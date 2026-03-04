import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "DataBridges — AI Consulting for Irish Businesses",
  description:
    "DataBridges makes AI useful for Irish businesses — without the buzzwords. Consulting, automation, SharePoint, Power Platform, and practical training.",
};

const services = [
  {
    icon: "🤖",
    title: "AI Consulting & Integration",
    description: "Practical AI adoption that fits your workflow — no vendor lock-in, no hype.",
  },
  {
    icon: "⚡",
    title: "Power Platform Development",
    description: "Custom Power Automate flows, Power Apps, and Power BI dashboards that actually get used.",
  },
  {
    icon: "📁",
    title: "SharePoint Automation",
    description: "Intranet builds, document management, and automated workflows on SharePoint.",
  },
  {
    icon: "🎓",
    title: "Training & Workshops",
    description: "Hands-on sessions that demystify AI and Microsoft tools for real teams.",
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="bg-[#0A1E3D] text-white py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            Making AI{" "}
            <span className="text-[#3DE0E8]">Useful</span>
            <br />
            <span className="text-2xl sm:text-3xl lg:text-4xl font-normal text-gray-300">
              (and mildly tolerable)
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            DataBridges helps Irish businesses cut through the AI noise and adopt tools that
            actually work — from Power Platform to SharePoint to hands-on training.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/services/"
              className="bg-[#3DE0E8] text-[#0A1E3D] px-8 py-3 rounded-full font-semibold text-base hover:bg-white transition-colors"
            >
              See What We Do
            </Link>
            <Link
              href="/contact/"
              className="border border-[#3DE0E8] text-[#3DE0E8] px-8 py-3 rounded-full font-semibold text-base hover:bg-[#3DE0E8] hover:text-[#0A1E3D] transition-colors"
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </section>

      {/* Services overview */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0A1E3D] mb-4">What We Do</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Practical services — no unnecessary complexity, no jargon unless you ask for it.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s) => (
              <div
                key={s.title}
                className="border border-gray-100 rounded-2xl p-6 hover:shadow-lg hover:border-[#3DE0E8] transition-all group"
              >
                <div className="text-4xl mb-4">{s.icon}</div>
                <h3 className="font-bold text-[#0A1E3D] mb-2 group-hover:text-[#3DE0E8] transition-colors">
                  {s.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/services/"
              className="text-[#3DE0E8] font-semibold hover:text-[#0A1E3D] transition-colors underline underline-offset-4"
            >
              Full details on our services →
            </Link>
          </div>
        </div>
      </section>

      {/* About teaser */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-[#0A1E3D] mb-6">Who's Behind DataBridges?</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            DataBridges was founded by Oisín, based in Kilcock, Co. Kildare. After years working
            inside Irish organisations and watching AI projects fail spectacularly (or just
            embarrassingly), the goal became clear: bring practical, plain-language AI guidance to
            businesses that don't have time for hype.
          </p>
          <p className="text-gray-600 leading-relaxed mb-8">
            No fluff, no vendor kickbacks, no slide decks that say "leverage synergies." Just
            honest advice and tools that get the job done.
          </p>
          <Link
            href="/about/"
            className="inline-block border border-[#0A1E3D] text-[#0A1E3D] px-6 py-3 rounded-full font-semibold hover:bg-[#0A1E3D] hover:text-white transition-colors"
          >
            More About Us
          </Link>
        </div>
      </section>

      {/* CTA banner */}
      <section className="bg-[#0A1E3D] py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-gray-300 mb-8">
            Whether you have a specific project in mind or just want to explore what's possible,
            drop us a line. No obligation, no sales pitch.
          </p>
          <Link
            href="/contact/"
            className="bg-[#FFC857] text-[#0A1E3D] px-8 py-3 rounded-full font-semibold text-base hover:bg-white transition-colors"
          >
            Start the Conversation
          </Link>
        </div>
      </section>
    </>
  );
}
