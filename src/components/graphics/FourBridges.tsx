/**
 * Graphics kit — FourBridges
 *
 * The signature "Four Bridges to AI Adoption" diagram: a deck carried by four
 * connected arch spans that build in left-to-right on scroll-reveal (piers
 * rise, arches draw, labels fade up), then a light "traveller" crosses the
 * deck on a slow loop. This is proprietary framework IP — keep the four stage
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
const VIEW_H = 268;
const DECK_Y = 150;
const WATER_Y = 202;
const M = 40; // side margin
const PEAK = 60; // arch rise above deck

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
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={label} className="w-full h-auto">
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

              {/* span label under the deck */}
              <g className="gfx-span-label" style={{ animationDelay: `${0.35 + i * 0.22}s` }}>
                <text x={midX} y={WATER_Y + 26} textAnchor="middle" className="font-syne" fontSize={13} fontWeight={700} fill={textOnCard}>
                  {s.title}
                </text>
                <text x={midX} y={WATER_Y + 44} textAnchor="middle" className="font-jetbrains" fontSize={10.5} fill={subColor}>
                  {s.sub}
                </text>
              </g>
            </g>
          );
        })}

        {/* traveller crossing the deck */}
        <g className="gfx-traveller" style={{ "--gfx-pipe-travel": `${usable}px` } as React.CSSProperties}>
          <circle cx={M} cy={DECK_Y - 7} r={5} fill="var(--color-yellow)" />
        </g>
      </svg>
    </ScrollReveal>
  );
}
