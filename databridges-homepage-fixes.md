# DataBridges Homepage: Clarity and Focus Fix

**Repo:** databridges.ie (Next.js, hosted on Netlify)
**Goal:** the homepage currently reads as confusing and hard to follow. Fix structure, heading hierarchy and broken markup. Do not restyle, do not rebrand, do not rewrite the voice.
**Scope:** homepage primarily, plus three targeted edits elsewhere.

---

## HOW TO USE THIS SPEC

1. Read the whole file, including **NON-GOALS**, before touching anything.
2. Do a discovery pass first. Do not guess file paths. Locate the components listed under each task and report what you found before editing.
3. Work task by task in the run order at the bottom. One commit per task.
4. Where a task says "verbatim", use the exact string given.
5. If a task cannot be completed as written, stop and report. Do not improvise a substitute.

---

## NON-GOALS

These are deliberate decisions. **Do not "helpfully" fix them.**

### 1. Do not touch the licensing claims

Leave these exactly as they are, wherever they appear:

- "Built with Microsoft Power Platform, no new software licences."
- "Built on the Microsoft 365 tools you already pay for"

Out of scope for this pass.

### 2. Do not touch the public sector case study or HSE/Tusla wording

Leave untouched:

- The "Automation + governance / Public sector (health, ITIL 4)" case study on `/work`
- "Oisín has worked inside the HSE and Tusla before consulting for organisations like them"
- Any tense, framing or attribution in either

Out of scope for this pass.

### 3. Do not normalise the stat rows

The mixed numeric and non-numeric stats stay as they are:

- Homepage: `5+` / `4` / `UCD` / `MSc`
- Work page: `5` / `UCD` / `ITIL 4`

Do not convert, remove or restructure them. The only permitted change is the MSc label in Task 1.

### 4. Do not strip the negative constructions

The "no / not / never" voice is intentional house style and is staying. **Keep every one of these:**

- "No hype, no decks, no nonsense."
- "Four steps. No jargon."
- "No sales script."
- "No dependency, no retainer trap."
- "Working software in weeks, not a slide deck."
- "Not a consultant who learned some buzzwords."
- "It was never a database. It was never meant to be."
- "not a pilot that stalls at the first audit question"

Do not rewrite these into positive phrasing. Do not reduce their number. Do not flag them.

The clarity fix in this spec works at the **heading and section level**, not the sentence level. Sentences keep their bite. Headings start carrying information.

### 5. General

- Do not invent client names, euro figures, percentages or testimonials.
- Do not change colours, fonts, spacing tokens or the design system.
- Do not touch `/events`, `/faq`, `/seo-aeo` or `/contact`.
- Do not add new dependencies.

---

## TASK 1: One canonical MSc string

**Problem:** the degree is described four different ways across the site. This reads as credential inflation to a careful reader.

### Canonical strings

Use these three forms and nothing else.

**Long form** (bio prose):

> MSc Data-Intensive Astrophysics (Distinction), Cardiff University, applying machine learning to astrophysical data.

**Short form** (credential bullets, badges, chips):

> MSc Data-Intensive Astrophysics (Distinction) · Cardiff

**Stat form** (stat block only, value then label):

> `MSc` / `Data-Intensive Astrophysics`

### Find and replace

Grep the whole repo for each of these and replace with the correct form above:

| Current string | Replace with |
|---|---|
| `MSc Machine Learning Astrophysics` | Stat form |
| `MSc Astrophysics (Distinction) · Cardiff` | Short form |
| `an MSc in data science` | `an MSc in Data-Intensive Astrophysics` |
| `trained as a data scientist at Cardiff University` | `trained in data-intensive astrophysics at Cardiff University, applying machine learning to astrophysical data,` |

Also grep for and correct any other occurrence of: `MSc`, `Cardiff`, `data scientist`, `astrophysic`.

Check at minimum: homepage hero stats, homepage credentials block, homepage About block, `/about`, `/services`, `/work`, footer, JSON-LD or structured data, and any `og:` or meta description containing credentials.

### Acceptance

- Zero occurrences of "MSc in data science", "MSc Machine Learning Astrophysics" or "data scientist" describing Oisín.
- Every credential mention on the site resolves to one of the three canonical forms.
- The heading "An astrophysicist who got tired of bad spreadsheets" stays as is. It is now consistent.

---

## TASK 2: Fix the broken links

### 2a. Stray `/contact` anchor in the header

**Symptom:** the header renders two links where one is intended. The second has the literal text `/contact` as its label, sitting beside the "Book a free chat" CTA. It is present in both the desktop and mobile nav render. Almost certainly an `href` prop being passed through as `children`, or a spread that leaks the href into the link body.

**Fix:** locate the header/nav component. Remove the stray anchor so exactly one CTA renders per breakpoint. Verify by inspecting rendered HTML, not just the JSX.

**Acceptance:** the string `/contact` never appears as visible link text or as accessible name anywhere in the rendered DOM on any page.

### 2b. LinkedIn cards pointing at the wrong URL

**Symptom:** the "Straight talk about AI" section has five cards. Each has a "Read on LinkedIn →" button. Four of the five point at the profile page, not the article:

| Card | Current href | Status |
|---|---|---|
| EU AI Act (Article 50 / 2 August 2026) | `https://www.linkedin.com/pulse/2nd-august-2026-disclosures-ois%C3%ADn-bridges-ltuuf` | Valid |
| Ireland (Regulation of AI Bill 2026) | `https://linkedin.com/in/oisin-bridges` | Broken promise |
| Copyright (US publisher v Google) | `https://linkedin.com/in/oisin-bridges` | Broken promise |
| Jobs (Ford rehiring engineers) | `https://linkedin.com/in/oisin-bridges` | Broken promise |
| Framework (four bridges) | `https://linkedin.com/in/oisin-bridges` | Broken promise |

**Fix, in this order:**

1. Refactor the card data so each card carries an explicit `articleUrl` field.
2. Render the "Read on LinkedIn →" button **only** when `articleUrl` is present and is a real article URL (contains `/pulse/`).
3. Any card without a valid `articleUrl` must not render that button. Leave a `// TODO: add article URL` comment against it.
4. Per Task 4, this section reduces to **two cards** on the homepage. Prioritise cards that have a valid `articleUrl`. If only one valid URL exists, render one card plus the section-level follow link.

**Also fix the handle mismatch:** article and profile links use `linkedin.com/in/oisin-bridges`, the follow link and footer use `linkedin.com/company/databridges`. Pick one per purpose and make it consistent:

- Personal article links: `https://www.linkedin.com/in/oisin-bridges`
- Company / follow links: `https://www.linkedin.com/company/databridges`

Add the `www.` prefix to all LinkedIn URLs for consistency.

**Acceptance:** every rendered "Read on LinkedIn →" button resolves to a `/pulse/` article URL. No button promises an article and delivers a profile.

---

## TASK 3: Make the before/after spreadsheet machine readable

**Problem:** the "What We Actually Change" before/after visual is the most complex element on the page and it is a soup of orphaned characters to a screen reader and to any AI crawler. On a site with an SEO and AEO page, this is the one element that should be legible to machines.

**Note:** Task 4 removes this section from the homepage. Fix the component anyway. It is cheap, and the component may be reused elsewhere or restored later.

### Fix

1. Wrap the whole before/after unit in `<figure>`.
2. Set `role="img"` on the visual container with a single `aria-label`:
   ```
   aria-label="Before and after: a fragile spreadsheet with circular reference errors and a 40MB file size, replaced by a single clean monthly output table with reconciled hours and no errors."
   ```
3. Set `aria-hidden="true"` on the decorative cell grid, the column letters, the row numbers and the fake formula strings, so assistive tech reads the label once instead of decoding every cell.
4. Add a real `<figcaption>` containing the existing text:
   > Built with Microsoft Power Platform, no new software licences. This is an illustration of the shape of the work; see the real engagements on our Work page.
5. Add a visually hidden plain text summary inside the figure, using the existing utility class if one exists (`sr-only` or equivalent), so crawlers index the claim:
   > One sheet instead of forty tabs. Hours reconciled rather than retyped. Zero broken references.

### Related: duplicated Four Bridges markup

The Four Bridges block currently renders twice in the DOM on both the homepage and `/work`: once as a visual and once as an ordered list, with identical content. This is duplicate content and it doubles what a screen reader announces.

**Fix:** render the content once. Keep the semantic `<ol>` as the source of truth, apply `aria-hidden="true"` to the purely decorative visual layer.

**Acceptance:** run an accessibility audit on the homepage. No orphaned single-character text nodes exposed to the accessibility tree. Four Bridges content appears once in the accessibility tree.

---

## TASK 4: Restructure the homepage

**Problem:** fourteen sections, three competing numbered frameworks in a row, two separate bios, and eight elements between the top of the page and the reader's actual problem.

### Target structure: eight sections, in this order

| # | Section | Action |
|---|---|---|
| 1 | Hero | Rebuild, see Task 5 |
| 2 | Sound familiar? | Keep, unchanged |
| 3 | What I build (services) | Keep, de-number, see below |
| 4 | Where it's worked (cases) | Keep, dedupe links |
| 5 | EU AI Act quiz | **Move up** from position 9 |
| 6 | Four Bridges | Keep, add the gap sentence, see Task 6 |
| 7 | Who you'd be working with | **Merge** the two bio blocks into one |
| 8 | Final CTA | Keep, unchanged |

### Remove from the homepage

- **The scrolling tech logo marquee.** Moving content in peripheral vision while the reader parses the H1. Delete the section. Keep the component file if reused elsewhere.
- **The before/after spreadsheet section.** Highest decoding cost on the page, and the caption tells the reader it is illustrative. Remove the section from the homepage. Keep the component.
- **The four-step process ("Four steps. No jargon." / Chat, Map, Build, Train).** Move it to `/services`, verbatim, including the heading. Do not rewrite it. It is good content in the wrong place.
- **The second hero CTA ("See what we do").** One CTA in the hero: "Book a free chat →".
- **Three of the five LinkedIn cards.** Keep two, per Task 2b. Keep the section-level "Follow Oisín on LinkedIn →" link.
- **The duplicate headshot.** The same image currently renders twice. One instance only, in section 7.

### Merge the two bio blocks

"Not a consultant who learned some buzzwords." and "An astrophysicist who got tired of bad spreadsheets." are two bios ten sections apart with the same headshot. Merge into one section at position 7.

- **Keep the heading** "Not a consultant who learned some buzzwords." as the section heading. It is house voice and it stays.
- Use the "An astrophysicist..." paragraph as the body copy.
- Keep the four credential bullets, with the MSc line updated per Task 1.
- One headshot.
- Keep the "Full story →" link to `/about`.

### De-number the services section

Two numbered "fours" side by side (services and Four Bridges) is the collision that makes the page hard to follow. Four Bridges keeps its numbering because it is the framework. Services loses its number.

- Change the heading from "Four ways we help." to **"What I build for Irish teams."**
- Remove any `01`–`04` badges or counters from the service cards.
- Keep all four cards, their copy and their links unchanged.

### Dedupe the case section links

The "Where we've helped" section currently contains four links to the same page: three "See it on our work page →" plus one "See all our work →".

- Remove the per-card "See it on our work page →" links. Make the whole card clickable to its `/work#cases` anchor instead.
- Keep one "See all our work →" at the foot of the section.

### Acceptance

- Homepage renders eight sections in the order above.
- The headshot appears once.
- The word "Four" appears in exactly one section heading (Four Bridges).
- No section contains more than one link to `/work`.

---

## TASK 5: Rebuild the hero and the heading ladder

**Problem:** read the homepage headings alone, with all body copy removed, and the page never says what is sold or who it is sold to. The heading ladder has to carry the pitch, because most readers only read headings.

### 5a. Hero

**Current:** an animated word-by-word H1 reading "Making AI Useful (and mildly tolerable)", which delays the primary message and names no audience, offer or outcome.

**Fix:**

1. **Demote the tagline to a kicker.** Keep "Making AI Useful (and mildly tolerable)" verbatim as the small line above the H1. It is the brand line and it stays on the page.
2. **New H1** (verbatim):
   > AI consulting, Power Platform and training for Irish SMEs and public sector teams.
   
   This is the existing meta description. It is the clearest sentence on the site and it is currently only visible to search engines.
3. **Remove the word-by-word reveal animation** on the H1. A single fade or no animation. The primary message must be readable on first paint.
4. **Keep the existing subhead verbatim:**
   > DataBridges helps Irish businesses connect people, data and process, turning "there has to be a smarter way to do this" into something that actually works.
5. One CTA: "Book a free chat →".
6. Keep the location line and the stat block as they are.

### 5b. Section headings

Replace the section headings so the skim carries the pitch. Body copy under each is unchanged unless a task above says otherwise.

| Section | Current heading | New heading |
|---|---|---|
| 2 | Sound familiar? | *unchanged* |
| 3 | Four ways we help. | What I build for Irish teams. |
| 4 | Five sectors. One pattern: less faffing, more done. | What changed for a wealth manager, a fit-out firm and a legal practice. |
| 5 | Does the EU AI Act affect your business? | Does the EU AI Act apply to you? Four questions, 30 seconds. |
| 6 | Four Bridges to AI adoption. | The gap where AI projects die, and the four bridges across it. |
| 7 | Not a consultant who learned some buzzwords. | *unchanged* |
| 8 | Ready to stop doing things the hard way? | *unchanged* |

Note that headings 2, 7 and 8 keep their negative framing. That is deliberate.

### 5c. Normalise the section eyebrows

Currently only seven of eleven sections have an eyebrow, and their capitalisation is mixed ("The Problem" and "What We Do" in title case, "Where we've helped" and "Our framework" in sentence case).

- Give **every** section an eyebrow.
- Use **sentence case** throughout.
- Suggested: `The problem` / `What I build` / `Where it's worked` / `Free tool` / `Our framework` / `About Oisín` / `Next step`.

### Acceptance

Delete all body copy mentally and read the headings in order. A stranger should be able to name: the problem, the offer, the audience, the proof, the hook, the person, the next step. If any of those seven is missing, the ladder has failed.

---

## TASK 6: Give the Four Bridges its river

**Problem:** a bridge crosses a gap. The homepage never says what the gap is, so the framework reads as four abstract nouns. The sentence that defines the gap exists, but it is on `/work` and on LinkedIn, not on the homepage.

### Fix

1. **New heading** (from Task 5b):
   > The gap where AI projects die, and the four bridges across it.
2. **Insert this lead paragraph above the four spans, verbatim.** It is existing DataBridges copy, lifted from `/work`:
   > Most AI projects don't fail on the tech. They fall into the gap between a clever demo and a team actually using it. These are the four spans I build across, every time.
3. **Remove** the current lead paragraph:
   > Every engagement crosses the same four spans, in order. Skip one and the whole thing wobbles, so we build them one at a time.
   
   Optionally retain the "Skip one and the whole thing wobbles" clause appended to the new paragraph. It is good and it is a negative.
4. **Add the one-line expansions** to each span on the homepage. They already exist on `/work` and the homepage version is missing them, which is why the homepage version reads as abstract:
   - Design & explainability: AI you can open up and explain, not a black box you have to take on faith.
   - Leadership & trust: Getting the people who sign it off on board, and the people who use it comfortable.
   - Operations & implementation: The unglamorous bit: building it, wiring it in, and making it survive contact with Monday.
   - Strategy & infrastructure: The plumbing and the plan underneath, so it still makes sense in two years.
5. Apply the duplicate-markup fix from Task 3.
6. Four Bridges stays on the homepage. It is the only numbered framework on the page after Task 4.

**Acceptance:** the reader learns what the gap is before they are shown the bridges. Each span has a plain-English expansion.

---

## TASK 7: Trim the nav (lower priority)

Eight nav items is too many, and one of them, **SEO & AEO**, is an acronym the buyer does not know for a service that does not appear in the services list.

**Preferred fix:**

- Primary nav: `Services` / `Work` / `About` / `Contact` plus the "Book a free chat" CTA.
- Move `Events`, `SEO & AEO` and `FAQ` into the footer only.
- Do not delete the pages. Do not change their content. Keep them in the sitemap.

**If a page-level decision is needed on whether SEO & AEO becomes a fifth service card, stop and ask. Do not decide it yourself.**

---

## RUN ORDER

Commit separately, in this sequence. Tasks 1 to 3 are safe and self-contained. Task 4 onward changes the page shape.

1. **Task 1** — canonical MSc string. `fix: single canonical MSc credential string sitewide`
2. **Task 2** — broken links. `fix: stray /contact anchor and LinkedIn article URLs`
3. **Task 3** — accessibility of the spreadsheet figure and Four Bridges duplication. `fix: a11y of before/after figure, dedupe Four Bridges DOM`
4. **Task 4** — homepage restructure. `refactor: homepage to 8 sections, merge bios, move process to /services`
5. **Task 5** — hero and heading ladder. `copy: hero H1 and section heading ladder`
6. **Task 6** — Four Bridges gap sentence and span expansions. `copy: Four Bridges lead paragraph and span detail`
7. **Task 7** — nav trim, only if approved. `refactor: primary nav to four items`

---

## FINAL ACCEPTANCE CHECKLIST

**Correctness**

- [ ] One canonical MSc string, no variants anywhere in the repo
- [ ] No visible `/contact` link text in the rendered DOM
- [ ] Every "Read on LinkedIn →" resolves to a `/pulse/` article
- [ ] All LinkedIn URLs use `www.` and the correct handle for their purpose

**Structure**

- [ ] Homepage has eight sections in the specified order
- [ ] One headshot, one bio block
- [ ] "Four" appears in exactly one section heading
- [ ] No logo marquee, no spreadsheet visual, no process section on the homepage
- [ ] Process section present and intact on `/services`
- [ ] Two LinkedIn cards, both with valid article URLs

**Clarity**

- [ ] H1 names the offer and the audience on first paint, with no reveal animation
- [ ] Heading-only skim conveys problem, offer, audience, proof, hook, person, next step
- [ ] Four Bridges is preceded by a sentence defining the gap
- [ ] Every section has a sentence-case eyebrow

**Accessibility**

- [ ] No orphaned single-character nodes in the accessibility tree
- [ ] Four Bridges content announced once, not twice
- [ ] Figure has a role, a label and a caption

**Untouched (verify nothing changed)**

- [ ] Licensing claims intact
- [ ] Public sector case study and HSE/Tusla wording intact
- [ ] Stat rows unchanged apart from the MSc label
- [ ] Every negative construction listed in NON-GOALS section 4 still present
- [ ] No new client names, figures or testimonials anywhere
