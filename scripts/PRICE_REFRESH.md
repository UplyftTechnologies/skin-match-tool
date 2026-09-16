# On-demand price refresh

The existing POST `/api/retailer-products/rescrape` accepts `{ "id": "123" }`.
This is a `retailer_products.id`, not a new canonical product table. The route
loads the full stored row and reuses `findComparableProducts` to resolve the
stored retailer URLs. Client-provided URLs are never accepted by this route.
There are no database writes. Results update the current comparison session;
reloading the page restores stored catalogue values.

Refresh streams each retailer result to the comparison UI as soon as it finishes.
The existing JSON response remains available for clients without an NDJSON Accept
header. Matched retailer IDs/URLs are reused for up to 60 seconds per server
process (at most 500 products); prices are always fetched live. A cache miss
uses the existing database matching flow. The optional Python service supports
the same streaming protocol and avoids starting Python again on every click.

## Local / Node hosting

Requires Python 3.11+. From the repository root:

```sh
python -m venv .venv-price-scraper
# Windows:
.venv-price-scraper/Scripts/python.exe -m pip install -r scripts/price-scraper-requirements.txt
# Linux:
.venv-price-scraper/bin/python -m pip install -r scripts/price-scraper-requirements.txt
```

The Next.js adapter detects this environment automatically. Alternatively set
`PRICE_SCRAPER_PYTHON` to an absolute Python executable with these dependencies.
On Render's Node service, create this environment and install requirements in
the build command before `npm run build`. A standalone bundle includes the
Python script, but its host still needs Python and the installed dependencies.

## Vercel / separate Python service

Install the same requirements on a Python host and run from the repo root:

```sh
python -m uvicorn price_scraper_service:app --app-dir scripts --host 0.0.0.0 --port 8000
```

Set a strong `PRICE_SCRAPER_TOKEN` on both services, and set
`PRICE_SCRAPER_URL=https://your-python-service/refresh` on Next.js. Keep the token
server-side. The Python service refuses requests without the matching token.

## Extraction and limits

Uses Scrapling `AsyncFetcher` (HTTP Fetcher) with up to eight concurrent requests,
eight-second HTTP timeouts, no retries, and a 15-second deadline per retailer.
Redirect destinations must be public HTTPS URLs. The Next.js adapter has a
45-second overall timeout. No browser installation or background crawl needed.

Extracts only selling price, MRP, calculated percentage discount, and stock from
Product/Offer JSON-LD, product metadata, Nykaa's product state, Tira's price block,
Purplle's validated availability price tuple, and Amazon's scoped buy box. Supports
Nykaa, Tira, Purplle, and other stored retailer URLs when they expose these data.
Missing MRP/discount/stock is returned as null. Ambiguous variants, aggregate
prices, unsupported currencies, blocked pages, and JavaScript-only pages fail
per retailer rather than inventing a price. HTTP extraction is not a guarantee
of success on every retailer. No browser fallback is enabled.

Run parser/concurrency tests:

```sh
.venv-price-scraper/Scripts/python.exe -m unittest discover -s scripts -p test_price_scraper.py
```

Scrapling HTTP API reference: https://scrapling.readthedocs.io/en/latest/fetching/static/
