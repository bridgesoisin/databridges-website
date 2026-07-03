/**
 * Graphics kit — DashCard
 *
 * Shared "dashboard card" chrome for the animated dashboard graphics
 * (BeforeAfterBars, WorkflowPipeline, ChangeHeatmap). A glass panel with a
 * window header (traffic dots + mono title) and an optional caption, so each
 * graphic reads as a live dashboard tile rather than a bare SVG.
 *
 * Reads correctly on both navy and off-white surfaces:
 * - `tone="light"` — for placement on navy sections (light text).
 * - `tone="dark"`  — default, for off-white / white sections (navy text).
 *
 * CSS contract (globals.css, "Graphics kit" block):
 * - `.gfx-dash`: rounded glass shell (translucent film + cyan-dim border);
 *   subtle lift on hover, disabled under prefers-reduced-motion: reduce.
 * No motion of its own — the child SVG owns the animation.
 */

interface DashCardProps {
  /** Mono window title, e.g. "admin-hours.dash". */
  title: string;
  /** Short strap line under the graphic. */
  caption?: string;
  /** "light" on navy surfaces, "dark" (default) on light surfaces. */
  tone?: "light" | "dark";
  children: React.ReactNode;
  className?: string;
}

export default function DashCard({
  title,
  caption,
  tone = "dark",
  children,
  className = "",
}: DashCardProps) {
  const isLight = tone === "light";
  const titleColor = isLight ? "text-gray-300" : "text-cyan-ink";
  const capColor = isLight ? "text-gray-400" : "text-gray-500";

  return (
    <figure className={`gfx-dash ${className}`}>
      <div className="gfx-dash-head flex items-center gap-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-cyan)" }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-yellow)" }} />
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: "color-mix(in srgb, var(--color-offwhite) 40%, transparent)" }}
          />
        </span>
        <span className={`font-jetbrains text-xs uppercase tracking-wider ${titleColor}`}>
          {title}
        </span>
      </div>

      <div className="mt-4">{children}</div>

      {caption && (
        <figcaption className={`mt-3 text-sm ${capColor}`}>{caption}</figcaption>
      )}
    </figure>
  );
}
