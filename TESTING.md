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

## Question 3: configurable Feature section

Atif reported completing the guided Theme Editor and development-preview tests on October 10, 2026, with no failures reported. The instructions below are retained for repeat testing. Keep `shopify theme dev` running and use its Theme Editor link (press `e` if supported by the running CLI). Ensure you are editing the development theme containing the local files.

1. Open the Home page in the Theme Editor. Choose Add section → Assessment features. Place it below the main banner. The preset should create three Feature blocks.
2. Set the heading to **Why choose us**, background to **#f3f8ff**, and vertical padding to **40px**.
3. Add images and captions: **Quality materials**, **Thoughtful design**, and **Reliable delivery**. Set meaningful alt text for the images. Save and inspect the development preview.

| Check | Expected |
|---|---|
| Heading edit | New text displayed |
| Background edit | Only this instance changes |
| Padding 0, 40, 100 | Computed top/bottom padding is exactly 0px, 40px, 100px |
| Add fourth Feature | Fourth card appears |
| Reorder blocks | Preview order matches editor order |
| Remove a block | Its card disappears |
| Select a block | Editor identifies the corresponding card |
| Clear heading/caption | Empty text element omitted |
| Remove image | No broken image; caption remains |
| Remove all blocks | No grid or errors; section remains editable |
| Long caption | Text wraps without horizontal overflow |
| Mobile/tablet/desktop | 1/2/3 columns respectively |
| Save and refresh | Values and block order persist |

For an instance-isolation check, add Assessment features a second time with heading **More benefits**, background **#fff4e5**, and padding **80px**. Changing the first section must not change the second. This also prepares the Question 6 demonstration.

### Reported results

- Question 3 is complete based on static validation and Atif's confirmation of successful guided testing.
- Reported coverage: heading/background edits, padding at 0/40/100px, images/captions, adding/removing/reordering blocks, mobile/desktop layout, and independent settings for two instances.
- Static validation passed both new/updated theme files with no warnings or errors.
- Evidence source: user-run manual testing. The assistant did not independently observe the browser; screenshots, computed-style readings, and per-case results were not supplied. Additional edge-case checks in the table have no separately recorded outcome.

## Question 4: AJAX cart and header count

Atif reported successful completion of the guided development-preview tests on October 10, 2026. Six automated tests also passed with `node --test tests/q4-cart.test.cjs`; these mock requests and DOM elements. The instructions below are retained for repeat testing.

Keep the development preview running. Use a product with two available variants and known inventory. Set Cart type to Notification, then repeat in Drawer mode. Empty the session cart through the normal cart UI. Open DevTools Network with Preserve log enabled.

| Action | Expected |
|---|---|
| Select variant A; add quantity 1 | No reload; header shows 1; correct variant in cart |
| Add quantity 2 of variant A | Header shows 3; same variant totals 3 |
| Add quantity 1 of variant B | Header shows 4, not 2 distinct lines |
| Double-click with Slow 3G enabled | One add POST while pending; quantity added once |
| Request more units than available | Inventory error shown; controls recover |
| Correct quantity after rejection | Subsequent intentional add succeeds |
| Block cart/add.js request in DevTools | Uncertain-outcome warning; spinner stops; no automatic retry |
| Close cart with Escape | Normal Dawn focus behavior retained |
| Repeat in Notification and Drawer modes | Header and cart UI update in both modes |
| Cart page mode | Header updates without redirecting; no popup expected |

For inventory rejection, use a variant with quantity 1, continue-selling disabled, and request quantity 2 from an empty cart. Inspect the actual cart after rejection: Shopify can partially fulfill an over-stock request. Do not assume a rejected request never changed the cart.

Inspect the add request in Network: `id` is the selected variant, `quantity` is correct, `sections` includes `cart-icon-bubble`, and `sections_url` begins with `/`. A successful response contains section HTML. There should be no document navigation.

### Missing-section recovery

On the development product page, run the following console script before adding once. It simulates missing HTML after a real successful add:

```javascript
window.q4OriginalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await window.q4OriginalFetch(...args);
  if (String(args[0]).includes('/cart/add.js') && response.ok) {
    const state = await response.clone().json();
    if (state.sections) state.sections['cart-icon-bubble'] = null;
    return new Response(JSON.stringify(state), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return response;
};
```

Expected: one add POST and one recovery GET containing `sections=...`; cart UI and header recover, and quantity increases once. Restore with `window.fetch = window.q4OriginalFetch`, or reload.

To simulate failed recovery, block `*sections=*` in DevTools while the script is active. Expect one add and a warning that the display could not update. Check the cart before adding again. Disable blocking and restore fetch afterwards.

Record counts, selected/returned variant, mode, and errors before updating submission verification. Real locale testing requires an alternate language configured in the store; locale routing has only been checked with mocks so far.

### Reported results

- Question 4 is recorded as complete based on static checks, six automated tests, and Atif's manual-testing confirmation.
- Guided coverage: selected variants, quantities and header count, no reload, duplicate clicks, inventory rejection, blocked-request feedback, and Notification/Drawer modes.
- Evidence source: user-run manual testing; no individual counts, request logs, or screenshots were supplied, and the assistant did not independently observe the browser.
- Missing-section recovery and failure were covered by mocks; their browser simulation, Cart page mode, keyboard focus, and real alternate-locale behavior have no separately recorded manual outcome.

## Question 6: independent section instances

Reuses the two-instance isolation test reported complete during Question 3 on October 10, 2026. No separate Q6 browser session or additional code changes were needed. The source puts each instance's background and padding values on its wrapper; the submission documents that implementation.

For repeat testing, add two Assessment features sections with different background/padding values. Change each instance in turn, save, and refresh. Each wrapper should retain its own settings. The example colors in the guide are suggested repeat-test data, not separately recorded actual values from the user-run test.

## Question 7: size selector

Status: complete. Atif confirmed all remaining testing, including Q7, on October 10, 2026. Four mocked automated checks passed; direct execution with `node tests/q7-variants.test.cjs` was used in the final review because sandbox restrictions blocked the child-process test runner. The instructions below are retained for repeat testing.

Create an Active Online Store product titled **Assessment Q7 Size Selector**, handle `assessment-q7-size-selector`, with one option named **Size**. Disable continue selling and track inventory. Use:

Import fixture: `test-data/q7-product.csv`, containing one product with four Size variants. Import through Products → Import. For multi-location stores, set or verify inventory at the appropriate fulfillment location separately after product import. CSV structure and variant stock counts were checked locally; Atif subsequently confirmed overall testing; no separate import log was supplied.

| Size | Price | Compare-at | Quantity |
|---|---:|---:|---:|
| S | 20.00 | Blank | 10 |
| M | 25.00 | 30.00 | 10 |
| L | 30.00 | Blank | 0 |
| XL | 35.00 | Blank | 10 |

Open this product in the development preview. Set the variant picker to Buttons initially and use a currency matching the expected prices. Empty the cart before cart checks.

Local preview URL:

```text
http://127.0.0.1:9292/products/assessment-q7-size-selector
```

### Guided storefront test

1. Select S, M, and XL and compare their prices with the table. M should show a compare-at price of 30 and savings of 5 / 17%. No selection should reload the document.
2. Try clicking L and navigating with the keyboard. Its control must be natively disabled; available sizes remain usable.
3. Empty the cart, select M, and add quantity 1. Verify the cart contains size M at 25.
4. Open the product with `?utm_source=q7-test#details`, change size, and confirm both the parameter and fragment remain alongside the new variant ID.
5. Copy a selected M variant URL and reopen it. Then use L's variant ID from Shopify Admin in a direct link; L's price should render with purchasing disabled, and selecting S should restore purchasing.
6. Switch S → M → XL rapidly. After requests settle, XL's selection, price, hidden form ID, and URL must agree. Repeat using Dropdown mode and verify L is disabled there too.
7. Block `*option_values=*` in DevTools Network and choose another available size. Confirm an error and disabled Add to cart. Remove blocking and choose another size or refresh to recover.

The detailed expected outcomes below also include additional edge cases.

| Check | Expected |
|---|---|
| Select S, M, XL | Corresponding prices 20, 25, 35; correct size selected |
| Select M | Q1 savings shows 5 and 17%, using the storefront money format |
| Try L | Radio has a native disabled attribute; mouse/keyboard cannot select it |
| Change available size | URL variant changes, no document reload |
| Add selected M | Cart contains M, not the previously selected size |
| Switch rapidly S/M/XL with Slow 3G | Final XL selection, price, form ID, and URL agree |
| Direct available variant URL | Initial selection and price match that variant |
| Direct L variant URL | L pricing shown, L control disabled, Add to cart disabled; choosing S recovers |
| Switch picker to Dropdown | L option disabled; available selections still update |
| All variants sold out | No available choices; purchasing unavailable |

Start with `/products/assessment-q7-size-selector?utm_source=q7-test#details` and select M. Confirm `utm_source=q7-test` and `#details` remain alongside the new variant parameter. Preserve any development preview parameters as well.

To test failure, block `*option_values=*` in DevTools Network, then choose a different available size. Expect a visible selection error and disabled Add to cart. Remove blocking and choose another size (or refresh); successful loading restores synchronized state. Do not use an old cart ID while the selected size is unresolved.

Inspect `#product-form-SECTION_ID input[name="id"]` and the add request's `id`. They must match the selected available size's variant ID. Test keyboard navigation and verify L is skipped. Test any quick-add/featured-product component separately if used: it must not modify the browser URL when update-url is false.

Record actual results, product URL, variant IDs, and currency. Swatch rendering is supported by the disabled parameter but has not been manually verified. Q1/Q4 integration uses the existing handlers and should be checked during this run.

### Verification status

Implementation, syntax validation, Theme Check, four mocked automated tests, local CSV checks, and user-confirmed manual acceptance are complete. Atif confirmed all remaining testing on October 10, 2026. The confirmation is an overall result; product URLs, screenshots, and individual case outcomes were not supplied, and the assistant did not independently observe the storefront.

## Question 8: product care metafields

Atif confirmed both definitions and values on two products and reported successful completion of the guided development-preview tests on October 10, 2026. The following steps are retained for repeat testing.

1. Keep the development theme running. Open its Theme Editor and choose the product template used by Product A.
2. In Product information, choose Add block → Care instructions. Position it below the price/buy buttons and save. Adding the block to a shared product template makes it available to every product using that template; content still comes from each product's own metafields.
3. Open Product A in the development preview. Confirm its own instructions and a second heading identifying Product B, with B's care instructions underneath.
4. Verify paragraphs, bullets, and emphasis match the rich-text values you entered. Text must not appear as raw JSON or HTML source.
5. Edit Product B's instructions in Admin, save, and refresh Product A. The related group must use the updated content.
6. Temporarily clear A's related reference. Its own group remains and the related group disappears. Restore the reference.
7. Temporarily clear A's own instructions while keeping B's reference. Only B's group appears. Restore A's instructions.
8. Clear B's instructions temporarily. A's own group remains without an empty related heading. Restore B's instructions.
9. On a product without either field populated, confirm no empty care wrapper or heading appears.
10. Optionally reference A from A: the implementation intentionally suppresses the duplicate related group. Restore B afterwards.

Check mobile formatting and block repositioning in the editor. These are product-level fields; ordinary variant changes should leave care content unchanged. Use refresh after Admin edits, allowing for normal storefront caching.

Record the tested product URLs, actual rich-text rendering, missing-data behavior, and pass/fail before finalizing Q8. Test products can reuse existing assessment products; no additional product import is necessary.

### Reported results

- Q8 is complete based on definition setup, Theme Check, and Atif's successful manual-testing report.
- Guided coverage: editor block insertion, both products' care content and formatting, referenced-content updates after refresh, missing reference, missing current care, and empty output when neither field is populated.
- Evidence source: user-run testing. Product URLs, screenshots, and per-case results were not supplied; the assistant did not independently observe the browser.
- Self-reference, mobile formatting, and product-swap behavior have no separately recorded test outcome.


## Question 9: shared Designer metaobjects

Status: complete based on Admin setup, Shopify validation, and successful user-reported guided testing on October 10, 2026. The steps below are retained for repeat testing.

1. Keep the development theme running. In Admin > Online Store > Pages, create a visible page titled Our Designers, handle our-designers. Body text is optional.
2. Select the designers theme template if available. If it is absent from the Admin dropdown, test the development template directly at http://127.0.0.1:9292/pages/our-designers?view=designers. An alternate template can be selected with the view parameter; publishing the theme is not required for this test.
3. In the development Theme Editor, open the product template used by the assigned products. Under Product information, Add block > Designer, position it, and save. Verify each relevant template if products use different templates.
4. Open two products referencing the same designer and a third referencing another designer. Check name, biography formatting, photo, and country against Admin. Both shared products must show the same designer; the third must show its own.
5. Edit the shared designer biography, save, and refresh both products and the directory. All three locations must reflect the edit after normal storefront caching.
6. Open the directory URL from step 2. Confirm every Active storefront-visible entry appears, including an entry without product assignments if you create one. Each entry must appear once across the directory pages.
7. In the development Theme Editor, select Pages > designers and preview Our Designers. Temporarily set Our designers > Designers per page to 1. With two Active entries, check page 1 and page 2, next/previous links, and preservation of the designers template. Restore 12 and save.
8. On a product without a Designer reference, confirm no empty Designer heading/card. Temporarily remove a populated reference to check this, then restore it.
9. Temporarily remove optional photo, country, and biography values; confirm the remaining card stays readable without broken images. Restore values. If publication status is enabled, temporarily mark an entry Draft: it should disappear from the directory and its product reference should not display a card. Restore Active.
10. Check mobile and desktop layout, photo proportions, keyboard access to pagination, and editor block repositioning. Confirm existing price, variant, and cart behavior still works.

Atif reported that Q9 works well and was tested successfully on October 10, 2026 after receiving the guided checks. No product URLs, screenshots, or individual case results were supplied. This confirms overall user-reported success; optional missing-field and Draft scenarios have no separately recorded outcome. The assistant did not independently observe the storefront.


## Question 10: performance debugging and technical judgment

Q10 is complete as a written scenario answer. Official documentation was checked for Shopify performance reports, Theme Inspector, theme performance guidance, and Chrome Lighthouse. No storefront performance audit or benchmark was run, and no optimization was implemented. The baseline, controlled comparisons, functional regression checks, and rollout monitoring described in ASSESSMENT.md are proposed verification steps rather than completed tests.


## Final requirement review

On October 10, 2026, the original DOCX was compared against all ten answers and current theme source. Shopify validation of 15 reviewed files produced no errors and three inherited warnings. Direct execution of the existing Q4 and Q7 test files passed all ten checks. JavaScript syntax and relevant JSON parsing passed. REVIEW.md records question-by-question coverage and scope limits. Atif subsequently confirmed all remaining testing, including Q7, and all ten questions are marked complete. This review did not independently inspect the live storefront or Admin configuration.
