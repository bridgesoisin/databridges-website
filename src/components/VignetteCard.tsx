/**
 * VignetteCard, reusable before→after engagement card.
 *
 * Used full on `/work` (before/after split shown) and compact on the Home
 * "Where we've helped" section (`compact` hides the split for scannability).
 *
 * Presentational only, no client JS. The scroll reveal is handled by the
 * wrapping <ScrollReveal> at the call site; the hover lift comes from the
 * already reduced-motion-gated `.gfx-card` class in globals.css.
 */

import Link from "next/link";
import type { Vignette } from "@/data/vignettes";

interface VignetteCardProps {
  vignette: Vignette;
  href?: string;
  compact?: boolean;
}

function StackChips({ stack }: { stack: string[] }) {
  return (
    <ul className="mt-6 flex flex-wrap gap-2 list-none p-0">
      {stack.map((s) => (
        <li
          key={s}
          className="border border-gray-200 text-gray-500 text-xs px-3 py-1 rounded-full"
        >
          {s}
        </li>
      ))}
    </ul>
  );
}

function Proof({ proof }: { proof: string }) {
  return (
    <div className="mt-6 flex gap-3 rounded-xl bg-navy/[0.04] p-4">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-cyan-ink)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="mt-0.5 shrink-0"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <p className="text-[15px] leading-relaxed text-navy/80">{proof}</p>
    </div>
  );
}

export default function VignetteCard({
  vignette,
  href,
  compact = false,
}: VignetteCardProps) {
  const { sector, eyebrow, title, before, after, proof, stack } = vignette;

  const body = (
    <div className="gfx-card flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-xs uppercase tracking-widest text-cyan-ink">
          {eyebrow}
        </p>
        <p className="text-xs text-gray-400">{sector}</p>
      </div>

      <h3 className="font-syne text-2xl font-bold text-navy mt-3">{title}</h3>

      {!compact && (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-yellow-ink">
              Before
            </p>
            <p className="text-[15px] leading-relaxed text-gray-600 mt-2">
              {before}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-ink">
              After
            </p>
            <p className="text-[15px] leading-relaxed text-gray-600 mt-2">
              {after}
            </p>
          </div>
        </div>
      )}

      <Proof proof={proof} />

      <StackChips stack={stack} />

      {href && (
        <span className="mt-6 inline-block text-cyan-ink text-sm font-medium group-hover:underline">
          See it on our work page &rarr;
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group block h-full">
        {body}
      </Link>
    );
  }

  return body;
}
