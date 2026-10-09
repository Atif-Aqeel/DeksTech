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
