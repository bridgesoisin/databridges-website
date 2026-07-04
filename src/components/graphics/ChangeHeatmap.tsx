/**
 * Graphics kit — ChangeHeatmap
 *
 * A change-ticket heatmap dashboard tile: a grid of cells (rows × columns)
 * shaded by volume, that scale/fade in on a diagonal wave when scrolled into
 * view, then the hottest cells shimmer on a slow loop. Nods to the real HSE
 * 2019–2026 change-ticket resourcing dashboard.
 *
 * Deterministic data (no randomness) so SSR and client match. The default
 * matrix trends upward across the years — illustrative of rising change volume.
 *
 * CSS contract (globals.css, "Graphics kit" block):
 * - `.gfx-cell`: base opacity 1 (static fallback). Under no-preference,
 *   opacity 0 + scale(0.4) → gfxCellIn when an ancestor `.scroll-reveal.revealed`
 *   is present; per-cell diagonal delay via inline animationDelay.
 * - `.gfx-cell-hot`: adds a looping gfxCellShimmer after the reveal.
 * Reduced motion: every cell renders at full intensity, no shimmer.
 */

import ScrollReveal from "@/components/ScrollReveal";
import DashCard from "@/components/graphics/DashCard";

interface ChangeHeatmapProps {
  /** rows × columns of 0–1 intensities. Defaults to a 4×8 upward-trending grid. */
  data?: number[][];
  /** Row labels (top → bottom), same length as data. */
  rows?: string[];
  /** Column labels (left → right), same length as data[0]. */
  cols?: string[];
  title?: string;
  caption?: string;
  tone?: "light" | "dark";
  ariaLabel?: string;
  className?: string;
}

// 4 quarters × 8 years (2019–2026), trending upward. Deterministic.
const DEFAULT_DATA: number[][] = [
  [0.18, 0.28, 0.35, 0.3, 0.55, 0.62, 0.72, 0.8],
  [0.22, 0.34, 0.42, 0.48, 0.6, 0.7, 0.85, 0.92],
  [0.3, 0.4, 0.38, 0.52, 0.66, 0.78, 0.9, 0.86],
  [0.26, 0.32, 0.46, 0.5, 0.58, 0.74, 0.82, 0.95],
];
const DEFAULT_ROWS = ["Q1", "Q2", "Q3", "Q4"];
const DEFAULT_COLS = ["'19", "'20", "'21", "'22", "'23", "'24", "'25", "'26"];

const CELL = 34;
const GAP = 5;
const PAD_L = 34; // room for row labels
const PAD_T = 4;
const PAD_B = 22; // room for column labels

function cellFill(v: number): { fill: string; opacity: number } {
  // Sequential cyan → yellow: cool for quiet quarters, warm for the busy ones.
  const fill = v >= 0.66 ? "var(--color-yellow)" : "var(--color-cyan)";
  return { fill, opacity: 0.22 + Math.min(1, Math.max(0, v)) * 0.78 };
}

export default function ChangeHeatmap({
  data = DEFAULT_DATA,
  rows = DEFAULT_ROWS,
  cols = DEFAULT_COLS,
  title = "changes.dash",
  caption = "Change-ticket volume by quarter, 2019–2026. Warmer cells = more work to resource. Illustrative.",
  tone = "dark",
  ariaLabel,
  className = "",
}: ChangeHeatmapProps) {
  const nRows = data.length;
  const nCols = data[0]?.length ?? 0;
  const gridW = PAD_L + nCols * CELL + (nCols - 1) * GAP;
  const gridH = PAD_T + nRows * CELL + (nRows - 1) * GAP + PAD_B;

  const label =
    ariaLabel ?? `Heatmap of change-ticket volume by quarter across ${cols[0]} to ${cols[nCols - 1]}, rising over time.`;
  const textOnCard = tone === "light" ? "var(--color-offwhite)" : "var(--color-navy)";

  return (
    <DashCard title={title} caption={caption} tone={tone} className={className}>
      <ScrollReveal>
        <svg viewBox={`0 0 ${gridW} ${gridH}`} role="img" aria-label={label} data-gfx-loop className="w-full h-auto">
          {data.map((row, r) =>
            row.map((v, c) => {
              const { fill, opacity } = cellFill(v);
              const hot = v >= 0.8;
              return (
                <rect
                  key={`${r}-${c}`}
                  className={hot ? "gfx-cell gfx-cell-hot" : "gfx-cell"}
                  x={PAD_L + c * (CELL + GAP)}
                  y={PAD_T + r * (CELL + GAP)}
                  width={CELL}
                  height={CELL}
                  rx={6}
                  fill={fill}
                  fillOpacity={opacity}
                  style={{ animationDelay: `${(r + c) * 70}ms` }}
                />
              );
            })
          )}

          {/* row labels */}
          {rows.map((rlabel, r) => (
            <text
              key={`r-${r}`}
              x={PAD_L - 10}
              y={PAD_T + r * (CELL + GAP) + CELL / 2 + 4}
              textAnchor="end"
              className="font-jetbrains"
              fontSize={11}
              fill={textOnCard}
              fillOpacity={0.7}
            >
              {rlabel}
            </text>
          ))}

          {/* column labels */}
          {cols.map((clabel, c) => (
            <text
              key={`c-${c}`}
              x={PAD_L + c * (CELL + GAP) + CELL / 2}
              y={gridH - 6}
              textAnchor="middle"
              className="font-jetbrains"
              fontSize={11}
              fill={textOnCard}
              fillOpacity={0.7}
            >
              {clabel}
            </text>
          ))}
        </svg>
      </ScrollReveal>
    </DashCard>
  );
}
