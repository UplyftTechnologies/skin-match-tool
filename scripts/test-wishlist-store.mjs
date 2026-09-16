import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WishlistStore, wishlistMatches } from '../src/lib/wishlist-store.js';

const session = { user: { id: 'account-a' }, access_token: 'a' };
const product = { product_uid: '301749', product_name: 'Retailer product', selling_price: 299 };
const response = (data, ok = true) => ({ ok, json: async () => data });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function setup(request, backing = new Map()) {
  const storage = { getItem: key => backing.get(key), setItem: (key, value) => backing.set(key, value) };
  return { store: new WishlistStore({ storage, request, onChange: () => {} }), backing };
}

test('saved retailer product survives a new provider instance and server reload', async () => {
  const db = new Map();
  const request = async (_url, options) => {
    if (options.method === 'GET') return response({ products: [...db.values()] });
    db.set(JSON.parse(options.body).productUid, product);
    return response({ product });
  };
  const { store, backing } = setup(request);
  await store.setSession(session);
  store.change(product, true);
  await store.flush();
  const reloaded = setup(request, backing).store;
  await reloaded.setSession(session);
  assert.deepEqual(reloaded.items, [product]);
  assert.equal(reloaded.pending.size, 0);
});

test('HTTP rejection preserves the item and durable pending save; retry succeeds', async () => {
  let fail = true;
  const { store, backing } = setup(async (_url, { method }) => method === 'GET'
    ? response({ products: [] }) : response({ product }, !fail));
  await store.setSession(session);
  store.change(product, true);
  await store.flush();
  assert.match(store.error, /could not sync/);
  assert.equal(store.items.length, 1);
  assert.equal(JSON.parse(backing.get('wishlist_products:account-a')).pending.length, 1);
  fail = false;
  await store.retry();
  assert.equal(store.pending.size, 0);
  assert.equal(store.error, '');
});

test('reload during an unfinished POST restores and retries that operation', async () => {
  const blocked = deferred();
  const { store, backing } = setup(async (_url, { method }) => method === 'GET'
    ? response({ products: [] }) : blocked.promise);
  await store.setSession(session);
  store.change(product, true);
  store.dispose();
  const calls = [];
  const reloaded = setup(async (_url, { method }) => {
    calls.push(method);
    return response(method === 'GET' ? { products: [] } : { product });
  }, backing).store;
  await reloaded.setSession(session);
  assert.deepEqual(reloaded.items, [product]);
  assert.deepEqual(calls, ['GET', 'POST']);
  blocked.resolve(response({ product }));
});

test('rapid save then remove is sent in order and leaves the product removed', async () => {
  const blocked = deferred();
  const calls = [];
  const { store } = setup(async (_url, { method }) => {
    calls.push(method);
    return method === 'GET' ? response({ products: [] }) : method === 'POST' ? blocked.promise : response({ ok: true });
  });
  await store.setSession(session);
  store.change(product, true);
  store.change(product, false);
  blocked.resolve(response({ product }));
  await store.flush();
  assert.deepEqual(calls, ['GET', 'POST', 'DELETE']);
  assert.deepEqual(store.items, []);
});

test('failed removal stays removed across reload until DELETE can succeed', async () => {
  const { store, backing } = setup(async (_url, { method }) => method === 'GET'
    ? response({ products: [product] }) : response({}, false));
  await store.setSession(session);
  store.change(product, false);
  await store.flush();
  const reloaded = setup(async (_url, { method }) => response(method === 'GET' ? { products: [product] } : {}), backing).store;
  await reloaded.setSession(session);
  assert.deepEqual(reloaded.items, []);
  assert.equal(reloaded.pending.size, 0);
});

test('late account A response cannot overwrite account B', async () => {
  const blocked = deferred();
  const { store } = setup(async (_url, { headers }) => headers.Authorization === 'Bearer a'
    ? blocked.promise : response({ products: [] }));
  const first = store.setSession(session);
  await store.setSession({ user: { id: 'account-b' }, access_token: 'b' });
  blocked.resolve(response({ products: [product] }));
  await first;
  assert.deepEqual(store.items, []);
});

test('token refresh does not issue another GET or replace local edits', async () => {
  let requests = 0;
  const { store } = setup(async () => { requests++; return response({ products: [product] }); });
  await store.setSession(session);
  await store.setSession({ ...session, access_token: 'new-token' });
  assert.equal(requests, 1);
  assert.deepEqual(store.items, [product]);
});

test('load failure retains cached products and reports an error', async () => {
  const backing = new Map([['wishlist_products:account-a', JSON.stringify({ items: [product], pending: [] })]]);
  const { store } = setup(async () => response({}, false), backing);
  await store.setSession(session);
  assert.deepEqual(store.items, [product]);
  assert.match(store.error, /Could not load/);
});

test('numeric/string IDs and old catalogue aliases identify the same saved heart', () => {
  assert.equal(wishlistMatches(product, 301749), true);
  assert.equal(wishlistMatches({ product_uid: 'Roopsee-old', retailer_product_id: '301749' }, 301749), true);
  assert.equal(wishlistMatches(product, 'other'), false);
});
