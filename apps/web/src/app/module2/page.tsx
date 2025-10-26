"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceSvg, Block as BlocklyBlock } from "blockly";
import { Blockly, setDatasetOptions } from "@/lib/blockly";
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

type DatasetInfoResp = {
  key: string;
  name: string;
  description?: string | null;
  image_shape?: [number | null, number | null, number | null] | null;
  num_classes: number;
  classes: string[];
  approx_count: Record<string, number>;
  version?: string;
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

/** Pulls datasets from backend and updates the dataset.select dropdown options.
 *  Optionally nudges any dataset.select blocks to re-validate their current value. */
async function refreshDatasets(workspace?: WorkspaceSvg) {
  const data = await fetchJSON<{ items: { key: string; name: string }[] }>(
    `${API_BASE}/datasets`
  );
  // Update global options used by the field dropdown
  setDatasetOptions(data.items.map((i) => ({ name: i.name, key: i.key })));

  if (!workspace) return;

  // Nudge existing dataset.select blocks so their menu reflects latest options
  const blocks = workspace.getAllBlocks(false);
  const validKeys = new Set(data.items.map((i) => i.key));
  for (const b of blocks) {
    if (b.type === "dataset.select") {
      const field = b.getField("DATASET") as any;
      const cur = field?.getValue?.();
      if (cur && !validKeys.has(cur) && data.items.length > 0) {
        field.setValue(data.items[0].key); // fallback to first dataset
      } else {
        field?.setValue(cur); // nudge to rebuild menu with new options
      }
    }
  }
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

      // Analysis-only blocks (UI effects)
      case "m2.show_working":
      case "m2.before_after":
      case "m2.shape":
        break;

      // Loop/export handled separately
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
      case "reset":
        return "Reset working image";
      case "resize":
        if (op.mode === "size")
          return `Resize to ${op.w}×${op.h} (keep=${op.keep})`;
        if (op.mode === "fit") return `Resize fit within ${op.maxside}`;
        return `Scale ${op.pct}%`;
      case "crop_center":
        return `Center crop ${op.w}×${op.h}`;
      case "pad":
        return `Pad ${op.w}×${op.h} (${op.mode}${
          op.mode === "constant" ? ` rgb(${op.r},${op.g},${op.b})` : ""
        })`;
      case "brightness_contrast":
        return `Brightness ${op.b}, Contrast ${op.c}`;
      case "blur_sharpen":
        return `Blur r=${op.blur}, Sharpen=${op.sharp}`;
      case "edges":
        return `Edges ${op.method} thr=${op.threshold} overlay=${op.overlay}`;
      case "to_grayscale":
        return "To grayscale";
      case "normalize":
        return `Normalize ${op.mode}`;
      default:
        return `Unknown op: ${op.type}`;
    }
  });
}

function labelOp(op: any): string {
  switch (op.type) {
    case "reset": return "Reset";
    case "resize":
      if (op.mode === "size") return `Resize ${op.w}×${op.h}`;
      if (op.mode === "fit") return `Resize (fit ≤${op.maxside})`;
      return `Scale ${op.pct}%`;
    case "crop_center": return `Center crop ${op.w}×${op.h}`;
    case "pad":
      return `Pad ${op.w}×${op.h}${op.mode === "constant" ? ` (rgb ${op.r},${op.g},${op.b})` : ` (${op.mode})`}`;
    case "brightness_contrast": return `Brightness ${op.b}, Contrast ${op.c}`;
    case "blur_sharpen": return `Blur r=${op.blur}, Sharpen=${op.sharp}`;
    case "edges": return `Edges ${op.method} thr=${op.threshold}${op.overlay ? " (overlay)" : ""}`;
    case "to_grayscale": return "Grayscale";
    case "normalize": return `Normalize ${op.mode}`;
    default: return op.type;
  }
}


export default function Module2Page() {
  const blocklyDivRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<WorkspaceSvg | null>(null);

  const [logs, setLogs] = useState<LogItem[]>([]);
  const [baymaxLine, setBaymaxLine] = useState<string>(
    "Preprocessing is like cleaning my glasses!"
  );
  const [dark, setDark] = useState<boolean>(true);
  const [running, setRunning] = useState<boolean>(false);

  // Session memory for dataset + sample image path
  const datasetKeyRef = useRef<string | null>(null);
  const sampleRef = useRef<SampleResponse | null>(null);

  // Live preview bookkeeping
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPreviewSigRef = useRef<string>(""); // JSON signature of {ds, sample spec, ops}

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
    try {
      (ws as any).scrollCenter?.();
    } catch {}

    // Load datasets into the dropdown on mount
    refreshDatasets(ws).catch(() => {});

    // LIVE PREVIEW: on-change listener, debounced
    const onChange = (evt: any) => {
      // Safely detect UI-only events (viewport moves, toolbox selection, theme, etc.)
      const E = (Blockly as any).Events;
      const uiTypes = new Set([
        E.UI,                 // generic UI
        E.CLICK,              // workspace clicks
        E.VIEWPORT_CHANGE,
        E.TOOLBOX_ITEM_SELECT,
        E.THEME_CHANGE,
        E.BUBBLE_OPEN,
        E.TRASHCAN_OPEN,
        E.SELECTED,
      ]);

      if (evt && evt.type && uiTypes.has(evt.type)) {
        return; // ignore UI-only events
      }

      if (previewTimer.current) clearTimeout(previewTimer.current);
      previewTimer.current = setTimeout(() => {
        livePreview().catch((e) => {
          setLogs((prev) => [
            ...prev,
            { kind: "error", text: `Live preview failed: ${e?.message || String(e)}` },
          ]);
        });
      }, 400); // debounce
    };

    ws.addChangeListener(onChange);

    return () => {
      ws.removeChangeListener(onChange);
      ws.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocklyDivRef.current]);

  useEffect(() => {
    if (!workspaceRef.current) return;
    workspaceRef.current.setTheme(dark ? DarkTheme : LightTheme);
  }, [dark]);

  async function livePreview(): Promise<void> {
    const ws = workspaceRef.current;
    if (!ws) return;
    

    // Find dataset/sample and the first chain that contains any m2.* block
    let dsKey: string | null = null;
    let sampleMode: "random" | "index" | null = null;
    let sampleIndex = 0;
    let previewChain: BlocklyBlock | null = null;

    const tops = ws.getTopBlocks(true) as BlocklyBlock[];
    for (const top of tops) {
      for (let b: BlocklyBlock | null = top; b; b = b.getNextBlock()) {
        if (b.type === "dataset.select" && !dsKey) dsKey = b.getFieldValue("DATASET");
        if (b.type === "dataset.sample_image" && sampleMode === null) {
          const mode = b.getFieldValue("MODE") as "random" | "index";
          sampleMode = mode;
          const idxRaw = b.getFieldValue("INDEX");
          sampleIndex = typeof idxRaw === "number" ? idxRaw : parseInt(String(idxRaw || 0), 10) || 0;
        }
        if (!previewChain && b.type.startsWith("m2.")) previewChain = top;
      }
    }

    if (!previewChain) return;                  // nothing to preview
    if (!dsKey || !sampleMode) {                // missing setup
      setLogs((prev) => [...prev, { kind: "warn", text: "Add 'use dataset' and 'get sample image' to see live preview." }]);
      return;
    }

    // Build full ops and a cumulative plan
    const fullOps = blocksToOps(previewChain);

    // Signature to avoid re-running if nothing material changed
    const sig = JSON.stringify({ dsKey, sample: { mode: sampleMode, index: sampleIndex }, ops: fullOps });
    if (sig === lastPreviewSigRef.current) return;
    lastPreviewSigRef.current = sig;

    // Ensure we have a sample matching the spec
    if (
      !sampleRef.current ||
      sampleRef.current.dataset_key !== dsKey ||
      (sampleMode === "index" && sampleRef.current.index_used !== sampleIndex)
    ) {
      const url = `${API_BASE}/datasets/${encodeURIComponent(dsKey)}/sample?mode=${sampleMode}${
        sampleMode === "index" ? `&index=${sampleIndex}` : ""
      }`;
      const sample = await fetchJSON<SampleResponse>(url);
      datasetKeyRef.current = dsKey;
      sampleRef.current = sample;
    } else {
      datasetKeyRef.current = dsKey;
    }

    // Determine if user asked for shape card (we’ll show final shape)
    let wantsShape = false;
    for (let b: BlocklyBlock | null = previewChain; b; b = b.getNextBlock()) {
      if (b.type === "m2.shape") wantsShape = true;
    }

    // STEPWISE PREVIEW:
    // Start with Original, then apply cumulative ops, capturing each step’s output.
    const gallery: { src: string; caption: string }[] = [];
    gallery.push({ src: sampleRef.current.image_data_url, caption: "Original" });

    const cumulative: any[] = [];
    let lastAfter: ApplyResp | null = null;

    for (const op of fullOps) {
      cumulative.push(op);

      // Apply up to this op
      const body = {
        dataset_key: dsKey,
        path: sampleRef.current.path,
        ops: cumulative,
      };
      const stepResp = await fetchJSON<ApplyResp>(`${API_BASE}/preprocess/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // Add this step’s image
      gallery.push({
        src: stepResp.after_data_url,
        caption: labelOp(op),
      });

      lastAfter = stepResp;
    }

    // Compose OutputPanel logs: compact pipeline summary + gallery + optional shape
    const newLogs: LogItem[] = [];
    const summary = summarizeOps(fullOps);
    if (summary.length) newLogs.push({ kind: "card", title: "Pipeline (live)", lines: summary });

    // Show the whole evolution vertically (Original + each step)
    for (const it of gallery) {
      newLogs.push({ kind: "image", src: it.src, caption: it.caption });
    }

    if (wantsShape && lastAfter) {
      const [h, w, c] = lastAfter.after_shape as [number, number, number];
      newLogs.push({ kind: "card", title: "Final Shape", lines: [`Height: ${h}`, `Width: ${w}`, `Channels: ${c}`] });
    }

    setLogs(newLogs);
    setBaymaxLine("Each block’s effect is shown step-by-step!");
  }


  /** Manual run: keeps loop/export behavior (dataset-wide ops) */
  async function run(): Promise<void> {
    const ws = workspaceRef.current;
    if (!ws) return;

    setRunning(true);
    const newLogs: LogItem[] = [];

    try {
      // pass 1: walk blocks to handle dataset.* / info / counts / sample & image.show
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

          if (b.type === "dataset.info") {
            if (!datasetKeyRef.current) {
              newLogs.push({ kind: "warn", text: "Add 'use dataset' before 'dataset info'." });
            } else {
              const info = await fetchJSON<DatasetInfoResp>(`${API_BASE}/datasets/${encodeURIComponent(datasetKeyRef.current)}/info`);
              const lines: string[] = [
                `Name: ${info.name}`,
                `Classes: ${info.classes.join(", ") || "(none)"}`,
              ];
              newLogs.push({ kind: "card", title: "Dataset Info", lines });
            }
          }

          if (b.type === "dataset.class_counts") {
            if (!datasetKeyRef.current) {
              newLogs.push({ kind: "warn", text: "Add 'use dataset' before 'class counts'." });
            } else {
              const info = await fetchJSON<DatasetInfoResp>(`${API_BASE}/datasets/${encodeURIComponent(datasetKeyRef.current)}/info`);
              const lines = Object.entries(info.approx_count || {}).map(
                ([cls, n]) => `${cls}: ${n}`
              );
              newLogs.push({ kind: "card", title: "Class Counts", lines: lines.length ? lines : ["(no images)"] });
            }
          }

          if (b.type === "dataset.class_distribution_preview") {
            if (!datasetKeyRef.current) {
              newLogs.push({ kind: "warn", text: "Add 'use dataset' before 'class distribution preview'." });
            } else {
              const info = await fetchJSON<DatasetInfoResp>(`${API_BASE}/datasets/${encodeURIComponent(datasetKeyRef.current)}/info`);
              const total = Object.values(info.approx_count || {}).reduce((a, b) => a + b, 0);
              const lines =
                total > 0
                  ? info.classes.map((cls) => {
                      const n = info.approx_count?.[cls] ?? 0;
                      const pct = ((n / total) * 100).toFixed(1);
                      return `${cls}: ${pct}%`;
                    })
                  : ["(no images)"];
              newLogs.push({ kind: "card", title: "Class Distribution (%)", lines });
            }
          }

          if (b.type === "dataset.sample_image") {
            if (!datasetKeyRef.current) {
              newLogs.push({
                kind: "warn",
                text: "Please add 'use dataset' before 'get sample image'.",
              });
              break;
            }
            const mode = b.getFieldValue("MODE") as "random" | "index";
            const idxRaw = b.getFieldValue("INDEX");
            const idx =
              typeof idxRaw === "number"
                ? idxRaw
                : parseInt(String(idxRaw || 0), 10) || 0;
            const url = `${API_BASE}/datasets/${encodeURIComponent(
              datasetKeyRef.current!
            )}/sample?mode=${mode}${mode === "index" ? `&index=${idx}` : ""}`;
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
            if (!sampleRef.current)
              newLogs.push({
                kind: "warn",
                text: "Get a sample image first, then 'show image'.",
              });
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

      // pass 2: dataset-wide operations (loop + export)
      for (const top of ws.getTopBlocks(true) as BlocklyBlock[]) {
        let b: BlocklyBlock | null = top;
        while (b) {
          if (b.type === "m2.loop_dataset") {
            if (!datasetKeyRef.current) {
              newLogs.push({
                kind: "warn",
                text: "Add 'use dataset' before the loop block.",
              });
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
              if (cursor.type === "m2.export_dataset") {
                exportBlock = cursor;
                break;
              }
              cursor = cursor.getNextBlock();
            }
            if (!exportBlock) {
              newLogs.push({
                kind: "warn",
                text: "Add 'export processed dataset' after the loop to save results.",
              });
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

            const resp = await fetchJSON<BatchExportResp>(
              `${API_BASE}/preprocess/batch_export`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              }
            );

            newLogs.push({
              kind: "card",
              title: "Export Complete",
              lines: [
                `New dataset: ${resp.new_dataset_key}`,
                `Images processed: ${resp.processed}`,
                `Classes: ${resp.classes.join(", ")}`,
              ],
            });

            // repopulate the dataset dropdown so the new dataset shows up immediately
            await refreshDatasets(workspaceRef.current);
          }
          b = b.getNextBlock();
        }
      }

      if (newLogs.length === 0) {
        newLogs.push({
          kind: "warn",
          text:
            "Use Run for dataset-wide actions (loop + export). Live preview handles the sample image automatically.",
        });
      }

      setLogs((prev) => [...prev, ...newLogs]);
      setBaymaxLine("Dataset actions completed.");
    } catch (e: any) {
      setLogs((prev) => [
        ...prev,
        { kind: "error", text: `Run failed: ${e?.message || String(e)}` },
      ]);
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
        gridTemplateColumns: `minmax(0, 1fr) ${sizes.rightWidth}px`,
        gridTemplateRows: "48px 1fr",
      }}
    >
      {/* Top bar */}
      <div className={`col-span-2 flex items-center justify-between px-3 border-b ${barBg}`}>
        <div className={`font-semibold ${barText}`}>VisionBlocks — Module 2: Image Preprocessing</div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => refreshDatasets(workspaceRef.current)}
            className={`px-3 py-1.5 rounded-md border ${
              dark ? "border-neutral-700 text-neutral-200 hover:bg-neutral-800" : "border-gray-300 text-gray-800 hover:bg-gray-50"
            }`}
            title="Reload dataset list"
          >
            Refresh datasets
          </button>

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
