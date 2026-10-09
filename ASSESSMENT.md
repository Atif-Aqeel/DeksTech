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

## 2. Collection Filtering & the Pagination Trap

### Requirement

Display only in-stock collection products, show 12 products per page, and keep pagination correct. Explain the common pagination issue.

### Approach and assumptions

Apply Shopify's native Availability filter before pagination. Availability is enabled in Shopify Search & Discovery for the assessment store. The tested in-stock collection view is:

```text
/collections/assessment-q2-stock-pagination?filter.v.availability=1
```

Use this filtered URL for the navigation entry intended to show only in-stock products. The assumption is that “in stock” means Shopify's native available-for-purchase status. For inventory-tracked test products, disable continuing to sell when out of stock. Products with untracked inventory or continue-selling enabled may still be available at zero physical stock.

Shopify filters the collection on the server before Liquid paginates `collection.products`. Reuse Dawn's existing product cards, filter controls, sorting, and pagination links. The final page can contain fewer than 12 products.

### Implementation

The product grid in `templates/collection.json` is configured with `"products_per_page": 12`. In `sections/main-collection-product-grid.liquid`, the setting has the following schema:

```json
{
  "type": "range",
  "id": "products_per_page",
  "min": 8,
  "max": 36,
  "step": 4,
  "default": 12,
  "label": "t:sections.main-collection-product-grid.settings.products_per_page.label"
}
```

The inherited rendering remains:

```liquid
{%- paginate collection.products by section.settings.products_per_page -%}
  {%- for product in collection.products -%}
    {% render 'card-product',
      card_product: product,
      media_aspect_ratio: section.settings.image_ratio,
      image_shape: section.settings.image_shape,
      show_secondary_image: section.settings.show_secondary_image,
      show_vendor: section.settings.show_vendor,
      show_rating: section.settings.show_rating,
      lazy_load: lazy_load,
      skip_styles: skip_card_product_styles,
      quick_add: section.settings.quick_add,
      section_id: section.id
    %}
  {%- endfor -%}
  {%- if paginate.pages > 1 -%}
    {% render 'pagination', paginate: paginate, anchor: '' %}
  {%- endif -%}
{%- endpaginate -%}
```

The code above is an excerpt of the existing structure; the actual loop renders `card-product` with Dawn's image, layout, and quick-add settings. No availability condition is added inside the product loop. Dawn's `pagination` snippet uses Shopify-generated `paginate.previous.url`, `part.url`, and `paginate.next.url`; it does not rebuild links using only a page number. Dawn's facet handling carries selected filter values into sorting requests.

### The pagination trap

If a page is first paginated into 12 products and then six sold-out products are skipped, it displays only six cards. Page counts still reflect the unfiltered collection, and later pages can be empty even though available products exist elsewhere. CSS hiding or browser-side removal has the same counting problem.

A Liquid `where: 'available', true` array is not a substitute for native full-collection filtering and supported collection pagination. Filtering must determine the result set before page boundaries and totals are calculated.

### Edge cases and considerations

- Availability must be configured in Shopify Admin; a URL parameter alone does not establish the required store configuration.
- The plain collection URL and removal of the Availability filter show the ordinary collection. This solution provides an explicitly filtered in-stock view; it does not permanently restrict every collection request. If the merchant requires an always-restricted listing, use a separately maintained collection whose membership follows the agreed stock rule.
- Preserve the availability parameter when paging and sorting. Reset to page 1 when changing filters.
- Shopify's native filtering has collection-size limits; confirm eligibility before applying this approach to a very large catalog.
- Keep the section's products-per-page setting at 12. The editor setting remains configurable.

### Verification

Shopify Theme Check passed the collection template and product-grid section with no warnings or errors. Static inspection confirmed that Dawn paginates `collection.products` before rendering cards and uses Shopify-generated pagination URLs.

Manual testing was completed by Atif Aqeel on October 10, 2026, in the development preview. The assessment collection contains 30 imported test products: 25 available and 5 sold out. The guided tests were reported successful and covered:

- The in-stock view across three pages, with expected page sizes of 12, 12, and 1.
- Availability retained in the supplied pagination URLs.
- Filtering, sorting, and page refresh using Dawn's existing collection controls.
- An additional out-of-stock view using `filter.v.availability=0` with title-ascending sorting; the test data contains 5 sold-out products.

The reusable import file is `test-data/q2-products.csv`. It contains unique product handles, inventory tracking, and a deny-selling policy for zero-stock products.

Reference: [Shopify storefront filtering](https://shopify.dev/docs/storefronts/themes/navigation-search/filtering/storefront-filtering).

### Result

Question 2 is complete for the availability-filtered collection view. Shopify filters eligible products before pagination, allowing full pages of 12 products and a shorter final page without counting sold-out products in the in-stock result set. The standard unfiltered collection remains accessible.

---
