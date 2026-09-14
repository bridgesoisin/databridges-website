/**
 * The LinkedIn posts surfaced across the site: `featured` ones on the Home
 * "Straight talk about AI" section, the rest on the About page.
 *
 * Content lives in `content/linkedin.json`, editable via the Decap CMS admin
 * at `/admin` ("LinkedIn Posts") without touching code. This file is just a
 * typed loader so `LINKEDIN_POSTS` keeps its shape for consumers
 * (`src/app/page.tsx`, `src/app/about/page.tsx`, `LinkedInPostCard.tsx`).
 *
 * Every entry's `postUrl` resolves to a specific post or article — never the
 * bare profile page. Five of the eight are converted from LinkedIn's embed
 * format (`embed/feed/update/...`) to the normal public permalink
 * (`feed/update/.../`), since the embed URLs are meant for an iframe widget,
 * not a standalone destination.
 */

import linkedinData from "../../content/linkedin.json";

export interface LinkedInPost {
  tag: string; // topic chip
  previewText: string;
  postUrl: string;
  featured: boolean; // true = shown on the homepage; false = About page only
}

export const LINKEDIN_POSTS: LinkedInPost[] = linkedinData.posts;
