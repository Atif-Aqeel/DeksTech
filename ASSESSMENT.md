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

## 3. Section Schema with Settings & Repeatable Blocks

### Requirement

Create a section schema with a heading text field, background color picker, padding slider from 0–100px, and repeatable Feature blocks containing an image and caption. Show how padding is output and blocks are rendered in Liquid.

### Approach and assumptions

Use a dedicated OS 2.0 section, `sections/assessment-features.liquid`, with a preset so merchants can add it through the Theme Editor. Padding applies equally to the top and bottom; Dawn's `page-width` class provides horizontal gutters. Each Feature renders in a responsive grid with one column on mobile, two on tablet, and three on desktop.

The heading and captions are plain text and are escaped. Images use Shopify's responsive image filters and retain their aspect ratio. Merchants should supply meaningful image alt text and choose a background with sufficient contrast against the inherited theme text color. The component is intended for supporting content below the first viewport, so images are lazy-loaded.

### Implementation

Complete section source:

```liquid
<div
  class="assessment-features"
  style="--feature-background: {{ section.settings.background_color }}; --feature-padding: {{ section.settings.padding }}px;"
>
  <div class="page-width">
    {%- if section.settings.heading != blank -%}
      <h2 class="assessment-features__heading">{{ section.settings.heading | escape }}</h2>
    {%- endif -%}
    {%- if section.blocks.size > 0 -%}
      <ul class="assessment-features__grid" role="list">
        {%- for block in section.blocks -%}
          <li class="assessment-features__item" {{ block.shopify_attributes }}>
            <figure class="assessment-features__figure">
              {%- if block.settings.image != blank -%}
                {{
                  block.settings.image
                  | image_url: width: 1200
                  | image_tag:
                    widths: '240, 360, 540, 720, 960, 1200',
                    sizes: '(min-width: 990px) 30vw, (min-width: 750px) 45vw, 90vw',
                    loading: 'lazy',
                    class: 'assessment-features__image'
                }}
              {%- endif -%}
              {%- if block.settings.caption != blank -%}
                <figcaption class="assessment-features__caption">{{ block.settings.caption | escape }}</figcaption>
              {%- endif -%}
            </figure>
          </li>
        {%- endfor -%}
      </ul>
    {%- endif -%}
  </div>
</div>

{% stylesheet %}
  .assessment-features {
    background-color: var(--feature-background);
    padding-block: var(--feature-padding);
  }

  .assessment-features__heading {
    margin: 0 0 2.4rem;
  }

  .assessment-features__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 2.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .assessment-features__item {
    min-width: 0;
  }

  .assessment-features__figure {
    margin: 0;
  }

  .assessment-features__image {
    display: block;
    width: 100%;
    height: auto;
  }

  .assessment-features__caption {
    margin-top: 1.2rem;
    overflow-wrap: anywhere;
  }

  @media screen and (min-width: 750px) {
    .assessment-features__grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media screen and (min-width: 990px) {
    .assessment-features__grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
{% endstylesheet %}

{% schema %}
{
  "name": "t:assessment_features.name",
  "tag": "section",
  "class": "assessment-features-section",
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "t:assessment_features.heading",
      "default": "Our features"
    },
    {
      "type": "color",
      "id": "background_color",
      "label": "t:assessment_features.background_color",
      "default": "#ffffff"
    },
    {
      "type": "range",
      "id": "padding",
      "min": 0,
      "max": 100,
      "step": 1,
      "unit": "px",
      "label": "t:assessment_features.padding",
      "default": 40
    }
  ],
  "blocks": [
    {
      "type": "feature",
      "name": "t:assessment_features.feature",
      "settings": [
        {
          "type": "image_picker",
          "id": "image",
          "label": "t:assessment_features.image"
        },
        {
          "type": "text",
          "id": "caption",
          "label": "t:assessment_features.caption"
        }
      ]
    }
  ],
  "presets": [
    {
      "name": "t:assessment_features.name",
      "blocks": [
        { "type": "feature" },
        { "type": "feature" },
        { "type": "feature" }
      ]
    }
  ]
}
{% endschema %}
```

The following keys are added at the root of `locales/en.default.schema.json` for the editor labels:

```json
"assessment_features": {
  "name": "Assessment features",
  "heading": "Heading",
  "background_color": "Background color",
  "padding": "Vertical padding",
  "feature": "Feature",
  "image": "Image",
  "caption": "Caption"
}
```

The padding setting is output as `--feature-padding: {{ section.settings.padding }}px` on the section's wrapper. Static CSS consumes this with `padding-block: var(--feature-padding)`. Liquid values are output in the HTML rather than inside `{% stylesheet %}`, where Liquid is not evaluated.

The `section.blocks` loop renders each Feature in merchant-defined order. `block.shopify_attributes` on each list item allows the Theme Editor to identify, select, and reorder blocks. Background and padding variables are set on each instance's wrapper, allowing independent settings when the section is added twice. No JavaScript is needed.

### Edge cases and considerations

- A blank heading or caption produces no empty text element.
- An unset image produces no broken image request; a caption can still render.
- With no blocks, the grid is omitted while the section's heading and settings remain usable.
- Long captions can wrap without overflowing the grid.
- Image dimensions and responsive sources are generated by `image_tag`; the image picker supplies the image resource.
- The slider applies the exact selected vertical padding, including 0px and 100px.

### Verification

Shopify Theme Check passed the section and English schema locale file with no warnings or errors.

Atif Aqeel reported successful completion of the guided Theme Editor and development-preview tests on October 10, 2026. Testing covered editing the heading and background, setting padding to 0px, 40px, and 100px, adding images and captions, adding/removing/reordering Feature blocks, checking mobile and desktop layouts, and verifying that two section instances retain independent settings.

### Result

Question 3 is complete. The section provides all requested settings and repeatable Feature blocks, with explicit Liquid output for padding and block rendering. It is available through the Theme Editor's Add section menu as Assessment features, and the guided manual tests were reported successful.

---

## 4. AJAX Cart & Section Rendering API

### Requirement

Add the selected variant without refreshing the page, update the header cart count, provide JavaScript, and explain relevant considerations.

### Approach and assumptions

Extend Dawn's existing `product-form` custom element rather than attach a second submit listener. Read the selected variant ID, quantity, line-item properties, and any selling plan from the existing form using `FormData`. Post to the locale-aware `window.routes.cart_add_url` generated by Liquid.

Request bundled section rendering in the add operation. Notification mode requests `cart-notification-product`, `cart-notification-button`, and `cart-icon-bubble`; drawer mode requests `cart-drawer` and `cart-icon-bubble`. When neither cart component exists, request only `cart-icon-bubble` and update the header without redirecting. The header target is `#cart-icon-bubble`; its rendered Liquid uses `cart.item_count`, which counts total units rather than distinct lines or the last-added quantity.

The normal path makes one add request and renders the returned sections. If section HTML is missing or lacks its expected selector, make one read-only Section Rendering API request to recover the requested sections. Never repeat the add automatically.

### Implementation

The complete resulting `assets/product-form.js` is:

```javascript
if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        this.variantIdInput.disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        this.submitButton = this.querySelector('[type="submit"]');
        this.submitButtonText = this.submitButton.querySelector('span');

        if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');

        this.hideErrors = this.dataset.hideErrors === 'true';
      }

      async onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.pending || this.submitButton.getAttribute('aria-disabled') === 'true') return;

        this.pending = true;
        this.handleErrorMessage();
        this.submitButton.setAttribute('aria-disabled', 'true');
        this.submitButton.classList.add('loading');
        this.querySelector('.loading__spinner').classList.remove('hidden');

        let added = false;
        try {
          const formData = new FormData(this.form);
          const sectionIds = this.cart
            ? this.cart.getSectionsToRender().map((section) => section.id)
            : ['cart-icon-bubble'];
          formData.set('sections', sectionIds.join(','));
          formData.set('sections_url', window.location.pathname);
          this.cart?.setActiveElement(document.activeElement);

          const config = fetchConfig('javascript');
          config.headers['X-Requested-With'] = 'XMLHttpRequest';
          delete config.headers['Content-Type'];
          config.body = formData;

          const response = await fetch(window.routes.cart_add_url, config);
          const state = await response.json();
          if (!response.ok || state.status) {
            const message = state.description || window.cartStrings.error;
            publish(PUB_SUB_EVENTS.cartError, {
              source: 'product-form',
              productVariantId: formData.get('id'),
              errors: state.errors || message,
              message,
            });
            this.handleErrorMessage(message);
            return;
          }

          added = true;
          const quickAddModal = this.closest('quick-add-modal');
          if (quickAddModal) {
            await new Promise((resolve) => {
              document.body.addEventListener('modalClosed', () => setTimeout(resolve), { once: true });
              quickAddModal.hide(true);
            });
          }

          try {
            await this.renderCartSections(state, sectionIds);
          } catch (error) {
            this.handleErrorMessage(window.cartStrings.addedRefreshError);
            console.error(error);
          }

          publish(PUB_SUB_EVENTS.cartUpdate, {
            source: 'product-form',
            productVariantId: formData.get('id'),
            cartData: state,
          });
        } catch (error) {
          this.handleErrorMessage(added ? window.cartStrings.addedRefreshError : window.cartStrings.addUncertain);
          console.error(error);
        } finally {
          this.pending = false;
          this.submitButton.classList.remove('loading');
          this.submitButton.removeAttribute('aria-disabled');
          this.querySelector('.loading__spinner').classList.add('hidden');
        }
      }

      async renderCartSections(state, sectionIds) {
        const canRender = () => sectionIds.every((id) => {
          const html = state.sections?.[id];
          if (typeof html !== 'string') return false;
          const selector = id === 'cart-drawer'
            ? '#CartDrawer'
            : id === 'cart-notification-product'
              ? `[id="cart-notification-product-${state.key}"]`
              : '.shopify-section';
          const destination = id === 'cart-drawer'
            ? document.querySelector('#CartDrawer')
            : document.getElementById(id);
          return destination && new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
        });

        if (!canRender()) {
          const url = new URL(window.location.href);
          url.searchParams.delete('section_id');
          url.searchParams.set('sections', sectionIds.join(','));
          const response = await fetch(url, { cache: 'no-store' });
          if (!response.ok) throw new Error('Cart section recovery failed');
          state.sections = await response.json();
          if (!canRender()) throw new Error('Cart section HTML is unavailable');
        }

        if (this.cart) {
          this.cart.classList.remove('is-empty');
          this.cart.renderContents(state);
        } else {
          const html = new DOMParser().parseFromString(state.sections['cart-icon-bubble'], 'text/html');
          document.getElementById('cart-icon-bubble').innerHTML = html.querySelector('.shopify-section').innerHTML;
        }
      }
      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }

      toggleSubmitButton(disable = true, text) {
        if (disable) {
          this.submitButton.setAttribute('disabled', 'disabled');
          if (text) this.submitButtonText.textContent = text;
        } else {
          this.submitButton.removeAttribute('disabled');
          this.submitButtonText.textContent = window.variantStrings.addToCart;
        }
      }

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }
    }
  );
}
```

`layout/theme.liquid` adds these translated messages to Dawn's existing `window.cartStrings` object:

```liquid
addUncertain: {{ 'assessment.cart_add_uncertain' | t | json }},
addedRefreshError: {{ 'assessment.cart_added_refresh_error' | t | json }},
```

The `assessment` object in `locales/en.default.json` includes:

```json
"cart_add_uncertain": "The cart request could not be confirmed. Check your cart before trying again.",
"cart_added_refresh_error": "Added to your cart, but the cart display could not be updated. Open your cart to review it."
```

Dawn supplies `fetchConfig`, `publish`, `PUB_SUB_EVENTS`, cart components, form markup, the loading spinner, and the error region. Those are inherited dependencies, not new assessment handlers. The existing header element is preserved while its contents are replaced, retaining its attached drawer listeners. Existing notification/drawer renderers retain their focus and opening behavior. Quick-add rendering waits for the modal to close.

### Edge cases and considerations

- A pending flag and loading state block repeat submission from the same form while the operation is in flight. This is not global cart-operation serialization.
- Use variant IDs, not product IDs. `FormData` preserves quantity, properties, recipient fields, and selling plans without manually reconstructing them.
- Do not set the Content-Type header when sending FormData; the browser supplies its multipart boundary.
- Handle non-success HTTP responses and Shopify error payloads. Display inventory errors without permanently treating every rejection as a sold-out variant; restore submission controls so corrected quantities can be tried.
- Missing section HTML can occur after a successful mutation. Validate it before invoking Dawn's renderers, recover via GET, and warn if the UI still cannot refresh. A failed recovery can leave stale UI until the customer opens or refreshes the cart.
- A network failure or unreadable response leaves the mutation outcome uncertain. Warn the customer to inspect the cart before retrying; do not automatically resend the POST.
- `sections_url` begins with `/`; this implementation uses the current locale-aware pathname. The requested section count is below Shopify's five-section limit.
- Keep errors in Dawn's existing alert region and preserve its component focus behavior. Gift-card recipient forms retain Dawn's separate error handling via `data-hide-errors`.
- The section renderer defines how large cart counts are displayed; Dawn hides the visible number at 100 or more while retaining an accessible count.

### Verification

JavaScript syntax checking passed. Six automated tests in `tests/q4-cart.test.cjs` passed, covering the selected variant/quantity and locale route, repeat-submit blocking, inventory rejection, uncertain network failure without automatic retry, UI failure after a successful add, and read-only recovery of missing header HTML.

These tests use mocked requests and DOM elements. Shopify Theme Check passed the JavaScript and English locale file without findings. The layout passed with one warning in inherited code (`scheme_classes`).

Atif Aqeel reported successful completion of the guided development-preview tests on October 10, 2026. The guided checks covered selected-variant additions without reloading, header quantities increasing from 1 to 3 to 4, duplicate-click prevention, inventory errors, blocked-request feedback, and successful cart/header updates in Notification and Drawer modes.

Reference: [Shopify AJAX Cart API and bundled section rendering](https://shopify.dev/docs/api/ajax/reference/cart).

### Result

Question 4 is complete based on static validation, automated tests, and the reported manual storefront checks. The handler adds the selected variant without page navigation and updates the header through server-rendered cart HTML. It retains Dawn's cart components while adding duplicate-submit protection, visible failure messages, and recovery that does not repeat the cart mutation.

---

## 5. Theme Editor Lifecycle Events

### Requirement

Explain why a JavaScript carousel breaks when blocks are added, removed, or reordered in the Theme Editor, how to fix it, and which lifecycle handlers to use.

### Why it happens

The Theme Editor can replace section HTML without reloading the page. Initialization that runs only on page load does not automatically run for the replacement DOM. The new carousel can remain uninitialized while the old instance retains references to removed elements, event listeners, timers, or observers.

Block changes also invalidate cached slide counts, positions, and measurements. Reinitializing indiscriminately can make the problem worse by creating duplicate instances and autoplay timers.

### Solution approach

Give each carousel a single owner for initialization and cleanup. Initialize existing carousels on page load. Before a section is removed or replaced, destroy its instance. When its replacement loads, initialize against the new DOM and current block order.

Initialization must be safe to call repeatedly: check whether an instance already exists, and refresh it when appropriate instead of creating duplicates. Scope actions to the affected section using the event target and section ID so editing one carousel does not reset others.

Cleanup must remove registered listeners, stop autoplay timers, disconnect observers, cancel scheduled callbacks, and release old DOM references. The exact methods depend on the carousel implementation; there is no universal Shopify carousel initialization or destroy API.

### Lifecycle handlers

| Event | Handler responsibility |
|---|---|
| Initial page load | Initialize each existing carousel once. |
| `shopify:section:load` | Initialize the carousel within the newly added or re-rendered section. |
| `shopify:section:unload` | Destroy the affected instance and clean up its resources before removal or replacement. |
| `shopify:section:reorder` | Refresh measurements if moving the section changes its layout. |
| `shopify:block:select` | Reveal the selected slide and apply an editor pause so it stays visible. |
| `shopify:block:deselect` | Release the block-selection pause; resume only when autoplay is enabled and no other pause condition applies. |
| `shopify:section:select` | Keep the section visible; apply a section-selection pause if needed. |
| `shopify:section:deselect` | Release the section-selection pause without overriding other pause conditions. |

There is no documented `shopify:block:reorder` event. Block additions, removals, and reordering are handled through the section re-render lifecycle; `shopify:section:reorder` refers to moving an entire section.

Register the document-level editor handlers once, not inside every carousel initialization. Normal storefront initialization must run independently of editor-only event handling; `Shopify.designMode` can identify the editor context.

### Block selection and autoplay

Each slide wrapper must include `{{ block.shopify_attributes }}` so Shopify can identify it and target block-selection events. Locate the selected slide in its own carousel, reveal it, and pause rotation while it is selected.

Deselecting a block must not blindly start autoplay. Respect the section configuration, a customer's manual pause, reduced-motion behavior, and remaining pause conditions such as another editor selection. Keeping separate pause reasons prevents one event from incorrectly overriding another.

### Application to Dawn

Dawn already provides a slideshow custom element and block-selection handlers. Reuse that architecture rather than add another carousel library or parallel instance manager.

A custom element can own initialization in `connectedCallback()` and cleanup in `disconnectedCallback()`. In that design, section-event handlers should call guarded refresh or selection methods instead of independently constructing the same instance. This describes a lifecycle design; it does not claim that every existing Dawn slideshow method already implements it.

### Verification and scope

The lifecycle event names and responsibilities were checked against Shopify's official Theme Editor documentation. This answer is a written explanation, as requested by the question. No theme implementation changes or Question 5 browser tests were performed.

For an implementation, I would verify repeated slide additions, removals, and reordering; selection of a nonvisible slide; deletion and re-addition of a section; and independent operation of two carousel instances. Controls should react once per interaction, selected slides should remain visible, and removed instances should leave no running timers or observers. These are proposed checks, not reported test results.

Reference: [Shopify Theme Editor lifecycle](https://shopify.dev/docs/storefronts/themes/best-practices/editor/integrate-sections-and-blocks).

### Result

The proposed solution addresses the carousel failure by initializing against the current section DOM, cleaning up replaced instances, preventing duplicate initialization, and maintaining selected-slide visibility. The written answer covers the cause, fix, and lifecycle handlers required by Question 5.

---
