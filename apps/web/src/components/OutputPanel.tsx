"use client";
import { useEffect, useRef } from "react";

export type LogItem = { kind: "info" | "preview" | "warn" | "error"; text: string };

export default function OutputPanel({
  logs,
  onClear,
  dark = false,
}: {
  logs: LogItem[];
  onClear: () => void;
  dark?: boolean;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  const panelBg = dark ? "bg-neutral-900 border-neutral-700" : "bg-white border-gray-200";
  const textMuted = dark ? "text-neutral-400" : "text-gray-500";

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between pb-2">
        <h2 className={`text-lg font-semibold ${dark ? "text-neutral-100" : "text-gray-900"}`}>
          Output
        </h2>
        <button
          onClick={onClear}
          className={`text-sm px-3 py-1 rounded-md border ${
            dark
              ? "border-neutral-600 text-neutral-200 hover:bg-neutral-800"
              : "border-gray-300 text-gray-800 hover:bg-gray-50"
          }`}
        >
          Clear
        </button>
      </div>

      <div className={`flex-1 rounded-md border ${panelBg} p-3 overflow-auto`}>
        {logs.length === 0 ? (
          <p className={textMuted}>Run your blocks to see results here.</p>
        ) : (
          logs.map((l, i) => {
            const cls =
              l.kind === "error"
                ? dark ? "text-red-400" : "text-red-600"
                : l.kind === "warn"
                ? dark ? "text-amber-300" : "text-amber-600"
                : l.kind === "preview"
                ? dark ? "text-sky-300" : "text-sky-700"
                : dark ? "text-neutral-100" : "text-gray-800";
            return (
              <div key={i} className="mb-2">
                <span className={cls}>{l.text}</span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
