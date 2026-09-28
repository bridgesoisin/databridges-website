import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import StatCounter from "@/components/StatCounter";
import AEOReadiness from "@/components/AEOReadiness";
import { graph, breadcrumbLd, ORG_ID } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "SEO & AEO Consulting Ireland",
  description:
    "Get found by people and by AI. DataBridges offers SEO and Answer Engine Optimisation (AEO) consulting for Irish businesses: structured data, technical SEO, content that gets cited by AI answers. Based in Kilcock, Co. Kildare.",
  alternates: { canonical: "/seo-aeo" },
  openGraph: {
    type: "website",
    locale: "en_IE",
    siteName: "DataBridges",
    url: "https://databridges.ie/seo-aeo",
    title: "SEO & AEO Consulting for Irish Businesses | DataBridges",
    description:
      "Rank on Google and get cited by AI answer engines. Practical SEO and AEO consulting, plus free tips you can try today.",
    images: ["/images/og-card.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "SEO & AEO Consulting Ireland | DataBridges",
    description:
      "Rank on Google and get cited by AI answer engines. Practical SEO and AEO consulting for Irish businesses.",
    images: ["/images/og-card.jpg"],
  },
};

const SERVICES = [
  {
    title: "Technical SEO audit",
    body: "A full sweep of crawlability, speed, Core Web Vitals, indexing and the fixes that actually move rankings.",
  },
  {
    title: "Answer Engine Optimisation",
    body: "Structuring your content so ChatGPT, Google AI answers and Copilot quote you, not your competitors.",
  },
  {
    title: "Structured data & schema",
    body: "FAQ, Article, Organization and LocalBusiness markup so engines understand exactly what you offer.",
  },
  {
    title: "Content that ranks",
    body: "Answer-first pages built around the real questions your customers type and ask out loud.",
  },
  {
    title: "Local SEO for Ireland",
    body: "Google Business Profile, local citations and consistent NAP so you win in your county, not just nationally.",
  },
  {
    title: "Measurement & reporting",
    body: "Clear dashboards showing rankings, traffic and AI visibility, with a plain-English read on what to do next.",
  },
];

const TIPS = [
  {
    n: "01",
    title: "Answer in the first line",
    body: "Open every key page with a one-sentence answer. It is the line engines lift into AI results.",
  },
  {
    n: "02",
    title: "Write headings as questions",
    body: '"How much does it cost?" mirrors how people search and speak. "Pricing" does not.',
  },
  {
    n: "03",
    title: "Add FAQ schema",
    body: "Mark up your questions and answers so engines can quote them directly in results.",
  },
  {
    n: "04",
    title: "Keep your facts consistent",
    body: "Same name, address and services on your site, Google Business Profile and LinkedIn.",
  },
  {
    n: "05",
    title: "Refresh, don't just publish",
    body: "Update your best pages and show a visible last-updated date. Freshness is a real signal.",
  },
  {
    n: "06",
    title: "Earn a few good mentions",
    body: "Directories, partners and local press build the authority engines look for before citing you.",
  },
  {
    n: "07",
    title: "Be fast on mobile",
    body: "Compress images and cut clutter. Slow pages get demoted before content even matters.",
  },
  {
    n: "08",
    title: "Be specific and local",
    body: '"AI consultant in Kildare" beats "AI solutions provider" every time.',
  },
];

const FAQS = [
  {
    q: "What is the difference between SEO and AEO?",
    a: "SEO (Search Engine Optimisation) helps your pages rank in traditional search results like Google. AEO (Answer Engine Optimisation) helps AI tools such as ChatGPT, Google AI answers and Copilot understand and quote your content when they answer a question. The two overlap heavily, and the same solid foundations serve both.",
  },
  {
    q: "Do I need AEO if my SEO is already working?",
    a: "Increasingly, yes. A growing share of searches now end with an AI-generated answer rather than a list of links. If your content is not structured to be quoted, you can rank well and still be invisible in that answer. AEO protects and extends the visibility your SEO has earned.",
  },
  {
    q: "How quickly will I see results?",
    a: "Technical fixes and structured data can improve how engines read your site within weeks. Ranking and authority gains build over months. The first audit gives you a realistic timeline for your specific situation, with no inflated promises.",
  },
  {
    q: "Do you work with small Irish businesses?",
    a: "Yes. Most clients are Irish SMEs and public sector teams. Local SEO and clear, answer-first content are often where smaller businesses see the fastest wins.",
  },
  {
    q: "How do I get started?",
    a: "Try the free readiness check on this page, then email oisin@databridges.ie or use the contact page to enquire about a full audit.",
  },
];

const serviceLd = {
  "@type": "Service",
  serviceType: "SEO and Answer Engine Optimisation consulting",
  provider: { "@id": ORG_ID },
  areaServed: { "@type": "Country", name: "Ireland" },
  description:
    "SEO and AEO consulting for Irish businesses: technical SEO, structured data, and content optimised to be cited by AI answer engines.",
};

const faqPageLd = {
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const seoJsonLd = graph(
  breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "SEO & AEO", path: "/seo-aeo" },
  ]),
  serviceLd,
  faqPageLd
);

export default function SeoAeoPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(seoJsonLd) }}
      />

      {/* HERO */}
      <section
        id="seo-hero"
        data-otter-section="seo-hero"
        aria-labelledby="seo-hero-heading"
        className="relative overflow-hidden bg-navy px-6 pt-36 pb-24"
      >
        {/* animated blobs */}
        <div aria-hidden="true" data-gfx-loop className="pointer-events-none absolute inset-0">
          <div
            className="seo-blob"
            style={{ width: 340, height: 340, top: -60, left: -40, background: "var(--color-cyan)" }}
          />
          <div
            className="seo-blob"
            style={{ width: 300, height: 300, bottom: -80, right: 40, background: "var(--color-yellow)" }}
          />
          <div
            className="seo-blob"
            style={{ width: 260, height: 260, top: 80, right: 260, background: "var(--seo-blue)" }}
          />
        </div>

        <div className="relative mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="font-jetbrains text-cyan text-sm uppercase tracking-widest">
              SEO + AEO Consulting
            </span>
            <h1
              id="seo-hero-heading"
              className="db-display text-white mt-4"
            >
              Get found by people <span className="text-cyan">and</span> by AI.
            </h1>
            <p className="text-gray-300 text-lg mt-6 max-w-xl">
              Ranking on Google is no longer enough. When someone asks an AI a
              question, your business should be the answer it gives. DataBridges
              makes your site win in search and in AI answers alike.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="#readiness"
                className="rounded-full bg-cyan px-8 py-3 font-semibold text-navy transition-colors hover:bg-white"
              >
                Free readiness check
              </Link>
              <Link
                href="/contact"
                className="rounded-full border border-white/30 px-8 py-3 font-semibold text-white transition-colors hover:bg-white/10"
              >
                Talk to Oisín
              </Link>
            </div>
          </div>

          {/* Hero graphic: search bar + rising ranks + answer nodes */}
          <ScrollReveal className="seo-graphic">
            <svg
              viewBox="0 0 460 340"
              role="img"
              aria-label="Illustration of a search query producing ranked results and an AI answer"
              data-gfx-loop
              className="w-full h-auto"
            >
              {/* search bar */}
              <rect x="30" y="30" width="300" height="44" rx="22" fill="var(--seo-panel)" stroke="var(--color-cyan)" strokeWidth="1.5" />
              <circle cx="58" cy="52" r="9" fill="none" stroke="var(--color-cyan)" strokeWidth="2.5" />
              <line x1="65" y1="59" x2="74" y2="68" stroke="var(--color-cyan)" strokeWidth="2.5" strokeLinecap="round" />
              <rect x="86" y="46" width="150" height="6" rx="3" fill="var(--seo-line)" />
              <rect className="seo-scan" x="86" y="44" width="40" height="12" rx="6" fill="var(--color-cyan)" opacity="0.5" />

              {/* rising rank bars (SEO) */}
              <g>
                <rect className="seo-bar" x="40" y="140" width="30" height="150" rx="6" fill="var(--color-cyan)" />
                <rect className="seo-bar" x="80" y="170" width="30" height="120" rx="6" fill="var(--seo-bar-2)" />
                <rect className="seo-bar" x="120" y="200" width="30" height="90" rx="6" fill="var(--seo-bar-2)" />
                <rect className="seo-bar" x="160" y="230" width="30" height="60" rx="6" fill="var(--seo-bar-3)" />
                <rect className="seo-bar" x="200" y="250" width="30" height="40" rx="6" fill="var(--seo-bar-3)" />
              </g>

              {/* flow line to answer card */}
              <path
                className="seo-flow"
                d="M240 120 C 300 120, 300 180, 340 180"
                fill="none"
                stroke="var(--color-yellow)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* AI answer card (AEO) */}
              <g>
                <rect x="300" y="150" width="140" height="150" rx="14" fill="var(--seo-panel)" stroke="var(--color-yellow)" strokeWidth="1.5" />
                <circle className="seo-ring" cx="322" cy="176" r="10" fill="none" stroke="var(--color-yellow)" strokeWidth="2" />
                <circle cx="322" cy="176" r="6" fill="var(--color-yellow)" />
                <rect x="338" y="172" width="80" height="6" rx="3" fill="var(--seo-line)" />
                <rect x="316" y="200" width="108" height="6" rx="3" fill="var(--seo-line-dim)" />
                <rect x="316" y="214" width="108" height="6" rx="3" fill="var(--seo-line-dim)" />
                <rect x="316" y="228" width="70" height="6" rx="3" fill="var(--seo-line-dim)" />
                {/* cited source chip */}
                <rect x="316" y="256" width="108" height="26" rx="13" fill="var(--seo-chip)" stroke="var(--color-cyan)" strokeWidth="1" />
                <circle className="seo-node" cx="330" cy="269" r="4" fill="var(--color-cyan)" />
                <rect x="342" y="266" width="70" height="6" rx="3" fill="var(--color-cyan)" />
              </g>

              {/* small orbiting nodes */}
              <g className="seo-orbit" style={{ transformOrigin: "370px 180px" }}>
                <circle className="seo-node" cx="370" cy="132" r="4" fill="var(--color-cyan)" />
                <circle className="seo-node" cx="418" cy="180" r="3.5" fill="var(--color-yellow)" />
              </g>
            </svg>
          </ScrollReveal>
        </div>
      </section>

      {/* AUTHORITY STRIP */}
      <section
        aria-label="Why DataBridges"
        className="px-6 py-8"
        style={{ backgroundColor: "var(--color-offwhite)" }}
      >
        <p className="mx-auto max-w-4xl text-center text-gray-600">
          Led by <span className="text-navy font-semibold">Oisín Bridges</span>,
          AI consultant, machine learning engineer and UCD lecturer. The same
          data mindset that builds AI systems, pointed at making your business
          the answer engines choose.
        </p>
      </section>

      {/* SEO vs AEO EXPLAINER */}
      <section
        id="seo-vs-aeo"
        data-otter-section="seo-vs-aeo"
        aria-labelledby="seo-vs-aeo-heading"
        className="px-6 py-20"
      >
        <div className="mx-auto max-w-6xl">
          <h2
            id="seo-vs-aeo-heading"
            className="db-h2 text-navy text-center"
          >
            Two ways to be found. You need both.
          </h2>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            <ScrollReveal>
              <div className="seo-card h-full rounded-3xl border border-gray-100 bg-white p-8"
                style={{ boxShadow: "0 6px 20px rgba(10,30,61,0.06)" }}>
                <span className="font-jetbrains text-sm uppercase tracking-widest text-cyan-ink">
                  SEO
                </span>
                <h3 className="font-syne text-2xl font-bold text-navy mt-2">
                  Rank in search results
                </h3>
                <p className="text-gray-600 mt-3 leading-relaxed">
                  When someone types a query into Google, you want to be near the
                  top. That means fast, crawlable pages, the right keywords, and
                  content that genuinely answers the search.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={80}>
              <div className="seo-card h-full rounded-3xl border border-gray-100 bg-white p-8"
                style={{ boxShadow: "0 6px 20px rgba(10,30,61,0.06)" }}>
                <span className="font-jetbrains text-sm uppercase tracking-widest text-yellow-ink">
                  AEO
                </span>
                <h3 className="font-syne text-2xl font-bold text-navy mt-2">
                  Get quoted by AI answers
                </h3>
                <p className="text-gray-600 mt-3 leading-relaxed">
                  When someone asks ChatGPT or Google&apos;s AI a question, you
                  want to be the source it cites. That means structured data,
                  clear answers, and content an engine can trust and lift.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* STAT BAND */}
      <section
        aria-label="Approach in numbers"
        className="bg-navy px-6 py-16"
      >
        <div className="mx-auto max-w-5xl grid grid-cols-1 sm:grid-cols-3 gap-10">
          <StatCounter target="3" label="Surfaces to win: search, maps, AI answers" />
          <StatCounter target="7" label="Point readiness check, free below" />
          <StatCounter target="8" label="Quick wins you can try today" />
        </div>
      </section>

      {/* SERVICES */}
      <section
        id="seo-services"
        data-otter-section="seo-services"
        aria-labelledby="seo-services-heading"
        className="px-6 py-20"
        style={{ backgroundColor: "var(--color-offwhite)" }}
      >
        <div className="mx-auto max-w-6xl">
          <h2
            id="seo-services-heading"
            className="db-h2 text-navy text-center"
          >
            What a project looks like
          </h2>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((s, i) => (
              <ScrollReveal key={s.title} delay={(i % 3) * 70}>
                <div className="seo-card h-full rounded-2xl border border-gray-100 bg-white p-7"
                  style={{ boxShadow: "0 6px 20px rgba(10,30,61,0.06)" }}>
                  <h3 className="font-syne text-xl font-bold text-navy">
                    {s.title}
                  </h3>
                  <p className="text-gray-600 mt-2 leading-relaxed text-[15px]">
                    {s.body}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* TIPS & TRICKS */}
      <section
        id="seo-tips"
        data-otter-section="seo-tips"
        aria-labelledby="seo-tips-heading"
        className="px-6 py-20"
      >
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2
              id="seo-tips-heading"
              className="db-h2 text-navy"
            >
              8 things you can try today
            </h2>
            <p className="text-gray-600 mt-3 max-w-2xl mx-auto">
              No consultant required. These are the same fundamentals we start
              every project with, laid out so you can act on them now.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5">
            {TIPS.map((tip, i) => (
              <ScrollReveal key={tip.n} delay={(i % 2) * 60}>
                <div className="seo-card flex gap-4 rounded-2xl border border-gray-100 bg-white p-6"
                  style={{ boxShadow: "0 4px 16px rgba(10,30,61,0.05)" }}>
                  <span
                    aria-hidden="true"
                    className="font-syne text-3xl font-extrabold text-cyan shrink-0"
                  >
                    {tip.n}
                  </span>
                  <span>
                    <span className="block font-syne text-lg font-bold text-navy">
                      {tip.title}
                    </span>
                    <span className="block text-gray-600 mt-1 text-[15px] leading-relaxed">
                      {tip.body}
                    </span>
                  </span>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* INTERACTIVE READINESS */}
      <section
        id="readiness"
        data-otter-section="readiness"
        aria-labelledby="readiness-heading"
        className="px-6 py-20"
        style={{ backgroundColor: "var(--color-offwhite)" }}
      >
        <h2 id="readiness-heading" className="sr-only">
          AEO readiness self-check
        </h2>
        <AEOReadiness />
      </section>

      {/* FAQ */}
      <section
        id="seo-faq"
        data-otter-section="seo-faq"
        aria-labelledby="seo-faq-heading"
        className="px-6 py-20"
      >
        <div className="mx-auto max-w-3xl">
          <h2
            id="seo-faq-heading"
            className="db-h2 text-navy text-center"
          >
            SEO &amp; AEO questions
          </h2>
          <div className="mt-10 flex flex-col gap-5">
            {FAQS.map((f, i) => (
              <ScrollReveal key={f.q} delay={i * 40}>
                <article className="rounded-2xl border border-gray-100 bg-white p-6 md:p-8"
                  style={{ boxShadow: "0 4px 16px rgba(10,30,61,0.06)" }}>
                  <h3 className="font-syne text-xl font-bold text-navy">{f.q}</h3>
                  <p className="text-gray-600 mt-3 leading-relaxed">{f.a}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        data-otter-section="footer-cta"
        aria-labelledby="seo-cta-heading"
        className="bg-navy px-6 py-20"
      >
        <div className="mx-auto max-w-3xl text-center">
          <h2
            id="seo-cta-heading"
            className="db-h2 text-white"
          >
            Ready to be the answer?
          </h2>
          <p className="text-gray-300 text-lg mt-3">
            Use the contact form to describe where search is falling short and
            where you want to show up.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="rounded-full bg-cyan px-8 py-3 font-semibold text-navy transition-colors hover:bg-white"
            >
              Get in touch
            </Link>
            <Link
              href="/faq"
              className="rounded-full border border-white/30 px-8 py-3 font-semibold text-white transition-colors hover:bg-white/10"
            >
              Read the FAQ
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
