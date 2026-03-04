import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Services",
  description:
    "DataBridges services: AI consulting & integration, Power Platform development, SharePoint automation, and hands-on training for Irish businesses.",
};

const services = [
  {
    id: "ai-consulting",
    icon: "🤖",
    title: "AI Consulting & Integration",
    tagline: "Practical AI adoption — no buzzwords required.",
    body: [
      "AI is everywhere, but most of what's out there is noise. DataBridges helps you cut through it — figuring out what tools are actually worth your time, which ones to avoid, and how to build AI into your existing workflows without blowing the budget or confusing your team.",
      "This includes reviewing your current processes, recommending the right tools (open-source or commercial), overseeing pilots, and making sure whatever gets built is something your team can actually use and maintain.",
    ],
    points: [
      "Tool selection and vendor-neutral advice",
      "Workflow analysis and AI opportunity mapping",
      "Pilot projects and proof-of-concept builds",
      "Ongoing support and iteration",
    ],
  },
  {
    id: "power-platform",
    icon: "⚡",
    title: "Power Platform Development",
    tagline: "Automate the boring bits so your team can focus on the rest.",
    body: [
      "Microsoft's Power Platform — Power Automate, Power Apps, and Power BI — is already included in most Microsoft 365 licences. Most businesses aren't using it anywhere near its potential.",
      "DataBridges builds practical solutions: approval flows, custom apps for internal processes, dashboards that surface the data you actually need. No unnecessary complexity. No six-month delivery timelines.",
    ],
    points: [
      "Power Automate flows for approvals, notifications, and data sync",
      "Power Apps for internal tools and forms",
      "Power BI dashboards and reports",
      "Integration with SharePoint, Teams, and third-party services",
    ],
  },
  {
    id: "sharepoint",
    icon: "📁",
    title: "SharePoint Automation",
    tagline: "An intranet that people actually use.",
    body: [
      "SharePoint has a reputation for being the place documents go to die. It doesn't have to be like that. DataBridges builds clean, well-structured SharePoint environments — intranets people can navigate, document libraries that make sense, and automated workflows that remove the manual steps your team currently dreads.",
      "Whether you're starting from scratch or rescuing an existing setup, the goal is the same: a SharePoint that works for the people using it.",
    ],
    points: [
      "Intranet design and build",
      "Document management and taxonomy",
      "Automated workflows (approval, archiving, notifications)",
      "Permissions and governance clean-up",
    ],
  },
  {
    id: "training",
    icon: "🎓",
    title: "Training & Workshops",
    tagline: "Hands-on sessions that actually make sense.",
    body: [
      "A lot of AI and Microsoft 365 training is death by slideshow. DataBridges takes a different approach: practical, hands-on sessions built around your team's actual work, not generic examples.",
      "Sessions can cover anything from 'what even is AI and should we care?' for leadership teams, to deep dives into Power Automate or Copilot for teams ready to get their hands dirty. All delivered in plain English — or plain Irish if you prefer.",
    ],
    points: [
      "AI literacy sessions for leadership and non-technical staff",
      "Microsoft 365 & Copilot workshops",
      "Power Platform hands-on training",
      "Custom workshops built around your tools and workflows",
    ],
  },
];

export default function ServicesPage() {
  return (
    <>
      {/* Page header */}
      <section className="bg-[#0A1E3D] text-white py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Services</h1>
          <p className="text-gray-300 text-lg leading-relaxed">
            Practical help with AI, automation, and Microsoft tools — delivered without the
            jargon.
          </p>
        </div>
      </section>

      {/* Service sections */}
      <div className="py-16 px-4">
        <div className="max-w-4xl mx-auto space-y-20">
          {services.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">{s.icon}</span>
                <span className="text-xs font-semibold uppercase tracking-widest text-[#3DE0E8]">
                  0{i + 1}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0A1E3D] mb-1">{s.title}</h2>
              <p className="text-[#3DE0E8] font-medium mb-6">{s.tagline}</p>
              <div className="space-y-4 text-gray-600 leading-relaxed mb-8">
                {s.body.map((para, j) => (
                  <p key={j}>{para}</p>
                ))}
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {s.points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-[#3DE0E8] font-bold mt-0.5">✓</span>
                    {point}
                  </li>
                ))}
              </ul>
              {i < services.length - 1 && (
                <hr className="mt-16 border-gray-100" />
              )}
            </section>
          ))}
        </div>
      </div>

      {/* CTA */}
      <section className="bg-[#0A1E3D] py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Not sure which service fits?</h2>
          <p className="text-gray-300 mb-8">
            Send a message and we can figure it out together. No commitment needed.
          </p>
          <Link
            href="/contact/"
            className="bg-[#FFC857] text-[#0A1E3D] px-8 py-3 rounded-full font-semibold hover:bg-white transition-colors"
          >
            Get in Touch
          </Link>
        </div>
      </section>
    </>
  );
}
