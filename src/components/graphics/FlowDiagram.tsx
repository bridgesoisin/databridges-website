/**
 * Graphics kit — FlowDiagram
 *
 * Numbered process stages joined by animated flow lines, in the style of the
 * /seo-aeo query-to-answer flow. Stage boxes are self-coloured navy so the
 * diagram reads correctly on both navy and off-white backgrounds. Keep step
 * labels short (one or two words) so they fit their boxes at 360px.
 *
 * CSS contract (globals.css, "Graphics kit" block — task F2):
 * - `.gfx-flow`: travelling stroke-dash animation on the connector paths;
 *   motion only under no-preference (static dashed line otherwise).
 */

interface FlowDiagramProps {
  /** Short stage labels, drawn left to right. */
  steps?: string[];
  ariaLabel?: string;
  className?: string;
}

const VIEW_W = 460;
const VIEW_H = 120;
const BOX_Y = 24;
const BOX_H = 72;
const GAP = 26;
const SIDE_PAD = 4;

export default function FlowDiagram({
  steps = ["Ask", "Automate", "Deliver"],
  ariaLabel = "Process flow diagram",
  className = "",
}: FlowDiagramProps) {
  const n = Math.max(1, steps.length);
  const boxW = (VIEW_W - SIDE_PAD * 2 - GAP * (n - 1)) / n;
  const midY = BOX_Y + BOX_H / 2;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={`${ariaLabel}: ${steps.join(", ")}`}
      data-gfx-loop
      className={`w-full h-auto ${className}`}
    >
      {steps.map((label, i) => {
        const x = SIDE_PAD + i * (boxW + GAP);
        return (
          <g key={`${i}-${label}`}>
            {i > 0 && (
              <path
                className="gfx-flow"
                d={`M ${x - GAP + 2} ${midY} L ${x - 4} ${midY}`}
                fill="none"
                stroke="var(--color-yellow)"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            )}
            <rect
              x={x}
              y={BOX_Y}
              width={boxW}
              height={BOX_H}
              rx={14}
              fill="var(--color-navy)"
              stroke="var(--color-cyan)"
              strokeWidth={1.5}
            />
            <text
              x={x + 16}
              y={BOX_Y + 26}
              className="font-jetbrains"
              fontSize={12}
              fill="var(--color-yellow)"
            >
              {String(i + 1).padStart(2, "0")}
            </text>
            <text
              x={x + boxW / 2}
              y={BOX_Y + 52}
              textAnchor="middle"
              className="font-syne"
              fontSize={15}
              fontWeight={700}
              fill="var(--color-offwhite)"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
