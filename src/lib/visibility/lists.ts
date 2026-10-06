export const LISTS_VERSION = "1.0.0-draft";

export const OWN_AGENT_TOKEN = "DataBridgesBot";
export const OWN_USER_AGENT =
  "DataBridgesBot/1.0 (+https://databridges.ie/index/bot)";

export type AgentTreatment =
  | "scored-classic-search"
  | "scored-ai-search"
  | "informational-training"
  | "informational-user-initiated";

export interface AiAgent {
  token: string;
  operator: string;
  purpose: string;
  treatment: AgentTreatment;
  docsUrl: string | null;
  verifiedAt: string | null;
  reviewDueAt: string | null;
}

const unverified = { docsUrl: null, verifiedAt: null, reviewDueAt: null };

export const AI_AGENTS: readonly AiAgent[] = [
  { token: "Googlebot", operator: "Google", purpose: "Search", treatment: "scored-classic-search", ...unverified },
  { token: "bingbot", operator: "Microsoft", purpose: "Search", treatment: "scored-classic-search", ...unverified },
  { token: "OAI-SearchBot", operator: "OpenAI", purpose: "Search index for ChatGPT search", treatment: "scored-ai-search", ...unverified },
  { token: "PerplexityBot", operator: "Perplexity", purpose: "Search index", treatment: "scored-ai-search", ...unverified },
  { token: "Claude-SearchBot", operator: "Anthropic", purpose: "Search quality", treatment: "scored-ai-search", ...unverified },
  { token: "GPTBot", operator: "OpenAI", purpose: "Model training", treatment: "informational-training", ...unverified },
  { token: "ClaudeBot", operator: "Anthropic", purpose: "Model training", treatment: "informational-training", ...unverified },
  { token: "Google-Extended", operator: "Google", purpose: "Robots token for model use", treatment: "informational-training", ...unverified },
  { token: "Applebot-Extended", operator: "Apple", purpose: "Robots token for model use", treatment: "informational-training", ...unverified },
  { token: "CCBot", operator: "Common Crawl", purpose: "Open web corpus", treatment: "informational-training", ...unverified },
  { token: "Amazonbot", operator: "Amazon", purpose: "Crawling and model use", treatment: "informational-training", ...unverified },
  { token: "Bytespider", operator: "ByteDance", purpose: "Crawling and model use", treatment: "informational-training", ...unverified },
  { token: "meta-externalagent", operator: "Meta", purpose: "Crawling and model use", treatment: "informational-training", ...unverified },
  { token: "ChatGPT-User", operator: "OpenAI", purpose: "User-initiated fetch", treatment: "informational-user-initiated", ...unverified },
  { token: "Claude-User", operator: "Anthropic", purpose: "User-initiated fetch", treatment: "informational-user-initiated", ...unverified },
  { token: "Perplexity-User", operator: "Perplexity", purpose: "User-initiated fetch", treatment: "informational-user-initiated", ...unverified },
];

export const CLASSIC_SEARCH_AGENTS: readonly string[] = ["Googlebot", "bingbot"];
export const AI_SEARCH_AGENTS: readonly string[] = [
  "OAI-SearchBot",
  "PerplexityBot",
  "Claude-SearchBot",
];

export function isListStale(reviewDueAt: string | null, now: Date): boolean {
  if (reviewDueAt === null) return true;
  const due = Date.parse(reviewDueAt);
  return Number.isNaN(due) || due < now.getTime();
}

export const NON_HTML_EXT: readonly string[] = [
  ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico", ".css",
  ".js", ".json", ".xml", ".zip", ".gz", ".mp3", ".mp4", ".webm", ".doc",
  ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt",
];

export const UTILITY_EXCLUDE: readonly RegExp[] = [
  /^\/(login|signin|sign-in|register|signup|account|my-account|cart|basket|checkout|wp-admin|wp-login|admin|search|thank|thanks|cdn-cgi|api|feed|tag|category|author)(\/|$)/i,
  /^\/page\/\d+(\/|$)/i,
];

export type SampledPageType =
  | "services"
  | "about"
  | "faq"
  | "contact"
  | "legal"
  | "article";

export const PAGE_TYPE_PATTERNS: readonly { type: SampledPageType; pattern: RegExp }[] = [
  { type: "services", pattern: /^\/(services?|solutions?|what-we-do|offerings?|products?)(\/|$)/i },
  { type: "about", pattern: /^\/(about|about-us|who-we-are|our-story|team|company)(\/|$)/i },
  { type: "faq", pattern: /^\/(faq|faqs|questions|help)(\/|$)/i },
  { type: "contact", pattern: /^\/(contact|contact-us|get-in-touch|enquir[a-z]*)(\/|$)/i },
  { type: "legal", pattern: /^\/(privacy|privacy-policy|terms|cookies?|legal|disclaimer)(\/|$)/i },
  { type: "article", pattern: /^\/(blog|news|insights|articles?|resources|journal|posts?)\/.+/i },
];

export const ABOUT_PATTERN = /^\/(about|about-us|who-we-are|our-story|team|company)(\/|$)/i;
export const CONTACT_PATTERN = /^\/(contact|contact-us|get-in-touch|enquir[a-z]*)(\/|$)/i;
export const PRIVACY_PATTERN = /^\/(privacy|privacy-policy|privacy-notice|data-protection)(\/|$)/i;

export const GENERIC_ANCHORS: ReadonlySet<string> = new Set([
  "click here", "here", "read more", "learn more", "more", "link", "this",
  "details", "continue", "view", "click", "read", "find out more", "see more",
  "go",
]);

export const QUESTION_STARTERS: ReadonlySet<string> = new Set([
  "what", "why", "how", "when", "where", "who", "which", "can", "do", "does",
  "did", "is", "are", "was", "were", "should", "will", "would", "could", "may",
  "might",
]);

export const SPA_ROOT_SELECTORS: readonly string[] = [
  "#root", "#app", "#__next", "#__nuxt", "[data-reactroot]", "[ng-version]",
];

export const NOSCRIPT_JS_MESSAGE =
  /enable\s+javascript|requires?\s+javascript|javascript\s+(is\s+)?(required|disabled)/i;

export const ORG_TYPES: ReadonlySet<string> = new Set([
  "Organization", "Corporation", "LocalBusiness", "ProfessionalService", "NGO",
  "EducationalOrganization", "GovernmentOrganization", "MedicalBusiness",
  "Store", "Restaurant", "FinancialService", "LegalService",
  "AccountingService", "RealEstateAgent", "TravelAgency",
  "HomeAndConstructionBusiness",
]);

export const ARTICLE_SCHEMA_TYPES: ReadonlySet<string> = new Set([
  "Article", "BlogPosting", "NewsArticle", "TechArticle",
]);

export const SERVICE_SCHEMA_TYPES: ReadonlySet<string> = new Set([
  "Service", "Product", "OfferCatalog",
]);

export const SHARE_LINK_PATTERNS: readonly RegExp[] = [
  /^https?:\/\/(www\.)?facebook\.com\/sharer/i,
  /^https?:\/\/(www\.)?(twitter|x)\.com\/(intent|share)/i,
  /^https?:\/\/(www\.)?linkedin\.com\/(sharing|shareArticle)/i,
  /^https?:\/\/(www\.)?pinterest\.com\/pin\/create/i,
  /^https?:\/\/wa\.me\//i,
];

export const CJK_THAI_LANGS: readonly string[] = ["zh", "ja", "ko", "th"];
