/**
 * Events shown on `/events`.
 *
 * Content lives as one markdown file per event in `content/events/`,
 * editable via the Decap CMS admin at `/admin` ("Events") without touching
 * code. Add a poster, title, date, location and description there and it
 * shows up here after the next deploy.
 *
 * This loader reads those files at build time (Node `fs`, never shipped to
 * the browser), so the site works exactly the same with zero events, one
 * event, or a folder that doesn't exist yet.
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export interface EventItem {
  slug: string;
  title: string;
  date: string; // ISO 8601
  location: string;
  posterImage?: string;
  registrationUrl?: string;
  description: string; // markdown body
}

const EVENTS_DIR = path.join(process.cwd(), "content", "events");

function loadAllEvents(): EventItem[] {
  if (!fs.existsSync(EVENTS_DIR)) return [];

  return fs
    .readdirSync(EVENTS_DIR)
    .filter((filename) => filename.endsWith(".md"))
    .map((filename) => {
      const raw = fs.readFileSync(path.join(EVENTS_DIR, filename), "utf8");
      const { data, content } = matter(raw);
      return {
        slug: filename.replace(/\.md$/, ""),
        title: data.title ?? "Untitled event",
        date: data.date
          ? new Date(data.date).toISOString()
          : new Date(0).toISOString(),
        location: data.location ?? "",
        posterImage: data.posterImage,
        registrationUrl: data.registrationUrl,
        description: content.trim(),
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

const ALL_EVENTS = loadAllEvents();
const NOW = Date.now();

/** Soonest first. */
export const UPCOMING_EVENTS: EventItem[] = ALL_EVENTS.filter(
  (e) => new Date(e.date).getTime() >= NOW
);

/** Most recently past first. */
export const PAST_EVENTS: EventItem[] = ALL_EVENTS.filter(
  (e) => new Date(e.date).getTime() < NOW
).reverse();
