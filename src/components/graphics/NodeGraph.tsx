/**
 * Graphics kit — NodeGraph
 *
 * A network of pulsing data nodes joined by animated connection lines, in the
 * style of the /seo-aeo answer-engine motifs. Layout is fixed/deterministic
 * (no randomness) so server and client renders always match. Works on both
 * navy and off-white backgrounds — links and nodes are self-coloured.
 *
 * CSS contract (globals.css, "Graphics kit" block — task F2):
 * - `.gfx-node`: pulse (opacity/scale) keyframes, transform-box: fill-box,
 *   staggered via :nth-child; motion only under no-preference.
 * - `.gfx-link`: travelling stroke-dash animation; motion only under
 *   no-preference (static line otherwise).
 * - `.gfx-ring`: expanding echo ring around the hub; motion only under
 *   no-preference (hidden or faint static ring otherwise).
 */

const NODES = [
  { x: 230, y: 170, r: 14, color: "var(--color-cyan)" }, // hub
  { x: 92, y: 84, r: 8, color: "var(--color-cyan)" },
  { x: 368, y: 72, r: 7, color: "var(--color-yellow)" },
  { x: 64, y: 244, r: 7, color: "var(--color-cyan)" },
  { x: 392, y: 252, r: 9, color: "var(--color-cyan)" },
  { x: 232, y: 44, r: 6, color: "var(--color-yellow)" },
  { x: 176, y: 296, r: 6, color: "var(--color-cyan)" },
];

/** Index pairs into NODES; hub is index 0. */
const LINKS: Array<[number, number]> = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [0, 6],
  [1, 5],
  [2, 4],
];

interface NodeGraphProps {
  ariaLabel?: string;
  className?: string;
}

export default function NodeGraph({
  ariaLabel = "Network of connected data nodes",
  className = "",
}: NodeGraphProps) {
  const hub = NODES[0];

  return (
    <svg
      viewBox="0 0 460 340"
      role="img"
      aria-label={ariaLabel}
      data-gfx-loop
      className={`w-full h-auto ${className}`}
    >
      {LINKS.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          className="gfx-link"
          x1={NODES[a].x}
          y1={NODES[a].y}
          x2={NODES[b].x}
          y2={NODES[b].y}
          stroke="var(--color-cyan)"
          strokeOpacity={0.35}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      ))}

      {/* expanding echo around the hub */}
      <circle
        className="gfx-ring"
        cx={hub.x}
        cy={hub.y}
        r={hub.r + 12}
        fill="none"
        stroke="var(--color-yellow)"
        strokeWidth={2}
      />

      {NODES.map((n, i) => (
        <circle
          key={i}
          className="gfx-node"
          cx={n.x}
          cy={n.y}
          r={n.r}
          fill={n.color}
        />
      ))}
    </svg>
  );
}
