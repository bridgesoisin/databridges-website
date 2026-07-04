/**
 * Graphics kit, StatBand
 *
 * Full-width navy band of animated stat counters, modelled on the /seo-aeo
 * "Approach in numbers" section. Wraps the existing StatCounter, which counts
 * up on scroll into view and already falls back to a static number under
 * prefers-reduced-motion: reduce.
 *
 * No custom CSS needed, layout is Tailwind, motion lives in StatCounter.
 */

import StatCounter from "@/components/StatCounter";

export interface StatBandStat {
  /** Value to count up to, e.g. "40" or "100+"; non-numeric shows as-is. */
  target: string;
  label: string;
  /** Accent for the number. Reserve "yellow" for the one hook stat. */
  accent?: "cyan" | "yellow";
}

interface StatBandProps {
  stats: StatBandStat[];
  ariaLabel?: string;
  className?: string;
}

export default function StatBand({
  stats,
  ariaLabel = "Key numbers",
  className = "",
}: StatBandProps) {
  return (
    <section aria-label={ariaLabel} className={`bg-navy px-6 py-14 md:py-16 ${className}`}>
      <div
        className={`mx-auto max-w-5xl grid grid-cols-1 gap-10 ${
          stats.length % 2 === 0
            ? stats.length >= 4
              ? "sm:grid-cols-2 lg:grid-cols-4"
              : "sm:grid-cols-2"
            : "sm:grid-cols-3"
        }`}
      >
        {stats.map((s) => (
          <StatCounter
            key={s.label}
            target={s.target}
            label={s.label}
            accent={s.accent}
          />
        ))}
      </div>
    </section>
  );
}
