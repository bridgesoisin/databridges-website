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
                Automate with AI.
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
              Growth starts when the right people can find your business,
              understand what you offer, and know what to do next.
            </p>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-gray-600">
              At DataBridges, we sharpen your message, strengthen SEO and AEO
              visibility, and improve the website and marketing pathways that
              connect your business with the people most likely to become
              customers.
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
        className="bg-navy px-6 py-16 md:py-24"
      >
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 md:grid-cols-[0.55fr_1.45fr]">
          <div
            aria-hidden="true"
            className="font-gilroy text-[clamp(6rem,16vw,11rem)] font-extrabold leading-none text-cyan/25"
          >
            02
          </div>
          <ScrollReveal>
            <p className="db-eyebrow db-eyebrow--dark mb-4">
              Improvement + automation
            </p>
            <h2 id="improvement-heading" className="db-h2 max-w-3xl text-white">
              Remove friction. Automate with AI.
            </h2>
            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/15 bg-white/5 p-6">
                <p className="font-jetbrains text-xs uppercase tracking-[0.2em] text-cyan">
                  Improve
                </p>
                <h3 className="mt-3 font-gilroy text-2xl font-bold text-white">
                  Remove friction and bottlenecks.
                </h3>
                <p className="mt-3 leading-relaxed text-gray-300">
                  We use DataBridges&apos; AI workflow to understand where work
                  slows down, simplify the process and keep the human decisions
                  that add value.
                </p>
              </div>
              <div
                id="automation"
                className="rounded-2xl border border-white/15 bg-white/5 p-6"
              >
                <p className="font-jetbrains text-xs uppercase tracking-[0.2em] text-cyan">
                  Automate
                </p>
                <h3 className="mt-3 font-gilroy text-2xl font-bold text-white">
                  Use AI for routine work.
                </h3>
                <p className="mt-3 leading-relaxed text-gray-300">
                  We automate stable, repeatable work while keeping ownership,
                  exceptions and human accountability clear.
                </p>
              </div>
            </div>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                href="/services"
                className="inline-flex min-h-12 items-center rounded-full border border-cyan px-6 font-semibold text-cyan transition-colors hover:bg-cyan hover:text-navy"
              >
                Explore services
              </Link>
              <Link
                href="/contact"
                className="inline-flex min-h-12 items-center rounded-full bg-cyan px-6 font-semibold text-navy transition-colors hover:bg-white"
              >
                Start with one problem &rarr;
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
