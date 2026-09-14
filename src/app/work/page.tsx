import type { Metadata } from "next";
import Link from "next/link";
import AnimatedBlobs from "@/components/graphics/AnimatedBlobs";
import StatBand from "@/components/graphics/StatBand";
import NumberedFeatures from "@/components/graphics/NumberedFeatures";
import FourBridges from "@/components/graphics/FourBridges";
import ScrollReveal from "@/components/ScrollReveal";
import VignetteCard from "@/components/VignetteCard";
import { VIGNETTES } from "@/data/vignettes";
import { FOUR_BRIDGES_SPANS } from "@/data/fourBridges";

export const metadata: Metadata = {
  title: "Our Work",
  description:
    "Honest before-and-after stories from real DataBridges engagements across finance, construction, legal, public sector and training, anonymised by sector. Concrete outcomes, no vanity metrics.",
  alternates: { canonical: "/work" },
  openGraph: {
    type: "website",
    locale: "en_IE",
    siteName: "DataBridges",
    url: "https://databridges.ie/work",
    title: "Our Work, AI & Power Platform case studies | DataBridges",
    description:
      "Real engagements, told straight and anonymised by sector. Concrete outcomes, no vanity metrics.",
    images: ["/images/og-card.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Our Work | DataBridges",
    description:
      "Real engagements, told straight and anonymised by sector. Concrete outcomes, no vanity metrics.",
    images: ["/images/og-card.jpg"],
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://databridges.ie",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Work",
      item: "https://databridges.ie/work",
    },
  ],
};

const itemListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "DataBridges engagements",
  description:
    "Honest before-and-after case studies from real DataBridges engagements, anonymised by sector.",
  itemListElement: VIGNETTES.map((v, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: v.title,
    description: v.proof,
  })),
};

export default function WorkPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      {/* ─── HERO ─── */}
      <section
        id="work-hero"
        data-otter-section="work-hero"
        aria-labelledby="work-hero-heading"
        className="relative overflow-hidden bg-navy px-6 pt-32 md:pt-40 pb-20 md:pb-28"
      >
        <AnimatedBlobs />

        <div className="relative mx-auto max-w-6xl">
          <p className="db-eyebrow db-eyebrow--dark">Our Work</p>
          <h1
            id="work-hero-heading"
            className="db-display text-white mt-4 leading-tight"
          >
            Proof, not promises.
          </h1>
          <p className="text-gray-300 text-lg mt-6 max-w-2xl">
            Real engagements, told straight and anonymised by sector. Where a
            number is genuinely ours, we quote it. Where it isn&apos;t, we
            won&apos;t invent one.
          </p>
        </div>
      </section>

      {/* ─── STAT BAND: the defensible facts ─── */}
      <StatBand
        ariaLabel="DataBridges work in numbers"
        stats={[
          { target: "5", label: "Sectors delivered in" },
          { target: "UCD", label: "Live AI cohorts taught" },
          { target: "ITIL 4", label: "Governance-grade delivery" },
        ]}
      />

      {/* ─── CASE VIGNETTES ─── */}
      <section
        id="cases"
        data-otter-section="cases"
        aria-labelledby="cases-heading"
        className="py-20 md:py-28 px-6"
        style={{ backgroundColor: "var(--color-offwhite)" }}
      >
        <div className="mx-auto max-w-5xl">
          <p className="db-eyebrow db-eyebrow--light mb-4">Case studies</p>
          <h2 id="cases-heading" className="db-h2 text-navy">
            Five jobs, five honest before-and-afters.
          </h2>
          <p className="db-subhead text-gray-500 mt-3">
            Different sectors, same pattern: find where the hours leak, build
            the fix on tools you already pay for, hand it back working.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 md:mt-14">
            {VIGNETTES.map((v, i) => (
              <ScrollReveal
                key={v.slug}
                delay={(i % 2) * 100}
                className={`h-full${
                  i === VIGNETTES.length - 1 && VIGNETTES.length % 2 === 1
                    ? " md:col-span-2"
                    : ""
                }`}
              >
                <VignetteCard vignette={v} />
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW WE ANONYMISE (honesty note) ─── */}
      <section
        id="how-we-anonymise"
        data-otter-section="how-we-anonymise"
        aria-labelledby="anonymise-heading"
        className="py-20 md:py-28 px-6 bg-white"
      >
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl bg-navy/[0.04] p-8 md:p-10">
            <h2 id="anonymise-heading" className="db-h2 text-navy">
              Why no logos or euro figures?
            </h2>
            <p className="text-gray-600 text-lg leading-relaxed mt-4">
              Because most of this work sits inside regulated firms and the
              public sector, and because a saving we can&apos;t stand over
              isn&apos;t proof, it&apos;s decoration. If a client&apos;s
              happy to be named, we&apos;ll ask them, not assume.
            </p>
          </div>
        </div>
      </section>

      {/* ─── FOUR BRIDGES TEASER (signature framework diagram + numbered detail) ─── */}
      <section
        id="work-four-bridges"
        data-otter-section="work-four-bridges"
        aria-labelledby="work-four-bridges-heading"
        className="py-20 md:py-28 px-6"
        style={{ backgroundColor: "var(--color-offwhite)" }}
      >
        <div className="mx-auto max-w-5xl">
          <p className="db-eyebrow db-eyebrow--light mb-4">Our framework</p>
          <h2 id="work-four-bridges-heading" className="db-h2 text-navy">
            The same four bridges under every job on this page.
          </h2>
          <p className="db-subhead text-gray-500 mt-3">
            Most AI projects don&apos;t fail on the tech. They fall into the gap
            between a clever demo and a team actually using it. These are the
            four spans we build across, every time.
          </p>

          <FourBridges tone="dark" className="mt-12 md:mt-14" />

          <NumberedFeatures
            items={FOUR_BRIDGES_SPANS}
            columns={2}
            className="mt-12"
          />

          <div className="mt-10">
            <Link
              href="/#four-bridges"
              className="inline-block text-cyan-ink font-medium hover:underline transition-colors duration-200"
            >
              See the framework in full &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FOOTER CTA ─── */}
      <section
        id="footer-cta"
        data-otter-section="footer-cta"
        aria-labelledby="work-cta-heading"
        className="py-20 md:py-28 px-6 border-t border-navy/10"
        style={{ backgroundColor: "var(--color-yellow)" }}
      >
        <div className="mx-auto max-w-2xl text-center">
          <span
            aria-hidden="true"
            className="mb-6 inline-block h-2.5 w-2.5 rotate-45 bg-navy/70"
          />
          <h2
            id="work-cta-heading"
            className="db-h2 font-extrabold text-navy leading-tight"
          >
            Ready to stop doing things the hard way?
          </h2>
          <p className="text-navy/70 text-xl mt-4">
            30 minutes. No sales script. Just an honest chat about whether we
            can help.
          </p>

          <Link
            href="/contact"
            className="font-syne inline-block mt-10 bg-navy text-white font-semibold px-10 py-5 rounded-full text-lg hover:bg-navy/90 transition-colors duration-200"
          >
            Book a free chat &rarr;
          </Link>
        </div>
      </section>
    </>
  );
}
