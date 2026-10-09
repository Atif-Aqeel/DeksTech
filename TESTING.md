# Assessment testing

## Question 1: sale savings

Run from this Dawn folder:

```powershell
shopify theme dev --store dev-store-startup.myshopify.com
```

This serves the local theme through a development theme with live reload. Use the preview URL printed by the CLI. Confirm that this is the intended assessment store before running. Do not publish the theme.

### Prepare data

Use a dedicated assessment product assigned to the Online Store, with quantity price breaks disabled. For the dollar examples below, use USD. Configure variants with the valid prices below and keep most in stock. For the sold-out case, track inventory, set quantity to zero, and turn off continue selling when out of stock. Use a dropdown picker if necessary to select the sold-out variant, or open its `?variant=ID` link directly.

### Acceptance cases

Atif reported successful completion of the guided Question 1 preview tests on October 10, 2026. The confirmed cases are listed under Results. Equal/lower compare-at values and the additional checks below have no separately confirmed result. Expected output assumes the default USD money format; enabling currency codes can append USD.

| Case | Compare-at | Price | Expected savings |
|---|---:|---:|---|
| Sale | $100 | $80 | Save $20.00 (20%) |
| Fraction rounds down | $30 | $20 | Save $10.00 (33%) |
| Fraction rounds up | $30 | $10 | Save $20.00 (67%) |
| No compare-at | Blank | $80 | No savings element |
| Equal prices | $80 | $80 | No savings element |
| Lower compare-at | $60 | $80 | No savings element |
| Free sale variant | $100 | $0 | Save $100.00 (100%) |
| Sold-out sale variant | $100 | $80 | Save $20.00 (20%); purchasing unavailable |

Shopify Admin may reject equal or lower compare-at values. If it does, record those cases as not run in the storefront; do not claim they passed. The Liquid guard handles those values defensively.

### Interactive checks

1. Open the product without a variant parameter. Verify savings match the initially selected variant and displayed price.
2. Switch between both sale variants and a regular variant. Verify amounts and percentages update, then disappear on the regular variant, without a page refresh.
3. Load a valid `?variant=ID` URL directly, including a sold-out variant, and verify its own pricing is used.
4. Switch quickly between variants. Verify the settled selection, displayed price, and savings agree.
5. Toggle the theme currency-code setting and verify the savings format follows it.
6. Check mobile layout and the browser console for new errors.

In DevTools Elements, inspect `.assessment-sale-savings` inside `#price-SECTION_ID`. For non-sale variants, the savings paragraph should be absent, not merely hidden.

### Results

- Shopify Theme Check previously passed the integration and locale file with no errors; two warnings were in unchanged Dawn code.
- Percentage arithmetic was corrected to use a floating-point divisor. Revalidation results are recorded in `SETUP.md`.
- User-reported pass: sale 20%, rounding down to 33%, rounding up to 67%, blank compare-at, free sale variant, sale/regular switching without refresh, direct variant URL, and sold-out sale variant with purchasing unavailable.
- Evidence source: Atif's confirmation after the guided test checklist, October 10, 2026. These were manual user-run tests; the assistant did not independently observe the browser. Exact product URL and preview theme ID were not supplied.
- Not separately confirmed: equal/lower compare-at values, rapid switching, currency-code toggle, mobile layout, and console inspection. Do not represent these additional cases as passed.

## Question 2: in-stock collection pagination

Atif reported completing all guided cases on October 10, 2026. This is user-reported manual verification; the assistant did not independently observe the browser. Individual counts, screenshots, and pass/fail records were not supplied.

1. In Shopify Search & Discovery, enable the Availability storefront filter. This is store configuration and is not deployed with the theme files.
2. Create a dedicated manual collection with 30 Online Store products: 25 available and 5 fully sold out. For sold-out products, track inventory, set all variants to zero, and disable continue selling. Interleave sold-out products with available products in manual order so the test exposes filtering after pagination.
3. In the development preview, open `/collections/YOUR_HANDLE?filter.v.availability=1`. Preserve any preview parameters if constructing the URL yourself.
4. Confirm only In stock is selected, and the product-grid setting is 12 in the Theme Editor. Wait for Shopify's filter data to update if products were just edited.

| Check | Expected |
|---|---|
| Page 1 | 12 available product cards |
| Page 2 | 12 available product cards |
| Page 3 | 1 available product card |
| Product count | 25 filtered products, not 30 |
| All pages combined | 25 distinct products; none sold out or duplicated |
| Pagination URLs | Retain `filter.v.availability=1` |
| Sorting | Availability stays selected and totals remain 25 |
| Change another filter on page 2 | Return to page 1 of the new result set |
| No available matches | Empty state, no misleading page links |
| Fewer than 12 available matches | All matches on one page |
| Remove availability filter | Ordinary mixed-stock collection returns; this is outside the in-stock view |

Test mobile filtering, browser Back/Forward, and page refresh while the availability filter is active. Record actual counts, URLs, and pass/fail. Configure any navigation entry for this in-stock view to use the filtered URL. Do not claim the plain collection URL is permanently restricted.

### Reported results

Question 2 is recorded as complete for the native in-stock filtered view, based on Atif's confirmation. The test fixture is `test-data/q2-products.csv`: 30 unique products, 25 with quantity 10 and 5 with quantity 0. CSV structure and stock counts were checked locally before import. Product CSV inventory quantities apply to single-location stores; location inventory should be checked separately when reusing the fixture in a multi-location store.

- Availability enabled in Shopify Search & Discovery; collection and imported products created; a header shortcut added.
- User supplied local preview URLs for the in-stock first page, page 2, and page 3 on `http://127.0.0.1:9292/collections/assessment-q2-stock-pagination`, retaining `filter.v.availability=1`.
- User also supplied `filter.v.availability=0` with `sort_by=title-ascending`. This selects out-of-stock products, for which the fixture expects 5 results on one page. It is not URL evidence of sorting while retaining the in-stock filter.
- Expected in-stock results remain 25 products across pages of 12, 12, and 1. User stated “tested all cases”; no failures were reported. Actual individual counts were not separately supplied.
- Header shortcut destination was not supplied; its inclusion of the in-stock parameter is not independently verified.
