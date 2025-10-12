"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceSvg, Block as BlocklyBlock } from "blockly";
import * as BlocklyNS from "blockly";
import { Blockly } from "@/lib/blockly";
import { toolboxJson } from "@/components/toolbox";
import OutputPanel, { type LogItem } from "@/components/OutputPanel";
import BaymaxPanel from "@/components/BaymaxPanel";
import { DarkTheme, LightTheme } from "@/lib/blockly/theme";

// Baymax learner-style simulator
function simulateRun(workspace: WorkspaceSvg): { logs: LogItem[]; baymax: string } {
  const logs: LogItem[] = [];
  let baymax = "I don't know how to see yet. Can we start by choosing a dataset?";

  const tops = workspace.getTopBlocks(true) as BlocklyBlock[];

  for (const top of tops) {
    let b: BlocklyBlock | null = top;
    while (b) {
      const type = b.type;

      if (type === "dataset.select") {
        const ds = (b.getFieldValue("DATASET") as string) ?? "unknown";
        logs.push({ kind: "info", text: `[info] Using dataset: ${ds}` });
        baymax = `Okay… I picked ${ds}. What should we look at next?`;
      }

      if (type === "dataset.info") {
        logs.push({
          kind: "info",
          text: `[info] Dataset info -> name, image count, shape, classes`
        });
        baymax = "That gives me some clues. Maybe we can try a sample image?";
      }

      if (type === "dataset.classes") {
        logs.push({
          kind: "preview",
          text: `[classes] ["...class names from dataset..."]`
        });
        baymax = "Those are the kinds of things I need to learn to recognize.";
      }

      if (type === "dataset.sample_image") {
        const mode = b.getFieldValue("MODE") as string;
        const idx = b.getFieldValue("INDEX") ?? 0;
        logs.push({
          kind: "preview",
          text:
            mode === "index"
              ? `[preview] sample image loaded (index ${idx})`
              : `[preview] sample image loaded (random)`
        });
        logs.push({ kind: "preview", text: `[preview] label: "...label..."` });
        baymax = "I sense something! Can you show it to me?";
      }

      if (type === "image.show") {
        const title = (b.getFieldValue("TITLE") as string) || "Sample";
        logs.push({ kind: "preview", text: `[preview] image: ${title} shape=[H,W,C]` });
        baymax = "I can see the picture! What size is it?";
      }

      if (type === "image.shape") {
        logs.push({ kind: "info", text: `[shape] [H, W, C]` });
        baymax = "So that's the size. What does color look like to a computer?";
      }

      if (type === "image.channels_split") {
        logs.push({
          kind: "preview",
          text: `[preview] Showing Red / Green / Blue channel views`
        });
        baymax = "Oh! Colors are made of pieces. That's new to me!";
      }

      if (type === "image.to_grayscale_preview") {
        logs.push({ kind: "preview", text: `[preview] Grayscale view shown` });
        baymax = "This looks simpler. I think I'm beginning to get it.";
      }

      if (type === "label.show") {
        logs.push({ kind: "preview", text: `[preview] label: "...label..."` });
        baymax = "So that's what this picture is called. Interesting!";
      }

      if (type === "dataset.class_distribution_preview") {
        logs.push({
          kind: "preview",
          text: `[class_dist] {"classA": 100, "classB": 100, "...": 100}`
        });
        baymax = "If some classes are rare, that might be hard for me later.";
      }

      b = b.getNextBlock();
    }
  }

  if (logs.length === 0) {
    logs.push({
      kind: "warn",
      text: "No blocks to run. Try adding 'use dataset' and 'get sample image'."
    });
  }

  return { logs, baymax };
}

export default function Page() {
  const blocklyDivRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<WorkspaceSvg | null>(null);

  const [logs, setLogs] = useState<LogItem[]>([]);
  const [baymaxLine, setBaymaxLine] = useState<string>(
    "Hello… I don’t know how to see yet. Can you help me?"
  );
  const [dark, setDark] = useState<boolean>(true); // default to dark

  const sizes = useMemo(() => ({ rightWidth: 360 }), []);

  // Inject workspace once
  useEffect(() => {
    if (!blocklyDivRef.current) return;

    const workspace = Blockly.inject(blocklyDivRef.current, {
      toolbox: toolboxJson,
      renderer: "zelos",
      theme: dark ? DarkTheme : LightTheme,
      trashcan: true,
      scrollbars: true,
      zoom: { controls: true, wheel: true, startScale: 0.9 }
    });
    workspaceRef.current = workspace;

    workspace.clear();
    try {
      (workspace as any).scrollCenter?.();
    } catch {}

    return () => workspace.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocklyDivRef.current]);

  // Toggle theme live
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
        gridTemplateRows: "48px 1fr"
      }}
    >
      {/* Top bar */}
      <div className={`col-span-2 flex items-center justify-between px-3 border-b ${barBg}`}>
        <div className={`font-semibold ${barText}`}>Mission 1: Learn to See</div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setDark(!dark)}
            className={`px-3 py-1.5 rounded-md border ${
              dark
                ? "border-neutral-700 text-neutral-200 hover:bg-neutral-800"
                : "border-gray-300 text-gray-800 hover:bg-gray-50"
            }`}
            title="Toggle dark mode"
          >
            {dark ? "Light" : "Dark"}
          </button>

          <button
            onClick={() => {
              if (!workspaceRef.current) return;
              const result = simulateRun(workspaceRef.current);
              setLogs(result.logs);
              setBaymaxLine(result.baymax);
            }}
            className="px-4 py-1.5 rounded-md bg-black text-white"
          >
            Run
          </button>
        </div>
      </div>

      {/* Middle: Blockly workspace */}
      <div ref={blocklyDivRef} className={`relative ${dark ? "bg-neutral-950" : "bg-white"}`} />

      {/* Right: Output + Baymax */}
      <div className={`border-l p-3 flex flex-col gap-4 ${rightBg}`}>
        <OutputPanel logs={logs} onClear={() => setLogs([])} dark={dark} />
        <BaymaxPanel line={baymaxLine} dark={dark} />
      </div>
    </div>
  );
}
