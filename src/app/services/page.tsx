import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Services | DataBridges — AI Consulting & Power Platform",
  description:
    "AI consulting, Power Platform development, SharePoint automation and AI training workshops for Irish businesses and public sector teams.",
};

const checkIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-cyan flex-shrink-0 mt-0.5"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

interface ServiceSectionProps {
  id: string;
  name: string;
  icon: React.ReactNode;
  problem: string;
  whatWeDo: string;
  whatYouGet: string[];
  ctaLabel: string;
  bg: string;
  children?: React.ReactNode;
}

function ServiceSection({
  id,
  name,
  icon,
  problem,
  whatWeDo,
  whatYouGet,
  ctaLabel,
  bg,
  children,
}: ServiceSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={`py-20 px-6 ${bg}`}
    >
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-cyan/10 flex items-center justify-center text-cyan">
            {icon}
          </div>
          <h2
            id={`${id}-heading`}
            className="text-3xl font-bold text-navy"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            {name}
          </h2>
        </div>

        <div className="mt-8">
          <p
            className="text-xs uppercase tracking-widest text-cyan font-medium mb-2"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            The Problem
          </p>
          <p
            className="text-gray-700 text-lg leading-relaxed"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            {problem}
          </p>
        </div>

        <div className="mt-8">
          <p
            className="text-xs uppercase tracking-widest text-cyan font-medium mb-2"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            What DataBridges Does
          </p>
          <p
            className="text-gray-700 text-lg leading-relaxed"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            {whatWeDo}
          </p>
        </div>

        <div className="mt-8">
          <p
            className="text-xs uppercase tracking-widest text-cyan font-medium mb-2"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            What You Get
          </p>
          <ul className="space-y-3 mt-3">
            {whatYouGet.map((item) => (
              <li key={item} className="flex items-start gap-3">
                {checkIcon}
                <span
                  className="text-gray-700"
                  style={{ fontFamily: "var(--font-dm-sans)" }}
                >
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {children}

        
        <a
          href="mailto:hello@databridges.ie"
          className="inline-block mt-10 text-cyan font-medium hover:underline transition-colors duration-200"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          {ctaLabel} &rarr;
        </a>
      </div>
    </section>
  );
}

export default function ServicesPage() {
  return (
    <>
      {/* HERO */}
      <section
        aria-labelledby="services-hero-heading"
        className="bg-navy py-32 px-6"
      >
        <div className="mx-auto max-w-5xl">
          <p
            className="text-sm uppercase tracking-widest text-cyan mb-4"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            What We Do
          </p>
          <h1
            id="services-hero-heading"
            className="text-6xl font-extrabold text-white"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            Services
          </h1>
          <p
            className="text-gray-300 text-xl max-w-2xl mt-4"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            Real problems. Practical solutions. No jargon, no decks, no
            47-slide PowerPoint strategies.
          </p>
        </div>
      </section>

      {/* SERVICE 1: AI Consulting */}
      <ServiceSection
        id="ai-consulting"
        name="AI Consulting & Integration"
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2a8 8 0 0 0-8 8c0 3 1.5 5.5 4 7v3h8v-3c2.5-1.5 4-4 4-7a8 8 0 0 0-8-8z" />
            <line x1="10" y1="22" x2="14" y2="22" />
          </svg>
        }
        problem="Your organisation has Microsoft 365. Some teams are using Copilot. Most are not. A few are using AI tools with no governance in place, creating risk nobody has formally acknowledged. Meanwhile the EU AI Act is moving from guidance to enforcement."
        whatWeDo="We audit how your team currently works, identify where AI genuinely saves time (and where it does not), and roll out tools with proper training and guardrails. Microsoft Copilot, ChatGPT, Gemini — whichever fits your stack and your budget. We also help you understand your EU AI Act obligations before the enforcement regime begins in August 2026."
        whatYouGet={[
          "AI readiness audit and workflow analysis",
          "Tool recommendations matched to your actual needs",
          "Implementation support and staff onboarding",
          "EU AI Act risk assessment (Annex III applicability)",
          "Ongoing support during rollout",
        ]}
        ctaLabel="Talk to Oisín about AI Consulting"
        bg="bg-white"
      >
        {/* EU AI Act callout */}
        <div
          className="rounded-xl p-6 mt-8"
          style={{ backgroundColor: "var(--color-yellow)" }}
        >
          <h3
            className="text-navy font-semibold text-lg"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            August 2, 2026 &mdash; Are you ready?
          </h3>
          <p
            className="text-navy/80 mt-2"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            If your organisation uses AI for recruitment decisions, credit
            scoring, or evaluating eligibility for public services, you fall
            under Annex III of the EU AI Act. The enforcement regime begins
            the day the National AI Office opens &mdash; not after a grace
            period.
          </p>
          <Link
            href="/#eu-ai-act-checker"
            className="inline-block mt-3 text-navy font-medium underline hover:no-underline transition-colors duration-200"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            Take the free 2-minute check &rarr;
          </Link>
        </div>
      </ServiceSection>

      {/* SERVICE 2: Power Platform */}
      <ServiceSection
        id="power-platform"
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
      />

      {/* SERVICE 3: SharePoint */}
      <ServiceSection
        id="sharepoint"
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
      />

      {/* SERVICE 4: Training */}
      <ServiceSection
        id="training"
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
      />
    </>
  );
}
