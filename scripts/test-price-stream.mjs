import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPriceStream } from '../src/lib/price-stream.js';
import { recalledPriceListings, rememberPriceListings } from '../src/lib/price-refresh-listings.js';

test('delivers the first retailer before the response finishes and handles split UTF-8', async () => {
  let controller;
  const body = new ReadableStream({ start(c) { controller = c; } });
  const received = [];
  const reading = readPriceStream(body, event => received.push(event));
  const bytes = new TextEncoder().encode(JSON.stringify({ site: 'Nykaa', text: '₹100' }) + '\n');
  const rupee = bytes.indexOf(0xe2);
  controller.enqueue(bytes.slice(0, rupee + 1));
  controller.enqueue(bytes.slice(rupee + 1));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(received[0].text, '₹100');
  controller.enqueue(new TextEncoder().encode('{"site":"Tira"}'));
  controller.close();
  await reading;
  assert.deepEqual(received.map(item => item.site), ['Nykaa', 'Tira']);
});

test('malformed stream is rejected rather than reported as successful', async () => {
  const body = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('not-json\n')); c.close(); } });
  await assert.rejects(readPriceStream(body, () => {}));
});

test('only matched URLs are cached and entries expire after 60 seconds', () => {
  const now = Date.now;
  try {
    Date.now = () => 1000;
    rememberPriceListings({ id: 111, site: 'nykaa', product_url: 'https://www.nykaa.com/p/1', selling_price: 99 }, []);
    assert.deepEqual(recalledPriceListings('111'), [{ id: 111, site: 'nykaa', product_url: 'https://www.nykaa.com/p/1' }]);
    Date.now = () => 61000;
    assert.equal(recalledPriceListings('111'), null);
  } finally { Date.now = now; }
});
