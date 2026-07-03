import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import ScrollReveal from "@/components/ScrollReveal";
import AnimatedBlobs from "@/components/graphics/AnimatedBlobs";
import FlowDiagram from "@/components/graphics/FlowDiagram";
import { graph, breadcrumbLd, ORG_ID, SITE_URL } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with DataBridges. Book a free discovery call with Oisín Bridges — AI consultant and Power Platform developer based in Kilcock, Co. Kildare.",
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    locale: "en_IE",
    siteName: "DataBridges",
    url: "https://databridges.ie/contact",
    title: "Contact | DataBridges",
    description:
      "Book a free discovery call with Oisín Bridges — AI consultant and Power Platform developer.",
    images: ["/images/logo-wordmark.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact | DataBridges",
    description:
      "Book a free discovery call with Oisín Bridges — AI consultant and Power Platform developer.",
    images: ["/images/logo-wordmark.png"],
  },
};

const contactJsonLd = graph(
  breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Contact", path: "/contact" },
  ]),
  {
    "@type": "ContactPage",
    "@id": `${SITE_URL}/contact#contactpage`,
    url: `${SITE_URL}/contact`,
    about: { "@id": ORG_ID },
  }
);

/* Hero graphic: a message leaving a form, flying across a dashed arc and
   landing as a reply — with a clock for the one-working-day promise.
   Dependency-free SVG on the .gfx-* contract in globals.css. */
function MessageInFlight() {
  const scatter = [
    { x: 60, y: 48, r: 2.5, o: 0.5 },
    { x: 150, y: 30, r: 2, o: 0.6 },
    { x: 262, y: 40, r: 3, o: 0.4 },
    { x: 396, y: 52, r: 2, o: 0.55 },
    { x: 428, y: 150, r: 2.5, o: 0.4 },
    { x: 40, y: 180, r: 2, o: 0.4 },
  ];
  return (
    <svg
      viewBox="0 0 460 250"
      role="img"
      aria-label="A message sent from a form flying to a reply, usually within one working day"
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

      {/* the message: a tiny form card */}
      <rect
        x="30"
        y="118"
        width="152"
        height="104"
        rx="14"
        fill="var(--color-offwhite)"
        fillOpacity="0.05"
        stroke="var(--color-cyan)"
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
      <rect x="48" y="138" width="80" height="7" rx="3.5" fill="var(--color-cyan)" fillOpacity="0.7" />
      <rect x="48" y="155" width="116" height="6" rx="3" fill="var(--color-offwhite)" fillOpacity="0.3" />
      <rect x="48" y="169" width="98" height="6" rx="3" fill="var(--color-offwhite)" fillOpacity="0.3" />
      <rect x="48" y="192" width="58" height="16" rx="8" fill="var(--color-cyan)" fillOpacity="0.85" />

      {/* flight path */}
      <path
        className="gfx-flow"
        d="M182 150 C 226 70, 268 62, 312 106"
        fill="none"
        stroke="var(--color-yellow)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* paper plane mid-flight */}
      <g className="gfx-node">
        <polygon
          points="238,72 268,84 244,92 240,104"
          fill="var(--color-cyan)"
        />
        <polygon points="244,92 252,88 240,104" fill="var(--color-navy)" fillOpacity="0.35" />
      </g>

      {/* the reply bubble */}
      <rect
        x="306"
        y="102"
        width="122"
        height="78"
        rx="14"
        fill="var(--color-offwhite)"
        fillOpacity="0.06"
        stroke="var(--color-yellow)"
        strokeOpacity="0.5"
        strokeWidth="1.5"
      />
      <polygon
        points="330,180 348,180 330,198"
        fill="var(--color-offwhite)"
        fillOpacity="0.06"
        stroke="var(--color-yellow)"
        strokeOpacity="0.5"
        strokeWidth="1.5"
      />
      <polyline
        points="348,140 362,154 388,124"
        fill="none"
        stroke="var(--color-yellow)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* the one-working-day clock */}
      <circle
        className="gfx-ring"
        cx="230"
        cy="196"
        r="24"
        fill="none"
        stroke="var(--color-cyan)"
        strokeWidth="2"
      />
      <circle
        cx="230"
        cy="196"
        r="16"
        fill="var(--color-navy)"
        stroke="var(--color-cyan)"
        strokeWidth="2"
      />
      <line x1="230" y1="196" x2="230" y2="186" stroke="var(--color-cyan)" strokeWidth="2" strokeLinecap="round" />
      <line x1="230" y1="196" x2="238" y2="200" stroke="var(--color-cyan)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* Decorative accents that sit around the form card (aria-hidden) */
function SparkleAccent() {
  return (
    <svg viewBox="0 0 48 48" className="w-10 h-10" aria-hidden="true">
      <path
        className="gfx-node"
        d="M24 4 L28 20 L44 24 L28 28 L24 44 L20 28 L4 24 L20 20 Z"
        fill="var(--color-yellow)"
      />
    </svg>
  );
}

function DotGridAccent() {
  const dots = [0, 1, 2];
  return (
    <svg viewBox="0 0 60 60" className="w-12 h-12" aria-hidden="true">
      {dots.map((row) =>
        dots.map((col) => (
          <circle
            key={`${row}-${col}`}
            className="gfx-node"
            cx={10 + col * 20}
            cy={10 + row * 20}
            r="3.5"
            fill="var(--color-cyan)"
            opacity={0.35 + 0.2 * ((row + col) % 3)}
          />
        ))
      )}
    </svg>
  );
}

const DETAILS = [
  {
    label: "Email",
    body: (
      <a
        href="mailto:hello@databridges.ie"
        className="text-navy font-medium hover:text-cyan transition-colors duration-200"
      >
        hello@databridges.ie
      </a>
    ),
  },
  {
    label: "LinkedIn",
    body: (
      <>
        <a
          href="https://linkedin.com/company/databridges"
          target="_blank"
          rel="noopener noreferrer"
          className="text-navy font-medium hover:text-cyan transition-colors duration-200 block"
        >
          linkedin.com/company/databridges
        </a>
        <a
          href="https://linkedin.com/in/oisin-bridges"
          target="_blank"
          rel="noopener noreferrer"
          className="text-navy font-medium hover:text-cyan transition-colors duration-200 block mt-1"
        >
          linkedin.com/in/oisin-bridges
        </a>
      </>
    ),
  },
  {
    label: "Location",
    body: (
      <>
        <p className="text-navy font-medium">Kilcock, Co. Kildare, Ireland</p>
        <p className="text-sm text-gray-500 mt-1">
          Working with teams across Ireland
        </p>
      </>
    ),
  },
  {
    label: "Response time",
    body: (
      <p className="text-sm text-gray-500">Usually within one working day.</p>
    ),
  },
];

export default function ContactPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }}
      />

      {/* HERO */}
      <section
        id="contact-hero"
        data-otter-section="contact-hero"
        aria-labelledby="contact-hero-heading"
        className="relative overflow-hidden bg-navy pt-36 pb-24 px-6"
      >
        <AnimatedBlobs />

        <div className="relative mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div>
            <h1
              id="contact-hero-heading"
              className="font-syne text-5xl md:text-6xl font-extrabold text-white"
            >
              Let&apos;s Talk
            </h1>
            <p className="text-cyan text-2xl mt-2">(Briefly. Like humans.)</p>
            <p className="text-gray-300 text-lg max-w-xl mt-4">
              Tell us what&apos;s driving you mad. We&apos;ll tell you whether
              AI can fix it. No scripts, no jargon, no pressure.
            </p>
          </div>

          {/* Hero graphic: message in flight */}
          <div className="max-w-sm mx-auto w-full lg:max-w-md lg:justify-self-end">
            <MessageInFlight />
            <p
              className="font-jetbrains text-xs text-white/50 text-center mt-3"
              aria-hidden="true"
            >
              send &rarr; reply, usually within one working day
            </p>
          </div>
        </div>
      </section>

      {/* CONTACT SECTION */}
      <section
        id="contact-form"
        data-otter-section="contact-form"
        aria-labelledby="contact-form-heading"
        className="py-20 px-6"
        style={{ backgroundColor: "var(--color-offwhite)" }}
      >
        <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-5 gap-12 lg:gap-16">
          {/* LEFT — FORM (60%) */}
          <ScrollReveal className="md:col-span-3">
            <div className="relative">
              {/* offset frame + corner accents around the form */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-3 rounded-3xl border-2 border-cyan/30 -rotate-1"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-8 -right-2 sm:-right-6"
              >
                <SparkleAccent />
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-8 -left-2 sm:-left-6"
              >
                <DotGridAccent />
              </div>

              <div className="relative bg-white rounded-3xl border border-navy/10 shadow-xl shadow-navy/5 p-6 sm:p-10">
                <h2 id="contact-form-heading" className="sr-only">
                  Contact Form
                </h2>
                <ContactForm />
              </div>
            </div>
          </ScrollReveal>

          {/* RIGHT — DETAILS (40%) */}
          <ScrollReveal delay={120} className="md:col-span-2">
            <div className="space-y-4">
              {DETAILS.map((d) => (
                <div
                  key={d.label}
                  className="gfx-card bg-white rounded-2xl border border-navy/10 border-l-4 border-l-cyan p-5"
                >
                  <p className="text-xs uppercase tracking-widest text-cyan-ink mb-2">
                    {d.label}
                  </p>
                  {d.body}
                </div>
              ))}

              {/* what happens next */}
              <div className="pt-6">
                <p className="text-xs uppercase tracking-widest text-cyan-ink mb-3">
                  What happens next
                </p>
                <FlowDiagram
                  steps={["Send", "Read", "Reply"]}
                  ariaLabel="What happens after you send a message"
                />
                <p
                  className="font-jetbrains text-xs text-navy/70 text-center mt-2"
                  aria-hidden="true"
                >
                  no sales script, just an answer
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
