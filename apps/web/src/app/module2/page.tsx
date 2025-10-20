"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceSvg, Block as BlocklyBlock } from "blockly";
import { Blockly } from "@/lib/blockly";
import { toolboxJsonModule2 } from "@/components/toolboxModule2";
import OutputPanel, { type LogItem } from "@/components/OutputPanel";
import BaymaxPanel from "@/components/BaymaxPanel";
import { DarkTheme, LightTheme } from "@/lib/blockly/theme";

const API_BASE = "http://localhost:8000";

type DatasetInfo = {
  key: string;
  name: string;
  classes: string[];
  approx_count: Record<string, number>;
};

type SampleResponse = {
  dataset_key: string;
  index_used: number;
  label: string;
  image_data_url: string;
  path?: string;
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function summarizePipeline(block: BlocklyBlock): string[] {
  // Walk a chain and summarize Module 2 operations.
  const steps: string[] = [];
  let b: BlocklyBlock | null = block;
  while (b) {
    switch (b.type) {
      case "m2.reset_working":
        steps.push("Reset working image");
        break;
      case "m2.resize": {
        const mode = b.getFieldValue("MODE");
        if (mode === "size") {
          steps.push(`Resize to ${b.getFieldValue("W")}×${b.getFieldValue("H")} (keep=${b.getFieldValue("KEEP")})`);
        } else if (mode === "fit") {
          steps.push(`Resize fit within ${b.getFieldValue("MAXSIDE")}`);
        } else {
          steps.push(`Scale ${b.getFieldValue("PCT")}%`);
        }
        break;
      }
      case "m2.crop_center":
        steps.push(`Center crop ${b.getFieldValue("W")}×${b.getFieldValue("H")}`);
        break;
      case "m2.pad":
        steps.push(
          `Pad to ${b.getFieldValue("W")}×${b.getFieldValue("H")} (${b.getFieldValue("MODE")}${
            b.getFieldValue("MODE") === "constant"
              ? ` rgb(${b.getFieldValue("R")},${b.getFieldValue("G")},${b.getFieldValue("B")})`
              : ""
          })`
        );
        break;
      case "m2.brightness_contrast":
        steps.push(`Brightness ${b.getFieldValue("B")}, Contrast ${b.getFieldValue("C")}`);
        break;
      case "m2.blur_sharpen":
        steps.push(`Blur r=${b.getFieldValue("BLUR")}, Sharpen=${b.getFieldValue("SHARP")}`);
        break;
      case "m2.edges":
        steps.push(
          `Edges ${b.getFieldValue("METHOD")} thr=${b.getFieldValue("THRESH")} overlay=${b.getFieldValue("OVERLAY")}`
        );
        break;
      case "m2.to_grayscale":
        steps.push("To grayscale");
        break;
      case "m2.normalize":
        steps.push(`Normalize ${b.getFieldValue("MODE")}`);
        break;
      case "m2.show_working":
        steps.push(`Show working (“${b.getFieldValue("TITLE") || "Processed"}”)`);
        break;
      case "m2.before_after":
        steps.push("Show before/after");
        break;
      case "m2.shape":
        steps.push("Show working shape");
        break;
      case "m2.loop_dataset": {
        const subset = b.getFieldValue("SUBSET");
        const nVal = b.getFieldValue("N");
        const k = b.getFieldValue("K");
        const shuffle = b.getFieldValue("SHUFFLE");
        steps.push(
          `For each image (subset=${subset}${subset !== "all" ? `, N=${nVal}` : ""}, shuffle=${shuffle}, every ${k}) { … }`
        );
        // summarize inner
        const inner = b.getInputTargetBlock("DO");
        if (inner) {
          const innerSteps = summarizePipeline(inner).map((s) => `  - ${s}`);
          steps.push(...innerSteps);
        }
        break;
      }
      case "m2.export_dataset":
        steps.push(
          `Export name="${b.getFieldValue("NAME")}", format=${b.getFieldValue("FORMAT")}${
            b.getFieldValue("FORMAT") === "jpeg" ? `, q=${b.getFieldValue("QUALITY")}` : ""
          }, overwrite=${b.getFieldValue("OVERWRITE")}`
        );
        break;
      default:
        // ignore other categories from module 1
        break;
    }
    b = b.getNextBlock();
  }
  return steps;
}

async function runWorkspaceM2(workspace: WorkspaceSvg): Promise<{ logs: LogItem[]; baymax: string }> {
  const logs: LogItem[] = [];
  let baymax = "Okay! I’m ready to clean images. What should we do first?";

  let datasetKey: string | null = null;
  let lastSample: SampleResponse | null = null;

  const tops = workspace.getTopBlocks(true) as BlocklyBlock[];

  for (const top of tops) {
    let b: BlocklyBlock | null = top;

    // Handle Dataset + sampling exactly like Module 1 so we can at least show an image
    while (b) {
      if (b.type === "dataset.select") {
        datasetKey = (b.getFieldValue("DATASET") as string) ?? null;
        logs.push({ kind: "info", text: `[info] Using dataset: ${datasetKey}` });
      }

      if (b.type === "dataset.sample_image") {
        if (!datasetKey) {
          logs.push({ kind: "warn", text: "Please add 'use dataset' before 'get sample image'." });
        } else {
          const mode = (b.getFieldValue("MODE") as string) as "random" | "index";
          const idxRaw = b.getFieldValue("INDEX");
          const idx = typeof idxRaw === "number" ? idxRaw : parseInt(String(idxRaw || 0), 10) || 0;
          const url = `${API_BASE}/datasets/${encodeURIComponent(datasetKey)}/sample?mode=${mode}${
            mode === "index" ? `&index=${idx}` : ""
          }`;
          lastSample = await fetchJSON<SampleResponse>(url);
          logs.push({
            kind: "preview",
            text:
              mode === "index"
                ? `[preview] sample image loaded (index ${lastSample.index_used})`
                : `[preview] sample image loaded (random index ${lastSample.index_used})`,
          });
        }
      }

      if (b.type === "image.show") {
        if (!lastSample) {
          logs.push({ kind: "warn", text: "Get a sample image first, then 'show image'." });
        } else {
          const title = (b.getFieldValue("TITLE") as string) || "Original";
          logs.push({ kind: "image", src: lastSample.image_data_url, caption: `${title} — label: ${lastSample.label}` });
        }
      }

      // Module 2 pipeline blocks: for now, we summarize steps & show placeholders
      if (b.type.startsWith("m2.")) {
        const steps = summarizePipeline(b);
        logs.push({ kind: "card", title: "Planned Pipeline", lines: steps });

        // Placeholder before/after:
        if (lastSample) {
          logs.push({
            kind: "images",
            items: [
              { src: lastSample.image_data_url, caption: "Before (original)" },
              { src: lastSample.image_data_url, caption: "After (preview coming)" },
            ],
          });
        } else {
          logs.push({ kind: "warn", text: "No sample image yet — add 'get sample image' to see previews." });
        }

        // Skip ahead: we don't re-run the rest of the chain after summarizing this top block
        break;
      }

      b = b.getNextBlock();
    }
  }

  if (logs.length === 0) {
    logs.push({
      kind: "warn",
      text: "Add blocks: use dataset → get sample image → reset working image → resize/pad/etc. → show before/after",
    });
  }

  return { logs, baymax };
}

export default function Module2Page() {
  const blocklyDivRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<WorkspaceSvg | null>(null);

  const [logs, setLogs] = useState<LogItem[]>([]);
  const [baymaxLine, setBaymaxLine] = useState<string>("Preprocessing is like cleaning my glasses!");
  const [dark, setDark] = useState<boolean>(true);
  const [running, setRunning] = useState<boolean>(false);

  const sizes = useMemo(() => ({ rightWidth: 380 }), []);

  useEffect(() => {
    if (!blocklyDivRef.current) return;

    const ws = Blockly.inject(blocklyDivRef.current, {
      toolbox: toolboxJsonModule2,
      renderer: "zelos",
      theme: dark ? DarkTheme : LightTheme,
      trashcan: true,
      scrollbars: true,
      zoom: { controls: true, wheel: true, startScale: 0.9 },
    });
    workspaceRef.current = ws;

    ws.clear();
    try { (ws as any).scrollCenter?.(); } catch {}

    return () => ws.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocklyDivRef.current]);

  useEffect(() => {
    if (!workspaceRef.current) return;
    workspaceRef.current.setTheme(dark ? DarkTheme : LightTheme);
  }, [dark]);

  const appBg = dark ? "bg-neutral-950" : "bg-white";
  const barBg = dark ? "bg-neutral-900 border-neutral-800" : "bg-white border-gray-200";
  const barText = dark ? "text-neutral-100" : "text-gray-900";
  const rightBg = dark ? "bg-neutral-950 border-neutral-800" : "bg-gray-50 border-gray-200";

  return (
    <div
      className={`h-screen w-screen ${appBg}`}
      style={{
        display: "grid",
        gridTemplateColumns: `minmax(0, 1fr) ${sizes.rightWidth}px`,
        gridTemplateRows: "48px 1fr",
      }}
    >
      {/* Top bar */}
      <div className={`col-span-2 flex items-center justify-between px-3 border-b ${barBg}`}>
        <div className={`font-semibold ${barText}`}>VisionBlocks — Module 2: Image Preprocessing</div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setDark(!dark)}
            className={`px-3 py-1.5 rounded-md border ${
              dark ? "border-neutral-700 text-neutral-200 hover:bg-neutral-800" : "border-gray-300 text-gray-800 hover:bg-gray-50"
            }`}
            title="Toggle dark mode"
          >
            {dark ? "Light" : "Dark"}
          </button>

          <button
            onClick={async () => {
              if (!workspaceRef.current || running) return;
              setRunning(true);
              setLogs((prev) => [...prev, { kind: "info", text: "Running..." }]);
              try {
                const result = await runWorkspaceM2(workspaceRef.current);
                setLogs(result.logs);
                setBaymaxLine(result.baymax);
              } catch (e: any) {
                setLogs((prev) => [...prev, { kind: "error", text: `Run failed: ${e?.message || String(e)}` }]);
              } finally {
                setRunning(false);
              }
            }}
            className={`px-4 py-1.5 rounded-md ${running ? "opacity-60 cursor-not-allowed" : ""} bg-black text-white`}
            disabled={running}
          >
            {running ? "Running…" : "Run"}
          </button>
        </div>
      </div>

      {/* Middle: Blockly workspace */}
      <div ref={blocklyDivRef} className={`relative min-h-0 ${dark ? "bg-neutral-950" : "bg-white"}`} />

      {/* Right: Output + Baymax */}
      <div className={`border-l p-3 flex flex-col gap-4 min-h-0 ${rightBg}`}>
        <div className="h-[40vh]">
          <OutputPanel logs={logs} onClear={() => setLogs([])} dark={dark} />
        </div>
        <div className="flex-1 min-h-0">
          <BaymaxPanel line={baymaxLine} dark={dark} />
        </div>
      </div>
    </div>
  );
}
