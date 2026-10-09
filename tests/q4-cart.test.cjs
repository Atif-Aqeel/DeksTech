const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

function setup(fetch) {
  let ProductForm;
  const events = [];
  const context = {
    HTMLElement: class {},
    customElements: { get: () => false, define: (_name, component) => { ProductForm = component; } },
    FormData: class extends Map { constructor(form) { super([['id', form.variant], ['quantity', form.quantity]]); } },
    fetch,
    fetchConfig: () => ({ headers: { 'Content-Type': 'application/json' } }),
    window: {
      routes: { cart_add_url: '/fr/cart/add.js' },
      location: { pathname: '/fr/products/test', href: 'https://example.com/fr/products/test' },
      cartStrings: { error: 'Error', addUncertain: 'Check cart first', addedRefreshError: 'Added; check cart' },
    },
    document: { activeElement: {} },
    PUB_SUB_EVENTS: { cartError: 'error', cartUpdate: 'update' },
    publish: (name, payload) => events.push({ name, payload }),
    console: { error() {} },
    URL,
  };
  vm.runInNewContext(fs.readFileSync('assets/product-form.js', 'utf8'), context);
  const form = Object.create(ProductForm.prototype);
  const attributes = new Map();
  form.form = { variant: '123', quantity: '2' };
  form.submitButton = {
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: (key) => attributes.delete(key),
    classList: { add() {}, remove() {} },
  };
  form.querySelector = () => ({ classList: { add() {}, remove() {} } });
  form.closest = () => null;
  form.handleErrorMessage = (message) => { form.message = message; };
  form.renderCartSections = async () => {};
  return { form, events, context, ProductForm };
}

const submit = (form) => form.onSubmitHandler({ preventDefault() {} });

test('uses selected variant, quantity, locale route and bundled header section', async () => {
  const { form, events } = setup(async (url, config) => {
    assert.equal(url, '/fr/cart/add.js');
    assert.equal(config.body.get('id'), '123');
    assert.equal(config.body.get('quantity'), '2');
    assert.equal(config.body.get('sections'), 'cart-icon-bubble');
    assert.equal(config.body.get('sections_url'), '/fr/products/test');
    assert.equal(config.headers['Content-Type'], undefined);
    return { ok: true, json: async () => ({ key: '123:key' }) };
  });
  await submit(form);
  assert.equal(events[0].name, 'update');
  assert.equal(form.pending, false);
});

test('blocks repeated submission while request is pending', async () => {
  let finish;
  let calls = 0;
  const { form } = setup(() => { calls++; return new Promise((resolve) => { finish = resolve; }); });
  const first = submit(form);
  await submit(form);
  assert.equal(calls, 1);
  finish({ ok: true, json: async () => ({}) });
  await first;
});

test('inventory rejection shows error and permits a later corrected request', async () => {
  const { form, events } = setup(async () => ({ ok: false, json: async () => ({ status: 422, description: 'Not enough stock' }) }));
  await submit(form);
  assert.equal(form.message, 'Not enough stock');
  assert.equal(events[0].name, 'error');
  assert.equal(form.submitButton.getAttribute('aria-disabled'), undefined);
});

test('network failure warns about uncertain outcome and never retries add', async () => {
  let calls = 0;
  const { form } = setup(async () => { calls++; throw new Error('Network lost'); });
  await submit(form);
  assert.equal(calls, 1);
  assert.equal(form.message, 'Check cart first');
  assert.equal(form.pending, false);
});

test('UI failure after successful add does not repeat mutation', async () => {
  let calls = 0;
  const { form } = setup(async () => { calls++; return { ok: true, json: async () => ({}) }; });
  form.renderCartSections = async () => { throw new Error('Sections unavailable'); };
  await submit(form);
  assert.equal(calls, 1);
  assert.equal(form.message, 'Added; check cart');
});

test('missing section triggers read-only recovery and preserves header element', async () => {
  let recoveryCalls = 0;
  const { form, context, ProductForm } = setup(async (url, config) => {
    recoveryCalls++;
    assert.equal(url.searchParams.get('sections'), 'cart-icon-bubble');
    assert.equal(config.method, undefined);
    return { ok: true, json: async () => ({ 'cart-icon-bubble': '<rendered-header>' }) };
  });
  const header = { innerHTML: 'old' };
  context.document.getElementById = () => header;
  context.DOMParser = class { parseFromString() { return { querySelector: () => ({ innerHTML: 'new count' }) }; } };
  await ProductForm.prototype.renderCartSections.call(form, { sections: { 'cart-icon-bubble': null } }, ['cart-icon-bubble']);
  assert.equal(recoveryCalls, 1);
  assert.equal(header.innerHTML, 'new count');
});
