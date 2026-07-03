import type { Metadata } from "next";
import Link from "next/link";
import AnimatedBlobs from "@/components/graphics/AnimatedBlobs";
import StatBand from "@/components/graphics/StatBand";

export const metadata: Metadata = {
  title: "Our Work — AI & Power Platform case studies | DataBridges",
  description:
    "Honest before-and-after stories from real DataBridges engagements across finance, construction, legal, public sector and training — anonymised by sector. Concrete outcomes, no vanity metrics.",
  alternates: { canonical: "https://databridges.ie/work" },
  openGraph: {
    type: "website",
    locale: "en_IE",
    siteName: "DataBridges",
    title: "Our Work — AI & Power Platform case studies | DataBridges",
    description:
      "Real engagements, told straight and anonymised by sector. Concrete outcomes, no vanity metrics.",
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

export default function WorkPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* ─── HERO ─── */}
      <section
        id="work-hero"
        data-otter-section="work-hero"
        aria-labelledby="work-hero-heading"
        className="relative overflow-hidden bg-navy px-6 pt-36 pb-24"
      >
        <AnimatedBlobs />

        <div className="relative mx-auto max-w-6xl">
          <p className="font-jetbrains text-cyan text-sm uppercase tracking-widest">
            Our Work
          </p>
          <h1
            id="work-hero-heading"
            className="font-syne text-5xl md:text-6xl font-extrabold text-white mt-4 leading-tight"
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
          {
            target: "~1hr",
            label: "Saved per analyst each week (public sector)",
          },
          { target: "5", label: "Sectors delivered in" },
          { target: "UCD", label: "Live AI cohorts taught" },
        ]}
      />

      {/* ─── CASE VIGNETTES (stub — filled in a later phase) ─── */}
      <section
        id="cases"
        data-otter-section="cases"
        aria-labelledby="cases-heading"
        className="py-24 px-6"
        style={{ backgroundColor: "var(--color-offwhite)" }}
      >
        <div className="mx-auto max-w-5xl">
          <p className="text-sm uppercase tracking-widest text-cyan-ink mb-4">
            Case studies
          </p>
          <h2
            id="cases-heading"
            className="font-syne text-4xl md:text-5xl font-bold text-navy"
          >
            Five jobs, five honest before-and-afters.
          </h2>
          <p className="text-gray-500 mt-2 max-w-2xl">
            Different sectors, same pattern: find where the hours leak, build
            the fix on tools you already pay for, hand it back working.
          </p>

          {/* Vignette grid is populated in a later content phase. */}
        </div>
      </section>

      {/* ─── HOW WE ANONYMISE (honesty note stub) ─── */}
      <section
        id="how-we-anonymise"
        data-otter-section="how-we-anonymise"
        aria-labelledby="anonymise-heading"
        className="py-24 px-6 bg-white"
      >
        <div className="mx-auto max-w-3xl">
          <h2
            id="anonymise-heading"
            className="font-syne text-3xl font-bold text-navy"
          >
            Why no logos or euro figures?
          </h2>
          {/* Copy is finalised in a later content phase. */}
        </div>
      </section>

      {/* ─── FOOTER CTA ─── */}
      <section
        id="footer-cta"
        data-otter-section="footer-cta"
        aria-labelledby="work-cta-heading"
        className="py-24 px-6"
        style={{ backgroundColor: "var(--color-yellow)" }}
      >
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="work-cta-heading"
            className="font-syne text-4xl md:text-5xl font-extrabold text-navy leading-tight"
          >
            Ready to stop doing things the hard way?
          </h2>
          <p className="text-navy/70 text-xl mt-4">
            30 minutes. No sales script. Just an honest chat about whether we
            can help.
          </p>

          <Link
            href="mailto:hello@databridges.ie"
            className="font-syne inline-block mt-10 bg-navy text-white font-semibold px-10 py-5 rounded-full text-lg hover:bg-navy/90 transition-colors duration-200"
          >
            Book a Free Chat &rarr;
          </Link>
        </div>
      </section>
    </>
  );
}
