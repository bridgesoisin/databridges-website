import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import AnimatedBlobs from "@/components/graphics/AnimatedBlobs";
import RankBars from "@/components/graphics/RankBars";
import NodeGraph from "@/components/graphics/NodeGraph";
import FlowDiagram from "@/components/graphics/FlowDiagram";
import { graph, breadcrumbLd, ORG_ID } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "Services",
  description:
    "AI consulting, Power Platform development, SharePoint automation and AI training workshops for Irish businesses and public sector teams.",
  alternates: { canonical: "/services" },
  openGraph: {
    type: "website",
    locale: "en_IE",
    siteName: "DataBridges",
    url: "https://databridges.ie/services",
    title: "Services | DataBridges — AI Consulting & Power Platform",
    description:
      "AI consulting, Power Platform, SharePoint automation and AI training for Irish teams.",
    images: ["/images/logo-wordmark.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Services | DataBridges",
    description:
      "AI consulting, Power Platform, SharePoint automation and training for Irish teams.",
    images: ["/images/logo-wordmark.png"],
  },
};

// Four Service nodes — copy mirrors the on-page cards so schema and content
// stay in parity. provider links to the site-wide Organization @id.
const serviceNodes = [
  {
    "@type": "Service",
    name: "AI Consulting & Integration",
    serviceType: "AI consulting",
    provider: { "@id": ORG_ID },
    areaServed: { "@type": "Country", name: "Ireland" },
    description:
      "Make Copilot, ChatGPT and your AI tools actually earn their keep.",
  },
  {
    "@type": "Service",
    name: "Power Platform Development",
    serviceType: "Microsoft Power Platform development",
    provider: { "@id": ORG_ID },
    areaServed: { "@type": "Country", name: "Ireland" },
    description:
      "Replace the Excel chaos with apps and dashboards that work the way your team does.",
  },
  {
    "@type": "Service",
    name: "SharePoint Automation",
    serviceType: "SharePoint automation",
    provider: { "@id": ORG_ID },
    areaServed: { "@type": "Country", name: "Ireland" },
    description:
      "Clean up the mess, automate approvals, make collaboration less painful.",
  },
  {
    "@type": "Service",
    name: "Training & Workshops",
    serviceType: "AI training",
    provider: { "@id": ORG_ID },
    areaServed: { "@type": "Country", name: "Ireland" },
    description:
      "Practical AI sessions. The same approach used at UCD. Tools your team will open on Monday morning.",
  },
  {
    "@type": "Service",
    name: "SEO & AEO",
    serviceType: "Search and answer-engine optimisation",
    provider: { "@id": ORG_ID },
    areaServed: { "@type": "Country", name: "Ireland" },
    description:
      "Get found by people and by AI. Win in Google search and in the answers AI assistants give.",
  },
];

const servicesJsonLd = graph(
  breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Services", path: "/services" },
  ]),
  ...serviceNodes
);

/* Bespoke service graphics (dependency-free SVG on the .gfx-* contract
   in globals.css). Both are wrapped in ScrollReveal by ServiceSection,
   which is what triggers the .gfx-bar rise. */

/** Power Platform: a dashboard window with rising bars and a trend line. */
function DashboardGraphic() {
  return (
    <svg
      viewBox="0 0 460 340"
      role="img"
      aria-label="Illustration of a dashboard with key figures, rising bars and an upward trend line"
      className="w-full h-auto"
    >
      {/* window frame */}
      <rect
        x="20"
        y="16"
        width="420"
        height="308"
        rx="16"
        fill="var(--color-offwhite)"
        fillOpacity="0.05"
        stroke="var(--color-cyan)"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <circle cx="44" cy="42" r="5" fill="var(--color-cyan)" opacity="0.6" />
      <circle cx="62" cy="42" r="5" fill="var(--color-yellow)" opacity="0.6" />
      <circle cx="80" cy="42" r="5" fill="var(--color-offwhite)" opacity="0.3" />

      {/* KPI chips */}
      {[40, 170, 300].map((x) => (
        <g key={x}>
          <rect
            x={x}
            y="64"
            width="120"
            height="48"
            rx="10"
            fill="var(--color-offwhite)"
            fillOpacity="0.06"
            stroke="var(--color-cyan)"
            strokeOpacity="0.25"
          />
          <rect
            x={x + 14}
            y="78"
            width="62"
            height="7"
            rx="3.5"
            fill="var(--color-cyan)"
            fillOpacity="0.8"
          />
          <rect
            x={x + 14}
            y="93"
            width="42"
            height="6"
            rx="3"
            fill="var(--color-offwhite)"
            fillOpacity="0.3"
          />
        </g>
      ))}

      {/* rising bars */}
      <line
        x1="44"
        y1="296"
        x2="244"
        y2="296"
        stroke="var(--color-offwhite)"
        strokeOpacity="0.2"
      />
      <g>
        {[60, 95, 125, 150, 170].map((h, i) => (
          <rect
            key={h}
            className="gfx-bar"
            x={52 + i * 40}
            y={296 - h}
            width="26"
            height={h}
            rx="6"
            fill="var(--color-cyan)"
            fillOpacity={0.5 + i * 0.12}
          />
        ))}
      </g>

      {/* trend line */}
      <path
        className="gfx-flow"
        d="M268 262 L316 224 L352 238 L412 158"
        fill="none"
        stroke="var(--color-yellow)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle className="gfx-node" cx="412" cy="158" r="6" fill="var(--color-yellow)" />
    </svg>
  );
}

/** Training: a presenter on screen with knowledge fanning out to the team. */
function WorkshopGraphic() {
  const row1 = [70, 176, 284, 390];
  const row2 = [123, 230, 337];
  return (
    <svg
      viewBox="0 0 460 300"
      role="img"
      aria-label="Illustration of a workshop presenter sharing knowledge with a team"
      className="w-full h-auto"
    >
      {/* presenter screen */}
      <rect
        x="150"
        y="16"
        width="160"
        height="96"
        rx="14"
        fill="var(--color-offwhite)"
        fillOpacity="0.06"
        stroke="var(--color-cyan)"
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
      <circle
        className="gfx-ring"
        cx="230"
        cy="64"
        r="24"
        fill="none"
        stroke="var(--color-yellow)"
        strokeWidth="2"
      />

      {/* knowledge fanning out */}
      {row1.map((x) => (
        <line
          key={`p-${x}`}
          className="gfx-link"
          x1="230"
          y1="112"
          x2={x}
          y2="180"
          stroke="var(--color-cyan)"
          strokeOpacity="0.35"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ))}
      {row2.map((x, i) => (
        <g key={`r2-${x}`}>
          <line
            className="gfx-link"
            x1={row1[i]}
            y1="180"
            x2={x}
            y2="252"
            stroke="var(--color-cyan)"
            strokeOpacity="0.25"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            className="gfx-link"
            x1={row1[i + 1]}
            y1="180"
            x2={x}
            y2="252"
            stroke="var(--color-cyan)"
            strokeOpacity="0.25"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      ))}

      {/* presenter + team nodes (after the lines so they sit on top) */}
      <circle className="gfx-node" cx="230" cy="64" r="12" fill="var(--color-yellow)" />
      {row1.map((x) => (
        <circle key={`n1-${x}`} className="gfx-node" cx={x} cy="180" r="11" fill="var(--color-cyan)" />
      ))}
      {row2.map((x) => (
        <circle key={`n2-${x}`} className="gfx-node" cx={x} cy="252" r="9" fill="var(--color-cyan)" fillOpacity="0.75" />
      ))}
    </svg>
  );
}

interface ServiceSectionProps {
  id: string;
  index: number;
  name: string;
  icon: React.ReactNode;
  problem: string;
  whatWeDo: string;
  whatYouGet: string[];
  ctaLabel: string;
  bg: string;
  /** Graphic column sits left of the text on lg screens. */
  reverse?: boolean;
  graphic: React.ReactNode;
  graphicCaption: string;
  children?: React.ReactNode;
}

function ServiceSection({
  id,
  index,
  name,
  icon,
  problem,
  whatWeDo,
  whatYouGet,
  ctaLabel,
  bg,
  reverse = false,
  graphic,
  graphicCaption,
  children,
}: ServiceSectionProps) {
  return (
    <section
      id={id}
      data-otter-section={id}
      aria-labelledby={`${id}-heading`}
      className={`py-20 md:py-28 px-6 ${bg}`}
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Text column */}
          <div className={reverse ? "lg:order-2" : ""}>
            <p className="font-jetbrains text-sm text-cyan-ink mb-3" aria-hidden="true">
              /{String(index).padStart(2, "0")}
            </p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan/10 flex items-center justify-center text-cyan flex-shrink-0">
                {icon}
              </div>
              <h2
                id={`${id}-heading`}
                className="db-h2 text-navy"
              >
                {name}
              </h2>
            </div>

            <div className="mt-8">
              <p className="text-xs uppercase tracking-widest text-cyan-ink font-medium mb-2">
                The Problem
              </p>
              <p className="text-gray-700 text-lg leading-relaxed">{problem}</p>
            </div>

            <div className="mt-8">
              <p className="text-xs uppercase tracking-widest text-cyan-ink font-medium mb-2">
                What DataBridges Does
              </p>
              <p className="text-gray-700 text-lg leading-relaxed">{whatWeDo}</p>
            </div>
          </div>

          {/* Graphic column — common baseline height so all four panels
              sit on one line down the alternating column. */}
          <ScrollReveal delay={80} className={reverse ? "lg:order-1" : ""}>
            <div className="gfx-card rounded-3xl bg-navy p-6 sm:p-10 lg:min-h-[320px] flex flex-col justify-center">
              <p className="font-jetbrains text-xs uppercase tracking-widest text-cyan mb-4 pb-3 border-b border-cyan/20">
                {graphicCaption}
              </p>
              {graphic}
            </div>
          </ScrollReveal>
        </div>

        {/* Numbered deliverables */}
        <ScrollReveal className="mt-12">
          <p className="text-xs uppercase tracking-widest text-cyan-ink font-medium mb-4">
            What You Get
          </p>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4 list-none p-0">
            {whatYouGet.map((item, i) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="font-syne text-xl font-extrabold text-cyan shrink-0 leading-7"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-gray-700 leading-7">{item}</span>
              </li>
            ))}
          </ol>
        </ScrollReveal>

        {children}

        <Link
          href="/contact"
          className="inline-block mt-10 text-cyan-ink font-medium hover:underline transition-colors duration-200"
        >
          {ctaLabel} &rarr;
        </Link>
      </div>
    </section>
  );
}

const SERVICE_ANCHORS = [
  { label: "AI Consulting", href: "#ai-consulting" },
  { label: "Power Platform", href: "#power-platform" },
  { label: "SharePoint", href: "#sharepoint" },
  { label: "Training", href: "#training" },
  { label: "SEO & AEO", href: "#seo-aeo" },
];

export default function ServicesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(servicesJsonLd) }}
      />

      {/* HERO */}
      <section
        id="services-hero"
        data-otter-section="services-hero"
        aria-labelledby="services-hero-heading"
        className="relative overflow-hidden bg-navy pt-32 md:pt-40 pb-20 md:pb-28 px-6"
      >
        <AnimatedBlobs />

        <div className="relative mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div>
            <p className="db-eyebrow db-eyebrow--dark mb-4">What We Do</p>
            <h1 id="services-hero-heading" className="db-display text-white">
              Services
            </h1>
            <p className="text-gray-300 text-xl max-w-2xl mt-4">
              Real problems. Practical solutions. No jargon, no decks, no
              47-slide PowerPoint strategies.
            </p>

            <nav aria-label="Jump to a service" className="mt-8 flex flex-wrap gap-3">
              {SERVICE_ANCHORS.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  className="inline-flex items-center min-h-[44px] rounded-full border border-white/20 px-4 py-2.5 text-sm text-white/80 hover:border-cyan hover:text-cyan transition-colors duration-200"
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Hero graphic: the manual grind shrinking */}
          <div className="max-w-xs mx-auto w-full lg:max-w-sm lg:justify-self-end">
            <RankBars ariaLabel="Bar chart of manual admin hours falling after automation" />
            <p className="font-jetbrains text-xs text-white/50 text-center mt-3" aria-hidden="true">
              hours lost to manual admin
            </p>
          </div>
        </div>
      </section>

      {/* SERVICE 1: AI Consulting */}
      <ServiceSection
        id="ai-consulting"
        index={1}
        name="AI Consulting & Integration"
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2a8 8 0 0 0-8 8c0 3 1.5 5.5 4 7v3h8v-3c2.5-1.5 4-4 4-7a8 8 0 0 0-8-8z" />
            <line x1="10" y1="22" x2="14" y2="22" />
          </svg>
        }
        problem="Your organisation has Microsoft 365. Some teams are using Copilot. Most are not. A few are using AI tools with no governance in place, creating risk nobody has formally acknowledged. Meanwhile the EU AI Act's first transparency deadline lands in August 2026."
        whatWeDo="We audit how your team currently works, identify where AI genuinely saves time (and where it does not), and roll out tools with proper training and guardrails. Microsoft Copilot, ChatGPT, Gemini — whichever fits your stack and your budget. We also help you meet your EU AI Act obligations — the Article 50 transparency duties that apply from August 2026, and the high-risk (Annex III) rules now phased to 2027–2028."
        whatYouGet={[
          "AI readiness audit and workflow analysis",
          "Tool recommendations matched to your actual needs",
          "Implementation support and staff onboarding",
          "EU AI Act risk assessment (transparency duties + Annex III applicability)",
          "Ongoing support during rollout",
        ]}
        ctaLabel="Talk to Oisín about AI Consulting"
        bg="bg-white"
        graphic={
          <NodeGraph ariaLabel="Illustration of AI tools connected through one central, governed hub" />
        }
        graphicCaption="Every tool, one governed hub"
      >
        {/* EU AI Act callout */}
        <div
          className="rounded-xl p-6 mt-10"
          style={{ backgroundColor: "var(--color-yellow)" }}
        >
          <h3 className="db-h3 text-navy">
            The August 2026 deadline didn&apos;t move.
          </h3>
          <p className="text-navy/80 mt-2">
            The May 2026 Digital Omnibus delayed the high-risk (Annex III)
            rules to December 2027 &mdash; but the Article 50{" "}
            <strong>transparency</strong> duties still apply from{" "}
            <strong>2 August 2026</strong>. Run a chatbot, an AI phone line, or
            publish AI-generated content and they apply to you, high-risk or
            not. Most people read the wrong line.
          </p>
          <Link
            href="/#eu-ai-act-checker"
            className="inline-block mt-3 text-navy font-medium underline hover:no-underline transition-colors duration-200"
          >
            Take the free 2-minute check &rarr;
          </Link>
        </div>
      </ServiceSection>

      {/* SERVICE 2: Power Platform */}
      <ServiceSection
        id="power-platform"
        index={2}
        name="Power Platform Development"
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        }
        problem="The business runs on a 40MB Excel file that someone built in 2019. It freezes on filter. Nobody knows all the formulas. Version control is a folder called 'FINAL' with eleven files in it. Every Monday morning, two people spend two hours copying data between sheets."
        whatWeDo="We replace the chaos with custom PowerApps, Power Automate flows, and Power BI dashboards. Built for how your team actually works — not how a consultant imagines it does. We have spent years inside Irish organisations and we understand the constraints: legacy systems, limited IT support, teams who are busy and do not want to learn something complicated."
        whatYouGet={[
          "Custom PowerApp built to your exact workflow",
          "Power Automate flows replacing manual processes",
          "Power BI dashboards your team will actually open",
          "Full handover training — your team owns it after we leave",
          "30-day post-launch support",
        ]}
        ctaLabel="Talk to Oisín about Power Platform"
        bg="bg-offwhite"
        reverse
        graphic={<DashboardGraphic />}
        graphicCaption="Dashboards people actually open"
      />

      {/* SERVICE 3: SharePoint */}
      <ServiceSection
        id="sharepoint"
        index={3}
        name="SharePoint Automation"
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        }
        problem="The SharePoint site is a graveyard. Folders nobody navigates, documents nobody can find, approval processes that live in someone's email inbox because the SharePoint version never worked properly."
        whatWeDo="We restructure the site so people can actually find things, automate the approval workflows that currently rely on email chains, and connect SharePoint properly to the rest of your Microsoft 365 stack. SharePoint can be genuinely useful. We have seen it."
        whatYouGet={[
          "Site information architecture redesign",
          "Automated approval and notification workflows",
          "Permissions audit and cleanup",
          "Integration with Teams, Outlook, Power Automate",
          "User training and adoption support",
        ]}
        ctaLabel="Talk to Oisín about SharePoint"
        bg="bg-white"
        graphic={
          <>
            <FlowDiagram
              steps={["Request", "Approve", "Notify"]}
              ariaLabel="Automated approval workflow"
            />
            <ul
              aria-label="Connects with"
              className="mt-6 flex flex-wrap gap-2 list-none p-0"
            >
              {["Teams", "Outlook", "Power Automate"].map((tool) => (
                <li
                  key={tool}
                  className="font-jetbrains rounded-full border border-cyan/30 px-3 py-1 text-xs text-cyan"
                >
                  {tool}
                </li>
              ))}
            </ul>
          </>
        }
        graphicCaption="Approvals without email chains"
      />

      {/* SERVICE 4: Training */}
      <ServiceSection
        id="training"
        index={4}
        name="Training & Workshops"
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        }
        problem="Your team has heard of AI. Half are worried it is going to replace them. The other half are using it randomly with no consistency or governance. Neither outcome is useful."
        whatWeDo="Practical, tailored workshops — the same approach Oisín uses lecturing at UCD Professional Academy. No theory lectures. No vendor sales pitches. Just honest guidance on which tools are worth your team's time, how to use them safely, and what to do on Monday morning."
        whatYouGet={[
          "Half-day or full-day workshop (your choice)",
          "Tailored to your specific tools and team",
          "Practical exercises, not passive presentations",
          "Takeaway resource pack your team keeps",
          "Follow-up Q&A session (30 days post-workshop)",
        ]}
        ctaLabel="Talk to Oisín about Training"
        bg="bg-offwhite"
        reverse
        graphic={<WorkshopGraphic />}
        graphicCaption="Skills that stick after we leave"
      />

      {/* SERVICE 5: SEO & AEO — callout linking to its own page */}
      <section
        id="seo-aeo"
        data-otter-section="seo-aeo"
        aria-labelledby="seo-aeo-heading"
        className="py-20 md:py-28 px-6 bg-white"
      >
        <div className="mx-auto max-w-6xl">
          <ScrollReveal>
            <div className="gfx-card rounded-3xl bg-navy p-8 sm:p-12 lg:p-16">
              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-10 lg:gap-16 items-center">
                <div>
                  <p
                    className="font-jetbrains text-sm text-cyan mb-3"
                    aria-hidden="true"
                  >
                    /05
                  </p>
                  <p className="db-eyebrow db-eyebrow--dark mb-4">
                    One more thing
                  </p>
                  <h2 id="seo-aeo-heading" className="db-h2 text-white">
                    SEO &amp; AEO
                  </h2>
                  <p className="text-gray-300 text-lg leading-relaxed mt-6">
                    Ranking on Google is no longer enough. When someone asks an
                    AI a question, your business should be the answer it gives.
                    We make your site win in search and in AI answers alike
                    &mdash; it&apos;s a service in its own right, with its own
                    page.
                  </p>
                  <Link
                    href="/seo-aeo"
                    className="inline-block mt-8 text-cyan font-medium hover:underline transition-colors duration-200"
                  >
                    Explore SEO &amp; AEO &rarr;
                  </Link>
                </div>

                <div className="lg:justify-self-end w-full max-w-xs mx-auto lg:mx-0">
                  <RankBars ariaLabel="Bar chart of search and AI-answer visibility rising" />
                  <p
                    className="font-jetbrains text-xs text-white/50 text-center mt-3"
                    aria-hidden="true"
                  >
                    visibility in search &amp; AI answers
                  </p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section
        id="services-cta"
        data-otter-section="footer-cta"
        aria-labelledby="services-cta-heading"
        className="py-20 md:py-28 px-6 border-t border-navy/10"
        style={{ backgroundColor: "var(--color-yellow)" }}
      >
        <div className="mx-auto max-w-2xl text-center">
          <span
            aria-hidden="true"
            className="mb-6 inline-block h-2.5 w-2.5 rotate-45 bg-navy/70"
          />
          <h2
            id="services-cta-heading"
            className="db-h2 font-extrabold text-navy leading-tight"
          >
            Not sure which one you need?
          </h2>
          <p className="text-navy/70 text-xl mt-4">
            Most projects touch more than one. Start with a free 30-minute
            chat and we&apos;ll point you at the fastest win.
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
