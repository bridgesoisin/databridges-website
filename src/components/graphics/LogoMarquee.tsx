/**
 * Graphics kit, LogoMarquee
 *
 * Continuously scrolling strip of client/technology names (text chips, no
 * image assets), in the style of a partner-logo marquee. The item list is
 * rendered twice so the loop is seamless; the duplicate copy is aria-hidden.
 *
 * CSS contract (globals.css, "Graphics kit" block, task F2):
 * - `.gfx-marquee`: overflow hidden, soft fade mask on both edges.
 * - `.gfx-marquee-track`: inline-flex; under no-preference motion, an
 *   infinite linear translateX(-50%) loop with duration from
 *   `--gfx-marquee-duration`. Reduced-motion fallback: no animation, track
 *   wraps into static rows instead.
 * - `.gfx-marquee-dup`: display: contents while the loop animates; hidden
 *   (display: none) under prefers-reduced-motion: reduce, since the duplicate
 *   copy is only needed for the seamless loop.
 */

import type { CSSProperties } from "react";

interface LogoMarqueeProps {
  /** Short names to scroll, e.g. technologies or sectors served. */
  items: string[];
  /** Seconds for one full loop. */
  duration?: number;
  ariaLabel?: string;
  className?: string;
}

function Chips({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item) => (
        <span
          key={item}
          role="listitem"
          className="font-jetbrains text-sm uppercase tracking-widest text-navy/70 whitespace-nowrap px-6 py-2"
        >
          {item}
        </span>
      ))}
    </>
  );
}

export default function LogoMarquee({
  items,
  duration = 28,
  ariaLabel = "Technologies and sectors we work with",
  className = "",
}: LogoMarqueeProps) {
  return (
    <div data-gfx-loop className={`gfx-marquee ${className}`}>
      {/* role="list" sits on the track so listitems are its direct children */}
      <div
        role="list"
        aria-label={ariaLabel}
        className="gfx-marquee-track"
        style={{ "--gfx-marquee-duration": `${duration}s` } as CSSProperties}
      >
        <Chips items={items} />
        <span aria-hidden="true" className="gfx-marquee-dup">
          <Chips items={items} />
        </span>
      </div>
    </div>
  );
}
