/**
 * Graphics kit, FourBridges
 *
 * The signature "Four Bridges to AI Adoption" diagram: a deck carried by four
 * connected arch spans that build in left-to-right on scroll-reveal (piers
 * rise, arches draw, labels fade up), then a light "traveller" crosses the
 * deck on a slow loop. This is proprietary framework IP, keep the four stage
 * names in order.
 *
 * Deterministic geometry; four spans are fixed. Reduced motion: the whole
 * bridge renders complete and static, no traveller.
 *
 * CSS contract (globals.css, "Graphics kit" block):
 * - `.gfx-arch`: fully drawn by default (static fallback). Under no-preference,
 *   stroke-dashoffset draws the arc (gfxDraw) when `.scroll-reveal.revealed` is
 *   present; per-span delay via inline animationDelay.
 * - `.gfx-pier`: rises (gfxBarRise) under no-preference; static under reduce.
 * - `.gfx-span-label`: fades up (gfxFadeUp) under no-preference; static otherwise.
 * - `.gfx-traveller`: crosses the deck on a loop (reuses gfxPipePacket, distance
 *   via `--gfx-pipe-travel`); hidden under reduced motion.
 */

import ScrollReveal from "@/components/ScrollReveal";

export interface BridgeSpan {
  title: string;
  sub: string;
}

interface FourBridgesProps {
  spans?: BridgeSpan[];
  tone?: "light" | "dark";
  ariaLabel?: string;
  className?: string;
}

const DEFAULT_SPANS: BridgeSpan[] = [
  { title: "Design & explainability", sub: "make it legible" },
  { title: "Leadership & trust", sub: "bring people with you" },
  { title: "Operations & implementation", sub: "ship it into the day job" },
  { title: "Strategy & infrastructure", sub: "build for what's next" },
];

const VIEW_W = 640;
const VIEW_H = 284;
const DECK_Y = 150;
const WATER_Y = 202;
const M = 40; // side margin
const PEAK = 60; // arch rise above deck

// Span labels (esp. "Design & explainability", "Operations & implementation")
// are wider than a single 140-unit arch span at any font size that stays
// legible, so long titles/subs wrap onto two balanced lines rather than
// overlapping the neighbouring span.
function wrapBalanced(text: string): string[] {
  const words = text.split(" ");
  if (words.length === 1) return [text];
  let bestIndex = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const line1 = words.slice(0, i).join(" ");
    const line2 = words.slice(i).join(" ");
    const diff = Math.abs(line1.length - line2.length);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }
  return [words.slice(0, bestIndex).join(" "), words.slice(bestIndex).join(" ")];
}

// Only wrap once the text is actually too wide for a span slot at the given
// font size; short text stays on one (vertically centred) line.
function wrapIfNeeded(text: string, maxLineChars: number): string[] {
  return text.length > maxLineChars ? wrapBalanced(text) : [text];
}

export default function FourBridges({
  spans = DEFAULT_SPANS,
  tone = "dark",
  ariaLabel,
  className = "",
}: FourBridgesProps) {
  const n = spans.length; // 4
  const usable = VIEW_W - M * 2;
  const span = usable / n;
  const piers = Array.from({ length: n + 1 }, (_, i) => M + i * span);

  const label =
    ariaLabel ??
    `The Four Bridges to AI Adoption, in order: ${spans.map((s) => s.title).join(", ")}.`;
  const textOnCard = tone === "light" ? "var(--color-offwhite)" : "var(--color-navy)";
  const subColor = tone === "light" ? "var(--color-cyan)" : "var(--color-cyan-ink)";

  return (
    <ScrollReveal className={className}>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={label} data-gfx-loop className="w-full h-auto">
        {/* water line */}
        <line x1={M - 16} y1={WATER_Y} x2={VIEW_W - M + 16} y2={WATER_Y} stroke="var(--color-cyan)" strokeOpacity={0.25} strokeWidth={1.5} />

        {/* piers */}
        {piers.map((x, i) => (
          <rect
            key={`pier-${i}`}
            className="gfx-pier"
            x={x - 3}
            y={DECK_Y}
            width={6}
            height={WATER_Y - DECK_Y}
            rx={3}
            fill="var(--color-cyan)"
            fillOpacity={0.55}
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}

        {/* deck */}
        <line x1={M - 8} y1={DECK_Y} x2={VIEW_W - M + 8} y2={DECK_Y} stroke="var(--color-cyan)" strokeWidth={3} strokeLinecap="round" />

        {/* arch spans */}
        {spans.map((s, i) => {
          const x1 = piers[i];
          const x2 = piers[i + 1];
          const midX = (x1 + x2) / 2;
          return (
            <g key={`span-${i}`}>
              <path
                className="gfx-arch"
                d={`M ${x1} ${DECK_Y} Q ${midX} ${DECK_Y - PEAK * 2} ${x2} ${DECK_Y}`}
                fill="none"
                stroke="var(--color-cyan)"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeOpacity={0.85}
                style={{ animationDelay: `${0.15 + i * 0.22}s` }}
              />
              {/* numbered keystone at the arch peak */}
              <circle cx={midX} cy={DECK_Y - PEAK} r={14} fill="var(--color-navy)" stroke="var(--color-yellow)" strokeWidth={2} />
              <text x={midX} y={DECK_Y - PEAK + 5} textAnchor="middle" className="font-syne" fontSize={15} fontWeight={800} fill="var(--color-yellow)">
                {i + 1}
              </text>

              {/* span label under the deck, hidden on phones (scales sub-legible);
                  a real DOM list below the SVG carries these on <sm */}
              <g className="gfx-span-label max-sm:hidden" style={{ animationDelay: `${0.35 + i * 0.22}s` }}>
                {wrapIfNeeded(s.title, 17).map((line, li, arr) => (
                  <text
                    key={`title-${li}`}
                    x={midX}
                    y={WATER_Y + (arr.length === 1 ? 30 : 24 + li * 14)}
                    textAnchor="middle"
                    className="font-syne"
                    fontSize={12}
                    fontWeight={700}
                    fill={textOnCard}
                  >
                    {line}
                  </text>
                ))}
                {wrapIfNeeded(s.sub, 19).map((line, li, arr) => (
                  <text
                    key={`sub-${li}`}
                    x={midX}
                    y={WATER_Y + (arr.length === 1 ? 60 : 54 + li * 12)}
                    textAnchor="middle"
                    className="font-jetbrains"
                    fontSize={10.5}
                    fill={subColor}
                  >
                    {line}
                  </text>
                ))}
              </g>
            </g>
          );
        })}

        {/* traveller crossing the deck */}
        <g className="gfx-traveller" style={{ "--gfx-pipe-travel": `${usable}px` } as React.CSSProperties}>
          <circle cx={M} cy={DECK_Y - 7} r={5} fill="var(--color-yellow)" />
        </g>
      </svg>

      {/* Phone-legible labels: on <sm the in-SVG text scales to ~6px, so the
          four stages are carried here as a real, ordered DOM list under the
          arches-only diagram. Numbered badge mirrors the arch keystones. */}
      <ol className="sm:hidden mt-6 grid grid-cols-1 gap-3 list-none p-0">
        {spans.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="font-syne shrink-0 flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm font-extrabold"
              style={{
                backgroundColor: "var(--color-navy)",
                borderColor: "var(--color-yellow)",
                color: "var(--color-yellow)",
              }}
            >
              {i + 1}
            </span>
            <span>
              <span className="block font-syne text-base font-bold" style={{ color: textOnCard }}>
                {s.title}
              </span>
              <span className="block font-jetbrains text-xs mt-0.5" style={{ color: subColor }}>
                {s.sub}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </ScrollReveal>
  );
}
