const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

function setup(fetch = async () => { throw new Error('offline'); }) {
  let ProductInfo;
  const changes = [];
  const context = {
    HTMLElement: class {},
    customElements: { get: () => false, define: (_name, component) => { ProductInfo = component; } },
    window: {
      location: { href: 'https://example.com/products/size?utm_source=test&preview_theme_id=123&variant=old#details', origin: 'https://example.com' },
      history: { state: { retained: true }, replaceState: (state, _title, url) => changes.push({ state, url }) },
      shopUrl: 'https://example.com',
      variantStrings: { selectionError: 'Select again' },
    },
    fetch, URL, AbortController,
    console: { log() {}, error() {} },
    document: { querySelector: () => ({ focus() {} }) },
    DOMParser: class { parseFromString() { return { querySelector: () => ({}) }; } },
  };
  vm.runInNewContext(fs.readFileSync('assets/product-info.js', 'utf8'), context);
  const instance = Object.create(ProductInfo.prototype);
  instance.dataset = { updateUrl: 'true', section: 'test', url: '/products/size' };
  instance.querySelector = () => null;
  const form = { toggleSubmitButton: (value) => { form.disabled = value; }, handleErrorMessage: (value) => { form.message = value; } };
  Object.defineProperty(instance, 'productForm', { value: form });
  return { instance, changes, form };
}

test('changes variant while preserving query, hash and history state', () => {
  const { instance, changes } = setup();
  instance.updateURL('/products/size', 456);
  const result = new URL(changes[0].url, 'https://example.com');
  assert.equal(result.searchParams.get('variant'), '456');
  assert.equal(result.searchParams.get('utm_source'), 'test');
  assert.equal(result.searchParams.get('preview_theme_id'), '123');
  assert.equal(result.hash, '#details');
  assert.equal(changes[0].state.retained, true);
});

test('removes unresolved variant only and respects embedded update-url=false', () => {
  const { instance, changes } = setup();
  instance.updateURL('/products/size', null);
  assert.equal(new URL(changes[0].url, 'https://example.com').searchParams.has('variant'), false);
  instance.dataset.updateUrl = 'false';
  instance.updateURL('/products/size', 789);
  assert.equal(changes.length, 1);
});

test('failed request shows selection error and keeps buying disabled', async () => {
  const { instance, form } = setup(async () => ({ ok: false }));
  let callbacks = 0;
  instance.renderProductInfo({ requestUrl: '/products/size?section_id=test', targetId: 'size', callback: () => callbacks++ });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(callbacks, 0);
  assert.equal(form.disabled, true);
  assert.equal(form.message, 'Select again');
});

test('late response from superseded request cannot overwrite current selection', async () => {
  const responses = [];
  const { instance } = setup(() => new Promise((resolve) => responses.push(resolve)));
  const rendered = [];
  instance.renderProductInfo({ requestUrl: 'old', targetId: 'old', callback: () => rendered.push('old') });
  instance.renderProductInfo({ requestUrl: 'new', targetId: 'new', callback: () => rendered.push('new') });
  responses[1]({ ok: true, text: async () => 'new' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  responses[0]({ ok: true, text: async () => 'old' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(rendered, ['new']);
});
