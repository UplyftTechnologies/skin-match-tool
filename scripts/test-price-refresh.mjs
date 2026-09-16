import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scrapePrices } from '../src/lib/price-scraper.js';

test('returns only validated price fields and preserves per-retailer failures', async () => {
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.PRICE_SCRAPER_URL;
  process.env.PRICE_SCRAPER_URL = 'https://scraper.example/refresh';
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ results: [
    { id: 1, ok: true, data: { selling_price: 100, mrp: 125, discount: 20, in_stock: false, description: 'must not escape' } },
    { id: 2, ok: false, reason: 'timeout' },
    { id: 3, ok: true, data: { selling_price: -5 } },
  ] }) });
  try {
    const results = await scrapePrices([1, 2, 3, 4].map(id => ({ id, site: 'retailer' })));
    assert.deepEqual(results[0].data, { selling_price: 100, mrp: 125, discount: 20, in_stock: false });
    assert.equal(results[1].reason, 'timeout');
    assert.equal(results[2].ok, false);
    assert.equal(results[3].ok, false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.PRICE_SCRAPER_URL;
    else process.env.PRICE_SCRAPER_URL = previousUrl;
  }
});
