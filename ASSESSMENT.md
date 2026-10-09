# Shopify Theme Dev Assessment — Atif Aqeel



## 1. Liquid Output, Money Filters & Sale Logic

### Requirement

Display the monetary amount and percentage saved when a product is on sale. Show neither when the compare-at price does not exceed the current price. Provide Liquid.

### Approach and assumptions

Use the selected variant, falling back to the first available variant, so the saving compares prices from the same variant. Display savings only when its compare-at price exceeds its current price. This is a catalog sale comparison, not a calculation of automatic discounts or discount codes. Dollar examples assume a USD storefront; money filters respect the customer's presentment currency and the theme's currency-code setting.

Monetary savings = compare-at price − current price. Percentage saved = monetary savings ÷ compare-at price × 100, rounded to the nearest whole number. For example, a $100 compare-at price and $80 current price produce $20 savings and 20% saved.

### Implementation

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
    assign compare_at_float = variant.compare_at_price | times: 1.0
    assign percentage = savings | times: 100 | divided_by: compare_at_float | round
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
- Convert the compare-at price to a float before division, because Liquid division follows the divisor type. Round only the final percentage to a whole number.
- A zero-price variant with a positive compare-at price shows 100% savings.
- A sold-out variant can still have sale pricing; availability and sale status are separate conditions.
- Very small discounts can round to 0%; one decimal place can be used if the merchant prefers.
- This displays unit savings before quantity price breaks. Additional translations and quantity-dependent pricing are outside this example's scope.

### Verification

Shopify Theme Check passed the savings snippet and English locale file with no errors. The main product section passed with two warnings in inherited Dawn code.

Manual development-preview testing was completed and reported successful by Atif Aqeel on October 10, 2026:

- $100 compare-at / $80 price: $20 savings and 20%.
- $30 compare-at / $20 price: $10 savings and 33%.
- $30 compare-at / $10 price: $20 savings and 67%.
- No compare-at price: no savings message.
- $100 compare-at / $0 price: $100 savings and 100%.
- Switching between sale and regular variants updated or removed the savings without reloading the page.
- Opening a direct variant URL displayed the selected variant's pricing and savings.
- A sold-out sale variant retained its savings while purchasing was unavailable.

References: [Variant pricing](https://shopify.dev/docs/api/liquid/objects/variant), [Liquid division](https://shopify.dev/docs/api/liquid/filters/divided_by).

### Result

The implementation displays currency-formatted monetary savings and a rounded percentage only when the selected variant's compare-at price exceeds its current price. Savings stay synchronized with variant selection through Dawn's existing price updates. The reported manual preview tests confirmed the required behavior.

---
