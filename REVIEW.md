# Assessment review

Reviewed October 10, 2026 against the original Developer Technical Assessment (1).docx, current theme source, ASSESSMENT.md, TESTING.md, and SETUP.md. This is an internal review record, separate from submission answers.

| Question | Requirement coverage | Verification and limits |
| --- | --- | --- |
| 1 | Selected-variant sale guard, monetary savings, floating-point percentage calculation, money formatting, and AJAX price-wrapper integration. | Covered; user-reported manual success. |
| 2 | Native availability filtering before pagination, 12-product setting, Shopify-generated paging URLs, and explanation of post-pagination filtering errors. | Covered for the explicit availability-filtered view; user-reported 12/12/1 results. Plain collection URLs remain unfiltered. Availability means purchasable, not universally positive physical inventory. |
| 3 | Heading, background, 0-100px padding, repeatable image/caption blocks, padding output, and block loop. | Covered; user-reported manual success. |
| 4 | Existing form submits selected variant through AJAX, requests cart sections, updates header, handles errors and duplicate submission, and avoids repeated cart mutations during recovery. | Covered; six automated checks pass and manual success reported. Concurrent forms are not globally serialized; mocked tests do not cover every cart component. |
| 5 | DOM replacement cause, initialization/cleanup, documented section/block lifecycle handlers, selection visibility, and duplicate-instance prevention. | Complete written answer; implementation and browser tests are not required by this explanation question. |
| 6 | Wrapper-scoped CSS custom properties isolate background and padding for each section instance. | Covered by Q3 implementation and reported two-instance test. |
| 7 | Size picker, selected variant/form ID, sold-out disabling, server-rendered price, variant URL, asynchronous updates, and Liquid/HTML/JS/CSS examples. | Implemented for one option named Size. Four automated checks pass. Atif subsequently confirmed all remaining manual testing, including integrated storefront acceptance. No separate import log or individual case results were supplied. Multiple-option disabling is outside the documented scope. |
| 8 | Merchant-editable rich-text definition, current-product rendering, related product reference resolution, and missing-data guards. | Covered; Admin configuration and manual success reported. |
| 9 | Shared Designer entity and field types, product reference, shared renderer, independent paginated directory, and rationale. | Covered; Admin setup and manual success reported. Directory includes storefront-visible entries; Draft entries are intentionally excluded. |
| 10 | Measurement, tools, all three scenario findings, evidence-based priorities, functionality tradeoffs, regression checks, and rollout. | Complete written scenario answer; no benchmark or optimization outcome claimed. |

## Checks performed

- Re-read all ten questions from the original DOCX and compared requirements with code and submission answers.
- Shopify Dev MCP validated 15 reviewed theme files: no errors. Three inherited warnings remain: main-product seo_media unused and unknown continue; layout unknown scheme_classes.
- Ran node tests/q4-cart.test.cjs: 6/6 passed. Ran node tests/q7-variants.test.cjs: 4/4 passed. The child-process test runner was blocked by sandbox permissions; direct execution runs the same test definitions successfully.
- JavaScript syntax checks passed for product-form.js and product-info.js.
- Collection/template and English locale JSON parsed successfully.
- Confirmed full embedded implementations match current savings, features, cart handler, care, Designer card, directory, and directory template source. Picker/option examples omit only their leading usage comments.
- ASSESSMENT.md contains ten numbered answers and ten closing dividers.
- No theme code was changed during this review. No live browser or Admin state was independently inspected.

## Final completion

Atif confirmed all remaining testing on October 10, 2026. All ten assessment questions are complete under the documented scope; Q7 completion wording is consistent across the submission and internal records. The Q2 filtered-view and Q7 Size-only assumptions remain explicit. No implementation blocker was found within those assumptions; this review does not establish unrestricted collection filtering or universal multi-option size disabling. Submit ASSESSMENT.md as the answer document. TESTING.md, SETUP.md, and REVIEW.md are internal supporting records.
