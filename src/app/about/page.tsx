import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about DataBridges and Oisín — an Irish AI consultant based in Kilcock, Co. Kildare, helping businesses adopt technology that actually works.",
};

const values = [
  {
    title: "Plain language",
    description:
      "If you need a glossary to understand the advice, the advice isn't good enough. Everything DataBridges delivers is explained in terms that make sense to the people who'll actually use it.",
  },
  {
    title: "Practical results",
    description:
      "The measure of success isn't a beautiful deck or a completed project — it's whether the thing works and gets used. That's what we optimise for.",
  },
  {
    title: "No hidden agenda",
    description:
      "DataBridges doesn't take referral fees or vendor commissions. Recommendations are based on what's right for you, not what pays the best margin.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Page header */}
      <section className="bg-[#0A1E3D] text-white py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">About DataBridges</h1>
          <p className="text-gray-300 text-lg leading-relaxed">
            A one-person consultancy with a straightforward mission: make technology work for
            Irish businesses, not the other way around.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-[#0A1E3D] mb-6">The Story</h2>
          <div className="space-y-5 text-gray-600 leading-relaxed">
            <p>
              DataBridges was founded by Oisín, based in Kilcock, Co. Kildare. The name comes
              from a simple idea: technology should act as a bridge between people and better
              outcomes — not a barrier, not a buzzword generator, not a reason to hire an army
              of consultants.
            </p>
            <p>
              After working inside Irish organisations across different sectors, a pattern
              emerged: businesses were spending real money on AI and automation projects that
              delivered very little. Not because the technology was bad, but because the advice
              wasn't grounded in how people actually work.
            </p>
            <p>
              DataBridges exists to fix that. Small enough to stay honest. Experienced enough
              to cut through the noise. Based in Ireland, working with Irish businesses, on
              problems that actually matter to them.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-gray-50 py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-[#0A1E3D] mb-10">How We Work</h2>
          <div className="space-y-8">
            {values.map((v) => (
              <div key={v.title} className="flex gap-4">
                <span className="text-[#3DE0E8] font-bold text-xl mt-0.5">→</span>
                <div>
                  <h3 className="font-bold text-[#0A1E3D] mb-1">{v.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{v.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0A1E3D] py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Sound like a good fit?</h2>
          <p className="text-gray-300 mb-8">
            If you're looking for practical help — not a PowerPoint about digital transformation
            — get in touch and we'll take it from there.
          </p>
          <Link
            href="/contact/"
            className="bg-[#3DE0E8] text-[#0A1E3D] px-8 py-3 rounded-full font-semibold hover:bg-[#FFC857] transition-colors"
          >
            Get in Touch
          </Link>
        </div>
      </section>
    </>
  );
}
