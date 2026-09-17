// Only retailer identities/URLs are cached, never scraped prices.
// Next can bundle this module separately for pages and route handlers.
const cacheKey = Symbol.for('roopsee.priceRefreshListings');
const entries = globalThis[cacheKey] ||= new Map();
// Listings change with catalogue imports, not per click; a reload re-primes them.
const TTL = 10 * 60_000;
export function rememberPriceListings(product, comparable) {
  const rows = [...new Map([product, ...comparable].map(row => [String(row.id), {
    id: row.id, site: row.site, product_url: row.product_url,
  }])).values()];
  if (entries.size >= 500) entries.delete(entries.keys().next().value);
  entries.set(String(product.id), { rows, expires: Date.now() + TTL });
  return rows;
}
export function recalledPriceListings(id) {
  const key = String(id);
  const entry = entries.get(key);
  if (!entry || entry.expires <= Date.now()) { entries.delete(key); return null; }
  return entry.rows;
}
