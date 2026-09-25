# QA: does the site match the writer's document?

Source document: **"USA Peptide Depot 1-8 Joey Punch List.docx"** (the writer's
copy for sections 1–8). This checklist walks the site page by page against it.

Branch under test: `core-content`. Check the **Vercel preview** for that branch,
not the live site — nothing here is on www until the branch is merged.

Tick every box. Anything that fails, write down the page and the line.

---

## 0. Before you start — read these five, they save you time

These are deliberate differences from the document. They are **not** bugs; do
not raise them unless you disagree with the decision.

1. **The document only covers sections 1–8.** Sections 9–14 (Editorial Policy,
   Quality Standards, Shipping, Return Policy, Terms, Privacy) were not written
   yet, so those pages still carry the older copy. Nothing to check them against.
2. **Leadership bios are not on the site.** The document says
   "[INSERT VERIFIED LEADERSHIP BIOS…]". The page says they are being finalized
   rather than inventing people. Owner needs to send them.
3. **Two old FAQ claims were removed, not rewritten** — "purity ratings
   consistently exceeding 99%" and vials "sealed under inert argon/nitrogen
   atmosphere". Nothing we hold verifies either. They go back in if the owner
   confirms them.
4. **The FAQ is split on purpose.** General/ordering/shipping/payment questions
   are on `/faq`. The research-and-handling questions (sections 7–8 of the doc)
   are at the bottom of `/knowledge-center`, where the articles explain them.
   The two pages link to each other.
5. **Typos in the document were fixed silently**: "avaialble" → available,
   "USA Peptide Depots'" → USA Peptide Depot's, "answer all your question.." →
   answer them.

---

## 1. Home page — document section 1

Open the preview home page.

- [ ] Headline reads **"Why trust what you can test?"**
- [ ] Under it, the paragraph: "Anyone can print a purity number on a label.
      USA Peptide Depot delivers the goods with independent HPLC testing and
      lot-specific documentation. We don't make marketing claims. We keep it
      real with real results for real research."
- [ ] Two buttons: **Shop Research Materials** and **Search COA Database**
- [ ] Below the buttons: **"Don't believe the hype. Believe the results.
      That's Trust. Verified."**
- [ ] Research-use-only line is still there under that
- [ ] Both buttons go somewhere real (shop, COA database)

> The small line above the headline ("In-vitro research materials stocked and
> shipped in the USA") is not from the document — it is set in
> Dashboard → Content and can be changed there at any time.

## 2. About Us — document section 2 — `/about-us`

- [ ] Title: **"Why trust what you can test?"**
- [ ] The principle line: **"Never trust what you can test."**
- [ ] "Bottom line" paragraph is present and names all five: clear product
      identification, lot-specific documentation, independent analytical
      testing (where available), domestic fulfillment, responsive support
- [ ] The traceability paragraph ("…maximum traceability, transparency, and
      consistency — from sourcing and documentation to fulfillment and customer
      support")
- [ ] Box reading **"Don't believe the hype. Believe the results."** with
      "That's Trust. Verified."
- [ ] **Five** cards under "What that means in practice"
- [ ] **Three** questions listed: what was actually tested / when was it tested
      / does the documentation match the lot you ordered
- [ ] Footer line: products are for laboratory and research use only

## 3. Our Story — document section 3 — `/our-story`

- [ ] Title: **"Too many claims. Too little proof."**
- [ ] **"All hat. No cattle."** appears
- [ ] Opening paragraph covers: purity numbers can be printed; a professional
      label doesn't make it real; marketing claims sound scientific — where's
      the support?
- [ ] The same three questions are listed
- [ ] "Evidence over hype and clarity over claims" paragraph
- [ ] Ends on **"Trust. Verified."**

## 4. Our Team and Leadership — document section 4 — `/our-team`

- [ ] Page exists and is reachable from the footer
- [ ] Says leadership is **operations-first**: rigorous sourcing, lot-specific
      documentation, direct support
- [ ] The three standards appear: **document every lot**, **deliver full
      operational accountability**, **make verification transparent and
      effortless**
- [ ] The box: "No promotional hype. No inflated results. No unsupported
      claims. Just facts. Verifiable facts."
- [ ] **No invented people.** No names, no titles, no headshots, no fake
      credentials anywhere on the page

## 5. Why Us — document section 5 — `/why-us`

- [ ] **Four** cards, not three
- [ ] Evidence > claims — includes "HPLC analysis alone is not enough" and
      "every test is lot-specific"
- [ ] Independent testing — "what's on our label is in the vial"
- [ ] Domestic fulfillment — "no delays or lost orders", stocked and dispatched
      from the United States with tracking
- [ ] Support — identity, documentation, order status, shipping
- [ ] Browser tab title reads "Why Choose Us | USA Peptide Depot" (not the
      brand name twice)

## 6. How It Works — document section 6 — `/how-it-works`

This is the page the owner caught. Count carefully.

- [ ] **Six** numbered steps, in this order:
      1 Select your research material · 2 Review · 3 Ordering · 4 Shipping ·
      5 Verify · 6 Support
- [ ] Step 2 names all five things to check: compound, lot number, testing
      laboratory, test date, reported results
- [ ] Step 3 mentions availability, verification and the Terms and Conditions
- [ ] Step 5 says compare the lot on the product with the COA database
- [ ] Step 6 says contact support **before** proceeding with research
- [ ] Links at the bottom all work

## 7. FAQ — document section 7 — `/faq`

- [ ] **19** questions in total, across six categories
- [ ] All nine of the writer's General questions are there: what we sell · US
      supplier · order online · need an account · larger orders · wholesale ·
      request a product not listed · how to contact · where to read the policies
- [ ] Clicking a question opens the answer; clicking again closes it
- [ ] The search box works — type "lot" and you get results
- [ ] Category filters work
- [ ] At the bottom: the "Looking for the science?" block linking to the
      Knowledge Center, COA database and support

## 8. Knowledge Center — document section 8 — `/knowledge-center`

The biggest page. Take your time.

- [ ] The two intro paragraphs from the document are there
- [ ] **A contents list of eight topics**, matching the document's "Core
      Knowledge Center Topics", and each one jumps to its section
- [ ] **Seven** articles, each collapsed with a **Read more**:
      1 How to read a Certificate of Analysis
      2 What HPLC can — and cannot — tell you
      3 Understanding purity, identity, concentration, and mass
      4 Why lot numbers matter
      5 How independent laboratory testing works
      6 Research-material storage and handling basics
      7 How to verify documentation before beginning research
- [ ] Open each one. The full article text appears, and **Read more** becomes
      **Close**
- [ ] Article 1 lists the seven questions a COA should answer
- [ ] Article 2 lists the seven things HPLC **cannot** prove
- [ ] Article 7 has **eight** numbered verification steps
- [ ] **Glossary of 15 terms** (the eighth topic), COA through to independent
      testing, followed by the note about method, laboratory and context
- [ ] **Nine** research-and-handling FAQs at the bottom, including both "we do
      not provide dosing instructions" answers
- [ ] Closing note mentions that educational content does not replace
      laboratory protocols, institutional requirements, manufacturer
      instructions or professional scientific judgment

---

## 9. Cross-cutting checks — do these on every page above

**On a phone (or a narrow browser window, ~375px wide):**

- [ ] No sideways scrolling. Swipe left and right — the page should not move
- [ ] Nothing runs off the right edge or gets cut off
- [ ] Read more / Close still works with a thumb
- [ ] Text is readable without zooming

**On a wide monitor (1440px or more):**

- [ ] Paragraphs do not run the full width of the screen — long lines should
      stop at a comfortable reading width
- [ ] Cards line up in even rows, nothing stretched or orphaned
- [ ] The glossary shows three columns, not two very wide ones

**Everywhere:**

- [ ] Every link you click goes somewhere real — no 404s
- [ ] Each page's browser tab title is specific to that page, and the brand
      name is not repeated twice
- [ ] Nothing on any page is copied from battlebornresearch.com or any other
      site
- [ ] No testimonials, no named labs, no review counts, no invented people
- [ ] Every page still carries a research-use-only line

**Navigation:**

- [ ] Header has: Knowledge Center, How it works, About, Our story
- [ ] Footer has: Our story, Our team and leadership, Knowledge Center, Why us,
      How it works
- [ ] The mobile menu opens and shows the same links

---

## 10. When you find something

Write it as: **page URL → what the document says → what the site says**. That
is enough to fix it without going back to the document each time.

If it is a wording change rather than missing content, say whether it should be
changed in the code or in Dashboard → Content — hero text, FAQ questions and
SEO titles are editable there without a developer.
