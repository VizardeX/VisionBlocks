"use client";

export default function BaymaxPanel({ line, dark = false }: { line: string; dark?: boolean }) {
  const titleCls = dark ? "text-neutral-100" : "text-gray-900";
  const bubbleBg = dark
    ? "bg-sky-950/50 border-sky-900 text-sky-200"
    : "bg-sky-50 border-sky-100 text-sky-900";
  const hintCls = dark ? "text-neutral-400" : "text-gray-500";

  return (
    <div className="h-full flex flex-col gap-5">
      {/* Title */}
      <h2 className={`text-lg font-semibold ${titleCls}`}>Baymax</h2>

      {/* Baymax and his speech */}
      <div className="flex flex-col items-center justify-start">
        {/* Baymax image */}
        <img
          src="/baymax.png"
          alt="Baymax"
          className="w-60 h-60 object-contain select-none drop-shadow-2xl"
          draggable={false}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              "data:image/svg+xml;utf8," +
              encodeURIComponent(
                `<svg xmlns='http://www.w3.org/2000/svg' width='224' height='224'>
                   <rect width='100%' height='100%' fill='#111827'/>
                   <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
                         font-size='12' fill='#9ca3af'>Add /public/baymax.png</text>
                 </svg>`
              );
          }}
        />

        {/* Speech bubble */}
        <div className="mt-6 w-full flex justify-center">
          <div
            className={`rounded-2xl px-4 py-3 border ${bubbleBg} shadow-md text-center text-sm leading-relaxed`}
            style={{ maxWidth: "90%" }}
          >
            {line}
          </div>
        </div>
      </div>

    </div>
  );
}
