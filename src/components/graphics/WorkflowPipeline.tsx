/**
 * Graphics kit — WorkflowPipeline
 *
 * An automation "pipeline" dashboard tile: labelled stages joined by a
 * connector, with a data packet travelling the length of the line on a gentle
 * loop and each stage pulsing as work passes through. Nods to the real
 * construction/fit-out Power Platform build (lead intake → scheduling →
 * survey → quote → labour).
 *
 * Deterministic layout. Stage count drives the geometry; keep labels short
 * (one word) so they fit at 360px.
 *
 * CSS contract (globals.css, "Graphics kit" block):
 * - `.gfx-pipe-line`: travelling dash under no-preference; static dashed line
 *   under reduced motion.
 * - `.gfx-pipe-node`: gentle pulse (opacity) under no-preference; static under
 *   reduced motion. Stagger via inline animationDelay.
 * - `.gfx-pipe-packet`: circle that translates the pipeline length on a loop
 *   (distance passed in via `--gfx-pipe-travel`); hidden under reduced motion.
 */

import DashCard from "@/components/graphics/DashCard";

interface WorkflowPipelineProps {
  stages?: string[];
  title?: string;
  caption?: string;
  tone?: "light" | "dark";
  ariaLabel?: string;
  className?: string;
}

const VIEW_W = 460;
const VIEW_H = 150;
const MID_Y = 66;
const SIDE = 30;
const NODE_R = 15;

export default function WorkflowPipeline({
  stages = ["Intake", "Schedule", "Survey", "Quote", "Labour"],
  title = "pipeline.dash",
  caption = "One connected flow, end to end — no re-keying between systems.",
  tone = "dark",
  ariaLabel,
  className = "",
}: WorkflowPipelineProps) {
  const n = Math.max(2, stages.length);
  const first = SIDE;
  const last = VIEW_W - SIDE;
  const step = (last - first) / (n - 1);
  const xs = stages.map((_, i) => first + i * step);

  const label = ariaLabel ?? `Automation pipeline: ${stages.join(" then ")}.`;
  const textOnCard = tone === "light" ? "var(--color-offwhite)" : "var(--color-navy)";

  return (
    <DashCard title={title} caption={caption} tone={tone} className={className}>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={label} className="w-full h-auto">
        {/* connector line under the nodes */}
        <line
          className="gfx-pipe-line"
          x1={first}
          y1={MID_Y}
          x2={last}
          y2={MID_Y}
          stroke="var(--color-cyan)"
          strokeOpacity={0.6}
          strokeWidth={2.5}
          strokeLinecap="round"
        />

        {/* travelling packet */}
        <g className="gfx-pipe-packet" style={{ "--gfx-pipe-travel": `${last - first}px` } as React.CSSProperties}>
          <circle cx={first} cy={MID_Y} r={6} fill="var(--color-yellow)" />
          <circle cx={first} cy={MID_Y} r={6} fill="none" stroke="var(--color-yellow)" strokeOpacity={0.5} strokeWidth={4} />
        </g>

        {/* stage nodes + labels */}
        {stages.map((stage, i) => (
          <g key={`${i}-${stage}`}>
            <circle
              className="gfx-pipe-node"
              cx={xs[i]}
              cy={MID_Y}
              r={NODE_R}
              fill="var(--color-navy)"
              stroke="var(--color-cyan)"
              strokeWidth={2}
              style={{ animationDelay: `${i * 0.45}s` }}
            />
            <text x={xs[i]} y={MID_Y + 5} textAnchor="middle" className="font-jetbrains" fontSize={14} fill="var(--color-cyan)">
              {String(i + 1).padStart(2, "0")}
            </text>
            <text
              x={xs[i]}
              y={MID_Y + NODE_R + 24}
              textAnchor="middle"
              className="font-syne"
              fontSize={16}
              fontWeight={700}
              fill={textOnCard}
            >
              {stage}
            </text>
          </g>
        ))}
      </svg>
    </DashCard>
  );
}
