/**
 * The four span titles and one-line expansions for the Four Bridges
 * framework, shared between `/work` and the homepage so the two pages'
 * copy can't drift apart. The lead paragraph above the spans is
 * page-specific (voiced differently on each page) and stays local to
 * each page.
 */

export interface BridgeSpan {
  title: string;
  body: string;
}

export const FOUR_BRIDGES_SPANS: BridgeSpan[] = [
  {
    title: "Design & explainability",
    body: "AI you can open up and explain, not a black box you have to take on faith.",
  },
  {
    title: "Leadership & trust",
    body: "Getting the people who sign it off on board, and the people who use it comfortable.",
  },
  {
    title: "Operations & implementation",
    body: "The unglamorous bit: building it, wiring it in, and making it survive contact with Monday.",
  },
  {
    title: "Strategy & infrastructure",
    body: "The plumbing and the plan underneath, so it still makes sense in two years.",
  },
];
