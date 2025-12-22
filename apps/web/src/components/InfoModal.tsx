"use client";

type InfoModalProps = {
  open: boolean;
  title?: string;
  text?: string;
  onClose: () => void;
  dark?: boolean;
};

export default function InfoModal({
  open,
  title,
  text,
  onClose,
  dark,
}: InfoModalProps) {
  if (!open) return null;

  const isDark = !!dark;

  // Turn "•" in the text into proper bullets for readability
  const raw = (text || "").trim();

  // Split the content into paragraphs (double-newline separated). This
  // preserves intentional spacing in the source text. We then detect the
  // paragraph(s) that contain bullet markers ("•") and render them as a
  // list, while keeping any paragraphs before/after the bullets as separate
  // paragraphs so blank lines show up in the UI.
  const paragraphs = raw
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  let introParagraphs: string[] = [];
  let bullets: string[] = [];
  let trailingParagraphs: string[] = [];

  const firstBulletIdx = paragraphs.findIndex((p) => p.includes("•"));
  if (firstBulletIdx === -1) {
    introParagraphs = paragraphs;
  } else {
    introParagraphs = paragraphs.slice(0, firstBulletIdx);

    // Collect consecutive paragraphs that contain bullets (usually one).
    let j = firstBulletIdx;
    const bulletParagraphs: string[] = [];
    while (j < paragraphs.length && paragraphs[j].includes("•")) {
      bulletParagraphs.push(paragraphs[j]);
      j++;
    }

    const combinedBulletText = bulletParagraphs.join("\n\n");
    bullets = combinedBulletText
      .split("•")
      .map((p) => p.trim())
      .filter(Boolean);

    trailingParagraphs = paragraphs.slice(j);
  }

  return (
    <>
      {/* subtle global animation for the glow */}
      <style jsx global>{`
        @keyframes vb-info-glow {
          0% {
            opacity: 0.6;
            transform: scale(0.99);
          }
          50% {
            opacity: 1;
            transform: scale(1.02);
          }
          100% {
            opacity: 0.6;
            transform: scale(0.99);
          }
        }
      `}</style>

      <div
        className="fixed inset-0 z-[100] flex items-center justify-center"
        aria-modal="true"
        role="dialog"
      >
        {/* backdrop */}
        <div
          className={`absolute inset-0 ${
            isDark ? "bg-black/70" : "bg-slate-900/40"
          } backdrop-blur-sm`}
          onClick={onClose}
        />

        {/* glowing card wrapper */}
        <div className="relative mx-4 w-full max-w-xl">
          {/* glow layer */}
          <div
            className={`
              pointer-events-none absolute -inset-[2px] rounded-[2rem]
              blur-xl opacity-90
              ${isDark
                ? "bg-gradient-to-r from-sky-500 via-emerald-400 to-violet-500"
                : "bg-gradient-to-r from-sky-400 via-teal-300 to-violet-400"}
              animate-[vb-info-glow_3s_ease-in-out_infinite]
            `}
          />

          {/* actual card */}
          <div
            className={`
              relative rounded-[1.8rem] p-6 md:p-7 border
              shadow-[0_22px_60px_rgba(15,23,42,0.55)]
              ${isDark
                ? "bg-slate-950/95 border-slate-700 text-slate-100"
                : "bg-slate-50/95 border-white/80 backdrop-blur-xl text-slate-900"}
            `}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span
                  className={`
                    inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase
                    ${isDark
                      ? "bg-sky-500/20 text-sky-200 border border-sky-500/40"
                      : "bg-sky-100 text-sky-700 border border-sky-300/70"}
                  `}
                >
                  Block guide
                </span>
                <h3 className="text-lg md:text-xl font-semibold leading-snug">
                  {title || "What does this block do?"}
                </h3>
              </div>

              <button
                onClick={onClose}
                className={`
                  mt-1 rounded-full px-3 py-1 text-xs font-medium
                  shadow-sm transition
                  ${
                    isDark
                      ? "bg-slate-900/80 text-slate-100 border border-slate-700 hover:bg-slate-800"
                      : "bg-white/90 text-slate-700 border border-slate-200 hover:bg-slate-100"
                  }
                `}
                aria-label="Close"
              >
                Close
              </button>
            </div>

            {/* intro paragraphs (preserve blank-line separation) */}
            {introParagraphs.length > 0 &&
              introParagraphs.map((p, i) => (
                <p
                  key={`intro-${i}`}
                  className={`
                    mt-4 text-sm leading-relaxed
                    ${isDark ? "text-slate-200" : "text-slate-700"}
                  `}
                >
                  {p}
                </p>
              ))}

            {/* bullet list if present */}
            {bullets.length > 0 && (
              <ul
                className={`
                  mt-4 space-y-2 text-sm leading-relaxed
                  ${isDark ? "text-slate-200" : "text-slate-700"}
                `}
              >
                {bullets.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span
                      className={`
                        mt-1 inline-flex h-2 w-2 rounded-full
                        ${isDark ? "bg-emerald-400" : "bg-emerald-500"}
                        shadow-[0_0_8px_rgba(16,185,129,0.8)]
                      `}
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* trailing paragraphs after bullets (preserve spacing) */}
            {trailingParagraphs.length > 0 &&
              trailingParagraphs.map((p, i) => (
                <p
                  key={`trail-${i}`}
                  className={`
                    mt-4 text-sm leading-relaxed
                    ${isDark ? "text-slate-200" : "text-slate-700"}
                  `}
                >
                  {p}
                </p>
              ))}
          </div>
        </div>
      </div>
    </>
  );
}
