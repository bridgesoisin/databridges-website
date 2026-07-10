import Image from "next/image";

type Variant = "onDark" | "onLight";

interface WordmarkProps {
  /** Colour treatment for the surface it sits on. */
  variant?: Variant;
  /** Pixel size of the diamond mark. */
  markSize?: number;
  /** Tailwind size classes for the wordmark text (font-size). */
  textClassName?: string;
  /** Extra classes on the wrapper. */
  className?: string;
  /** Extra classes on the diamond mark itself. */
  markClassName?: string;
  /** Render the diamond mark (set false for text-only lockups). */
  showMark?: boolean;
  /** `priority` the mark image (use in above-the-fold hero). */
  priority?: boolean;
}

/**
 * The DataBridges brand lockup: the diamond mark + a crisp "databridges"
 * wordmark rendered as live text (sharp at any size, tokens not hex).
 * Screen readers read the name naturally from the text spans.
 */
export default function Wordmark({
  variant = "onDark",
  markSize = 56,
  textClassName = "text-4xl sm:text-5xl",
  className = "",
  markClassName = "",
  showMark = true,
  priority = false,
}: WordmarkProps) {
  const dataColour = variant === "onDark" ? "text-white" : "text-navy";
  const bridgesColour = variant === "onDark" ? "text-cyan" : "text-cyan-ink";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {showMark && (
        <Image
          src="/images/db-diamond.png"
          alt=""
          aria-hidden="true"
          width={markSize}
          height={markSize}
          className={`w-auto shrink-0 ${markClassName}`}
          style={{ height: markSize }}
          priority={priority}
        />
      )}
      <span
        className={`font-syne font-extrabold tracking-tight leading-none ${textClassName}`}
      >
        <span className={dataColour}>data</span>
        <span className={bridgesColour}>bridges</span>
      </span>
    </div>
  );
}
