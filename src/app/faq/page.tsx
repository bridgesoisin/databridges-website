import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import AnimatedBlobs from "@/components/graphics/AnimatedBlobs";
import { graph, breadcrumbLd } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about DataBridges: what we do, what projects cost, who we work with, the EU AI Act, SharePoint automation, AI training, and how to get started. Based in Kilcock, Co. Kildare.",
  alternates: { canonical: "/faq" },
  openGraph: {
    type: "website",
    locale: "en_IE",
    siteName: "DataBridges",
    url: "https://databridges.ie/faq",
    title: "DataBridges FAQ, AI, Power Platform & Automation for Irish teams",
    description:
      "Straight answers on services, pricing, the EU AI Act, SharePoint, training and getting started.",
    images: [
      { url: "/images/og-card.jpg", width: 1200, height: 630, alt: "DataBridges" },
      { url: "/images/og-card-square.jpg", width: 1200, height: 1200, alt: "DataBridges" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FAQ | DataBridges",
    description:
      "Straight answers on services, pricing, the EU AI Act, SharePoint, training and getting started.",
    images: ["/images/og-card.jpg"],
  },
};

// Single source of truth: the visible answers and the structured-data answers
// are the same strings, which is what search and answer engines expect.
const FAQS: { q: string; a: string }[] = [
  {
    q: "What does DataBridges do?",
    a: "DataBridges helps Irish SMEs and public sector teams put AI and automation to practical use. There are four services: AI consulting and integration, Power Platform development, SharePoint automation, and training and workshops. The aim is always to replace spreadsheet-and-email chaos with tools that actually work.",
  },
  {
    q: "Who is behind DataBridges?",
    a: "DataBridges was founded in 2021 by Oisín Bridges, an AI consultant, machine learning engineer and UCD Professional Academy lecturer based in Kilcock, Co. Kildare. His background includes an MSc in Data-Intensive Astrophysics (Distinction) from Cardiff University, a BSc in Astrophysics from Maynooth University, and senior data roles in the HSE and Tusla. You deal with Oisín directly, not a rotating cast of account managers.",
  },
  {
    q: "Is DataBridges a good fit for a business my size?",
    a: "Yes. Most clients are Irish SMEs and public sector teams, not multinationals. If you have a painful, manual process, you are the right size to work with us.",
  },
  {
    q: "How much does a project cost?",
    a: "Projects are scoped individually, so there is no fixed price list. A quote requires details about scope.",
  },
  {
    q: "Where is DataBridges based, and do you work remotely?",
    a: "DataBridges is based in Kilcock, Co. Kildare, and works with teams across Ireland, both on-site and remotely.",
  },
  {
    q: "What is Power Platform development?",
    a: "It is building custom apps and automated workflows on Microsoft Power Platform (Power Apps and Power Automate), usually on the Microsoft 365 licences you already pay for. It is often the fastest way to retire a fragile spreadsheet-and-email process and replace it with something reliable.",
  },
  {
    q: "Can you fix a messy SharePoint setup?",
    a: "Yes. SharePoint automation is a core service: restructuring document libraries that nobody can navigate, connecting SharePoint properly to the rest of Microsoft 365, and automating the manual steps around it so the system actually gets used.",
  },
  {
    q: "What does AI consulting actually involve?",
    a: "A practical, honest look at where AI helps your business and where it does not. In practice that means integrating proven AI tools into your existing workflows, or building a tailored solution, always with a human check kept on anything that leaves the building.",
  },
  {
    q: "Do you provide AI training?",
    a: "Yes. Training and workshops are a core part of what DataBridges does: hands-on sessions so your own team can keep building and maintaining solutions after a project ends, rather than depending on a consultant forever.",
  },
  {
    q: "Does the EU AI Act affect my business?",
    a: "Very possibly. The May 2026 Digital Omnibus delayed the high-risk (Annex III) rules to December 2027, but the AI Act's Article 50 transparency duties still apply from 2 August 2026, and they apply even if you have no high-risk AI. If you run a chatbot, an AI phone line, or publish AI-generated content, you have disclosures to make. There is a free 30-second checker on the DataBridges home page that shows where you stand. This is general guidance, not legal advice.",
  },
  {
    q: "What are the EU AI Act transparency rules that apply from August 2026?",
    a: "From 2 August 2026, Article 50 of the EU AI Act requires you to tell people when they are dealing with AI. That covers chatbots and AI phone lines, AI-generated or AI-edited content you publish, deepfakes, and emotion-recognition or biometric-categorisation systems. These transparency duties apply even if you use no high-risk AI at all. The May 2026 Digital Omnibus delayed the high-risk (Annex III) obligations to 2 December 2027, and to 2 August 2028 where AI is embedded in regulated products, but it did not move the Article 50 date. In short: the deadline didn't move; most people read the wrong line. This is general guidance, not legal advice.",
  },
  {
    q: "How do I get started?",
    a: "Email oisin@databridges.ie or send an enquiry through the contact page. Include the process, current pain and desired outcome.",
  },
];

const faqPageLd = {
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const faqJsonLd = graph(
  breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "FAQ", path: "/faq" },
  ]),
  faqPageLd
);

/* Hero graphic: floating question bubbles resolving, along a dashed flight
   path, into one clear answer with a tick. Dependency-free SVG on the
   .gfx-* contract in globals.css. */
function QuestionsToAnswer() {
  const scatter = [
    { x: 48, y: 34, r: 2.5, o: 0.5 },
    { x: 168, y: 22, r: 2, o: 0.6 },
    { x: 292, y: 30, r: 3, o: 0.4 },
    { x: 420, y: 44, r: 2, o: 0.55 },
    { x: 434, y: 176, r: 2.5, o: 0.4 },
    { x: 30, y: 196, r: 2, o: 0.4 },
  ];
  return (
    <svg
      viewBox="0 0 460 250"
      role="img"
      aria-label="Several question bubbles resolving into one clear answer"
      className="w-full h-auto"
    >
      {/* ambient pulsing dots */}
      {scatter.map((s) => (
        <circle
          key={`${s.x}-${s.y}`}
          className="gfx-node"
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill="var(--color-offwhite)"
          opacity={s.o}
        />
      ))}

      {/* stacked question bubbles */}
      <g>
        <rect
          x="30"
          y="58"
          width="88"
          height="60"
          rx="14"
          fill="var(--color-offwhite)"
          fillOpacity="0.05"
          stroke="var(--color-cyan)"
          strokeOpacity="0.4"
          strokeWidth="1.5"
        />
        <polygon
          points="52,118 68,118 52,134"
          fill="var(--color-offwhite)"
          fillOpacity="0.05"
          stroke="var(--color-cyan)"
          strokeOpacity="0.4"
          strokeWidth="1.5"
        />
        <text
          x="74"
          y="98"
          textAnchor="middle"
          fontSize="30"
          fontWeight="700"
          fill="var(--color-cyan)"
          fillOpacity="0.9"
        >
          ?
        </text>
      </g>
      <g>
        <rect
          x="96"
          y="150"
          width="74"
          height="52"
          rx="12"
          fill="var(--color-offwhite)"
          fillOpacity="0.05"
          stroke="var(--color-cyan)"
          strokeOpacity="0.3"
          strokeWidth="1.5"
        />
        <text
          x="133"
          y="185"
          textAnchor="middle"
          fontSize="24"
          fontWeight="700"
          fill="var(--color-cyan)"
          fillOpacity="0.6"
        >
          ?
        </text>
      </g>
      <g>
        <rect
          x="150"
          y="42"
          width="60"
          height="44"
          rx="11"
          fill="var(--color-offwhite)"
          fillOpacity="0.05"
          stroke="var(--color-cyan)"
          strokeOpacity="0.25"
          strokeWidth="1.5"
        />
        <text
          x="180"
          y="72"
          textAnchor="middle"
          fontSize="20"
          fontWeight="700"
          fill="var(--color-cyan)"
          fillOpacity="0.45"
        >
          ?
        </text>
      </g>

      {/* flight path from questions to the answer */}
      <path
        className="gfx-flow"
        d="M172 132 C 224 168, 258 168, 300 138"
        fill="none"
        stroke="var(--color-yellow)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* the one clear answer */}
      <circle
        className="gfx-ring"
        cx="356"
        cy="128"
        r="58"
        fill="none"
        stroke="var(--color-cyan)"
        strokeWidth="2"
      />
      <rect
        x="298"
        y="92"
        width="118"
        height="72"
        rx="14"
        fill="var(--color-offwhite)"
        fillOpacity="0.06"
        stroke="var(--color-yellow)"
        strokeOpacity="0.5"
        strokeWidth="1.5"
      />
      <polygon
        points="322,164 340,164 322,182"
        fill="var(--color-offwhite)"
        fillOpacity="0.06"
        stroke="var(--color-yellow)"
        strokeOpacity="0.5"
        strokeWidth="1.5"
      />
      <polyline
        points="332,128 348,144 382,110"
        fill="none"
        stroke="var(--color-yellow)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Structured data for SEO and answer-engine (AEO) rich results.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* HERO */}
      <section
        id="faq-hero"
        data-otter-section="faq-hero"
        aria-labelledby="faq-hero-heading"
        className="db-subpage-hero relative overflow-hidden bg-navy px-6"
      >
        <AnimatedBlobs />

        <div className="relative mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div>
            <h1 id="faq-hero-heading" className="db-display text-white">
              Frequently Asked Questions
            </h1>
            <p className="text-cyan text-2xl mt-3">Straight answers, no jargon.</p>
            <p className="text-gray-300 text-lg max-w-2xl mt-4">
              The things people ask most about working with DataBridges. Can&apos;t
              see your question? Email{" "}
              <a
                href="mailto:oisin@databridges.ie"
                className="text-cyan underline underline-offset-4"
              >
                oisin@databridges.ie
              </a>
              .
            </p>
          </div>

          {/* Hero graphic: questions resolving into one clear answer */}
          <div className="max-w-sm mx-auto w-full lg:max-w-md lg:justify-self-end">
            <QuestionsToAnswer />
            <p
              className="font-jetbrains text-xs text-white/50 text-center mt-3"
              aria-hidden="true"
            >
              your questions &rarr; one straight answer
            </p>
          </div>
        </div>
      </section>

      {/* FAQ LIST */}
      <section
        id="faq-list"
        data-otter-section="faq-list"
        aria-labelledby="faq-list-heading"
        className="py-20 md:py-28 px-6"
        style={{ backgroundColor: "var(--color-offwhite)" }}
      >
        <h2 id="faq-list-heading" className="sr-only">
          Questions and answers
        </h2>
        <div className="mx-auto max-w-3xl flex flex-col gap-5">
          {FAQS.map((f, i) => (
            <ScrollReveal key={f.q} delay={i * 40}>
              <article className="gfx-card db-card-shadow bg-white rounded-2xl border border-gray-100 border-l-4 border-l-cyan p-6 md:p-8">
                <p
                  className="font-jetbrains text-xs text-cyan-ink tracking-widest"
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="db-h3 text-navy mt-2">
                  {f.q}
                </h3>
                <p className="text-gray-600 text-base leading-relaxed mt-3">
                  {f.a}
                </p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        id="faq-cta"
        data-otter-section="footer-cta"
        aria-labelledby="faq-cta-heading"
        className="relative overflow-hidden bg-navy py-20 px-6"
      >
        <AnimatedBlobs
          blobs={[
            { size: 260, color: "var(--color-cyan)", top: -100, left: -80 },
            { size: 220, color: "var(--color-yellow)", bottom: -110, right: -60 },
          ]}
        />

        <div className="relative mx-auto max-w-3xl text-center">
          <ScrollReveal>
            <h2 id="faq-cta-heading" className="db-h2 text-white">
              Still have a question?
            </h2>
            <p className="text-gray-300 text-lg mt-3">
              Tell us what&apos;s broken and we&apos;ll discuss honestly whether we can
              help.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/contact"
                className="inline-block rounded-full bg-cyan px-8 py-3 font-semibold text-navy transition-colors hover:bg-white"
              >
                Get in touch
              </Link>
              <Link
                href="/services"
                className="inline-block rounded-full border border-white/30 px-8 py-3 font-semibold text-white transition-colors hover:bg-white/10"
              >
                See our services
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
