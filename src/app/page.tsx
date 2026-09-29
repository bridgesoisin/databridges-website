import Image from "next/image";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import AnimatedBlobs from "@/components/graphics/AnimatedBlobs";
import NodeGraph from "@/components/graphics/NodeGraph";

export default function Home() {
  return (
    <>
      <section
        id="hero"
        data-otter-section="hero"
        data-scroll-section
        aria-labelledby="hero-heading"
        className="relative flex min-h-[100svh] items-center overflow-hidden bg-navy"
      >
        <AnimatedBlobs />

        <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 pb-16 pt-28 md:pt-32 lg:grid-cols-[1.35fr_0.65fr]">
          <div>
            <div
              className="mb-8 flex items-center gap-3 md:mb-10 md:gap-4"
              aria-label="DataBridges"
            >
              <Image
                src="/images/db-diamond.png"
                alt=""
                width={64}
                height={64}
                className="h-12 w-12 md:h-16 md:w-16"
                priority
              />
              <span className="font-gilroy text-[clamp(2.1rem,4vw,3.5rem)] font-extrabold leading-none tracking-tight">
                <span className="text-white">data</span>
                <span className="text-cyan">bridges</span>
              </span>
            </div>

            <p className="db-eyebrow db-eyebrow--dark mb-5">
              Visibility &rarr; improvement &rarr; automation
            </p>
            <h1
              id="hero-heading"
              className="font-gilroy leading-[1.05] text-white"
              style={{
                fontSize: "clamp(1.35rem, 3.4vw, 3rem)",
                fontWeight: 800,
              }}
            >
              <span className="block whitespace-nowrap">Get found.</span>{" "}
              <span className="block whitespace-nowrap">Find the friction.</span>{" "}
              <span className="block whitespace-nowrap">
                Automate what matters.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-relaxed text-gray-300">
              Practical, responsible AI, automation and business growth for
              Irish SMEs and operational teams.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/contact"
                className="rounded-full bg-cyan px-8 py-4 text-lg font-semibold text-navy transition-colors duration-200 hover:bg-white"
              >
                Start with one problem &rarr;
              </Link>
              <Link
                href="#visibility"
                className="inline-flex min-h-12 items-center px-2 font-medium text-white transition-colors duration-200 hover:text-cyan"
              >
                See how it works
              </Link>
            </div>
          </div>

          <div className="relative mx-auto hidden w-full max-w-xs lg:block lg:max-w-none">
            <NodeGraph ariaLabel="People, information and processes connected through a considered decision" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-cyan shadow-2xl ring-8 ring-navy sm:h-40 sm:w-40 lg:h-48 lg:w-48">
                <Image
                  src="/images/headshot-oisin.webp"
                  alt="Oisín Bridges"
                  width={800}
                  height={800}
                  sizes="192px"
                  priority
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="visibility"
        data-otter-section="visibility"
        aria-labelledby="visibility-heading"
        className="px-6 py-16 md:py-24"
        style={{ backgroundColor: "var(--color-offwhite)" }}
      >
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 md:grid-cols-[0.7fr_1.3fr]">
          <div
            aria-hidden="true"
            className="font-gilroy text-[clamp(6rem,16vw,11rem)] font-extrabold leading-none text-cyan/35"
          >
            01
          </div>
          <ScrollReveal>
            <p className="db-eyebrow db-eyebrow--light mb-4">Visibility</p>
            <h2 id="visibility-heading" className="db-h2 max-w-3xl text-navy">
              Get found and understood.
            </h2>
            <p className="db-subhead mt-5 max-w-2xl text-gray-600">
              Growth starts when the right people can find you, understand what
              you offer and see a clear next step.
            </p>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-gray-600">
              We clarify the message and strengthen the routes that connect
              your business with the people it can help.
            </p>
            <Link
              href="/seo-aeo"
              className="mt-7 inline-flex min-h-11 items-center font-semibold text-cyan-ink hover:text-navy"
            >
              Explore visibility &rarr;
            </Link>
          </ScrollReveal>
        </div>
      </section>

      <section
        id="improvement"
        data-otter-section="improvement"
        aria-labelledby="improvement-heading"
        className="bg-white px-6 py-16 md:py-24"
      >
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 md:grid-cols-[1.3fr_0.7fr]">
          <ScrollReveal className="md:order-1">
            <p className="db-eyebrow db-eyebrow--light mb-4">Improvement</p>
            <h2 id="improvement-heading" className="db-h2 max-w-3xl text-navy">
              Find and remove the friction.
            </h2>
            <p className="db-subhead mt-5 max-w-2xl text-gray-600">
              When interest becomes work, unclear handoffs and unnecessary
              steps start to cost time and attention.
            </p>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-gray-600">
              We map what actually happens, simplify the process and keep the
              human decisions that add value.
            </p>
            <Link
              href="/services"
              className="mt-7 inline-flex min-h-11 items-center font-semibold text-cyan-ink hover:text-navy"
            >
              Explore improvement &rarr;
            </Link>
          </ScrollReveal>
          <div
            aria-hidden="true"
            className="font-gilroy text-[clamp(6rem,16vw,11rem)] font-extrabold leading-none text-navy/10 md:order-2 md:text-right"
          >
            02
          </div>
        </div>
      </section>

      <section
        id="automation"
        data-otter-section="automation"
        aria-labelledby="automation-heading"
        className="bg-navy px-6 py-16 md:py-24"
      >
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 md:grid-cols-[0.7fr_1.3fr]">
          <div
            aria-hidden="true"
            className="font-gilroy text-[clamp(6rem,16vw,11rem)] font-extrabold leading-none text-cyan/25"
          >
            03
          </div>
          <ScrollReveal>
            <p className="db-eyebrow db-eyebrow--dark mb-4">Automation</p>
            <h2 id="automation-heading" className="db-h2 max-w-3xl text-white">
              Automate what is worth automating.
            </h2>
            <p className="db-subhead mt-5 max-w-2xl text-gray-300">
              Automation comes after the work is understood and improved, not
              before.
            </p>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-gray-300">
              We focus on stable, repeatable work, keep human accountability
              visible and plan for exceptions when the process does not behave
              as expected.
            </p>
            <Link
              href="/contact"
              className="mt-7 inline-flex min-h-11 items-center font-semibold text-cyan hover:text-white"
            >
              Discuss automation &rarr;
            </Link>
          </ScrollReveal>
        </div>
      </section>

      <section
        id="footer-cta"
        data-otter-section="footer-cta"
        aria-labelledby="footer-cta-heading"
        className="border-t border-navy/10 px-6 py-16 md:py-24"
        style={{ backgroundColor: "var(--color-yellow)" }}
      >
        <div className="mx-auto max-w-2xl text-center">
          <span
            aria-hidden="true"
            className="mb-6 inline-block h-2.5 w-2.5 rotate-45 bg-navy/70"
          />
          <p className="db-eyebrow db-eyebrow--yellow mb-4">A useful next step</p>
          <h2
            id="footer-cta-heading"
            className="db-h2 font-extrabold leading-tight text-navy"
          >
            Start with one problem that feels harder than it should.
          </h2>
          <p className="mt-4 text-xl text-navy/70">
            Describe what happens now, where it gets stuck and what a better
            outcome would look like. That is enough to begin.
          </p>
          <ol
            className="mt-8 grid grid-cols-1 gap-3 text-left sm:grid-cols-3"
            aria-label="What happens next"
          >
            {[
              "Describe the work",
              "Identify the decision",
              "Agree a useful next step",
            ].map((step, index) => (
              <li
                key={step}
                className="rounded-xl border border-navy/15 bg-white/35 px-4 py-3 text-sm font-medium text-navy"
              >
                <span
                  className="mr-2 font-jetbrains text-xs text-navy/60"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <Link
            href="/contact"
            className="mt-10 inline-block rounded-full bg-navy px-10 py-5 font-syne text-lg font-semibold text-white transition-colors duration-200 hover:bg-navy/90"
          >
            Send an enquiry &rarr;
          </Link>
        </div>
      </section>
    </>
  );
}
