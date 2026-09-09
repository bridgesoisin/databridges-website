/**
 * EventCard, poster + details card for `/events`.
 *
 * Modeled on VignetteCard.tsx: presentational only, no client JS. The
 * scroll reveal is handled by the wrapping <ScrollReveal> at the call site.
 */

import Image from "next/image";
import type { EventItem } from "@/data/events";

interface EventCardProps {
  event: EventItem;
  /** Past events read a little quieter (dimmed, no CTA). */
  past?: boolean;
}

const dateFormatter = new Intl.DateTimeFormat("en-IE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default function EventCard({ event, past = false }: EventCardProps) {
  const { title, date, location, posterImage, registrationUrl, description } =
    event;
  const formattedDate = dateFormatter.format(new Date(date));

  return (
    <div
      className={`gfx-card flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white ${
        past ? "opacity-70" : ""
      }`}
    >
      {posterImage && (
        <div className="relative aspect-[4/3] w-full bg-navy/5">
          <Image
            src={posterImage}
            alt={`${title} poster`}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-ink">
          {formattedDate}
        </p>

        <h3 className="font-syne text-2xl font-bold text-navy mt-3">
          {title}
        </h3>

        {location && (
          <p className="text-sm text-gray-500 mt-2">{location}</p>
        )}

        {description && (
          <p className="text-[15px] leading-relaxed text-gray-600 mt-4 whitespace-pre-line">
            {description}
          </p>
        )}

        {!past && registrationUrl && (
          <a
            href={registrationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block text-cyan-ink text-sm font-medium hover:underline"
          >
            Register / book &rarr;
          </a>
        )}
      </div>
    </div>
  );
}
