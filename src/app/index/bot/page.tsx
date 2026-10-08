import type { Metadata } from "next";
import AnimatedBlobs from "@/components/graphics/AnimatedBlobs";
import { OWN_AGENT_TOKEN, OWN_USER_AGENT } from "@/lib/visibility/lists";
import { MAX_REQUESTS } from "@/lib/visibility/scan";

// The page the scanner's User-Agent links to. It is live so a site owner who finds DataBridgesBot in their
// logs can see who it is and how to stop it, but it is noindex and not in the navigation or sitemap
// (databridges-agent-docs-v2/02, reserved routes). Every number below is read from the scanner's code.

const CONTACT_EMAIL = "oisin@databridges.ie";

export const metadata: Metadata = {
  title: "DataBridgesBot",
  description:
    "DataBridgesBot is the website checker run by DataBridges. What it reads, how it follows robots.txt, and how to block it or ask us to stop.",
  alternates: { canonical: "/index/bot" },
  robots: { index: false, follow: true },
};

export default function BotPage() {
  const subject = encodeURIComponent("DataBridgesBot");
  return (
    <>
      <section
        id="bot-hero"
        data-otter-section="bot-hero"
        aria-labelledby="bot-heading"
        className="db-subpage-hero relative overflow-hidden bg-navy px-6"
      >
        <AnimatedBlobs />
        <div className="relative mx-auto max-w-4xl">
          <p className="db-eyebrow db-eyebrow--dark">Crawler information</p>
          <h1 id="bot-heading" className="db-display text-white mt-4 leading-tight">
            DataBridgesBot
          </h1>
          <p className="text-gray-300 text-lg mt-6 max-w-2xl">
            DataBridgesBot is the website checker run by DataBridges, an AI and automation consultancy in
            Kilcock, Co. Kildare. It reads a few public pages of a business website to check search and
            AI-answer readiness signals, using a published checklist.
          </p>
        </div>
      </section>

      <section
        id="bot-details"
        data-otter-section="bot-details"
        aria-label="How DataBridgesBot works"
        className="py-20 md:py-28 px-6"
        style={{ backgroundColor: "var(--color-offwhite)" }}
      >
        <div className="mx-auto max-w-3xl">
          <h2 className="db-h2 text-navy">How to recognise it</h2>
          <p className="text-gray-600 text-lg leading-relaxed mt-4">It sends this User-Agent header:</p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-navy p-4 font-jetbrains text-sm text-white">
            <code>{OWN_USER_AGENT}</code>
          </pre>
          <p className="text-gray-600 text-lg leading-relaxed mt-4">
            It runs on cloud servers, so there is no fixed list of IP addresses.
          </p>

          <h2 className="db-h2 text-navy mt-14">What it reads</h2>
          <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-600 text-lg leading-relaxed">
            <li>
              <code className="font-jetbrains text-[0.9em]">robots.txt</code> first, and it follows it. It
              obeys the rules for <code className="font-jetbrains text-[0.9em]">{OWN_AGENT_TOKEN}</code>, or
              the rules for <code className="font-jetbrains text-[0.9em]">*</code> if there is no group for it.
            </li>
            <li>The homepage and up to four other pages, chosen by a fixed rule.</li>
            <li>
              Your sitemap and <code className="font-jetbrains text-[0.9em]">llms.txt</code> if you have them,
              and whether some links on those pages work.
            </li>
          </ul>
          <p className="text-gray-600 text-lg leading-relaxed mt-4">
            It only reads. It uses GET and HEAD requests, does not run JavaScript, does not fill in forms,
            does not log in, and does not keep cookies.
          </p>

          <h2 className="db-h2 text-navy mt-14">How gently</h2>
          <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-600 text-lg leading-relaxed">
            <li>At most {MAX_REQUESTS} requests to a site in one check.</li>
            <li>At most two requests at a time, at least a quarter of a second apart.</li>
            <li>Each check stops after 20 seconds, whatever it has read.</li>
            <li>A site is normally checked once, when we prepare an issue about its sector.</li>
          </ul>

          <h2 className="db-h2 text-navy mt-14">What we keep</h2>
          <p className="text-gray-600 text-lg leading-relaxed mt-4">
            The results of the checks (numbers and which checks passed), the site address and the business
            name. We do not keep copies of your pages, and we do not collect personal details from them.
          </p>

          <h2 className="db-h2 text-navy mt-14">How to block it</h2>
          <p className="text-gray-600 text-lg leading-relaxed mt-4">Add this to your robots.txt:</p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-navy p-4 font-jetbrains text-sm text-white">
            <code>{`User-agent: ${OWN_AGENT_TOKEN}\nDisallow: /`}</code>
          </pre>
          <p className="text-gray-600 text-lg leading-relaxed mt-4">
            If it is blocked, we cannot check your site and it will not be featured.
          </p>

          <h2 className="db-h2 text-navy mt-14">Ask us to stop</h2>
          <p className="text-gray-600 text-lg leading-relaxed mt-4">
            Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}?subject=${subject}`} className="text-cyan-ink underline underline-offset-4">
              {CONTACT_EMAIL}
            </a>{" "}
            with your website address. We add it to our do-not-contact list, and it is not checked, featured
            or contacted again. You do not need to give a reason.
          </p>
        </div>
      </section>
    </>
  );
}
