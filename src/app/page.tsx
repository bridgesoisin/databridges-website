import Image from "next/image";
import ServiceCard from "@/components/ServiceCard";
import LinkedInPostCard from "@/components/LinkedInPostCard";
import BeforeAfterToggle from "@/components/BeforeAfterToggle";
import EUAIActChecker from "@/components/EUAIActChecker";
import ScrollReveal from "@/components/ScrollReveal";
import HeroWords from "@/components/HeroWords";
import Wordmark from "@/components/Wordmark";
import AnimatedBlobs from "@/components/graphics/AnimatedBlobs";
import NodeGraph from "@/components/graphics/NodeGraph";
import FlowDiagram from "@/components/graphics/FlowDiagram";
import StatBand from "@/components/graphics/StatBand";
import NumberedFeatures from "@/components/graphics/NumberedFeatures";
import LogoMarquee from "@/components/graphics/LogoMarquee";

const TECH_ITEMS = [
  "Microsoft Copilot",
  "Power Apps",
  "Power Automate",
  "Power BI",
  "SharePoint",
  "Dataverse",
  "Microsoft Teams",
  "ChatGPT",
  "Microsoft 365",
];

const HOW_IT_WORKS = [
  {
    title: "A free chat",
    body: "30 minutes, no sales script. You describe the daily grind; we tell you honestly whether we can help — and say so if we can't.",
  },
  {
    title: "Map the mess",
    body: "We sit with the people actually doing the work, find where the hours go, and pick the fix with the fastest payback.",
  },
  {
    title: "Build it with you",
    body: "Working software in weeks, not a slide deck. Built on the Microsoft 365 tools you already pay for, shaped around how your team works.",
  },
  {
    title: "Hand it over properly",
    body: "Training and plain-English documentation so your team owns it. No dependency, no retainer trap.",
  },
];

export default function Home() {
  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: "DataBridges",
            description:
              "AI consulting, Power Platform development and training workshops for Irish SMEs and public sector teams.",
            url: "https://databridges.ie",
            telephone: "",
            email: "hello@databridges.ie",
            address: {
              "@type": "PostalAddress",
              addressLocality: "Kilcock",
              addressRegion: "Co. Kildare",
              addressCountry: "IE",
            },
            founder: {
              "@type": "Person",
              name: "Oisín Bridges",
            },
            sameAs: [
              "https://www.linkedin.com/company/databridges",
              "https://www.linkedin.com/in/oisin-bridges",
            ],
          }),
        }}
      />

      {/* ─── SECTION 1: HERO ─── */}
      <section
        id="hero"
        data-otter-section="hero"
        aria-labelledby="hero-heading"
        className="bg-navy min-h-[100svh] flex items-center relative overflow-hidden"
      >
        <AnimatedBlobs />

        <div className="relative mx-auto max-w-6xl w-full px-6 pt-[120px] md:pt-[100px] pb-16 grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
          <div>
            <Wordmark
              variant="onDark"
              priority
              markSize={60}
              textClassName="text-5xl sm:text-6xl"
              className="wordmark-in mb-8"
            />

            <p className="text-sm text-cyan uppercase tracking-widest mb-6">
              AI Consulting &middot; Power Platform &middot; Training
            </p>

            <h1 id="hero-heading">
              <HeroWords />
            </h1>

            <p className="text-xl max-w-xl mt-6 text-gray-300">
              DataBridges helps Irish businesses connect people, data and
              process &mdash; turning &ldquo;there has to be a smarter way to
              do this&rdquo; into something that actually works.
            </p>

            <div className="mt-10 flex gap-4 flex-wrap">
              <a
                href="mailto:hello@databridges.ie"
                className="bg-cyan text-navy font-semibold px-8 py-4 rounded-full text-lg hover:bg-white transition-colors duration-200"
              >
                Book a Free Chat &rarr;
              </a>
              <a
                href="#services"
                className="border-2 border-white/30 text-white px-8 py-4 rounded-full text-lg hover:border-white transition-colors duration-200"
              >
                See What We Do
              </a>
            </div>

            <p className="mt-16 text-sm text-white/60">
              Based in Kilcock, Co. Kildare &middot; Working with teams across
              Ireland
            </p>
          </div>

          {/* Hero graphic: people, data and process joined through one hub */}
          <div className="max-w-sm mx-auto w-full lg:max-w-none">
            <NodeGraph ariaLabel="Illustration of people, data and process connected through one central hub" />
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: STAT BAND ─── */}
      <StatBand
        ariaLabel="DataBridges in numbers"
        stats={[
          { target: "5+", label: "Years consulting" },
          { target: "4", label: "Years in Irish public sector" },
          { target: "UCD", label: "Professional Academy" },
          { target: "Aug '26", label: "EU AI Act deadline" },
        ]}
      />

      {/* ─── SECTION 3: TECHNOLOGY MARQUEE ─── */}
      <section
        aria-label="Technologies DataBridges works with"
        className="py-10"
        style={{ backgroundColor: "var(--color-offwhite)" }}
      >
        <LogoMarquee
          items={TECH_ITEMS}
          ariaLabel="Technologies DataBridges works with"
        />
      </section>

      {/* ─── SECTION 4: PAIN POINTS ─── */}
      <section
        id="services"
        data-otter-section="services"
        aria-labelledby="pain-heading"
        className="py-24 px-6"
        style={{ backgroundColor: "var(--color-offwhite)" }}
      >
        <div className="mx-auto max-w-5xl">
          <p className="text-sm uppercase tracking-widest text-cyan-ink mb-4">
            The Problem
          </p>
          <h2
            id="pain-heading"
            className="font-syne text-5xl md:text-6xl font-bold text-navy"
          >
            Sound familiar?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <ScrollReveal delay={0} className="h-full">
              <div className="gfx-card bg-white rounded-2xl p-8 h-full">
                <p className="font-jetbrains text-lg text-cyan-ink mb-4">
                  Final_V12_UseThisOne(2).xlsx
                </p>
                <p className="text-gray-600 leading-relaxed">
                  The spreadsheet that runs everything &mdash; until someone
                  sorts the wrong column and suddenly Dave&apos;s salary is
                  attached to the wrong department. Instant chaos.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={100} className="h-full">
              <div className="gfx-card bg-white rounded-2xl p-8 h-full">
                <p className="font-jetbrains text-lg text-cyan-ink mb-4">
                  Copy. Paste. Repeat.
                </p>
                <p className="text-gray-600 leading-relaxed">
                  Time returns, attendance records, contact lists &mdash;
                  manually copied between sheets every week because
                  that&apos;s just how it&apos;s always been done.
                  There&apos;s another way.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={200} className="h-full">
              <div className="gfx-card bg-white rounded-2xl p-8 h-full">
                <p className="font-jetbrains text-lg text-cyan-ink mb-4">
                  40MB and climbing.
                </p>
                <p className="text-gray-600 leading-relaxed">
                  That tidy little project tracker is now a monster that
                  freezes when you hit filter. It was never a database. It
                  was never meant to be.
                </p>
              </div>
            </ScrollReveal>
          </div>

          {/* Transition paragraph */}
          <div className="mt-16 text-center">
            <p className="font-syne text-2xl md:text-3xl text-navy italic">
              There&apos;s a smarter way. It doesn&apos;t require a
              master&apos;s degree.
            </p>
            <p className="text-gray-500 mt-2">
              (Ois&iacute;n has one anyway. But that&apos;s beside the
              point.)
            </p>
            <a
              href="#what-we-do"
              className="inline-block mt-8 text-cyan-ink font-medium hover:underline transition-colors duration-200"
            >
              Show me how &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* ─── SECTION 5: BEFORE/AFTER ─── */}
      <BeforeAfterToggle />

      {/* ─── SECTION 6: SERVICES GRID ─── */}
      <section
        id="what-we-do"
        data-otter-section="what-we-do"
        aria-labelledby="services-heading"
        className="py-24 px-6 bg-white"
      >
        <div className="mx-auto max-w-5xl">
          <p className="text-sm uppercase tracking-widest text-cyan-ink mb-4">
            What We Do
          </p>
          <h2
            id="services-heading"
            className="font-syne text-5xl font-bold text-navy"
          >
            Four ways we help.
          </h2>
          <p className="text-gray-500 mt-2">
            Real problems, solved simply. No hype, no decks, no nonsense.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
            <ServiceCard
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 2a8 8 0 0 0-8 8c0 3 1.5 5.5 4 7v3h8v-3c2.5-1.5 4-4 4-7a8 8 0 0 0-8-8z" />
                  <line x1="10" y1="22" x2="14" y2="22" />
                </svg>
              }
              name="AI Consulting & Integration"
              description="Make Copilot, ChatGPT and your AI tools actually earn their keep."
              href="/services#ai-consulting"
            />
            <ServiceCard
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              }
              name="Power Platform Development"
              description="Replace the Excel chaos with apps and dashboards that work the way your team does."
              href="/services#power-platform"
            />
            <ServiceCard
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              }
              name="SharePoint Automation"
              description="Clean up the mess, automate approvals, make collaboration less painful."
              href="/services#sharepoint"
            />
            <ServiceCard
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              }
              name="Training & Workshops"
              description="Practical AI sessions. The same approach used at UCD. Tools your team will open on Monday morning."
              href="/services#training"
            />
          </div>
        </div>
      </section>

      {/* ─── SECTION 7: HOW IT WORKS ─── */}
      <section
        id="how-it-works"
        data-otter-section="how-it-works"
        aria-labelledby="how-heading"
        className="py-24 px-6"
        style={{ backgroundColor: "var(--color-offwhite)" }}
      >
        <div className="mx-auto max-w-5xl">
          <p className="text-sm uppercase tracking-widest text-cyan-ink mb-4">
            How It Works
          </p>
          <h2
            id="how-heading"
            className="font-syne text-4xl md:text-5xl font-bold text-navy"
          >
            Four steps. No jargon.
          </h2>
          <p className="text-gray-500 mt-2">
            From &ldquo;there has to be a smarter way&rdquo; to sorted &mdash;
            here is the route every project takes.
          </p>

          <ScrollReveal className="mt-12">
            <FlowDiagram
              steps={["Chat", "Map", "Build", "Train"]}
              ariaLabel="How a DataBridges project runs"
              className="max-w-2xl mx-auto"
            />
          </ScrollReveal>

          <NumberedFeatures
            items={HOW_IT_WORKS}
            columns={2}
            className="mt-12"
          />
        </div>
      </section>

      {/* ─── SECTION 8: CREDIBILITY ─── */}
      <section
        id="credibility"
        data-otter-section="credibility"
        aria-labelledby="credibility-heading"
        className="bg-navy py-24 px-6"
      >
        <div className="mx-auto max-w-5xl">
          <h2
            id="credibility-heading"
            className="font-syne text-4xl font-bold text-white text-center"
          >
            Not a consultant who learned some buzzwords.
          </h2>
          <p className="text-gray-300 text-lg max-w-2xl text-center mx-auto mt-6">
            Ois&iacute;n has worked inside the HSE and Tusla before
            consulting for organisations like them. He has an MSc in data
            science and teaches AI at UCD. He has been doing this since 2021.
            The difference shows.
          </p>

          {/* Credential pills */}
          <div className="mt-12 flex flex-wrap gap-3 justify-center">
            {[
              "MSc Astrophysics (Distinction) · Cardiff",
              "UCD Professional Academy Lecturer",
              "Microsoft Copilot Certified",
              "HSE · Tusla",
            ].map((cred) => (
              <span
                key={cred}
                className="border border-white/20 text-white/60 text-xs px-4 py-2 rounded-full"
              >
                {cred}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 9: EU AI ACT CHECKER ─── */}
      <section
        id="eu-ai-act-checker"
        data-otter-section="eu-ai-act-checker"
        aria-labelledby="euai-heading"
        className="py-24 px-6"
        style={{ backgroundColor: "var(--color-yellow)" }}
      >
        <div className="mx-auto max-w-2xl">
          <p className="text-sm uppercase tracking-widest text-navy/70 mb-4">
            Free Tool
          </p>
          <h2
            id="euai-heading"
            className="font-syne text-4xl md:text-5xl font-bold text-navy"
          >
            Does the EU AI Act affect your business?
          </h2>
          <p className="text-navy/70 text-lg mt-4 mb-12">
            Answer 4 questions. Get an honest answer in 30 seconds.
          </p>

          <EUAIActChecker />
        </div>
      </section>

      {/* ─── SECTION 10: ABOUT TEASER ─── */}
      <section
        id="about-teaser"
        data-otter-section="about-teaser"
        aria-labelledby="about-teaser-heading"
        className="py-24 px-6"
        style={{ backgroundColor: "var(--color-offwhite)" }}
      >
        <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <ScrollReveal className="flex justify-center">
            <Image
              src="/images/headshot-oisin.jpeg"
              alt="Oisín Bridges, founder of DataBridges, wearing a tweed jacket and paisley tie"
              width={384}
              height={384}
              className="rounded-2xl max-w-sm w-full object-cover aspect-square"
            />
          </ScrollReveal>

          {/* Text */}
          <ScrollReveal delay={100} className="md:pl-12">
            <p className="text-sm uppercase tracking-widest text-cyan-ink mb-4">
              About Ois&iacute;n
            </p>
            <h2
              id="about-teaser-heading"
              className="font-syne text-4xl font-bold text-navy"
            >
              An astrophysicist who got tired of bad spreadsheets.
            </h2>
            <p className="text-gray-600 text-lg leading-relaxed mt-4">
              Ois&iacute;n trained as a data scientist at Cardiff University,
              spent four years analysing data inside the HSE and Tusla, and
              started DataBridges in 2021 because digital transformation
              projects kept making work harder, not easier. He now also
              teaches AI at UCD Professional Academy.
            </p>
            <a
              href="/about"
              className="inline-block mt-6 text-cyan-ink font-medium hover:underline transition-colors duration-200"
            >
              Full story &rarr;
            </a>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── SECTION 11: LINKEDIN CONTENT ─── */}
      <section
        id="linkedin"
        data-otter-section="linkedin"
        aria-labelledby="linkedin-heading"
        className="py-24 px-6 bg-white"
      >
        <div className="mx-auto max-w-5xl">
          <h2
            id="linkedin-heading"
            className="font-syne text-3xl font-semibold text-navy text-center"
          >
            Straight talk about AI
          </h2>
          <p className="text-gray-500 text-center mt-2">
            No hype. No vendor decks. Just honest takes.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
            <ScrollReveal className="h-full">
              <LinkedInPostCard
                previewText="Irish businesses love spreadsheets. But here are the top 5 ways they go wrong. 1. One wrong sort and the whole thing collapses. You think you're sorting by date, suddenly everyone's salary..."
                postUrl="https://www.linkedin.com/feed/update/urn:li:activity:7421857533692387328"
              />
            </ScrollReveal>
            <ScrollReveal delay={100} className="h-full">
              <LinkedInPostCard
                previewText="The AI Deadline is Closer Than You Think. If your business uses AI for recruitment, credit scoring, or educational placement, the August 2026 Annex III deadline is real and it is approaching..."
                postUrl="https://www.linkedin.com/pulse/compliance-traps-eu-ai-act-how-irish-firms-can-avoid-them-zy5jf"
              />
            </ScrollReveal>
          </div>

          <div className="mt-10 text-center">
            <a
              href="https://linkedin.com/company/databridges"
              target="_blank"
              rel="noopener noreferrer"
              className="text-navy font-medium hover:text-cyan transition-colors duration-200"
            >
              Follow Ois&iacute;n on LinkedIn &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* ─── SECTION 12: FOOTER CTA ─── */}
      <section
        id="footer-cta"
        data-otter-section="footer-cta"
        aria-labelledby="footer-cta-heading"
        className="py-24 px-6"
        style={{ backgroundColor: "var(--color-yellow)" }}
      >
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="footer-cta-heading"
            className="font-syne text-4xl md:text-5xl font-extrabold text-navy leading-tight"
          >
            Ready to stop doing things the hard way?
          </h2>
          <p className="text-navy/70 text-xl mt-4">
            30 minutes. No sales script. Just an honest chat about whether we
            can help.
          </p>

          <a
            href="mailto:hello@databridges.ie"
            className="font-syne inline-block mt-10 bg-navy text-white font-semibold px-10 py-5 rounded-full text-lg hover:bg-navy/90 transition-colors duration-200"
          >
            Book a Free Chat &rarr;
          </a>
        </div>
      </section>
    </>
  );
}
