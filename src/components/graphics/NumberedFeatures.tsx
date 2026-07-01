/**
 * Graphics kit — NumberedFeatures
 *
 * Numbered feature cards in a responsive grid, modelled on the /seo-aeo
 * "8 things you can try today" tips grid: big Syne cyan number beside a bold
 * title and body copy, each card revealed with a small stagger on scroll.
 * Reveal motion comes from ScrollReveal, which is a no-op under
 * prefers-reduced-motion: reduce.
 *
 * CSS contract (globals.css, "Graphics kit" block — task F2):
 * - `.gfx-card`: subtle hover lift (translateY/shadow via transform only),
 *   transition disabled under prefers-reduced-motion: reduce.
 */

import ScrollReveal from "@/components/ScrollReveal";

export interface NumberedFeature {
  title: string;
  body: string;
}

interface NumberedFeaturesProps {
  items: NumberedFeature[];
  /** Grid columns at md and up (always 1 column at 360px). */
  columns?: 1 | 2 | 3;
  className?: string;
}

const COLS: Record<1 | 2 | 3, string> = {
  1: "",
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 lg:grid-cols-3",
};

export default function NumberedFeatures({
  items,
  columns = 2,
  className = "",
}: NumberedFeaturesProps) {
  return (
    <ol className={`grid grid-cols-1 gap-5 list-none p-0 ${COLS[columns]} ${className}`}>
      {items.map((item, i) => (
        <li key={item.title}>
          <ScrollReveal delay={(i % columns) * 60} className="h-full">
            <div
              className="gfx-card flex h-full gap-4 rounded-2xl border border-gray-100 bg-white p-6"
              style={{ boxShadow: "0 4px 16px rgba(10,30,61,0.05)" }}
            >
              <span aria-hidden="true" className="font-syne text-3xl font-extrabold text-cyan shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                <span className="block font-syne text-lg font-bold text-navy">
                  {item.title}
                </span>
                <span className="block text-gray-600 mt-1 text-[15px] leading-relaxed">
                  {item.body}
                </span>
              </span>
            </div>
          </ScrollReveal>
        </li>
      ))}
    </ol>
  );
}
