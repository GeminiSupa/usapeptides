# SEO audit and first implementation

Date: 2026-09-21. Scope: 13 public URLs, sitemap, redirect behavior and repository
review. Raw HTTP evidence: `seo-audit-before.json`. This is a technical sample,
not a complete crawl, performance audit or ranking report.

## Findings and work completed

| Priority | Evidence | Change |
| --- | --- | --- |
| P1 | 7 of 13 sampled pages used the homepage canonical and title: COA, bulk pricing, calculator, shipping, returns, privacy, affiliates | Each now has its own canonical, title, description and social metadata. New SEO fields are editable in the existing dashboard. |
| P1 | Product metadata came from a server query while the initial UI used bundled catalogue data | Pass the mapped server record to the product UI; metadata and initial HTML share one lookup. Unpublished/unknown database products return not-found instead of falling back to a bundled listing. |
| P1 | Offer schema used sale_price and in_stock alone while the visible product page/cart used price and stock_count | Schema now reflects the displayed single-vial price and the existing stock-aware mapping. This does not alter checkout pricing. |
| P2 | Sitemap assigned current time to static pages on regeneration | Omit unknown dates, preserve real product/category updates and article modification dates. An empty successful DB result no longer resurrects bundled URLs. |
| P2 | Apex responds 308 to www, but published canonicals point at apex | Default business URL now uses www. If Vercel explicitly sets NEXT_PUBLIC_SITE_URL, set it to https://www.usapeptidedepot.com and redeploy. Verify live after deployment. |
| P2 | Useful purchasing resources were mostly connected via footer links | Added contextual COA, bulk-price, shipping and documentation links to shop, COA, bulk, product and category pages. COA and bulk headings now describe their purpose. |

All 13 sampled URLs returned HTTP 200 and one H1 before edits. The existing
product page already had Product schema; the site already had Organization and
WebSite schema. No measured ranking, revenue or indexing improvement is claimed.

## Keyword-to-page map

These are research candidates, not measured search volumes or difficulty scores.
Keep one primary page per intent; do not create another page for each synonym.
Priority reflects business relevance and observed technical gaps, not search volume.

| Priority | Existing target | Candidate searches | Page purpose / next work |
| --- | --- | --- | --- |
| 1 | /coa-database | peptide certificate of analysis; peptide COA; peptide lot lookup | Report lookup, lot matching, clearly label missing reports. Metadata, heading and contextual links improved. |
| 1 | /shop | research peptides USA; research peptide supplier; research peptide catalogue | Catalogue browsing and product discovery. Links to evidence and purchasing help added. |
| 1 | /bulk-discounts | bulk research peptides; research peptide bulk pricing; laboratory peptide orders | Real quantity tiers and order enquiries. Dedicated metadata and heading added. |
| 1 | /product/bpc-157-5mg | BPC-157 5mg research; BPC-157 5mg specifications; BPC-157 COA | Exact product/size with actual product data. Shared initial rendering fix applies to all product pages. |
| 1 | /product/ghk-cu-50mg | GHK-Cu 50mg research; GHK-Cu certificate of analysis | Exact product/size and batch documentation; prioritize further copy only after reviewing actual records. |
| 2 | /product/tb-500-5mg | TB-500 5mg research; TB-500 product specifications | Product details and available evidence, no therapeutic promises. |
| 2 | /category/extracellular-matrix-cell-migration-peptides | extracellular matrix research peptides; cell migration peptides | Category comparison and product navigation; contextual links added. |
| 2 | /shipping-policy | research peptide shipping; brand + delivery information | Existing factual policy; corrected canonical/title. Do not invent delivery guarantees. |
| 2 | /blog/understanding-hplc-and-mass-spectrometry-purity | peptide HPLC report; peptide purity analysis; HPLC and mass spectrometry | Review existing article against primary scientific sources before expanding. Avoid a near-duplicate article. |
| 3 | /calculator | peptide dilution calculator; laboratory concentration calculator | Existing laboratory tool; dedicated metadata. Its traffic may not convert like supplier searches. |

## Search-results research

Queries sampled: research peptides + COA + supplier, and peptide certificate of
analysis + guide. Results include suppliers publishing lot-level documentation
and dedicated COA explainers. This supports separating product/purchasing intent
from educational intent; it does not establish demand or easy competition.

Reference examples inspected through search results (not independently verified
supplier claims and not copy sources):
- https://purexbio.com/ — lot-specific documentation positioning.
- https://usamadepeps.com/ — lot-searchable certificate positioning.
- https://pepteraresearch.com/insights/how-to-read-certificate-of-analysis/ — dedicated COA explainer.

## Cluster plan

1. Catalogue cluster: Shop > existing categories > exact product/size pages.
   Keep current URLs; do not create duplicate keyword landing pages.
2. Documentation cluster: COA database > actual reports > relevant products;
   existing analytical-method article supports interpretation after fact review.
3. Purchasing cluster: product/category pages > volume pricing, shipping,
   contact/support. Links added in this pass.

No bulk-generated articles, new scientific claims, fake review markup, new domain,
location doorway pages or backlink purchases are part of this implementation.

## Search Console measurement plan

Owner confirmed Search Console is set up. The available browser opens the public
sign-in screen, so no property data has been read. Next input needed: sign in to
the property in the available browser, or provide its Performance export for the
last 3 months (queries, pages, countries, devices) and Page indexing report.

Once available:
- Filter United States, compare the latest 28 days to the previous 28 days.
- Separate branded from non-branded queries; review query/page pairs, not just
  site-wide average position. Note seasonality and small samples.
- Prioritize relevant pages already earning impressions around positions 8–30,
  then evaluate intent, competition and click-through rate. Do not promise gains.
- Inspect representative corrected URLs: selected canonical, indexing state,
  rendered content and sitemap discovery. Submit the existing sitemap if absent.
- Track organic visits through enquiry/order creation and confirmed revenue
  separately. Checkout currently records orders without taking online payment.
- Review initial crawl/indexing changes after 2 weeks; compare search trends at
  4 and 8 weeks after release. These are review dates, not ranking deadlines.

## Remaining evidence and follow-up

- Verify actual COA files, labs, test methods, stock, shipping promises and product
  photographs with the owner. Existing template claims are not proof. The COA
  interface currently labels catalogue rows as reports even when a PDF may be
  absent; investigate with actual records before calling it a complete archive.
- Existing price display differs between some catalogue cards and product/cart
  logic when sale_price is populated. This pass matches product schema to the
  product page; a full pricing audit is a separate follow-up.
- Run a full crawl for broken links, redirects, soft 404s and canonical conflicts;
  test real-device Core Web Vitals and the entry notice's mobile usability.
- Review existing educational copy with a qualified subject expert and primary
  references. Use authentic author/reviewer identities only.
- Real keyword-volume data and Search Console results remain unavailable. Do not
  purchase tools or promise high-converting terms based on this sample alone.

## Sources informing the work

- https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites
- https://developers.google.com/search/docs/specialty/ecommerce/help-google-understand-your-ecommerce-site-structure
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/appearance/structured-data/product-snippet
- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/docs/essentials/spam-policies

## Validation

Completed locally: TypeScript, production build (62 pages), three product fixture
tests, seven-page metadata/HTTP regression check, 13-page after-audit and 390px
browser DOM check of the purchasing-resource links. All passed. The after-audit
is in `seo-audit-after.json`; this local report uses bundled catalogue data.

Deployed as `61af3bd` and checked on the production www domain on 2026-09-21.
Live regression checks passed. All 13 sampled canonical paths match their page
and use the final www host. No environment-variable adjustment was needed for
this deployment. Search Console indexing and ranking effects are still unmeasured.

Run `npx tsc --noEmit`, `npm run build`, then start the production server and run
`node scripts/audit-seo.mjs http://127.0.0.1:3108 docs/seo-audit-after.json`.
`node scripts/check-seo.mjs http://127.0.0.1:3108` checks the page metadata,
product markup/HTML consistency, real missing-product response and sitemap dates.
The production environment must also be checked after deployment; local builds
without Supabase use the existing bundled catalogue.
