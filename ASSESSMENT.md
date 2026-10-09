# Shopify Theme Dev Assessment — Atif Aqeel

Draft submission. Written answers and code are the primary deliverable; this Dawn project provides supporting implementations. Only Question 1 has been implemented so far. No submission format or deadline has been confirmed.

## 1. Liquid Output, Money Filters & Sale Logic

### Approach and assumptions

Use the selected variant, falling back to the first available variant, so the saving compares prices from the same variant. Display savings only when its compare-at price exceeds its current price. This is a catalog sale comparison, not a calculation of automatic discounts or discount codes. Dollar examples assume a USD storefront; money filters respect the customer's presentment currency and the theme's currency-code setting.

### Actual implementation

Source: `snippets/assessment-sale-savings.liquid`.

```liquid
{% doc %}
  Displays monetary and percentage savings for the selected variant.
  @param {product} product - Product whose selected variant is priced.
{% enddoc %}
{%- assign variant = product.selected_or_first_available_variant -%}
{%- if variant != blank and variant.compare_at_price > variant.price -%}
  {%- liquid
    assign savings = variant.compare_at_price | minus: variant.price
    assign percentage = savings | times: 100.0 | divided_by: variant.compare_at_price | round
    assign formatted_savings = savings | money
    if settings.currency_code_enabled
      assign formatted_savings = savings | money_with_currency
    endif
  -%}
  <p class="assessment-sale-savings">
    {{- 'assessment.sale_savings' | t: amount: formatted_savings, percentage: percentage -}}
  </p>
{%- endif -%}
```

The added English locale entry in `locales/en.default.json` is:

```json
"assessment": {
  "sale_savings": "Save {{ amount }} ({{ percentage }}%)"
}
```

In `sections/main-product.liquid`, the price block now contains:

```liquid
<div id="price-{{ section.id }}" role="status" {{ block.shopify_attributes }}>
  {%- render 'price',
    product: product,
    use_variant: true,
    show_badges: true,
    price_class: 'price--large'
  -%}
  {%- render 'assessment-sale-savings', product: product -%}
</div>
```

Dawn's inherited `assets/product-info.js` replaces the contents of this price region after a variant change. Keeping the savings inside it reuses that behavior without adding another JavaScript handler.

### Edge cases and considerations

- Missing, equal, or lower compare-at prices produce no savings output. The guard also prevents division by zero for valid nonnegative Shopify prices.
- Multiply by `100.0` before division to retain fractional arithmetic; round only the final percentage to a whole number.
- A zero-price variant with a positive compare-at price shows 100% savings.
- A sold-out variant can still have sale pricing; availability and sale status are separate conditions.
- Very small discounts can round to 0%; one decimal place can be used if the merchant prefers.
- This displays unit savings before quantity price breaks. Additional translations and quantity-dependent pricing are outside this example's scope.

### Verification

Static inspection confirmed placement inside Dawn's existing variant price update region. Shopify Theme Check passed the snippet and English locale file; the main product section passed with two warnings in inherited code (unused `seo_media` and unknown `continue`). Storefront rendering, currency formatting, and live variant switching have not yet been tested. Setup results are recorded in `SETUP.md`.

Pending storefront cases: $100 → $80 shows $20 / 20%; $30 → $20 shows $10 / 33%; equal prices, lower compare-at price, or absent compare-at price hide the message; sale → regular variant switching removes it.

Reference: [Shopify Liquid variant](https://shopify.dev/docs/api/liquid/objects/variant).

## 2. Collection Filtering & the Pagination Trap

Pending. Apply native availability filtering before paginating 12 products. Explain why hiding sold-out products inside a paginated loop produces sparse pages and incorrect totals. Confirm store filter configuration and parameter preservation.

## 3. Section Schema with Settings & Repeatable Blocks

Pending. Implement heading, background, padding range 0–100px, repeatable image/caption blocks, preset, responsive images, and Theme Editor block attributes.

## 4. AJAX Cart & Section Rendering API

Pending. Reuse Dawn cart handling; document locale-aware routes, header section IDs, duplicate-submit prevention, errors, and safe recovery when section rendering fails after a successful cart mutation.

## 5. Theme Editor Lifecycle Events

Pending. Explain section DOM replacement; implement initialization and teardown, section load/unload, and block selection/deselection handling without duplicate initialization.

## 6. Per-Instance CSS Without Style Bleed

Pending. Demonstrate two independently configured instances using section-scoped styles or wrapper CSS variables. Share the Question 3 section where appropriate.

## 7. Integrated Build – AJAX Variant / Size Selector

Pending. Provide a complete Size-only component for a small variant set with genuinely disabled sold-out choices, synchronized form ID, price, availability, and URL while preserving other URL parameters. Identify inherited Dawn behavior and explain multi-option/high-variant limitations.

## 8. Metafields: Definition, Rendering & References

Pending. Define merchant-owned rich-text `custom.care_instructions` and a separate product-reference relationship. Render both current and referenced product instructions, resolving `.value` and guarding missing data.

## 9. Metaobjects vs. Metafields

Pending. Configure a reusable Designer entity with name, bio, photo, and country; assign via a product metaobject-reference metafield; render a paginated Our Designers listing. Document storefront access and publication prerequisites.

## 10. Performance Debugging & Technical Judgment

Pending. Write a measured investigation plan covering browser and server costs, app functionality, nested loops, and unnecessary variant payloads. Do not invent measurements or recreate the six-app scenario.

Each remaining answer will include approach, necessary assumptions, actual final code, edge cases, and verification performed.
