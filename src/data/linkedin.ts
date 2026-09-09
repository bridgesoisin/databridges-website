/**
 * The LinkedIn posts surfaced in the Home "Straight talk about AI" section.
 *
 * Content lives in `content/linkedin.json`, editable via the Decap CMS admin
 * at `/admin` ("LinkedIn Posts") without touching code. This file is just a
 * typed loader so `LINKEDIN_POSTS` keeps its original shape for consumers
 * (`src/app/page.tsx`, `LinkedInPostCard.tsx`) — neither needed to change.
 *
 * Topic `tag`s let the section read as a body of work rather than five
 * near-identical AI-Act posts. The EU AI Act preview (post 1) is the
 * already-corrected Article 50 / 2 August 2026 story, do not regress it.
 */

import linkedinData from "../../content/linkedin.json";

export interface LinkedInPost {
  tag: string; // topic chip
  previewText: string;
  postUrl: string;
}

export const LINKEDIN_POSTS: LinkedInPost[] = linkedinData.posts;
