/**
 * Graphics kit — AnimatedBlobs
 *
 * Soft blurred colour blobs that drift behind hero sections, modelled on the
 * /seo-aeo hero. Purely decorative (aria-hidden), absolutely positioned to
 * fill the nearest `relative` ancestor.
 *
 * CSS contract (globals.css, "Graphics kit" block — task F2):
 * - `.gfx-blob`: border-radius 9999px, blur filter, ~0.5 opacity; drifting
 *   transform keyframes only under prefers-reduced-motion: no-preference.
 *   Reduced-motion fallback: static glow (no animation).
 */

type BlobSpec = {
  /** Diameter in px. */
  size: number;
  /** Any CSS colour — prefer tokens, e.g. "var(--color-cyan)". */
  color: string;
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  left?: number | string;
};

const DEFAULT_BLOBS: BlobSpec[] = [
  { size: 340, color: "var(--color-cyan)", top: -60, left: -40 },
  { size: 300, color: "var(--color-yellow)", bottom: -80, right: 40 },
  { size: 260, color: "var(--color-cyan)", top: 80, right: 260 },
];

interface AnimatedBlobsProps {
  blobs?: BlobSpec[];
  className?: string;
}

export default function AnimatedBlobs({
  blobs = DEFAULT_BLOBS,
  className = "",
}: AnimatedBlobsProps) {
  return (
    <div
      aria-hidden="true"
      data-gfx-loop
      className={`pointer-events-none absolute inset-0 ${className}`}
    >
      {blobs.map((b, i) => (
        <div
          key={i}
          className="gfx-blob"
          style={{
            width: b.size,
            height: b.size,
            top: b.top,
            right: b.right,
            bottom: b.bottom,
            left: b.left,
            background: b.color,
          }}
        />
      ))}
    </div>
  );
}
