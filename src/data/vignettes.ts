/**
 * Single source of truth for the engagement vignettes.
 *
 * Imported by `/work` (full cards). Single source so the copy can never
 * diverge if these are reused elsewhere.
 *
 * House rules baked in here:
 * - Every client is anonymised by SECTOR. Never name a client.
 * - No euro figures, and no single metric is leaned on as the headline; the
 *   proof is the concrete change in how the work actually runs.
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
    title: "Which AI ideas are worth it, ranked before a euro is spent.",
    before:
      "A regulated firm had a backlog of candidate AI use cases and no structured way to assess which were feasible or compliant. They needed someone to sort the good ideas from the bad, then build and implement them.",
    after:
      "A discovery engagement that scoped every use case and ranked them by return: email-triggered investment summaries, call transcription with meeting notes, and a client-query assistant, sequenced so the safe, high-value ones went first.",
    proof:
      "A prioritised roadmap the firm could actually defend to compliance, not a pilot that stalls at the first audit question.",
    stack: ["AI strategy", "MiFID II-aware", "ChatGPT"],
    featured: true,
  },
  {
    slug: "construction",
    sector: "Construction & fit-out",
    eyebrow: "End-to-end Power Platform",
    title: "From first enquiry to labour on-site, in one system instead of six.",
    before:
      "Leads, surveys, quotes and scheduling were spread across paper, email, Word and individual staff knowledge, with no shared system linking them. They needed the whole job in one place, from first enquiry to labour on site.",
    after:
      "One Power Platform + Dataverse pipeline: lead intake → scheduling → property surveys → quotation → labour allocation, with Azure OpenAI drafting quotes, sanity-checking data and answering staff questions in an internal chatbot.",
    proof:
      "The whole job runs on rails the team can see. No more 'who's doing what Thursday?' by text at 11pm.",
    stack: ["Power Apps", "Dataverse", "Power Automate", "Azure OpenAI"],
    featured: true,
  },
  {
    slug: "legal",
    sector: "Legal firms",
    eyebrow: "SharePoint + document AI",
    title: "Case files that behave, and drafting that starts at the second draft.",
    before:
      "Matter documents were spread across multiple drives and versioned by filename, and correspondence was summarised by hand. They needed case files kept in order and routine summarising and drafting streamlined.",
    after:
      "A SharePoint-based case-management system that keeps everything in its place, with ChatGPT summarising documents and email threads and getting first drafts on the page.",
    proof:
      "Fee-earners spend their time on judgement, not on finding the right version of a letter.",
    stack: ["SharePoint", "ChatGPT", "Document AI"],
    featured: true,
  },
  {
    slug: "public-sector",
    sector: "Public sector (health, ITIL 4)",
    eyebrow: "Automation + governance",
    title: "Change approvals that move faster, with a paper trail that stands up to audit.",
    before:
      "Change approvals were triaged manually, post-CAB changes were distributed by hand, and there was no consolidated view of where resourcing pressure sat. They needed the process automated and the resourcing made visible, without loosening the audit trail.",
    after:
      "Approval-triage automation, a Python tool that auto-distributes post-CAB changes, and a 2019–2026 change-ticket heatmap that shows resourcing at a glance, all wrapped in an AI/automation strategy covering the EU AI Act, GDPR, DPIA, HIQA and a human-in-the-loop framework.",
    proof:
      "A governance model built for a regulated environment, humans in the loop by design, plus a 2019–2026 change-ticket heatmap that turns 'we're stretched' into something you can actually resource against.",
    stack: ["Python", "ITIL 4 Service Transition", "HITL governance", "Power BI"],
  },
  {
    slug: "training",
    sector: "Higher education / professional training",
    eyebrow: "Curriculum + delivery",
    title: "The AI course we teach, taught to your team.",
    before:
      "Staff were told to use AI without guidance on which tools suited which tasks, or where the appropriate limits were. They needed practical, task-based training rather than another vendor deck.",
    after:
      "Built the AI/ML curriculum for a professional academy and delivers it to live cohorts (ChatGPT Productivity, AI for Business and GenAI), the same practical sessions offered to client teams.",
    proof:
      "People leave able to open the tool on Monday and use it well, not nodding along to a vendor deck.",
    stack: ["UCD Professional Academy", "Live cohorts", "Copilot certified"],
  },
];
