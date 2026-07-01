import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";

export const metadata: Metadata = {
  title: "FAQ | DataBridges — AI, Power Platform & Automation in Ireland",
  description:
    "Answers to common questions about DataBridges: what we do, what projects cost, who we work with, the EU AI Act, SharePoint automation, AI training, and how to get started. Based in Kilcock, Co. Kildare.",
  alternates: { canonical: "https://databridges.ie/faq" },
  openGraph: {
    type: "website",
    locale: "en_IE",
    siteName: "DataBridges",
    title: "DataBridges FAQ — AI, Power Platform & Automation for Irish teams",
    description:
      "Straight answers on services, pricing, the EU AI Act, SharePoint, training and getting started.",
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
    a: "Projects are scoped individually, so there is no fixed price list. The first 30-minute discovery call is free and usually gives you a clear sense of scope and likely cost before you commit to anything.",
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
    a: "It might. The EU AI Act introduces obligations that phase in through August 2026, and they catch more businesses than people expect. There is a free 30-second checker on the DataBridges home page that gives you a quick sense of where you stand.",
  },
  {
    q: "How do I get started?",
    a: "Email hello@databridges.ie or book a free 30-minute chat. There is no sales script and no jargon: you tell us what is driving you mad, and we tell you honestly whether AI or automation can fix it.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

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
        className="bg-navy py-32 px-6"
      >
        <div className="mx-auto max-w-5xl">
          <h1
            id="faq-hero-heading"
            className="font-syne text-5xl md:text-6xl font-extrabold text-white"
          >
            Frequently Asked Questions
          </h1>
          <p className="text-cyan text-2xl mt-2">Straight answers, no jargon.</p>
          <p className="text-gray-300 text-lg max-w-2xl mt-4">
            The things people ask most about working with DataBridges. Can&apos;t
            see your question? Email{" "}
            <a
              href="mailto:hello@databridges.ie"
              className="text-cyan underline underline-offset-4"
            >
              hello@databridges.ie
            </a>
            .
          </p>
        </div>
      </section>

      {/* FAQ LIST */}
      <section
        id="faq-list"
        data-otter-section="faq-list"
        aria-labelledby="faq-list-heading"
        className="py-20 px-6"
        style={{ backgroundColor: "var(--color-offwhite)" }}
      >
        <h2 id="faq-list-heading" className="sr-only">
          Questions and answers
        </h2>
        <div className="mx-auto max-w-3xl flex flex-col gap-5">
          {FAQS.map((f, i) => (
            <ScrollReveal key={f.q} delay={i * 40}>
              <article
                className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8"
                style={{ boxShadow: "0 4px 16px rgba(10,30,61,0.06)" }}
              >
                <h3 className="font-syne text-xl md:text-2xl font-bold text-navy">
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
        className="bg-navy py-20 px-6"
      >
        <div className="mx-auto max-w-3xl text-center">
          <h2
            id="faq-cta-heading"
            className="font-syne text-3xl md:text-4xl font-extrabold text-white"
          >
            Still have a question?
          </h2>
          <p className="text-gray-300 text-lg mt-3">
            A first 30-minute chat is free, with no sales script. Tell us what&apos;s
            broken and we&apos;ll tell you straight whether we can help.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="inline-block rounded-full bg-cyan px-8 py-3 font-semibold text-navy transition-transform hover:scale-105"
            >
              Book a free chat
            </Link>
            <Link
              href="/services"
              className="inline-block rounded-full border border-white/30 px-8 py-3 font-semibold text-white transition-colors hover:bg-white/10"
            >
              See our services
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
