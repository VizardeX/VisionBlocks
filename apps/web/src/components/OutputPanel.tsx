"use client";
import { useEffect, useRef } from "react";

export type LogKind = "info" | "preview" | "warn" | "error" | "image" | "card" | "chart" | "images";

export type LogItem =
  | { kind: Exclude<LogKind, "image" | "card" | "chart" | "images">; text: string }
  | { kind: "image"; src: string; caption?: string }
  | { kind: "images"; items: { src: string; caption?: string }[] }
  | { kind: "card"; title: string; lines: string[] }
  | { kind: "chart"; title: string; data: { label: string; percent: number }[] };

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
  const textBase = dark ? "text-neutral-100" : "text-gray-900";

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between pb-2">
        <h2 className={`text-lg font-semibold ${textBase}`}>Output</h2>
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
          logs.map((item, i) => {
            if (item.kind === "image") {
              return (
                <figure key={i} className="mb-3">
                  <img src={item.src} alt={item.caption || "preview"} className="max-w-full rounded-md" />
                  {item.caption ? <figcaption className={`mt-1 text-xs ${textMuted}`}>{item.caption}</figcaption> : null}
                </figure>
              );
            }

            if (item.kind === "images") {
              return (
                <div key={i} className="mb-3 grid grid-cols-3 gap-2">
                  {item.items.map((p, idx) => (
                    <figure key={idx}>
                      <img src={p.src} alt={p.caption || "preview"} className="w-full rounded-md" />
                      {p.caption ? (
                        <figcaption className={`mt-1 text-[11px] ${textMuted}`}>{p.caption}</figcaption>
                      ) : null}
                    </figure>
                  ))}
                </div>
              );
            }

            if (item.kind === "card") {
              return (
                <div
                  key={i}
                  className={`mb-3 rounded-md ${dark ? "bg-neutral-800" : "bg-gray-50"} p-3 border ${
                    dark ? "border-neutral-600" : "border-gray-200"
                  }`}
                >
                  <div className={`text-sm font-semibold ${textBase}`}>{item.title}</div>
                  <ul className="mt-1 text-sm">
                    {item.lines.map((ln, idx) => (
                      <li key={idx} className={dark ? "text-neutral-200" : "text-gray-800"}>
                        {ln}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }

            if (item.kind === "chart") {
              return (
                <div
                  key={i}
                  className={`mb-3 rounded-md ${dark ? "bg-neutral-800" : "bg-gray-50"} p-3 border ${
                    dark ? "border-neutral-600" : "border-gray-200"
                  }`}
                >
                  <div className={`text-sm font-semibold ${textBase}`}>{item.title}</div>
                  <div className="mt-2 space-y-2">
                    {item.data.map((d, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between text-xs">
                          <span className={dark ? "text-neutral-200" : "text-gray-800"}>{d.label}</span>
                          <span className={textMuted}>{d.percent.toFixed(1)}%</span>
                        </div>
                        <div className={`h-2 rounded ${dark ? "bg-neutral-700" : "bg-gray-200"}`}>
                          <div
                            className="h-2 rounded"
                            style={{ width: `${Math.max(0, Math.min(100, d.percent))}%`, background: dark ? "#60a5fa" : "#2563eb" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            const cls =
              item.kind === "error"
                ? dark
                  ? "text-red-400"
                  : "text-red-600"
                : item.kind === "warn"
                ? dark
                  ? "text-amber-300"
                  : "text-amber-600"
                : item.kind === "preview"
                ? dark
                  ? "text-sky-300"
                  : "text-sky-700"
                : dark
                ? "text-neutral-100"
                : "text-gray-800";

            return (
              <div key={i} className="mb-2">
                <span className={cls}>{(item as any).text}</span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
