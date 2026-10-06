import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import AnimatedBlobs from "@/components/graphics/AnimatedBlobs";
import LinkedInPostCard from "@/components/LinkedInPostCard";
import { LINKEDIN_POSTS } from "@/data/linkedin";
import { graph, breadcrumbLd } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "About Oisín Bridges",
  description:
    "Oisín Bridges is an AI consultant, Machine Learning engineer and UCD lecturer based in Kilcock, Kildare. He founded DataBridges in 2021 after years working in Irish public sector data roles.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "profile",
    locale: "en_IE",
    siteName: "DataBridges",
    url: "https://databridges.ie/about",
    title: "About Oisín Bridges | DataBridges",
    description:
      "AI consultant, ML engineer and UCD lecturer. Founded DataBridges in 2021.",
    images: ["/images/headshot-oisin.jpeg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Oisín Bridges | DataBridges",
    description:
      "AI consultant, ML engineer and UCD lecturer. Founded DataBridges in 2021.",
    images: ["/images/headshot-oisin.jpeg"],
  },
};

// The Person node lives site-wide (layout); About just adds its breadcrumb.
const aboutJsonLd = graph(
  breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
  ])
);

/* Hero graphic: a constellation of stars forming a bridge, astrophysics
   background meets the DataBridges name. Dependency-free SVG on the .gfx-*
   contract in globals.css. */
function ConstellationBridge() {
  const suspenders = [
    { x: 115, y: 162 },
    { x: 160, y: 145 },
    { x: 230, y: 135 },
    { x: 300, y: 145 },
    { x: 345, y: 162 },
  ];
  const scatter = [
    { x: 70, y: 60, r: 2.5, fill: "var(--color-offwhite)", o: 0.5, twinkle: true },
    { x: 135, y: 35, r: 2, fill: "var(--color-yellow)", o: 0.7, twinkle: false },
    { x: 210, y: 55, r: 3, fill: "var(--color-offwhite)", o: 0.4, twinkle: true },
    { x: 295, y: 30, r: 2.5, fill: "var(--color-offwhite)", o: 0.5, twinkle: false },
    { x: 365, y: 65, r: 2, fill: "var(--color-yellow)", o: 0.6, twinkle: true },
    { x: 415, y: 38, r: 2, fill: "var(--color-offwhite)", o: 0.5, twinkle: false },
    { x: 85, y: 115, r: 2, fill: "var(--color-offwhite)", o: 0.35, twinkle: false },
    { x: 390, y: 115, r: 2.5, fill: "var(--color-offwhite)", o: 0.4, twinkle: false },
  ];
  return (
    <svg
      viewBox="0 0 460 250"
      role="img"
      aria-label="Constellation of stars forming a bridge"
      className="w-full h-auto"
    >
      {/* night-sky scatter */}
      {scatter.map((s) => (
        <circle
          key={`${s.x}-${s.y}`}
          className={s.twinkle ? "gfx-node" : undefined}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill={s.fill}
          opacity={s.o}
        />
      ))}

      {/* bridge deck */}
      <line
        x1="40"
        y1="210"
        x2="420"
        y2="210"
        stroke="var(--color-offwhite)"
        strokeOpacity="0.25"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* bridge arc */}
      <path
        className="gfx-flow"
        d="M40 210 Q230 60 420 210"
        fill="none"
        stroke="var(--color-cyan)"
        strokeWidth="2"
        strokeOpacity="0.8"
        strokeLinecap="round"
      />

      {/* suspenders */}
      {suspenders.map((s) => (
        <line
          key={s.x}
          className="gfx-link"
          x1={s.x}
          y1={s.y}
          x2={s.x}
          y2="210"
          stroke="var(--color-cyan)"
          strokeOpacity="0.3"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ))}

      {/* apex star */}
      <circle
        className="gfx-ring"
        cx="230"
        cy="135"
        r="20"
        fill="none"
        stroke="var(--color-yellow)"
        strokeWidth="2"
      />
      <circle className="gfx-node" cx="230" cy="135" r="8" fill="var(--color-yellow)" />

      {/* stars along the bridge (drawn last so they sit on the lines) */}
      <circle className="gfx-node" cx="40" cy="210" r="6" fill="var(--color-cyan)" />
      <circle className="gfx-node" cx="420" cy="210" r="6" fill="var(--color-cyan)" />
      {suspenders
        .filter((s) => s.x !== 230)
        .map((s) => (
          <circle
            key={`star-${s.x}`}
            className="gfx-node"
            cx={s.x}
            cy={s.y}
            r="5"
            fill="var(--color-cyan)"
          />
        ))}
      {suspenders.map((s) => (
        <circle
          key={`foot-${s.x}`}
          cx={s.x}
          cy="210"
          r="2.5"
          fill="var(--color-cyan)"
          opacity="0.5"
        />
      ))}
    </svg>
  );
}

/* The same eight credentials as before, ordered chronologically so they
   read as a timeline. Content is real, do not invent entries. */
const timeline = [
  {
    year: "2015",
    title: "BSc Astrophysics",
    subtitle: "Maynooth University · 2015–2019",
    initial: "BSc",
  },
  {
    year: "2020",
    title: "MSc Data-Intensive Astrophysics (Distinction)",
    subtitle: "Cardiff University · 2020–2021",
    initial: "MSc",
  },
  {
    year: "2021",
    title: "DataBridges",
    subtitle: "Founded January 2021",
    initial: "DB",
  },
  {
    year: "2021",
    title: "Data Analyst",
    subtitle: "Tusla – Child & Family Agency · Oct 2021–Mar 2025",
    initial: "DA",
  },
  {
    year: "2025",
    title: "Senior Analyst",
    subtitle: "Health Service Executive · Mar 2025–present",
    initial: "HSE",
  },
  {
    year: "2025",
    title: "AI & ML Lecturer + Course Developer",
    subtitle: "UCD Professional Academy · Oct 2025–present",
    initial: "AI",
  },
  {
    year: "2026",
    title: "GenAI Lecturer",
    subtitle: "UCD Professional Academy · Feb 2026–present",
    initial: "Gen",
  },
  {
    year: "Cert",
    title: "Microsoft Copilot Business Value",
    subtitle: "Certified",
    initial: "MS",
  },
];

const storyActs = [
  {
    eyebrow: "The beginning",
    heading: "I studied the universe.",
    body: "At Cardiff University, I completed an MSc in Data-Intensive Astrophysics with Distinction. My dissertation used deep learning models to predict where the James Webb Space Telescope would find submillimetre galaxies in the COSMOS field. It was the kind of data science that required patience, rigour, and a healthy tolerance for debugging at 2am. Not a weekend bootcamp. Not a YouTube certificate. The real thing.",
  },
  {
    eyebrow: "Then",
    heading: "Then I studied Irish organisations.",
    body: "Four years as a data analyst inside Tusla and the HSE taught me how Irish public sector teams actually work, the legacy systems, the Excel dependencies, the understaffed IT departments, the genuine goodwill from people who want better tools but have never had someone explain them clearly. I saw “digital transformation” projects arrive with fanfare and leave teams worse off. That stuck with me.",
  },
  {
    eyebrow: "Now",
    heading: "Now I close the gap.",
    body: "I founded DataBridges in January 2021 to work directly with Irish SMEs and public sector teams. I also lecture at UCD Professional Academy, AI and machine learning, productivity with AI. The approach is the same in both: practical, specific, and honest about what AI can and cannot do. If you can explain something to a classroom, you can explain it to anyone. If that sounds useful, let’s talk.",
  },
];

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }}
      />

      {/* HERO */}
      <section
        id="about-hero"
        data-otter-section="about-hero"
        aria-labelledby="about-hero-heading"
        className="db-subpage-hero relative overflow-hidden bg-navy px-6"
      >
        <AnimatedBlobs />

        <div className="relative mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div>
            <p className="db-eyebrow db-eyebrow--dark mb-4">About DataBridges</p>
            <h1 id="about-hero-heading" className="db-display text-white">
              Hi, I&apos;m Ois&iacute;n.
            </h1>
            <p className="text-gray-300 text-xl max-w-2xl mt-6">
              I built DataBridges because digital transformation kept making
              work harder, not easier. That seemed like something worth fixing.
            </p>

            {/* Credentials strip, surfaced once above the fold */}
            <ul className="mt-8 flex flex-wrap gap-2 list-none p-0">
              {[
                "MSc Data-Intensive Astrophysics (Distinction) · Cardiff",
                "Master's Excellence Scholarship",
                "ITIL 4",
                "Microsoft Copilot Certified",
                "UCD lecturer",
              ].map((cred) => (
                <li
                  key={cred}
                  className="font-jetbrains flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/70"
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-1.5 w-1.5 rotate-45 bg-cyan"
                  />
                  {cred}
                </li>
              ))}
            </ul>
          </div>

          {/* Hero graphic: constellation bridge */}
          <div className="max-w-sm mx-auto w-full lg:max-w-md lg:justify-self-end">
            <ConstellationBridge />
            <p
              className="font-jetbrains text-xs text-white/50 text-center mt-3"
              aria-hidden="true"
            >
              from galaxies to spreadsheets
            </p>
          </div>
        </div>
      </section>

      {/* STORY SECTION */}
      <section
        id="about-story"
        data-otter-section="about-story"
        aria-labelledby="story-heading"
        className="py-20 md:py-28 px-6"
        style={{ backgroundColor: "var(--color-offwhite)" }}
      >
        <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
          <ScrollReveal className="md:sticky md:top-28 flex justify-center">
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute -inset-3 rounded-2xl border-2 border-cyan/30 rotate-2"
              />
              <Image
                src="/images/about-portrait.jpg"
                alt="Oisín Bridges, founder of DataBridges"
                width={320}
                height={320}
                className="relative rounded-2xl max-w-xs w-full object-cover aspect-square"
              />
            </div>
          </ScrollReveal>

          {/* Story: three acts on a connecting line */}
          <div>
            <h2 id="story-heading" className="sr-only">
              My Story
            </h2>

            <div className="relative pl-8">
              <div
                aria-hidden="true"
                className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-cyan/50 via-cyan/20 to-yellow/50"
              />

              {storyActs.map((act, i) => (
                <div key={act.eyebrow} className={`relative ${i > 0 ? "mt-10" : ""}`}>
                  <span
                    aria-hidden="true"
                    className={`absolute -left-8 top-1 h-3.5 w-3.5 rounded-full ring-4 ${
                      i === storyActs.length - 1
                        ? "bg-yellow ring-yellow/15"
                        : "bg-cyan ring-cyan/15"
                    }`}
                  />
                  <ScrollReveal delay={i * 80}>
                    <p className="db-eyebrow db-eyebrow--light mb-2">
                      {act.eyebrow}
                    </p>
                    <h3 className="db-h3 text-navy mb-3">
                      {act.heading}
                    </h3>
                    {i === 0 && (
                      <Image
                        src="/images/about-msc-graduation.jpg"
                        alt="Oisín Bridges at his MSc graduation, Cardiff University"
                        width={160}
                        height={284}
                        className="float-right ml-5 mb-2 w-28 sm:w-36 rounded-xl border-2 border-cyan/30 -rotate-2 shadow-md"
                      />
                    )}
                    <p className="text-gray-700 leading-relaxed">{act.body}</p>
                  </ScrollReveal>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CREDENTIALS TIMELINE */}
      <section
        id="credentials"
        data-otter-section="credentials"
        aria-labelledby="credentials-heading"
        className="py-20 md:py-28 px-6 bg-white"
      >
        <div className="mx-auto max-w-4xl">
          <p
            className="font-jetbrains text-sm text-cyan-ink text-center mb-3"
            aria-hidden="true"
          >
            /timeline
          </p>
          <h2 id="credentials-heading" className="db-h2 text-navy text-center">
            Background
          </h2>

          <ol className="relative list-none p-0 mt-12">
            {/* spine */}
            <div
              aria-hidden="true"
              className="absolute left-5 md:left-1/2 top-3 bottom-3 w-0.5 -translate-x-1/2 bg-gradient-to-b from-cyan/50 via-cyan/20 to-yellow/50"
            />

            {timeline.map((item, i) => (
              <li key={item.title} className="relative py-3 pl-14 md:pl-0">
                {/* node on the spine */}
                <span
                  aria-hidden="true"
                  className="absolute left-5 md:left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" className="block">
                    <circle cx="9" cy="9" r="8" fill="white" />
                    <circle
                      className="gfx-node"
                      cx="9"
                      cy="9"
                      r="5.5"
                      fill={
                        i % 2 === 0 ? "var(--color-cyan)" : "var(--color-yellow)"
                      }
                      style={{ animationDelay: `${(i % 4) * 0.3}s` }}
                    />
                  </svg>
                </span>

                <div className="md:grid md:grid-cols-2 md:gap-16">
                  <div className={i % 2 === 0 ? "md:col-start-1" : "md:col-start-2"}>
                    <ScrollReveal delay={(i % 2) * 60}>
                      <div
                        className="gfx-card flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-5"
                        style={{ boxShadow: "0 4px 16px rgba(10,30,61,0.05)" }}
                      >
                        <div className="font-syne w-10 h-10 rounded-lg bg-cyan/10 flex items-center justify-center text-cyan-ink text-xs font-bold flex-shrink-0">
                          {item.initial}
                        </div>
                        <div>
                          <p
                            className="font-jetbrains text-[11px] uppercase tracking-widest text-cyan-ink"
                            aria-hidden="true"
                          >
                            {item.year}
                          </p>
                          <p className="text-sm font-semibold text-navy mt-1">
                            {item.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>
                    </ScrollReveal>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* MORE FROM LINKEDIN */}
      <section
        id="linkedin-more"
        data-otter-section="linkedin-more"
        aria-labelledby="linkedin-more-heading"
        className="py-20 md:py-28 px-6"
        style={{ backgroundColor: "var(--color-offwhite)" }}
      >
        <div className="mx-auto max-w-5xl">
          <p
            className="font-jetbrains text-sm text-cyan-ink text-center mb-3"
            aria-hidden="true"
          >
            /linkedin
          </p>
          <h2 id="linkedin-more-heading" className="db-h2 text-navy text-center">
            More from LinkedIn
          </h2>
          <p className="db-subhead text-gray-500 text-center mx-auto mt-3">
            The rest of what&apos;s on LinkedIn. Same voice, no filter.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12 md:mt-14">
            {LINKEDIN_POSTS.filter((post) => !post.featured).map((post, i) => (
              <ScrollReveal
                key={post.postUrl + post.tag}
                delay={(i % 3) * 80}
                className="h-full"
              >
                <LinkedInPostCard
                  tag={post.tag}
                  previewText={post.previewText}
                  postUrl={post.postUrl}
                />
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        id="about-cta"
        data-otter-section="footer-cta"
        aria-labelledby="about-cta-heading"
        className="relative overflow-hidden bg-navy py-20 px-6"
      >
        <AnimatedBlobs
          blobs={[
            { size: 260, color: "var(--color-cyan)", top: -100, left: -80 },
            { size: 220, color: "var(--color-yellow)", bottom: -110, right: -60 },
          ]}
        />

        <div className="relative mx-auto max-w-2xl text-center">
          <ScrollReveal>
            <h2 id="about-cta-heading" className="db-h2 text-white">
              Want to work together?
            </h2>
            <p className="text-gray-300 text-lg max-w-xl mx-auto mt-4">
              A 10 minute call costs nothing and usually tells us both whether
              it&apos;s worth going further. No sales script. Just a
              conversation.
            </p>

            <Link
              href="/contact"
              className="font-syne inline-block mt-8 bg-cyan text-navy font-semibold px-10 py-5 rounded-full text-lg hover:bg-white transition-colors duration-200"
            >
              Get in touch &rarr;
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
