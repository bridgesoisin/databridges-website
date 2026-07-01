/**
 * Graphics kit — RankBars
 *
 * Bar chart whose bars rise into place when scrolled into view, modelled on
 * the /seo-aeo hero rank bars. Wraps itself in ScrollReveal so the rise
 * triggers on `.revealed`.
 *
 * CSS contract (globals.css, "Graphics kit" block — task F2):
 * - `.gfx-bar`: transform-box: fill-box; transform-origin: bottom center.
 *   Under no-preference motion, start at scaleY(0) and animate a rise
 *   (staggered via :nth-child) when an ancestor `.scroll-reveal.revealed`
 *   is present. Reduced-motion fallback: bars render at full height.
 */

import ScrollReveal from "@/components/ScrollReveal";

interface RankBarsProps {
  /** Relative bar heights, each 0–1, drawn left to right. */
  values?: number[];
  ariaLabel?: string;
  className?: string;
}

const BAR_W = 34;
const GAP = 14;
const CHART_H = 240;
const TOP_PAD = 10;

export default function RankBars({
  values = [1, 0.8, 0.6, 0.4, 0.27],
  ariaLabel = "Bar chart of results rising over time",
  className = "",
}: RankBarsProps) {
  const width = values.length * BAR_W + (values.length + 1) * GAP;
  const height = CHART_H + TOP_PAD * 2;

  return (
    <ScrollReveal className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="w-full h-auto"
      >
        {values.map((v, i) => {
          const h = Math.max(0, Math.min(1, v)) * CHART_H;
          return (
            <rect
              key={i}
              className="gfx-bar"
              x={GAP + i * (BAR_W + GAP)}
              y={TOP_PAD + CHART_H - h}
              width={BAR_W}
              height={h}
              rx={6}
              fill="var(--color-cyan)"
              fillOpacity={Math.max(0.35, 1 - i * 0.16)}
            />
          );
        })}
      </svg>
    </ScrollReveal>
  );
}
