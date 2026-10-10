# Shopify theme development assessment: Atif Aqeel

## 1. Liquid output, money filters, and sale logic

### Requirement

Display the monetary amount and percentage saved when a product is on sale. Show neither when the compare-at price does not exceed the current price. Provide Liquid.

### Approach and assumptions

I compare the selected variant's price with its own compare-at price, falling back to the first available variant when needed. Savings appear only when the compare-at price is higher. This covers catalog sale pricing; automatic discounts and discount codes need a separate calculation. The dollar examples assume USD, while the money filters use the customer's presentment currency and the theme's currency-code setting.

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

Dawn's existing `assets/product-info.js` replaces this price region when the variant changes. Placing savings inside that region keeps them current through the same handler.

### Edge cases and considerations

- Missing, equal, or lower compare-at prices produce no savings output. The guard also prevents division by zero for valid nonnegative Shopify prices.
- Convert the compare-at price to a float before division, because Liquid division follows the divisor type. Round only the final percentage to a whole number.
- A zero-price variant with a positive compare-at price shows 100% savings.
- A sold-out variant can still have sale pricing; availability and sale status are separate conditions.
- Very small discounts can round to 0%; one decimal place can be used if the merchant prefers.
- This displays unit savings before quantity price breaks. Additional translations and quantity-dependent pricing are outside this example's scope.

### Verification

Shopify Theme Check passed the savings snippet and English locale file with no errors. The main product section passed with two warnings in inherited Dawn code.

Manual preview testing was reported successful on October 10, 2026, with these results:

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

## 2. Collection filtering and the pagination trap

### Requirement

Display only in-stock collection products, show 12 products per page, and keep pagination correct. Explain the common pagination issue.

### Approach and assumptions

Apply Shopify's native Availability filter before pagination. Availability is enabled in Shopify Search & Discovery for the assessment store. The tested in-stock collection view is:

```text
/collections/assessment-q2-stock-pagination?filter.v.availability=1
```

The in-stock navigation entry should use this filtered URL. Here, "in stock" means available to purchase under Shopify's rules. For the tracked test inventory, selling beyond stock is disabled. Untracked products and products with continue-selling enabled can still be purchasable at zero physical stock.

Shopify applies the filter before Liquid paginates `collection.products`. Dawn's existing cards, filters, sorting, and pagination then work with that result set. Only the final page should have fewer than 12 products.

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

This excerpt uses Dawn's existing `card-product` rendering with its image, layout, and quick-add settings. The loop does not skip unavailable products after pagination. The `pagination` snippet keeps Shopify's generated `paginate.previous.url`, `part.url`, and `paginate.next.url` links, and Dawn's facet handling carries the selected filters into sorting requests.

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

The preview collection has 30 imported products: 25 available and 5 sold out. Manual testing was reported successful on October 10, 2026, covering:

- The in-stock view across three pages, with expected page sizes of 12, 12, and 1.
- Availability retained in the supplied pagination URLs.
- Filtering, sorting, and page refresh using Dawn's existing collection controls.
- An additional out-of-stock view using `filter.v.availability=0` with title-ascending sorting; the test data contains 5 sold-out products.

The reusable import file is `test-data/q2-products.csv`. It contains unique product handles, inventory tracking, and a deny-selling policy for zero-stock products.

Reference: [Shopify storefront filtering](https://shopify.dev/docs/storefronts/themes/navigation-search/filtering/storefront-filtering).

### Result

The filtered collection displays 12 available products per page, with a shorter last page. The reported test returned 12, 12, and 1 products across three pages. The ordinary unfiltered collection remains available.

---

## 3. Section schema with settings and repeatable blocks

### Requirement

Create a section schema with a heading text field, background color picker, padding slider from 0-100px, and repeatable Feature blocks containing an image and caption. Show how padding is output and blocks are rendered in Liquid.

### Approach and assumptions

I use an OS 2.0 section, `sections/assessment-features.liquid`, with a preset for the Theme Editor's Add section menu. The padding setting controls both the top and bottom, and Dawn's `page-width` class supplies horizontal gutters. Feature blocks use one column on mobile, two on tablet, and three on desktop.

Heading and caption values are escaped as plain text. Shopify's responsive image filters preserve each image's proportions. Merchants should enter useful alt text and choose a background that keeps the inherited text readable. Images are lazy loaded because this section is intended for supporting content below the first viewport.

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

The wrapper sets `--feature-padding: {{ section.settings.padding }}px`, and the CSS reads it through `padding-block: var(--feature-padding)`. The Liquid belongs in the HTML because `{% stylesheet %}` does not evaluate Liquid.

The `section.blocks` loop follows the merchant's block order. Each item has `block.shopify_attributes` so the editor can identify and select it during editing. Background and padding values stay on each section's wrapper, which also makes two instances independent. This section needs no JavaScript.

### Edge cases and considerations

- A blank heading or caption produces no empty text element.
- An unset image produces no broken image request; a caption can still render.
- With no blocks, the grid is omitted while the section's heading and settings remain usable.
- Long captions can wrap without overflowing the grid.
- Image dimensions and responsive sources are generated by `image_tag`; the image picker supplies the image resource.
- The slider applies the exact selected vertical padding, including 0px and 100px.

### Verification

Shopify Theme Check passed the section and English schema locale file with no warnings or errors.

Editor and preview testing was reported successful on October 10, 2026. The checks covered editing the heading and background, setting padding to 0px, 40px, and 100px, adding images and captions, adding/removing/reordering Feature blocks, checking mobile and desktop layouts, and verifying that two section instances retain independent settings.

### Result

The Assessment features section has the requested heading, background, padding slider, and repeatable image/caption blocks. Its Liquid outputs the chosen padding and block order. Theme Check and the reported editor and preview tests passed.

---

## 4. AJAX cart and the Section Rendering API

### Requirement

Add the selected variant without refreshing the page, update the header cart count, provide JavaScript, and explain relevant considerations.

### Approach and assumptions

I extend Dawn's `product-form` custom element and keep its existing submit listener. `FormData` reads the selected variant, quantity, properties, and selling plan from the form. The request goes to the locale-aware `window.routes.cart_add_url` supplied by Liquid.

Request bundled section rendering in the add operation. Notification mode requests `cart-notification-product`, `cart-notification-button`, and `cart-icon-bubble`; drawer mode requests `cart-drawer` and `cart-icon-bubble`. When neither cart component exists, request only `cart-icon-bubble` and update the header without redirecting. The header target is `#cart-icon-bubble`; its rendered Liquid uses `cart.item_count`, which counts total units rather than distinct lines or the last-added quantity.

A successful add normally needs one request: add the item, then render the returned cart sections. If HTML is missing or lacks the expected selector, the handler makes one read-only Section Rendering API request. It never retries the add automatically.

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

Manual preview testing was reported successful on October 10, 2026. The checks covered selected-variant additions without reloading, header quantities increasing from 1 to 3 to 4, duplicate-click prevention, inventory errors, blocked-request feedback, and successful cart/header updates in Notification and Drawer modes.

Reference: [Shopify AJAX Cart API and bundled section rendering](https://shopify.dev/docs/api/ajax/reference/cart).

### Result

The selected variant is added without navigation, and server-rendered cart HTML updates the header count. Duplicate submission, visible errors, and read-only section recovery are handled within Dawn's existing cart flow. Static checks, six automated tests, and the reported Notification and Drawer tests passed.

---

## 5. Theme Editor lifecycle events

### Requirement

Explain why a JavaScript carousel breaks when blocks are added, removed, or reordered in the Theme Editor, how to fix it, and which lifecycle handlers to use.

### Why it happens

The Theme Editor replaces section HTML without a page reload. Code that initializes a carousel only on page load misses the new DOM. Meanwhile, the old instance can keep references to removed slides, listeners, timers, and observers.

Adding, removing, or moving blocks changes slide counts and measurements. Creating another carousel instance without cleaning up the old one can leave duplicate controls or autoplay timers.

### Solution approach

I would keep initialization and cleanup in one place. Existing carousels initialize on page load. When an editor operation removes or replaces a section, its carousel is destroyed; the replacement initializes from the current slides and their order.

Repeated initialization should refresh an existing instance when appropriate, rather than create another. The event target and section ID keep the operation local, so changing one carousel leaves the others alone.

Destroying an instance means removing its listeners, stopping timers, disconnecting observers, cancelling scheduled callbacks, and releasing old DOM references. The methods depend on the carousel library; Shopify does not provide a universal carousel destroy API.

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

Autoplay resumes after deselection only if it is enabled and no other pause reason remains. That includes a customer's manual pause, reduced-motion behavior, or another editor selection. Tracking the reasons separately prevents one event from undoing another pause.

### Application to Dawn

Dawn already has a slideshow custom element and block-selection handlers. I would build on those rather than introduce another library or instance manager.

A custom element can own initialization in `connectedCallback()` and cleanup in `disconnectedCallback()`. In that design, section-event handlers should call guarded refresh or selection methods instead of independently constructing the same instance. This describes a lifecycle design; it does not claim that every existing Dawn slideshow method already implements it.

### Verification and scope

Shopify's Theme Editor documentation confirms the event names used here. Q5 asks for an explanation, so this is a proposed lifecycle design; no theme changes or browser tests were performed for it.

For an implementation, I would verify repeated slide additions, removals, and reordering; selection of a nonvisible slide; deletion and re-addition of a section; and independent operation of two carousel instances. Controls should react once per interaction, selected slides should remain visible, and removed instances should leave no running timers or observers. These are proposed checks, not reported test results.

Reference: [Shopify Theme Editor lifecycle](https://shopify.dev/docs/storefronts/themes/best-practices/editor/integrate-sections-and-blocks).

### Result

The carousel would initialize from the current section DOM, clean up when that DOM is replaced, and keep a selected slide visible. The lifecycle handlers above cover those responsibilities without creating duplicate instances.

---

## 6. Independent styling for section instances

### Requirement

Allow two instances of the same section to use different background colors selected in the Theme Editor, without one instance's styles affecting the other.

### Approach and assumptions

I set CSS custom properties on each section wrapper and read them from shared CSS. Each element supplies its own background value, so two sections can use the same class without sharing a selected color.

The Feature section from Q3 already does this. Background and padding belong to the section settings. Inline custom properties suit these values; a selector using `section.id` would also work for more complex rules.

### Implementation

The section setting in `sections/assessment-features.liquid` is:

```json
{
  "type": "color",
  "id": "background_color",
  "label": "t:assessment_features.background_color",
  "default": "#ffffff"
}
```

The actual section wrapper outputs the selected values:

```liquid
<div
  class="assessment-features"
  style="--feature-background: {{ section.settings.background_color }}; --feature-padding: {{ section.settings.padding }}px;"
>
```

The corresponding rules, inside the section's existing `{% stylesheet %}` block, are:

```css
.assessment-features {
  background-color: var(--feature-background);
  padding-block: var(--feature-padding);
}
```

The rest of the wrapper content and closing tag are shown in the complete Question 3 section source. No second component or duplicate stylesheet is required.

For example, one instance can set `--feature-background: #f3f8ff` while another sets `--feature-background: #fff4e5`. The same background-color rule resolves each element's own value. Editing the first instance does not overwrite the second's setting.

### Edge cases and considerations

- Do not emit a shared `.assessment-features { background-color: SELECTED_COLOR; }` rule for each instance: the rules target both wrappers and can compete in the cascade.
- Output Liquid values in HTML or a Liquid-rendered style block. Liquid is not evaluated inside `{% stylesheet %}`.
- Keep the custom properties on the component wrapper rather than `:root`, and use component-specific property names. Descendants inherit them, while sibling section instances remain independent.
- Each nested Feature section wrapper sets its own values if nesting is introduced later.
- Merchant-selected backgrounds should retain sufficient contrast with the inherited text color.

### Verification

The existing Feature section passed Shopify Theme Check without warnings or errors. Static review confirmed that background and padding values are declared on the instance wrapper and consumed by shared static CSS.

The two-instance check from Q3 was reported successful on October 10, 2026. This answer uses that same implementation and test; it required no additional code or separate browser session.

### Result

Each Feature section uses its own background and padding while sharing the stylesheet. The two-instance test reported for Q3 confirmed that editing one section leaves the other section's settings intact.

---

## 7. AJAX variant and size selector

### Requirement

Select the correct size variant, disable out-of-stock sizes, update the displayed price and `?variant=` parameter, and perform all updates without refreshing. Provide Liquid/HTML, JavaScript, and relevant CSS.

### Approach and assumptions

I use Dawn's `variant-selects` and `product-info` components. The assessment product has one option named Size, differing prices, a small variant set, and at least one sold-out size. Native disabling is limited to that Size-only setup. Other products keep Dawn's option navigation, so an unavailable intermediate combination does not prevent reaching a valid one.

The picker publishes the selected option-value IDs, and Dawn requests the updated product section. Shopify resolves the variant and returns the matching controls, price, savings, and selected-variant data. Dawn then updates the form ID and purchase state. No second selection handler or full variant array is needed.

### Liquid and HTML

The inherited `snippets/product-variant-picker.liquid` supplies the complete picker structure:

```liquid
{%- unless product.has_only_default_variant -%}
  <variant-selects
    id="variant-selects-{{ section.id }}"
    data-section="{{ section.id }}"
    {{ block.shopify_attributes }}
  >
    {%- for option in product.options_with_values -%}
      {%- liquid
        assign swatch_count = option.values | map: 'swatch' | compact | size
        assign picker_type = block.settings.picker_type

        if swatch_count > 0 and block.settings.swatch_shape != 'none'
          if block.settings.picker_type == 'dropdown'
            assign picker_type = 'swatch_dropdown'
          else
            assign picker_type = 'swatch'
          endif
        endif
      -%}
      {%- if picker_type == 'swatch' -%}
        <fieldset class="js product-form__input product-form__input--swatch">
          <legend class="form__label">
            {{ option.name }}:
            <span data-selected-value>
              {{- option.selected_value -}}
            </span>
          </legend>
          {% render 'product-variant-options',
            product: product,
            option: option,
            block: block,
            picker_type: picker_type
          %}
        </fieldset>
      {%- elsif picker_type == 'button' -%}
        <fieldset class="js product-form__input product-form__input--pill">
          <legend class="form__label">{{ option.name }}</legend>
          {% render 'product-variant-options',
            product: product,
            option: option,
            block: block,
            picker_type: picker_type
          %}
        </fieldset>
      {%- else -%}
        <div class="product-form__input product-form__input--dropdown">
          <label class="form__label" for="Option-{{ section.id }}-{{ forloop.index0 }}">
            {{ option.name }}
          </label>
          <div class="select">
            {%- if picker_type == 'swatch_dropdown' -%}
              <span
                data-selected-value
                class="dropdown-swatch"
              >
                {% render 'swatch', swatch: option.selected_value.swatch, shape: block.settings.swatch_shape %}
              </span>
            {%- endif -%}
            <select
              id="Option-{{ section.id }}-{{ forloop.index0 }}"
              class="select__select"
              name="options[{{ option.name | escape }}]"
              form="{{ product_form_id }}"
            >
              {% render 'product-variant-options',
                product: product,
                option: option,
                block: block,
                picker_type: picker_type
              %}
            </select>
            <span class="svg-wrapper">
              {{- 'icon-caret.svg' | inline_asset_content -}}
            </span>
          </div>
        </div>
      {%- endif -%}
    {%- endfor -%}

    <script type="application/json" data-selected-variant>
      {{ product.selected_or_first_available_variant | json }}
    </script>
  </variant-selects>
{%- endunless -%}
```

The updated `snippets/product-variant-options.liquid` renders the size controls, including actual disabled attributes:

```liquid
{%- liquid
  assign product_form_id = 'product-form-' | append: section.id
  assign option_name = option.name | handleize
  assign disable_unavailable_sizes = false
  if product.options.size == 1 and option_name == 'size'
    assign disable_unavailable_sizes = true
  endif
-%}

{%- for value in option.values -%}
  {%- liquid
    assign swatch_focal_point = null
    if value.swatch.image
      assign image_url = value.swatch.image | image_url: width: 50
      assign swatch_value = 'url(' | append: image_url | append: ')'
      assign swatch_focal_point = value.swatch.image.presentation.focal_point
    elsif value.swatch.color
      assign swatch_value = 'rgb(' | append: value.swatch.color.rgb | append: ')'
    else
      assign swatch_value = null
    endif

    assign option_disabled = true
    if value.available
      assign option_disabled = false
    endif
    assign input_disabled = false
    if disable_unavailable_sizes and option_disabled
      assign input_disabled = true
    endif
  -%}

  {%- capture input_id -%}
    {{ section.id }}-{{ option.position }}-{{ forloop.index0 -}}
  {%- endcapture -%}

  {%- capture input_name -%}
    {{ option.name }}-{{ option.position }}
  {%- endcapture -%}

  {%- capture input_dataset -%}
    data-product-url="{{ value.product_url }}"
    data-option-value-id="{{ value.id }}"
  {%- endcapture -%}

  {%- capture label_unavailable -%}
    <span class="visually-hidden label-unavailable">
      {{- 'products.product.variant_sold_out_or_unavailable' | t -}}
    </span>
  {%- endcapture -%}

  {%- if picker_type == 'swatch' -%}
    {%- assign escaped_value = value | escape -%}
    {%- capture help_text -%}
      <span class="visually-hidden">{{ value | escape }}</span>
      {{ label_unavailable }}
    {%- endcapture -%}
    {%
      render 'swatch-input',
      id: input_id,
      name: input_name,
      value: escaped_value,
      swatch: value.swatch,
      product_form_id: product_form_id,
      checked: value.selected,
      disabled: input_disabled,
      visually_disabled: option_disabled,
      shape: block.settings.swatch_shape,
      help_text: help_text,
      additional_props: input_dataset
    %}
  {%- elsif picker_type == 'button' -%}
    <input
      type="radio"
      id="{{ input_id }}"
      name="{{ input_name | escape }}"
      value="{{ value | escape }}"
      form="{{ product_form_id }}"
      {% if value.selected %}
        checked
      {% endif %}
      {% if option_disabled %}
        class="disabled"
      {% endif %}
      {% if input_disabled %}
        disabled
      {% endif %}
      {{ input_dataset }}
    >
    <label for="{{ input_id }}">
      {{ value -}}
      {{ label_unavailable }}
    </label>
  {%- elsif picker_type == 'dropdown' or picker_type == 'swatch_dropdown' -%}
    <option
      id="{{ input_id }}"
      value="{{ value | escape }}"
      {% if value.selected %}
        selected="selected"
      {% endif %}
      {% if input_disabled %}
        disabled
      {% endif %}
      {% if swatch_value and picker_type == 'swatch_dropdown' %}
        data-option-swatch-value="{{ swatch_value }}"
        {% if swatch_focal_point %}
          data-option-swatch-focal-point="{{ swatch_focal_point }}"
        {% endif %}
      {% endif %}
      {{ input_dataset }}
    >
      {% if option_disabled -%}
        {{- 'products.product.value_unavailable' | t: option_value: value -}}
      {%- else -%}
        {{- value -}}
      {%- endif %}
    </option>
  {%- endif -%}
{%- endfor -%}
```

Swatches use Dawn's existing `swatch-input` snippet, whose optional `disabled` parameter produces the native attribute. The product form retains its hidden `name="id"` field, initially set to `product.selected_or_first_available_variant.id`; the JavaScript updates it after size selection. The existing main-product price wrapper is `#price-{{ section.id }}` with `role="status"`, allowing price and Question 1 savings to update together.

### JavaScript

Dawn's inherited `VariantSelects` class in `assets/global.js` publishes changes using selected option-value IDs:

```javascript
class VariantSelects extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.addEventListener('change', (event) => {
      const target = this.getInputForEventTarget(event.target);
      this.updateSelectionMetadata(event);

      publish(PUB_SUB_EVENTS.optionValueSelectionChange, {
        data: {
          event,
          target,
          selectedOptionValues: this.selectedOptionValues,
        },
      });
    });
  }

  updateSelectionMetadata({ target }) {
    const { value, tagName } = target;

    if (tagName === 'SELECT' && target.selectedOptions.length) {
      Array.from(target.options)
        .find((option) => option.getAttribute('selected'))
        .removeAttribute('selected');
      target.selectedOptions[0].setAttribute('selected', 'selected');

      const swatchValue = target.selectedOptions[0].dataset.optionSwatchValue;
      const selectedDropdownSwatchValue = target
        .closest('.product-form__input')
        .querySelector('[data-selected-value] > .swatch');
      if (!selectedDropdownSwatchValue) return;
      if (swatchValue) {
        selectedDropdownSwatchValue.style.setProperty('--swatch--background', swatchValue);
        selectedDropdownSwatchValue.classList.remove('swatch--unavailable');
      } else {
        selectedDropdownSwatchValue.style.setProperty('--swatch--background', 'unset');
        selectedDropdownSwatchValue.classList.add('swatch--unavailable');
      }

      selectedDropdownSwatchValue.style.setProperty(
        '--swatch-focal-point',
        target.selectedOptions[0].dataset.optionSwatchFocalPoint || 'unset'
      );
    } else if (tagName === 'INPUT' && target.type === 'radio') {
      const selectedSwatchValue = target.closest(`.product-form__input`).querySelector('[data-selected-value]');
      if (selectedSwatchValue) selectedSwatchValue.innerHTML = value;
    }
  }

  getInputForEventTarget(target) {
    return target.tagName === 'SELECT' ? target.selectedOptions[0] : target;
  }

  get selectedOptionValues() {
    return Array.from(this.querySelectorAll('select option[selected], fieldset input:checked')).map(
      ({ dataset }) => dataset.optionValueId
    );
  }
}

customElements.define('variant-selects', VariantSelects);
```

The following actual methods from the updated `assets/product-info.js` handle option changes, requests, returned prices, form IDs, and the URL. They remain methods of Dawn's existing ProductInfo class, which subscribes to option changes in `connectedCallback()`; no second handler is attached:

```javascript
      handleOptionValueChange({ data: { event, target, selectedOptionValues } }) {
        if (!this.contains(event.target)) return;

        this.resetProductFormState();

        const productUrl = target.dataset.productUrl || this.pendingRequestUrl || this.dataset.url;
        this.pendingRequestUrl = productUrl;
        const shouldSwapProduct = this.dataset.url !== productUrl;
        const shouldFetchFullPage = this.dataset.updateUrl === 'true' && shouldSwapProduct;

        this.renderProductInfo({
          requestUrl: this.buildRequestUrlWithParams(productUrl, selectedOptionValues, shouldFetchFullPage),
          targetId: target.id,
          callback: shouldSwapProduct
            ? this.handleSwapProduct(productUrl, shouldFetchFullPage)
            : this.handleUpdateProductInfo(productUrl),
        });
      }

      resetProductFormState() {
        const productForm = this.productForm;
        productForm?.toggleSubmitButton(true);
        productForm?.handleErrorMessage();
      }

      handleSwapProduct(productUrl, updateFullPage) {
        return (html) => {
          this.productModal?.remove();

          const selector = updateFullPage ? "product-info[id^='MainProduct']" : 'product-info';
          const variant = this.getSelectedVariant(html.querySelector(selector));
          this.updateURL(productUrl, variant?.id);

          if (updateFullPage) {
            document.querySelector('head title').innerHTML = html.querySelector('head title').innerHTML;

            HTMLUpdateUtility.viewTransition(
              document.querySelector('main'),
              html.querySelector('main'),
              this.preProcessHtmlCallbacks,
              this.postProcessHtmlCallbacks
            );
          } else {
            HTMLUpdateUtility.viewTransition(
              this,
              html.querySelector('product-info'),
              this.preProcessHtmlCallbacks,
              this.postProcessHtmlCallbacks
            );
          }
        };
      }

      renderProductInfo({ requestUrl, targetId, callback }) {
        this.abortController?.abort();
        this.abortController = new AbortController();
        const requestController = this.abortController;

        fetch(requestUrl, { signal: requestController.signal })
          .then((response) => {
            if (!response.ok) throw new Error('Variant request failed');
            return response.text();
          })
          .then((responseText) => {
            if (requestController.signal.aborted || requestController !== this.abortController) return;
            this.pendingRequestUrl = null;
            const html = new DOMParser().parseFromString(responseText, 'text/html');
            if (!html.querySelector('product-info')) {
              throw new Error('Variant response is missing product data');
            }
            callback(html);
          })
          .then(() => {
            if (requestController.signal.aborted || requestController !== this.abortController) return;
            // set focus to last clicked option value
            document.querySelector(`#${targetId}`)?.focus();
          })
          .catch((error) => {
            if (error.name === 'AbortError') {
              console.log('Fetch aborted by user');
            } else {
              if (requestController !== this.abortController) return;
              this.pendingRequestUrl = null;
              this.productForm?.toggleSubmitButton(true);
              this.productForm?.handleErrorMessage(window.variantStrings.selectionError);
              console.error(error);
            }
          });
      }

      getSelectedVariant(productInfoNode) {
        const selectedVariant = productInfoNode.querySelector('variant-selects [data-selected-variant]')?.innerHTML;
        return !!selectedVariant ? JSON.parse(selectedVariant) : null;
      }

      buildRequestUrlWithParams(url, optionValues, shouldFetchFullPage = false) {
        const params = [];

        !shouldFetchFullPage && params.push(`section_id=${this.sectionId}`);

        if (optionValues.length) {
          params.push(`option_values=${optionValues.join(',')}`);
        }

        return `${url}?${params.join('&')}`;
      }

      updateOptionValues(html) {
        const variantSelects = html.querySelector('variant-selects');
        if (variantSelects) {
          HTMLUpdateUtility.viewTransition(this.variantSelectors, variantSelects, this.preProcessHtmlCallbacks);
        }
      }

      handleUpdateProductInfo(productUrl) {
        return (html) => {
          const variant = this.getSelectedVariant(html);

          this.pickupAvailability?.update(variant);
          this.updateOptionValues(html);
          this.updateURL(productUrl, variant?.id);
          this.updateVariantInputs(variant?.id);

          if (!variant) {
            this.setUnavailable();
            return;
          }

          this.updateMedia(html, variant?.featured_media?.id);

          const updateSourceFromDestination = (id, shouldHide = (source) => false) => {
            const source = html.getElementById(`${id}-${this.sectionId}`);
            const destination = this.querySelector(`#${id}-${this.dataset.section}`);
            if (source && destination) {
              destination.innerHTML = source.innerHTML;
              destination.classList.toggle('hidden', shouldHide(source));
            }
          };

          updateSourceFromDestination('price');
          updateSourceFromDestination('Sku', ({ classList }) => classList.contains('hidden'));
          updateSourceFromDestination('Inventory', ({ innerText }) => innerText === '');
          updateSourceFromDestination('Volume');
          updateSourceFromDestination('Price-Per-Item', ({ classList }) => classList.contains('hidden'));

          this.updateQuantityRules(this.sectionId, html);
          this.querySelector(`#Quantity-Rules-${this.dataset.section}`)?.classList.remove('hidden');
          this.querySelector(`#Volume-Note-${this.dataset.section}`)?.classList.remove('hidden');

          this.productForm?.toggleSubmitButton(
            html.getElementById(`ProductSubmitButton-${this.sectionId}`)?.hasAttribute('disabled') ?? true,
            window.variantStrings.soldOut
          );

          publish(PUB_SUB_EVENTS.variantChange, {
            data: {
              sectionId: this.sectionId,
              html,
              variant,
            },
          });
        };
      }

      updateVariantInputs(variantId) {
        this.querySelectorAll(
          `#product-form-${this.dataset.section}, #product-form-installment-${this.dataset.section}`
        ).forEach((productForm) => {
          const input = productForm.querySelector('input[name="id"]');
          input.value = variantId ?? '';
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }

      updateURL(url, variantId) {
        this.querySelector('share-button')?.updateUrl(
          `${window.shopUrl}${url}${variantId ? `?variant=${variantId}` : ''}`
        );

        if (this.dataset.updateUrl === 'false') return;
        const nextUrl = new URL(window.location.href);
        const productUrl = new URL(url, window.location.origin);
        nextUrl.pathname = productUrl.pathname;
        productUrl.searchParams.forEach((value, key) => nextUrl.searchParams.set(key, value));
        if (variantId) {
          nextUrl.searchParams.set('variant', variantId);
        } else {
          nextUrl.searchParams.delete('variant');
        }
        window.history.replaceState(window.history.state, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      }
```

The existing component also supplies media, quantity, pickup availability, and product-swap helpers used by these methods. Its `disconnectedCallback()` now aborts the active variant request as well as unsubscribing from Dawn events.

The browser URL update uses the URL API to preserve unrelated query parameters, the fragment, and existing history state. It changes only the product path, any explicit parameters on the target product URL, and the variant parameter. Embedded components with `data-update-url="false"` do not change the browser URL. The share button retains Dawn's product/variant share URL rather than copying preview and tracking parameters.

The layout adds this entry to `window.variantStrings`:

```liquid
selectionError: {{ 'assessment.variant_selection_error' | t | json }},
```

The English locale adds this key under `assessment`:

```json
"variant_selection_error": "This size could not be loaded. Select a size again or refresh the page before adding to cart."
```

### CSS

Dawn already styles disabled pills with a muted color and strike-through. The implementation adds a disabled cursor; the relevant rules in `assets/component-product-variant-picker.css` are:

```css
variant-selects input[type='radio']:disabled + label {
  cursor: not-allowed;
}

.product-form__input--pill input[type='radio']:disabled + label,
.product-form__input--pill input[type='radio'].disabled + label {
  border-color: rgba(var(--color-foreground), 0.1);
  color: rgba(var(--color-foreground), 0.6);
  text-decoration: line-through;
}
```

### Edge cases and considerations

- A valid direct variant link uses that variant's initial price and selection. A sold-out variant may remain the displayed selection when opened directly, but its control and purchase action are disabled; available sizes remain selectable.
- A product whose every size is sold out has no selectable available size and cannot be purchased.
- Availability follows Shopify's purchasing rules; disable continue-selling on inventory-tracked sold-out test variants.
- On selection, Dawn disables purchasing until the corresponding variant response is applied. Failed requests leave purchasing disabled and display an error, preventing an old variant from being added under a newly selected size.
- Aborted or superseded responses cannot overwrite the latest selection. Requests are also aborted when the component is removed.
- Variant price is rendered by Shopify with the existing money filters; no currency formatting is reconstructed from a JavaScript number.
- Multi-option products require matching the complete option combination. Dawn already sends all selected option-value IDs; strict disabling of individual sizes would require a deliberate combination-availability policy and is outside this Size-only example.
- The implementation does not embed `product.variants` and does not claim that a small variant map supports all high-variant products.

### Verification

JavaScript syntax and whitespace checks passed. Four automated tests in `tests/q7-variants.test.cjs` passed: preserving URL parameters/hash/history state, removing unresolved variants and respecting embedded URL behavior, keeping purchasing disabled after a failed response, and rejecting a late superseded response.

Shopify Theme Check passed the option snippet, JavaScript, CSS, and English locale without findings. The layout retains one warning in inherited code (`scheme_classes`). Tests use mocked requests and DOM elements. Q7 preview testing was confirmed complete on October 10, 2026. This is a reported overall result; individual case records and screenshots were not supplied.

The reusable fixture `test-data/q7-product.csv` contains one Size-only product with S, M, L, and XL variants priced at 20, 25, 30, and 35 respectively. M has a compare-at price of 30; L has zero inventory and selling beyond stock is disabled. The CSV was checked locally for one product, four unique sizes, and the intended stock distribution. Overall storefront testing was later confirmed successful. The fixture remains available for repeat checks, although no separate import log was supplied.

### Result

For the documented Size-only product, sold-out controls are disabled and size changes update the price, form variant ID, and URL without a reload. Unrelated URL parameters remain intact. Static validation, four automated tests, and user-confirmed preview testing passed.

---

## 8. Metafield definitions, rendering, and references

### Requirement

Define merchant-editable Care Instructions for products, render them on the product page, and display care instructions from a related product. Provide the Liquid.

### Approach and assumptions

I use a merchant-owned rich-text product metafield for the instructions and one product-reference metafield for the related product. Rich text preserves paragraphs and lists. The reference lets the merchant choose the relationship without hardcoded handles. Admin definitions are independent of theme deployment.

### Definitions and values

In Settings → Metafields and metaobjects → Products, create:

| Name | Namespace and key | Type | Purpose |
|---|---|---|---|
| Care Instructions | `custom.care_instructions` | Rich text (`rich_text_field`) | Merchant-edited care content |
| Care Related Product | `custom.care_related_product` | One product (`product_reference`) | Related product whose care is displayed |

Pinning these definitions makes editing easier. They expose the fields on every product, but merchants still need to enter each product's values in its Metafields area.

For example, Product A can contain a list stating Wash cold, Do not bleach, and Dry flat, with its related-product field referencing Product B. Product B can contain Wipe with a damp cloth, Avoid soaking, and Air dry. These are illustrative values; the merchant enters content appropriate to the products. Both products should be available to the Online Store for storefront testing.

### Implementation

The Care instructions block belongs in Dawn's Product information section. Merchants can move it in the Theme Editor, and the schema permits one block per product section.

The complete `snippets/assessment-care-instructions.liquid` is:

```liquid
{% doc %}
  Renders product care instructions and care from one referenced product.
  @param {product} product - Current product.
  @param {object} block - Product section block.
{% enddoc %}
{%- liquid
  assign care = product.metafields.custom.care_instructions
  assign related_product = product.metafields.custom.care_related_product.value
  assign show_care = false
  assign show_related_care = false
  if care != blank and care.type == 'rich_text_field'
    assign show_care = true
  endif
  if related_product != blank and related_product.id != product.id
    assign related_care = related_product.metafields.custom.care_instructions
    if related_care != blank and related_care.type == 'rich_text_field'
      assign show_related_care = true
    endif
  endif
-%}
{%- if show_care or show_related_care -%}
  <div class="assessment-care quick-add-hidden" {{ block.shopify_attributes }}>
    {%- if show_care -%}
      <div class="assessment-care__group">
        <h2 class="h4">{{ 'assessment.care_heading' | t }}</h2>
        <div class="rte">{{ care | metafield_tag }}</div>
      </div>
    {%- endif -%}
    {%- if show_related_care -%}
      <div class="assessment-care__group">
        <h2 class="h4">
          {%- assign related_title = related_product.title | escape -%}
          {{- 'assessment.related_care_heading' | t: product: related_title -}}
        </h2>
        <div class="rte">{{ related_care | metafield_tag }}</div>
      </div>
    {%- endif -%}
  </div>
{%- endif -%}

{% stylesheet %}
  .assessment-care__group + .assessment-care__group {
    margin-top: 2.4rem;
  }
{% endstylesheet %}
```

The main-product block rendering includes:

```liquid
{%- when 'care_instructions' -%}
  {% render 'assessment-care-instructions', product: product, block: block %}
```

The added block schema is:

```json
{
  "type": "care_instructions",
  "name": "t:assessment_care.name",
  "limit": 1
}
```

The English storefront locale adds the following keys under `assessment`:

```json
"care_heading": "Care instructions",
"related_care_heading": "Care instructions for {{ product }}"
```

The English schema locale adds:

```json
"assessment_care": {
  "name": "Care instructions"
}
```

`metafield_tag` receives the rich-text metafield and produces formatted HTML. The related reference is resolved with `.value`; the snippet then reads that product's care field. Its title is escaped before it appears in the related heading.

### Edge cases and considerations

- Missing current-product instructions omit that group; related instructions can still display.
- An unset or unresolved reference, or a referenced product without care content, omits the related group.
- If neither group has content, no empty wrapper or heading renders.
- A self-reference is ignored to avoid displaying the same product's instructions twice.
- Incorrect metafield types are not rendered as rich text; definition types must match the documented setup.
- This resolves one reference only, without recursive related-product traversal.
- The content is product-level and does not change between variants of the same product. It follows the current product when a full product section is replaced.
- Dawn's existing `rte` styling formats the content. The block uses Theme Editor attributes and follows Dawn's quick-add-hidden convention.

### Verification

Both definitions were created and two products populated, as confirmed during setup. Shopify Theme Check passed the care snippet and both English locale files without findings. The main product section passed with two warnings in inherited Dawn code (unused `seo_media` and unknown `continue`). Locale JSON parsing and whitespace checks passed.

Manual preview testing was reported successful on October 10, 2026. The checks covered adding the Care instructions block, rendering the current and referenced product's formatted instructions, reflecting changes to the referenced product after refresh, removing the reference, clearing the current product's instructions, and omitting empty output when neither field is populated.

References: [Creating metafield definitions](https://help.shopify.com/en/manual/custom-data/metafields/metafield-definitions/creating-custom-metafield-definitions), [metafield_tag](https://shopify.dev/docs/api/liquid/filters/metafield_tag), [Metafield values](https://shopify.dev/docs/api/liquid/objects/metafield).

### Result

The block displays formatted care instructions for the current product and one referenced product. Missing content is omitted, and product relationships stay editable in Admin. The definitions, Liquid validation, and reported preview tests are complete.

---

## 9. Metaobjects and metafields

### Question

Create a reusable Designer entity containing Name, Bio, Photo, and Country, assignable to multiple products, and display every designer on an Our Designers page. Explain the data model, Admin configuration, and Liquid rendering.

### Approach and rationale

I store each designer once in a Designer metaobject and use a product metafield to reference that record. An edit appears on every linked product and the directory after refresh. Separate product fields would duplicate the biography and other details; hardcoded theme content would require code edits. The metaobject holds the entity, and the metafield holds the product relationship.

### Admin configuration

Create a merchant-owned metaobject definition named Designer, with type handle `designer` and these field keys:

| Field | Key | Type | Configuration |
| --- | --- | --- | --- |
| Name | name | Single line text | Required; display-name field |
| Bio | bio | Rich text | Formatted biography |
| Photo | photo | File reference | One file, restricted to images |
| Country | country | Single line text | Optional country text |

Enable storefront access and, when using Active/Draft status, make entries Active. Individual designer web pages are unnecessary for this directory. Create entries under Content > Metaobjects. Define product metafield `custom.designer` as one Metaobject reference restricted to Designer. Select an entry on each product; multiple products can reference the same entry.

Create a visible page titled Our Designers with handle `our-designers`, and use the `page.designers` template. For development testing, the alternate template can be requested with `/pages/our-designers?view=designers`. Add the Designer block to Product information in the development Theme Editor and save. Add the directory to navigation if desired.

### Implementation

Both the product block and directory use the same card snippet. It resolves the field values, escapes plain text, formats the biography through `metafield_tag`, and renders a responsive photo with fallback alt text.

`snippets/assessment-designer-card.liquid`:

```liquid
{% doc %}
  Renders one reusable Designer metaobject entry.
  @param {metaobject} designer - Designer with name, bio, photo and country.
  @param {string} [image_sizes] - Responsive image sizes attribute.
{% enddoc %}
{%- if designer != blank and designer.name.value != blank -%}
  <article class="assessment-designer">
    {%- assign photo = designer.photo.value -%}
    {%- if photo != blank and photo.media_type == 'image' -%}
      {%- assign image_alt = photo.alt | default: designer.name.value -%}
      {{
        photo
        | image_url: width: 960
        | image_tag:
          widths: '240, 360, 540, 720, 960',
          sizes: image_sizes,
          loading: 'lazy',
          alt: image_alt,
          class: 'assessment-designer__photo'
      }}
    {%- endif -%}
    <h3 class="h4 assessment-designer__name">{{ designer.name.value | escape }}</h3>
    {%- if designer.country.value != blank -%}
      <p class="assessment-designer__country">{{ designer.country.value | escape }}</p>
    {%- endif -%}
    {%- if designer.bio != blank and designer.bio.type == 'rich_text_field' -%}
      <div class="rte">{{ designer.bio | metafield_tag }}</div>
    {%- endif -%}
  </article>
{%- endif -%}

{% stylesheet %}
  .assessment-designer__photo {
    display: block;
    width: 100%;
    height: auto;
  }

  .assessment-designer__name {
    margin: 1.6rem 0 0.8rem;
  }

  .assessment-designer__country {
    margin: 0 0 1.2rem;
  }

  .assessment-designer {
    min-width: 0;
    overflow-wrap: anywhere;
  }
{% endstylesheet %}
```

The product block in `sections/main-product.liquid` resolves the reference with `.value`:

```liquid
{%- when 'designer' -%}
  {%- assign designer = product.metafields.custom.designer.value -%}
  {%- if designer != blank and designer.name.value != blank -%}
    <div class="assessment-product-designer quick-add-hidden" {{ block.shopify_attributes }}>
      <h2 class="h4">{{ 'assessment.designer_heading' | t }}</h2>
      {% render 'assessment-designer-card', designer: designer, image_sizes: '(min-width: 750px) 45vw, 90vw' %}
    </div>
  {%- endif -%}
```

Its block schema is `{ "type": "designer", "name": "t:assessment_designer.block_name", "limit": 1 }`.

The directory reads `metaobjects.designer.values` independently of product assignments. Pagination keeps all storefront-visible entries accessible across pages; the default is 12 entries per page.

`sections/assessment-designers.liquid`:

```liquid
<div class="assessment-designers page-width">
  <h2 class="h2">{{ 'assessment.designers_heading' | t }}</h2>
  {%- if metaobjects.designer != blank -%}
    {%- paginate metaobjects.designer.values by section.settings.designers_per_page -%}
      {%- if paginate.items > 0 -%}
        <ul class="assessment-designers__grid" role="list">
          {%- for designer in metaobjects.designer.values -%}
            <li>
              {% render 'assessment-designer-card',
                designer: designer,
                image_sizes: '(min-width: 990px) 30vw, (min-width: 750px) 45vw, 90vw'
              %}
            </li>
          {%- endfor -%}
        </ul>
        {%- if paginate.pages > 1 -%}
          {% render 'pagination', paginate: paginate, anchor: '' %}
        {%- endif -%}
      {%- else -%}
        <p>{{ 'assessment.designers_empty' | t }}</p>
      {%- endif -%}
    {%- endpaginate -%}
  {%- else -%}
    <p>{{ 'assessment.designers_empty' | t }}</p>
  {%- endif -%}
</div>

{% stylesheet %}
  .assessment-designers {
    padding-block: 3.2rem;
  }

  .assessment-designers__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 3.2rem;
    padding: 0;
    margin: 2.4rem 0 0;
    list-style: none;
  }

  @media screen and (min-width: 750px) {
    .assessment-designers__grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media screen and (min-width: 990px) {
    .assessment-designers__grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
{% endstylesheet %}

{% schema %}
{
  "name": "t:assessment_designer.listing_name",
  "tag": "section",
  "settings": [
    {
      "type": "range",
      "id": "designers_per_page",
      "min": 1,
      "max": 24,
      "step": 1,
      "default": 12,
      "label": "t:assessment_designer.per_page"
    }
  ],
  "presets": [
    { "name": "t:assessment_designer.listing_name" }
  ]
}
{% endschema %}
```

`templates/page.designers.json`:

```json
{
  "sections": {
    "main": {
      "type": "main-page",
      "settings": {
        "padding_top": 28,
        "padding_bottom": 28
      }
    },
    "designers": {
      "type": "assessment-designers",
      "settings": {
        "designers_per_page": 12
      }
    }
  },
  "order": ["main", "designers"]
}
```

English storefront keys under `assessment` are `designer_heading` (Designer), `designers_heading` (Meet our designers), and `designers_empty` (No designers are available yet). Schema keys under `assessment_designer` are `block_name` (Designer), `listing_name` (Our designers), and `per_page` (Designers per page).

### Edge cases and considerations

- Products without a resolved reference or designer name omit the entire block.
- Missing photos and countries omit those elements. Rich text is rendered only for a rich-text field; non-image files are not rendered as photos.
- Draft entries are excluded from storefront access when the definition uses publication status. Every designer means every storefront-visible entry, including entries not assigned to any product.
- An absent definition or empty directory displays a translated empty-state message.
- The directory follows Shopify's returned entry order; custom sorting is outside the requirement.
- Responsive columns use one, two, and three columns across mobile, tablet, and desktop. No additional JavaScript, app, or per-designer web page is required.

### Verification

Admin setup is complete: the definition, entries, reference field, and product assignments are configured. Shopify Theme Check passed the card snippet, directory section, alternate template, and both English locale files. The main product section retains two inherited warnings (unused `seo_media` and unknown `continue`). Preview testing was reported successful on October 10, 2026. No screenshots or individual case records were supplied, and there was no independent browser observation. Repeat-test instructions and evidence limits are kept in TESTING.md.

References: [Metaobject definitions and values](https://shopify.dev/docs/api/liquid/objects/metaobject_definition), [Alternate templates](https://shopify.dev/docs/storefronts/themes/architecture/templates/alternate-templates).

### Result

Designer records are shared across products and listed on their own paginated page. One snippet keeps the product and directory rendering consistent. Admin setup, static validation, and reported preview testing are complete.

---

## 10. Performance debugging and technical judgment

### Question

A merchant reports a slow storefront. Investigation reveals six apps injecting scripts, Liquid loops nesting collections inside product loops, and a homepage rendering 50 products with full variant data for each. Explain where to begin, which tools to use, what to prioritize, and how to balance performance with functionality.

### Starting point: establish the symptoms and baseline

I would start by asking which pages or interactions are slow, when it began, and whether mobile customers are affected most. Recent app and theme changes may explain a regression. Before experimenting, I would identify the features the merchant needs and keep a known working theme version for rollback.

Six app scripts, nested loops, and large product payloads are all worth investigating. Measurements should establish their relative cost: server response time, delayed content, JavaScript work, or interaction latency.

The baseline would include the homepage, a collection, and a product with many variants. I would record document response timing, HTML and JavaScript transfer sizes, request activity, main-thread work, and the largest visible content element. Variant selection, quick add, and cart updates also need a trace, since loading speed alone says little about how the page responds.

Comparisons need the same URLs, browser, viewport, CPU and network settings, consent state, and cache conditions. I would repeat runs and compare medians alongside the traces, keeping cold and warm loads separate. Development previews help compare revisions, but their measurements are not production customer data.

### Tools and what each would establish

| Tool | Purpose in this investigation |
| --- | --- |
| Shopify web performance reports | Establish real-customer loading, responsiveness, and layout-stability trends; compare devices and page groups where data is available. |
| Chrome DevTools Network | Inspect the document response, request waterfall, transfer sizes, script initiators, and unnecessary or duplicated requests. |
| Chrome DevTools Performance | Record loading and actual interactions; attribute main-thread work, layout activity, and delays to specific scripts and tasks. |
| Lighthouse / PageSpeed Insights | Obtain repeatable lab diagnostics and review available field data; use individual findings rather than treating one score as the diagnosis. |
| Shopify Theme Inspector for Chrome | Profile server-side Liquid rendering and identify expensive loops and repeated snippet work. |
| Shopify Theme Check and source review | Find relevant theme issues and inspect the templates, app integrations, and serialized data behind measured problems. |

Shopify's performance reports cover LCP, INP, and CLS. They provide field evidence that complements controlled development tests; a low-traffic assessment store may not have enough data. [Shopify web performance reports](https://help.shopify.com/en/manual/online-store/web-performance/web-performance-reports).

Theme Inspector supplies a Liquid rendering flame graph, while Lighthouse provides lab diagnostics. These address different parts of the request and should be used together. [Shopify Theme Inspector](https://shopify.dev/docs/storefronts/themes/tools/theme-inspector), [Chrome Lighthouse documentation](https://developer.chrome.com/docs/devtools/lighthouse/).

### Investigating the six app integrations

For each app, I would record its scripts, feature, relevant pages, loading method, dependencies, and business owner. App embeds, theme blocks, and legacy snippet injections may need different changes. Duplicate inclusions and code left behind by removed apps are worth checking first.

Network and Performance traces would show transfer size, execution cost, dependencies, and delays to content or interactions. Blocking a request can isolate a script during diagnosis, although it may break dependencies and is not a production fix.

Where the integration supports it, I would turn off one app embed in an unpublished theme, repeat the measurements, and check the affected feature. Legacy integrations and app settings can affect the entire store, so I would establish their scope first. Consent, analytics, and purchasing behavior must keep working.

Depending on the evidence, I might remove an unused app, eliminate a duplicate inclusion, load a widget only on relevant pages, or use the vendor's supported deferred initialization. Async and defer can change loading order, but scripts still use main-thread time and may depend on one another. An expensive required app would go back to its vendor with a trace and reproducible example.

### Simplifying nested Liquid work

Theme Inspector would show the cost of the nested collection traversal. I would then inspect what it is doing: finding relationships, grouping products, building recommendations, or repeating presentation work.

If each product scans all collections to find a relationship, I would consider an explicit collection or product reference, a section setting, or another merchant-maintained relationship. Values that stay constant can move outside the loop. Duplicate work can be removed, a search can stop at its required match, and output can be limited to the products actually needed.

The replacement must preserve the relationship and output rules. Moving a costly loop into a render snippet improves organization, but leaves the same work to do. I would profile the revised code and check empty relationships and products in multiple collections.

### Reducing homepage product and variant payloads

The homepage product count is a merchandising decision as well as a performance decision. I would discuss a smaller initial selection, perhaps 8 to 12 products linking to the full collection. If customers need more products on the homepage, an accessible way to load more is another option whose cost should be measured.

Before removing variant data, I would find the code that uses it. A simple card needs its title, image, price, availability, and product link, without every variant serialized alongside it. A card with quick add or a picker still needs enough information to select and purchase the right variant. Adding the first variant silently would change the feature.

A richer selector could request the relevant product or section content when it opens, using Dawn's existing quick-add flow where appropriate. Loading, errors, and repeated activation need handling. This reduces initial work but adds work during the interaction, so I would test both stages.

I would also check product image sizing and DOM volume. Below-the-fold images can be lazy loaded; the likely LCP image should load promptly. Lazy loading images alone does not reduce Liquid processing, inline variant JSON, or the number of initially rendered product cards. Shopify's guidance supports profiling Liquid and reducing unnecessary theme resources. [Shopify theme performance best practices](https://shopify.dev/docs/storefronts/themes/best-practices/performance).

### Priorities and functionality tradeoffs

I would rank changes by measured customer impact, effort, business importance, and regression risk. Unused or duplicate integrations are sensible early candidates. The traces would determine whether repeated Liquid work or unnecessary product data comes next. Replacing a required app or redesigning an interaction needs stronger evidence and a staged plan.

If Liquid accounts for most of the document response delay, I would fix the nested traversal first. If app execution causes the long tasks and slow interactions, those scripts take priority. If the 50 cards and their variant data dominate document size, I would reduce the initial output. These are conditional priorities for the scenario, not measured findings from this theme.

Before removing a feature, I would show the merchant its measured cost and the available alternatives. Prices, availability, selected variant IDs, accessibility, consent, and essential analytics must remain correct. Testing one change at a time makes its effect easier to identify and reverse.

### Verification and rollout

Each change would have a before-and-after record: URL, test conditions, measurements, and functional result. The gain should exceed ordinary run-to-run variation without making another important path slower.

Regression testing would include navigation, search and filters, card links, available and sold-out variants, quick add, cart updates, relevant discounts, consent states, and required app widgets. Analytics events should neither disappear nor fire twice. Mobile, keyboard use, and dynamically replaced Theme Editor sections also need checking.

I would release small reviewed changes with a rollback version available, check production behavior, and watch customer performance reports alongside business outcomes. Field data takes time to respond, and a lab improvement does not prove a conversion gain. The handover would state what improved, what still costs time, and the next justified change. I would make no numerical speed promise before measuring.

### Result

The proposed investigation measures the bottlenecks, tests targeted changes, and checks that required features still work before rollout. Q10 is a written scenario response. No performance audit, optimization, benchmark result, or production deployment was performed for this assessment.

---
