"use client";

import { useState } from "react";
import DrawerNav from "@/components/DrawerNav";

export default function Module2Page() {
  const [dark, setDark] = useState(true);
  const [open, setOpen] = useState(false);

  const appBg = dark ? "bg-neutral-950" : "bg-white";
  const barBg = dark ? "bg-neutral-900 border-neutral-800" : "bg-white border-gray-200";
  const barText = dark ? "text-neutral-100" : "text-gray-900";
  const panelBg = dark ? "bg-neutral-900 border-neutral-800" : "bg-white border-gray-200";
  const subText = dark ? "text-neutral-400" : "text-gray-600";

  return (
    <div
      className={`h-screen w-screen ${appBg}`}
      style={{
        display: "grid",
        gridTemplateRows: "48px 1fr",
      }}
    >
      {/* Top bar */}
      <div className={`flex items-center justify-between px-3 border-b ${barBg}`}>
        <div className={`font-semibold ${barText}`}>VisionBlocks — Module 2: Image Preprocessing</div>
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
            onClick={() => setOpen(true)}
            className={`px-3 py-1.5 rounded-md border ${
              dark
                ? "border-neutral-700 text-neutral-200 hover:bg-neutral-800"
                : "border-gray-300 text-gray-800 hover:bg-gray-50"
            }`}
            title="Open menu"
          >
            Menu
          </button>
        </div>
      </div>

      {/* Content scaffold */}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className={`rounded-xl border ${panelBg} p-4`}>
          <h2 className={`text-lg font-semibold ${barText}`}>Mission: Clean & Prepare</h2>
          <p className={`${subText} mt-2 text-sm`}>
            In this module, you’ll explore resizing, normalization, and basic augmentations.
            We’ll add the block workspace and live previews here next.
          </p>

          <ul className={`mt-3 text-sm ${subText} list-disc list-inside`}>
            <li>Load a sample image (from Module 1 dataset).</li>
            <li>Resize to a target size (e.g., 224×224).</li>
            <li>Normalize pixel values (0–1), visualize histogram.</li>
          </ul>
        </section>

        <section className={`rounded-xl border ${panelBg} p-4`}>
          <h2 className={`text-lg font-semibold ${barText}`}>Preview</h2>
          <div className="mt-3 text-sm">
            This preview area will show:
            <ul className="list-disc list-inside">
              <li className={subText}>Original vs Resized</li>
              <li className={subText}>Grayscale vs Color</li>
              <li className={subText}>Normalization effects</li>
            </ul>
          </div>
        </section>
      </div>

      <DrawerNav open={open} onClose={() => setOpen(false)} dark={dark} />
    </div>
  );
}
