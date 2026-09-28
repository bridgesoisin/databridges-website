import type { Metadata } from "next";
import Link from "next/link";
import AnimatedBlobs from "@/components/graphics/AnimatedBlobs";
import ScrollReveal from "@/components/ScrollReveal";
import EventCard from "@/components/EventCard";
import { UPCOMING_EVENTS, PAST_EVENTS } from "@/data/events";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Workshops, training sessions and talks from DataBridges: practical AI and Power Platform events for Irish businesses and public sector teams.",
  alternates: { canonical: "/events" },
  openGraph: {
    type: "website",
    locale: "en_IE",
    siteName: "DataBridges",
    url: "https://databridges.ie/events",
    title: "Events | DataBridges",
    description:
      "Workshops, training sessions and talks from DataBridges: practical AI and Power Platform events for Irish businesses and public sector teams.",
    images: ["/images/og-card.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Events | DataBridges",
    description:
      "Workshops, training sessions and talks from DataBridges for Irish businesses and public sector teams.",
    images: ["/images/og-card.jpg"],
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://databridges.ie",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Events",
      item: "https://databridges.ie/events",
    },
  ],
};

// Only upcoming events get Event rich-result markup, matching Google's
// guidance that Event schema is for events people can still attend.
const eventsJsonLd = UPCOMING_EVENTS.map((e) => ({
  "@context": "https://schema.org",
  "@type": "Event",
  name: e.title,
  startDate: e.date,
  location: e.location
    ? { "@type": "Place", name: e.location }
    : undefined,
  image: e.posterImage
    ? `https://databridges.ie${e.posterImage}`
    : undefined,
  description: e.description || undefined,
  url: e.registrationUrl || "https://databridges.ie/events",
  organizer: {
    "@type": "Organization",
    name: "DataBridges",
    url: "https://databridges.ie",
  },
}));

export default function EventsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {eventsJsonLd.map((ld, i) => (
        <script
          key={UPCOMING_EVENTS[i].slug}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}

      {/* ─── HERO ─── */}
      <section
        id="events-hero"
        data-otter-section="events-hero"
        aria-labelledby="events-hero-heading"
        className="relative overflow-hidden bg-navy px-6 pt-32 md:pt-40 pb-20 md:pb-28"
      >
        <AnimatedBlobs />

        <div className="relative mx-auto max-w-6xl">
          <p className="db-eyebrow db-eyebrow--dark">Events</p>
          <h1
            id="events-hero-heading"
            className="db-display text-white mt-4 leading-tight"
          >
            Workshops, talks, training.
          </h1>
          <p className="text-gray-300 text-lg mt-6 max-w-2xl">
            Practical AI and Power Platform sessions, the same straight-
            talking approach as everything else DataBridges does.
          </p>
        </div>
      </section>

      {/* ─── UPCOMING EVENTS ─── */}
      <section
        id="upcoming-events"
        data-otter-section="upcoming-events"
        aria-labelledby="upcoming-heading"
        className="py-20 md:py-28 px-6"
        style={{ backgroundColor: "var(--color-offwhite)" }}
      >
        <div className="mx-auto max-w-5xl">
          <p className="db-eyebrow db-eyebrow--light mb-4">Coming up</p>
          <h2 id="upcoming-heading" className="db-h2 text-navy">
            Upcoming events
          </h2>

          {UPCOMING_EVENTS.length === 0 ? (
            <p className="db-subhead text-gray-500 mt-6">
              Nothing scheduled right now, check back soon, or{" "}
              <Link
                href="/contact"
                className="text-cyan-ink font-medium hover:underline"
              >
                get in touch
              </Link>{" "}
              if you&apos;d like to arrange a session for your team.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 md:mt-14">
              {UPCOMING_EVENTS.map((event, i) => (
                <ScrollReveal
                  key={event.slug}
                  delay={(i % 2) * 100}
                  className="h-full"
                >
                  <EventCard event={event} />
                </ScrollReveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── PAST EVENTS ─── */}
      {PAST_EVENTS.length > 0 && (
        <section
          id="past-events"
          data-otter-section="past-events"
          aria-labelledby="past-heading"
          className="py-20 md:py-28 px-6 bg-white"
        >
          <div className="mx-auto max-w-5xl">
            <p className="db-eyebrow db-eyebrow--light mb-4">Archive</p>
            <h2 id="past-heading" className="db-h2 text-navy">
              Past events
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 md:mt-14">
              {PAST_EVENTS.map((event) => (
                <EventCard key={event.slug} event={event} past />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── FOOTER CTA ─── */}
      <section
        id="footer-cta"
        data-otter-section="footer-cta"
        aria-labelledby="events-cta-heading"
        className="py-20 md:py-28 px-6 border-t border-navy/10"
        style={{ backgroundColor: "var(--color-yellow)" }}
      >
        <div className="mx-auto max-w-2xl text-center">
          <span
            aria-hidden="true"
            className="mb-6 inline-block h-2.5 w-2.5 rotate-45 bg-navy/70"
          />
          <h2
            id="events-cta-heading"
            className="db-h2 font-extrabold text-navy leading-tight"
          >
            Want a session for your own team?
          </h2>
          <p className="text-navy/70 text-xl mt-4">
            Tell us what you need. We&apos;ll have an honest conversation about
            whether we can help.
          </p>

          <Link
            href="/contact"
            className="font-syne inline-block mt-10 bg-navy text-white font-semibold px-10 py-5 rounded-full text-lg hover:bg-navy/90 transition-colors duration-200"
          >
            Get in touch &rarr;
          </Link>
        </div>
      </section>
    </>
  );
}
