/**
 * Graphics kit — BeforeAfterBars
 *
 * A before/after admin-hours dashboard tile. Two bars (before = dim, after =
 * bright) rise into place on scroll-reveal; the reclaimed slice above the
 * "after" bar pulses gently forever to draw the eye to the saving. Nods to the
 * real HSE approval-triage automation (~1 hr/week saved per analyst).
 *
 * Deterministic layout (no randomness) so SSR and client always match. Values
 * are illustrative and set by the caller — keep them honest.
 *
 * CSS contract (globals.css, "Graphics kit" block):
 * - `.gfx-ba-bar`: transform-box: fill-box; origin bottom. Under no-preference,
 *   scaleY(0) → rise (reusing @keyframes gfxBarRise) when an ancestor
 *   `.scroll-reveal.revealed` is present; the "after" bar is delayed. Reduced
 *   motion: bars render full height.
 * - `.gfx-ba-save`: reclaimed slice; looping opacity pulse under no-preference,
 *   static translucent fill under reduced motion.
 */

import ScrollReveal from "@/components/ScrollReveal";
import DashCard from "@/components/graphics/DashCard";

interface BeforeAfterBarsProps {
  title?: string;
  caption?: string;
  beforeLabel?: string;
  afterLabel?: string;
  /** Numbers only, same unit; the taller one scales to the chart height. */
  beforeValue?: number;
  afterValue?: number;
  unit?: string;
  /** Badge on the reclaimed slice, e.g. "≈1 hr/week saved". */
  savedLabel?: string;
  tone?: "light" | "dark";
  ariaLabel?: string;
  className?: string;
}

const VIEW_W = 340;
const VIEW_H = 240;
const BASE_Y = 196;
const TOP = 34;
const MAX_H = BASE_Y - TOP;
const BAR_W = 74;
const B_X = 58;
const A_X = 208;

export default function BeforeAfterBars({
  title = "admin-hours.dash",
  caption = "Time on a repetitive manual process, before and after automation. Illustrative.",
  beforeLabel = "Before",
  afterLabel = "After",
  beforeValue = 4,
  afterValue = 1,
  unit = "hrs/wk",
  savedLabel = "time reclaimed",
  tone = "dark",
  ariaLabel,
  className = "",
}: BeforeAfterBarsProps) {
  const peak = Math.max(beforeValue, afterValue, 1);
  const beforeH = (beforeValue / peak) * MAX_H;
  const afterH = (afterValue / peak) * MAX_H;
  const beforeTop = BASE_Y - beforeH;
  const afterTop = BASE_Y - afterH;
  // Reclaimed slice: the gap between the (lower) after-bar top and the
  // (higher) before-bar top. Only meaningful when "after" is the smaller bar.
  const savedH = Math.max(0, afterTop - beforeTop);

  const label =
    ariaLabel ??
    `Bar chart: ${beforeLabel} ${beforeValue} ${unit}, ${afterLabel} ${afterValue} ${unit}. ${savedLabel}.`;

  const textOnCard = tone === "light" ? "var(--color-offwhite)" : "var(--color-navy)";

  return (
    <DashCard title={title} caption={caption} tone={tone} className={className}>
      <ScrollReveal>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={label} className="w-full h-auto">
          {/* baseline */}
          <line
            x1={28}
            y1={BASE_Y}
            x2={VIEW_W - 20}
            y2={BASE_Y}
            stroke="var(--color-cyan)"
            strokeOpacity={0.3}
            strokeWidth={1.5}
          />

          {/* before bar (dim) */}
          <rect
            className="gfx-ba-bar"
            x={B_X}
            y={beforeTop}
            width={BAR_W}
            height={beforeH}
            rx={8}
            fill="var(--color-cyan)"
            fillOpacity={0.4}
          />
          {/* after bar (bright) */}
          <rect
            className="gfx-ba-bar gfx-ba-after"
            x={A_X}
            y={afterTop}
            width={BAR_W}
            height={afterH}
            rx={8}
            fill="var(--color-cyan)"
          />

          {/* reclaimed slice above the after bar (looping pulse) */}
          {savedH > 6 && (
            <>
              <rect
                className="gfx-ba-save"
                x={A_X}
                y={beforeTop}
                width={BAR_W}
                height={savedH}
                rx={8}
                fill="var(--color-yellow)"
                fillOpacity={0.55}
              />
              <line
                x1={A_X}
                y1={beforeTop}
                x2={A_X + BAR_W}
                y2={beforeTop}
                stroke="var(--color-yellow)"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            </>
          )}

          {/* value labels */}
          <text x={B_X + BAR_W / 2} y={beforeTop - 10} textAnchor="middle" className="font-syne" fontSize={20} fontWeight={800} fill={textOnCard}>
            {beforeValue}
          </text>
          <text x={A_X + BAR_W / 2} y={afterTop - 10} textAnchor="middle" className="font-syne" fontSize={20} fontWeight={800} fill="var(--color-cyan-ink)">
            {afterValue}
          </text>

          {/* saved badge */}
          {savedH > 6 && (
            <text
              x={A_X + BAR_W + 8}
              y={beforeTop + savedH / 2 + 4}
              className="font-jetbrains"
              fontSize={11}
              fill="var(--color-yellow-ink)"
            >
              {savedLabel}
            </text>
          )}

          {/* category labels */}
          <text x={B_X + BAR_W / 2} y={BASE_Y + 22} textAnchor="middle" className="font-jetbrains" fontSize={12} fill={textOnCard} fillOpacity={0.7}>
            {beforeLabel}
          </text>
          <text x={A_X + BAR_W / 2} y={BASE_Y + 22} textAnchor="middle" className="font-jetbrains" fontSize={12} fill={textOnCard} fillOpacity={0.7}>
            {afterLabel}
          </text>
        </svg>
      </ScrollReveal>
    </DashCard>
  );
}
