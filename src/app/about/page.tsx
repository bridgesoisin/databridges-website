import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "About Oisín Bridges | DataBridges",
  description:
    "Oisín Bridges is an AI consultant, Machine Learning engineer and UCD lecturer based in Kilcock, Kildare. He founded DataBridges in 2021 after years working in Irish public sector data roles.",
};

const credentials = [
  {
    title: "MSc Data-Intensive Astrophysics (Distinction)",
    subtitle: "Cardiff University · 2020–2021",
    initial: "MSc",
  },
  {
    title: "BSc Astrophysics",
    subtitle: "Maynooth University · 2015–2019",
    initial: "BSc",
  },
  {
    title: "AI & ML Lecturer + Course Developer",
    subtitle: "UCD Professional Academy · Oct 2025–present",
    initial: "AI",
  },
  {
    title: "GenAI Lecturer",
    subtitle: "UCD Professional Academy · Feb 2026–present",
    initial: "Gen",
  },
  {
    title: "Senior Analyst",
    subtitle: "Health Service Executive · Mar 2025–present",
    initial: "HSE",
  },
  {
    title: "Data Analyst",
    subtitle: "Tusla – Child & Family Agency · Oct 2021–Mar 2025",
    initial: "DA",
  },
  {
    title: "Microsoft Copilot Business Value",
    subtitle: "Certified",
    initial: "MS",
  },
  {
    title: "DataBridges",
    subtitle: "Founded January 2021",
    initial: "DB",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* HERO */}
      <section aria-labelledby="about-hero-heading" className="bg-navy py-32 px-6">
        <div className="mx-auto max-w-5xl">
          <h1
            id="about-hero-heading"
            className="font-syne text-6xl font-extrabold text-white"
          >
            Hi, I&apos;m Ois&iacute;n.
          </h1>
          <p className="text-gray-300 text-xl max-w-2xl mt-6">
            I built DataBridges because digital transformation kept making
            work harder, not easier. That seemed like something worth fixing.
          </p>
        </div>
      </section>

      {/* STORY SECTION */}
      <section
        aria-labelledby="story-heading"
        className="py-24 px-6"
        style={{ backgroundColor: "var(--color-offwhite)" }}
      >
        <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
          <div className="flex justify-center">
            <Image
              src="/images/headshot-oisin.jpeg"
              alt="Oisín Bridges, founder of DataBridges"
              width={320}
              height={320}
              className="rounded-2xl max-w-xs w-full object-cover aspect-square"
            />
          </div>

          {/* Story */}
          <div>
            <h2 id="story-heading" className="sr-only">
              My Story
            </h2>

            {/* Act 1 */}
            <div>
              <p className="text-xs uppercase tracking-widest text-cyan mb-2">
                The beginning
              </p>
              <h3 className="font-syne text-2xl font-semibold text-navy mb-3">
                I studied the universe.
              </h3>
              <p className="text-gray-700 leading-relaxed">
                At Cardiff University, I completed an MSc in Data-Intensive
                Astrophysics with Distinction. My dissertation used deep
                learning models to predict where the James Webb Space
                Telescope would find submillimetre galaxies in the COSMOS
                field. It was the kind of data science that required patience,
                rigour, and a healthy tolerance for debugging at 2am. Not a
                weekend bootcamp. Not a YouTube certificate. The real thing.
              </p>
            </div>

            {/* Act 2 */}
            <div className="mt-10">
              <p className="text-xs uppercase tracking-widest text-cyan mb-2">
                Then
              </p>
              <h3 className="font-syne text-2xl font-semibold text-navy mb-3">
                Then I studied Irish organisations.
              </h3>
              <p className="text-gray-700 leading-relaxed">
                Four years as a data analyst inside Tusla and the HSE taught
                me how Irish public sector teams actually work &mdash; the
                legacy systems, the Excel dependencies, the understaffed IT
                departments, the genuine goodwill from people who want better
                tools but have never had someone explain them clearly. I saw
                &ldquo;digital transformation&rdquo; projects arrive with
                fanfare and leave teams worse off. That stuck with me.
              </p>
            </div>

            {/* Act 3 */}
            <div className="mt-10">
              <p className="text-xs uppercase tracking-widest text-cyan mb-2">
                Now
              </p>
              <h3 className="font-syne text-2xl font-semibold text-navy mb-3">
                Now I close the gap.
              </h3>
              <p className="text-gray-700 leading-relaxed">
                I founded DataBridges in January 2021 to work directly with
                Irish SMEs and public sector teams. I also lecture at UCD
                Professional Academy &mdash; AI and machine learning,
                productivity with AI. The approach is the same in both:
                practical, specific, and honest about what AI can and cannot
                do. If you can explain something to a classroom, you can
                explain it to anyone. If that sounds useful, let&apos;s talk.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CREDENTIALS */}
      <section
        aria-labelledby="credentials-heading"
        className="py-20 px-6 bg-white"
      >
        <div className="mx-auto max-w-3xl">
          <h2
            id="credentials-heading"
            className="font-syne text-3xl font-semibold text-navy text-center"
          >
            Background
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12">
            {credentials.map((cred) => (
              <div
                key={cred.title}
                className="bg-white border border-gray-100 rounded-xl p-5 flex items-start gap-4"
              >
                <div className="font-syne w-10 h-10 rounded-lg bg-cyan/10 flex items-center justify-center text-cyan text-xs font-bold flex-shrink-0">
                  {cred.initial}
                </div>
                <div>
                  <p className="text-sm font-semibold text-navy">
                    {cred.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {cred.subtitle}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        aria-labelledby="about-cta-heading"
        className="bg-navy py-20 px-6"
      >
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="about-cta-heading"
            className="font-syne text-4xl font-bold text-white"
          >
            Want to work together?
          </h2>
          <p className="text-gray-300 text-lg max-w-xl mx-auto mt-4">
            A 30-minute call costs nothing and usually tells us both whether
            it&apos;s worth going further. No sales script. Just a
            conversation.
          </p>

          <a
            href="mailto:hello@databridges.ie"
            className="font-syne inline-block mt-8 bg-cyan text-navy font-semibold px-10 py-5 rounded-full text-lg hover:bg-white transition-colors duration-200"
          >
            Book a Free Chat &rarr;
          </a>
        </div>
      </section>
    </>
  );
}
