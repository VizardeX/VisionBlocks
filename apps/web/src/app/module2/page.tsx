"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceSvg, Block as BlocklyBlock } from "blockly";
import { Blockly } from "@/lib/blockly";
import { toolboxJsonModule2 } from "@/components/toolboxModule2";
import OutputPanel, { type LogItem } from "@/components/OutputPanel";
import BaymaxPanel from "@/components/BaymaxPanel";
import { DarkTheme, LightTheme } from "@/lib/blockly/theme";

const API_BASE = "http://localhost:8000";

type SampleResponse = {
  dataset_key: string;
  index_used: number;
  label: string;
  image_data_url: string;
  path: string;
};

type ApplyResp = {
  dataset_key: string;
  path: string;
  before_data_url: string;
  after_data_url: string;
  after_shape: [number, number, number] | number[];
};

type BatchExportResp = {
  base_dataset: string;
  new_dataset_key: string;
  processed: number;
  classes: string[];
};

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** Convert a chain of Module 2 blocks into ops[] JSON for the API */
function blocksToOps(first: BlocklyBlock | null): any[] {
  const ops: any[] = [];
  let b: BlocklyBlock | null = first;
  while (b) {
    switch (b.type) {
      case "m2.reset_working":
        ops.push({ type: "reset" });
        break;

      case "m2.resize": {
        const mode = b.getFieldValue("MODE");
        if (mode === "size") {
          ops.push({
            type: "resize",
            mode: "size",
            w: Number(b.getFieldValue("W") || 256),
            h: Number(b.getFieldValue("H") || 256),
            keep: b.getFieldValue("KEEP"),
          });
        } else if (mode === "fit") {
          ops.push({
            type: "resize",
            mode: "fit",
            maxside: Number(b.getFieldValue("MAXSIDE") || 256),
          });
        } else {
          ops.push({
            type: "resize",
            mode: "scale",
            pct: Number(b.getFieldValue("PCT") || 100),
          });
        }
        break;
      }

      case "m2.crop_center":
        ops.push({
          type: "crop_center",
          w: Number(b.getFieldValue("W") || 224),
          h: Number(b.getFieldValue("H") || 224),
        });
        break;

      case "m2.pad":
        ops.push({
          type: "pad",
          w: Number(b.getFieldValue("W") || 256),
          h: Number(b.getFieldValue("H") || 256),
          mode: b.getFieldValue("MODE"),
          r: Number(b.getFieldValue("R") || 0),
          g: Number(b.getFieldValue("G") || 0),
          b: Number(b.getFieldValue("B") || 0),
        });
        break;

      case "m2.brightness_contrast":
        ops.push({
          type: "brightness_contrast",
          b: Number(b.getFieldValue("B") || 0),
          c: Number(b.getFieldValue("C") || 0),
        });
        break;

      case "m2.blur_sharpen":
        ops.push({
          type: "blur_sharpen",
          blur: Number(b.getFieldValue("BLUR") || 0),
          sharp: Number(b.getFieldValue("SHARP") || 0),
        });
        break;

      case "m2.edges":
        ops.push({
          type: "edges",
          method: b.getFieldValue("METHOD"),
          threshold: Number(b.getFieldValue("THRESH") || 100),
          overlay: b.getFieldValue("OVERLAY") === "TRUE",
        });
        break;

      case "m2.to_grayscale":
        ops.push({ type: "to_grayscale" });
        break;

      case "m2.normalize":
        ops.push({ type: "normalize", mode: b.getFieldValue("MODE") });
        break;

      // Analysis blocks do not change ops; they affect UI only.
      case "m2.show_working":
      case "m2.before_after":
      case "m2.shape":
        break;

      // Loop/export handled outside here
      case "m2.loop_dataset":
      case "m2.export_dataset":
        break;

      default:
        // ignore Module 1 blocks here
        break;
    }
    b = b.getNextBlock();
  }
  return ops;
}

function summarizeOps(ops: any[]): string[] {
  return ops.map((op) => {
    switch (op.type) {
      case "reset": return "Reset working image";
      case "resize":
        if (op.mode === "size") return `Resize to ${op.w}×${op.h} (keep=${op.keep})`;
        if (op.mode === "fit") return `Resize fit within ${op.maxside}`;
        return `Scale ${op.pct}%`;
      case "crop_center": return `Center crop ${op.w}×${op.h}`;
      case "pad":
        return `Pad ${op.w}×${op.h} (${op.mode}${op.mode === "constant" ? ` rgb(${op.r},${op.g},${op.b})` : ""})`;
      case "brightness_contrast": return `Brightness ${op.b}, Contrast ${op.c}`;
      case "blur_sharpen": return `Blur r=${op.blur}, Sharpen=${op.sharp}`;
      case "edges": return `Edges ${op.method} thr=${op.threshold} overlay=${op.overlay}`;
      case "to_grayscale": return "To grayscale";
      case "normalize": return `Normalize ${op.mode}`;
      default: return `Unknown op: ${op.type}`;
    }
  });
}

export default function Module2Page() {
  const blocklyDivRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<WorkspaceSvg | null>(null);

  const [logs, setLogs] = useState<LogItem[]>([]);
  const [baymaxLine, setBaymaxLine] = useState<string>("Preprocessing is like cleaning my glasses!");
  const [dark, setDark] = useState<boolean>(true);
  const [running, setRunning] = useState<boolean>(false);

  // Session memory for dataset + sample image path
  const datasetKeyRef = useRef<string | null>(null);
  const sampleRef = useRef<SampleResponse | null>(null);

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

  async function run(): Promise<void> {
    const ws = workspaceRef.current;
    if (!ws) return;

    setRunning(true);
    const newLogs: LogItem[] = [];

    try {
      // pass 1: walk blocks to set dataset and maybe sample
      const tops = ws.getTopBlocks(true) as BlocklyBlock[];

      datasetKeyRef.current = null;
      sampleRef.current = null;

      for (const top of tops) {
        let b: BlocklyBlock | null = top;
        while (b) {
          if (b.type === "dataset.select") {
            const key = b.getFieldValue("DATASET");
            datasetKeyRef.current = key;
            newLogs.push({ kind: "info", text: `[info] Using dataset: ${key}` });
          }

          if (b.type === "dataset.sample_image") {
            if (!datasetKeyRef.current) {
              newLogs.push({ kind: "warn", text: "Please add 'use dataset' before 'get sample image'." });
              break;
            }
            const mode = b.getFieldValue("MODE") as "random" | "index";
            const idxRaw = b.getFieldValue("INDEX");
            const idx = typeof idxRaw === "number" ? idxRaw : parseInt(String(idxRaw || 0), 10) || 0;
            const url = `${API_BASE}/datasets/${encodeURIComponent(datasetKeyRef.current!)}/sample?mode=${mode}${
              mode === "index" ? `&index=${idx}` : ""
            }`;
            const sample = await fetchJSON<SampleResponse>(url);
            sampleRef.current = sample;
            newLogs.push({
              kind: "preview",
              text:
                mode === "index"
                  ? `[preview] sample image loaded (index ${sample.index_used})`
                  : `[preview] sample image loaded (random index ${sample.index_used})`,
            });
          }

          if (b.type === "image.show") {
            if (!sampleRef.current) newLogs.push({ kind: "warn", text: "Get a sample image first, then 'show image'." });
            else {
              const title = (b.getFieldValue("TITLE") as string) || "Original";
              newLogs.push({
                kind: "image",
                src: sampleRef.current.image_data_url,
                caption: `${title} — label: ${sampleRef.current.label}`,
              });
            }
          }

          b = b.getNextBlock();
        }
      }

      // pass 2: find the first chain that contains any m2.* block, build ops and run /preprocess/apply
      let ranApply = false;
      for (const top of ws.getTopBlocks(true) as BlocklyBlock[]) {
        let chainHasM2 = false;
        for (let b: BlocklyBlock | null = top; b; b = b.getNextBlock()) {
          if (b.type.startsWith("m2.")) { chainHasM2 = true; break; }
        }
        if (!chainHasM2) continue;

        if (!datasetKeyRef.current || !sampleRef.current) {
          newLogs.push({ kind: "warn", text: "Add 'use dataset' and 'get sample image' before preprocessing." });
          break;
        }

        const ops = blocksToOps(top);
        const opsSummary = summarizeOps(ops);
        if (opsSummary.length) {
          newLogs.push({ kind: "card", title: "Pipeline", lines: opsSummary });
        }

        // check for analysis blocks in this chain to decide what to show
        let wantsBeforeAfter = false;
        let wantsShape = false;
        for (let b: BlocklyBlock | null = top; b; b = b.getNextBlock()) {
          if (b.type === "m2.before_after") wantsBeforeAfter = true;
          if (b.type === "m2.shape") wantsShape = true;
        }

        // call /preprocess/apply
        const applyBody = {
          dataset_key: datasetKeyRef.current,
          path: sampleRef.current.path,
          ops,
        };
        const applyResp = await fetchJSON<ApplyResp>(`${API_BASE}/preprocess/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(applyBody),
        });

        if (wantsBeforeAfter) {
          newLogs.push({
            kind: "images",
            items: [
              { src: applyResp.before_data_url, caption: "Before (original)" },
              { src: applyResp.after_data_url, caption: "After (processed)" },
            ],
          });
        } else {
          // If no before/after was requested, at least show the processed image
          newLogs.push({
            kind: "image",
            src: applyResp.after_data_url,
            caption: "Processed",
          });
        }

        if (wantsShape) {
          const [h, w, c] = applyResp.after_shape as [number, number, number];
          newLogs.push({
            kind: "card",
            title: "Working Image Shape",
            lines: [`Height: ${h}`, `Width: ${w}`, `Channels: ${c}`],
          });
        }

        ranApply = true;
        break; // run only the first m2 chain
      }

      // pass 3: loop + export (if present anywhere)
      for (const top of ws.getTopBlocks(true) as BlocklyBlock[]) {
        let b: BlocklyBlock | null = top;
        while (b) {
          if (b.type === "m2.loop_dataset") {
            if (!datasetKeyRef.current) {
              newLogs.push({ kind: "warn", text: "Add 'use dataset' before the loop block." });
              break;
            }
            // subset selection
            const subsetMode = b.getFieldValue("SUBSET"); // all | firstN | randomN
            const N = Number(b.getFieldValue("N") || 0);
            const shuffle = b.getFieldValue("SHUFFLE") === "TRUE";
            const K = Number(b.getFieldValue("K") || 10);

            // inner ops
            const inner = b.getInputTargetBlock("DO");
            const innerOps = blocksToOps(inner);
            const innerSummary = summarizeOps(innerOps);

            newLogs.push({
              kind: "card",
              title: "Loop",
              lines: [
                `Subset: ${subsetMode}${subsetMode !== "all" ? ` (N=${N})` : ""}`,
                `Shuffle: ${shuffle}`,
                `Progress every: ${K} images`,
                "Pipeline:",
                ...innerSummary.map((s) => `• ${s}`),
              ],
            });

            // find the following export block (we expect it after the loop)
            let cursor: BlocklyBlock | null = b.getNextBlock();
            let exportBlock: BlocklyBlock | null = null;
            while (cursor) {
              if (cursor.type === "m2.export_dataset") { exportBlock = cursor; break; }
              cursor = cursor.getNextBlock();
            }
            if (!exportBlock) {
              newLogs.push({ kind: "warn", text: "Add 'export processed dataset' after the loop to save results." });
              break;
            }

            const newName = exportBlock.getFieldValue("NAME") || "processed";
            const overwrite = exportBlock.getFieldValue("OVERWRITE") === "TRUE";

            // Call /preprocess/batch_export
            const body = {
              dataset_key: datasetKeyRef.current,
              subset: {
                mode: subsetMode,
                n: subsetMode === "all" ? null : N,
                shuffle,
              },
              ops: innerOps,
              new_dataset_name: newName,
              overwrite,
            };

            const resp = await fetchJSON<BatchExportResp>(`${API_BASE}/preprocess/batch_export`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });

            newLogs.push({
              kind: "card",
              title: "Export Complete",
              lines: [
                `New dataset: ${resp.new_dataset_key}`,
                `Images processed: ${resp.processed}`,
                `Classes: ${resp.classes.join(", ")}`,
              ],
            });
          }
          b = b.getNextBlock();
        }
      }

      if (!ranApply && newLogs.length === 0) {
        newLogs.push({
          kind: "warn",
          text: "Build a pipeline: use dataset → get sample image → reset → resize/pad/etc. → before/after (optional) → run.",
        });
      }

      setLogs(newLogs);
      setBaymaxLine("Nice! I can really see the difference after preprocessing.");
    } catch (e: any) {
      setLogs((prev) => [...prev, { kind: "error", text: `Run failed: ${e?.message || String(e)}` }]);
      setBaymaxLine("Oops—my lenses fogged up. Can you check your blocks?");
    } finally {
      setRunning(false);
    }
  }

  const appBg = dark ? "bg-neutral-950" : "bg-white";
  const barBg = dark ? "bg-neutral-900 border-neutral-800" : "bg-white border-gray-200";
  const barText = dark ? "text-neutral-100" : "text-gray-900";
  const rightBg = dark ? "bg-neutral-950 border-neutral-800" : "bg-gray-50 border-gray-200";

  return (
    <div
      className={`h-screen w-screen ${appBg}`}
      style={{
        display: "grid",
        gridTemplateColumns: `minmax(0, 1fr) 380px`,
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
            onClick={() => { if (!running) run(); }}
            className={`px-4 py-1.5 rounded-md ${running ? "opacity-60 cursor-not-allowed" : ""} bg-black text-white`}
            disabled={running}
          >
            {running ? "Running…" : "Run"}
          </button>
        </div>
      </div>

      {/* Workspace */}
      <div ref={blocklyDivRef} className={`relative min-h-0 ${dark ? "bg-neutral-950" : "bg-white"}`} />

      {/* Output + Baymax */}
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
