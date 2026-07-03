/**
 * Single source of truth for the engagement vignettes.
 *
 * Imported by both `/work` (full cards) and the Home "Where we've helped"
 * section (compact cards), so the copy can never diverge.
 *
 * House rules baked in here:
 * - Every client is anonymised by SECTOR. Never name a client.
 * - No euro figures. The only hard number we quote is the public-sector
 *   ~1 hr/week/analyst saving, which is real and defensible.
 */

export interface Vignette {
  slug: string;
  sector: string; // anonymised label
  eyebrow: string; // short kicker
  title: string; // the headline promise
  before: string; // the daily grind
  after: string; // what changed
  proof: string; // the honest, concrete outcome (no euros)
  stack: string[]; // tech chips
  featured?: boolean; // show on Home
}

export const VIGNETTES: Vignette[] = [
  {
    slug: "finance",
    sector: "Wealth management (regulated, MiFID II)",
    eyebrow: "AI discovery",
    title: "Which AI ideas are worth it — ranked before a euro is spent.",
    before:
      "A regulated firm with a long wish-list of 'could AI do this?' and no safe way to tell the quick wins from the compliance headaches.",
    after:
      "A discovery engagement that scoped every use case and ranked them by return: email-triggered investment summaries, call transcription with meeting notes, and a client-query assistant — sequenced so the safe, high-value ones went first.",
    proof:
      "A prioritised roadmap the firm could actually defend to compliance — not a pilot that stalls at the first audit question.",
    stack: ["AI strategy", "MiFID II-aware", "ChatGPT"],
    featured: true,
  },
  {
    slug: "construction",
    sector: "Construction & fit-out",
    eyebrow: "End-to-end Power Platform",
    title: "From first enquiry to labour on-site, in one system instead of six.",
    before:
      "Leads on sticky notes, surveys in one inbox, quotes in Word, the schedule in someone's head. Every handover a chance to drop the ball.",
    after:
      "One Power Platform + Dataverse pipeline: lead intake → scheduling → property surveys → quotation → labour allocation, with Azure OpenAI drafting quotes, sanity-checking data and answering staff questions in an internal chatbot.",
    proof:
      "The whole job runs on rails the team can see — no more 'who's doing what Thursday?' by text at 11pm.",
    stack: ["Power Apps", "Dataverse", "Power Automate", "Azure OpenAI"],
    featured: true,
  },
  {
    slug: "legal",
    sector: "Legal firms",
    eyebrow: "SharePoint + document AI",
    title: "Case files that behave, and drafting that starts at the second draft.",
    before:
      "Matter documents scattered across drives, versioned by filename, and hours lost summarising correspondence by hand.",
    after:
      "A SharePoint-based case-management system that keeps everything in its place, with ChatGPT summarising documents and email threads and getting first drafts on the page.",
    proof:
      "Fee-earners spend their time on judgement, not on finding the right version of a letter.",
    stack: ["SharePoint", "ChatGPT", "Document AI"],
  },
  {
    slug: "public-sector",
    sector: "Public sector (health, ITIL 4)",
    eyebrow: "Automation + governance",
    title: "An hour a week back for every analyst — and a paper trail that stands up.",
    before:
      "Change approvals triaged by hand, post-CAB changes distributed manually, and no clear picture of where the resourcing pressure actually was.",
    after:
      "Approval-triage automation, a Python tool that auto-distributes post-CAB changes, and a 2019–2026 change-ticket heatmap that shows resourcing at a glance — all wrapped in an AI/automation strategy covering the EU AI Act, GDPR, DPIA, HIQA and a human-in-the-loop framework.",
    proof:
      "Roughly one hour per week saved per analyst on triage alone, with a governance model built for a regulated environment — humans stay in the loop by design.",
    stack: ["Python", "ITIL 4 Service Transition", "HITL governance", "Power BI"],
    featured: true,
  },
  {
    slug: "training",
    sector: "Higher education / professional training",
    eyebrow: "Curriculum + delivery",
    title: "The AI course we teach, taught to your team.",
    before:
      "Staff hearing 'just use AI' with no idea which tool, which task, or where the line is.",
    after:
      "Built the AI/ML curriculum for a professional academy and delivers it to live cohorts — ChatGPT Productivity, AI for Business and GenAI — the same practical sessions offered to client teams.",
    proof:
      "People leave able to open the tool on Monday and use it well — not nodding along to a vendor deck.",
    stack: ["UCD Professional Academy", "Live cohorts", "Copilot certified"],
  },
];
