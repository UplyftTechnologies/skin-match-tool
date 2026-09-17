"""On-demand HTTP-only price extraction. stdin JSON -> stdout JSON; no DB writes."""
import asyncio
import ipaddress
import json
import math
import re
import socket
import sys
from urllib.parse import parse_qs, urljoin, urlsplit

# Imported before stdin is read, so a pre-started process is ready to fetch
# and a missing dependency fails immediately rather than mid-stream.
from scrapling.fetchers import AsyncFetcher


def amount(value):
    if isinstance(value, bool) or value is None:
        return None
    try:
        result = float(re.sub(r"[₹,\s]", "", str(value)))
        return result if math.isfinite(result) and result > 0 else None
    except (TypeError, ValueError):
        return None


def stock(value):
    if isinstance(value, bool):
        return value
    value = str(value or "").lower().rsplit("/", 1)[-1]
    if value in ("instock", "limitedavailability", "in stock"):
        return True
    if value in ("outofstock", "soldout", "discontinued", "out of stock"):
        return False
    return None


def types(node, kind):
    value = node.get("@type", [])
    return kind in (value if isinstance(value, list) else [value])


def products(value):
    # Deliberately do not recurse through recommendations, ItemLists or variants.
    if isinstance(value, list):
        return [p for entry in value for p in products(entry)]
    if not isinstance(value, dict):
        return []
    if types(value, "Product"):
        return [value]
    return products(value.get("@graph", [])) + products(value.get("mainEntity", []))


def same_url(left, right):
    a, b = urlsplit(left), urlsplit(right)
    return (a.hostname, a.path.rstrip("/"), a.query) == (b.hostname, b.path.rstrip("/"), b.query)


def extract(page, url):
    candidates = []
    for raw in page.css('script[type="application/ld+json"]::text').getall():
        try:
            candidates.extend(products(json.loads(raw)))
        except (ValueError, TypeError):
            continue
    matching = [p for p in candidates if same_url(urljoin(url, p.get("url") or p.get("@id") or ""), url)]
    if matching:
        candidates = matching
    if len(candidates) > 1:
        raise ValueError("ambiguous_product")
    offer = {}
    if candidates:
        offers = candidates[0].get("offers", {})
        if isinstance(offers, list):
            if len(offers) != 1:
                selected = [o for o in offers if o.get("url") and same_url(urljoin(url, o["url"]), url)]
                if len(selected) != 1:
                    raise ValueError("ambiguous_offer")
                offers = selected
            offers = offers[0] if offers else {}
        if isinstance(offers, dict) and not types(offers, "AggregateOffer"):
            offer = offers
    if offer.get("priceCurrency") and offer["priceCurrency"] != "INR":
        raise ValueError("unsupported_currency")

    def first(selector):
        return page.css(selector).get()

    currency = first('meta[property="product:price:currency"]::attr(content)')
    if currency and currency != "INR":
        raise ValueError("unsupported_currency")
    offer_price = amount(offer.get("price"))
    price = offer_price
    mrp = None
    specs = offer.get("priceSpecification", [])
    for spec in specs if isinstance(specs, list) else [specs]:
        if isinstance(spec, dict) and str(spec.get("priceType", "")).rsplit("/", 1)[-1] in ("StrikethroughPrice", "ListPrice", "MSRP"):
            mrp = amount(spec.get("price"))
    offer_mrp = mrp
    offer_availability = stock(offer.get("availability"))
    # Product-scoped metadata works across retailers without scanning page text.
    price = price or amount(first('meta[property="product:price:amount"]::attr(content)'))
    mrp = mrp or amount(first('meta[property="product:original_price:amount"]::attr(content)'))
    availability = offer_availability
    if availability is None:
        availability = stock(first('meta[property="product:availability"]::attr(content)'))
    host = (urlsplit(url).hostname or "").removeprefix("www.")
    if host == "nykaa.com":
        # Exact PDP state, not recommendation objects containing the same keys.
        for raw in page.css('script::text').getall():
            match = re.match(r"\s*window\.__PRELOADED_STATE__\s*=\s*", raw)
            if not match:
                continue
            try:
                state, _ = json.JSONDecoder().raw_decode(raw[match.end():])
                product = state.get("productPage", {}).get("product", {})
                product_id = re.search(r"/p/(\d+)", urlsplit(url).path)
                if product_id and str(product.get("id")) == product_id[1]:
                    # Multi-size products keep the default size at the top level;
                    # ?skuId= picks the listed size, as JSON-LD and meta tags do.
                    variants = [v for v in product.get("variants") or [] if isinstance(v, dict)]
                    if variants:
                        sku_id = parse_qs(urlsplit(url).query).get("skuId", [None])[0] or product.get("defaultPid")
                        selected = [v for v in variants if sku_id and str(v.get("childId")) == str(sku_id)]
                        if len(selected) != 1:
                            raise ValueError("ambiguous_variant")
                        product = selected[0]
                        # Meta tags describe the default size; keep only JSON-LD values.
                        price, mrp, availability = offer_price, offer_mrp, offer_availability
                    live_price = amount(product.get("offerPrice"))
                    if price and live_price and price != live_price:
                        raise ValueError("conflicting_prices")
                    price = live_price or price
                    mrp = amount(product.get("mrp")) or mrp
                    availability = stock(product.get("inStock")) if isinstance(product.get("inStock"), bool) else availability
            except (json.JSONDecodeError, AttributeError, TypeError):
                continue
    elif host == "tirabeauty.com":
        price = price or amount(first('#item_price::text'))
        mrp = mrp or amount(first('#item_price + span[class*="oldAmount"]::text'))
    elif host == "purplle.com":
        # Solid's hydration is JS, not JSON. Read only this narrow price tuple;
        # never execute it, and require a unique tuple agreeing with the offer.
        tuples = []
        for raw in page.css('script::text').getall():
            tuples.extend(re.findall(r'availability:\$R\[\d+\]=\{mrp:"([\d.,]+)",ourPrice:([\d.]+),offerPrice:"([\d.]+)"', raw))
        if len(tuples) == 1 and amount(tuples[0][2]) == price:
            mrp = amount(tuples[0][0]) or mrp
    # Amazon's buying box is scoped; generic .a-price also matches recommendations.
    if host == "amazon.in":
        price = price or amount(first('#corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen::text'))
        if price is None:
            # Some Amazon layouts leave .a-offscreen blank and render the
            # actual amount as separate whole/fraction spans instead.
            whole = first('#corePriceDisplay_desktop_feature_div .priceToPay .a-price-whole::text')
            fraction = first('#corePriceDisplay_desktop_feature_div .priceToPay .a-price-fraction::text')
            if whole:
                price = amount(whole.strip().rstrip('.') + ('.' + fraction.strip() if fraction else ''))
        mrp = mrp or amount(first('#corePriceDisplay_desktop_feature_div .basisPrice .a-offscreen::text'))
        if availability is None:
            availability = stock((first('#availability span::text') or "").strip().rstrip("."))
    if price is None:
        # Sold-out pages often publish price 0; the stock status is still news.
        if availability is False:
            return {"selling_price": None, "mrp": None, "discount": None, "in_stock": False}
        raise ValueError("no_price_found")
    if mrp is not None and mrp < price:
        raise ValueError("invalid_mrp")
    return {"selling_price": price, "mrp": mrp,
            "discount": round((mrp - price) / mrp * 100, 2) if mrp else None,
            "in_stock": availability}


async def validate_url(url):
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError("invalid_url")
    addresses = await asyncio.get_running_loop().getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(entry[4][0]).is_global for entry in addresses):
        raise ValueError("private_url")


async def scrape_one(row, semaphore):
    result = {"id": row.get("id"), "site": row.get("site"), "ok": False}
    try:
        async with semaphore, asyncio.timeout(15):
            url = row.get("product_url")
            if not url:
                raise ValueError("no_url")
            # Validate every redirect, including cross-retailer affiliate redirects.
            for _ in range(4):
                await validate_url(url)
                page = await AsyncFetcher.get(url, timeout=8, retries=0, follow_redirects=False)
                if page.status in (301, 302, 303, 307, 308):
                    location = page.headers.get("location") or page.headers.get("Location")
                    if not location:
                        raise ValueError("invalid_redirect")
                    url = urljoin(url, location)
                    continue
                if page.status != 200:
                    raise ValueError(f"http_{page.status}")
                result.update(ok=True, data=extract(page, url))
                return result
            raise ValueError("too_many_redirects")
    except TimeoutError:
        result["reason"] = "timeout"
    except ValueError as error:
        result["reason"] = str(error)
    except Exception:
        result["reason"] = "fetch_failed"
    return result


def validate_rows(rows):
    if not isinstance(rows, list) or len(rows) > 16 or any(not isinstance(row, dict) for row in rows):
        raise ValueError("invalid_rows")


async def scrape_iter(rows):
    validate_rows(rows)
    semaphore = asyncio.Semaphore(8)
    tasks = [asyncio.create_task(scrape_one(row, semaphore)) for row in rows]
    try:
        for task in asyncio.as_completed(tasks):
            yield await task
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


async def scrape(rows):
    results = [result async for result in scrape_iter(rows)]
    by_id = {str(result['id']): result for result in results}
    return {"results": [by_id[str(row['id'])] for row in rows]}


async def stream(rows):
    async for result in scrape_iter(rows):
        print(json.dumps(result, allow_nan=False), flush=True)


if __name__ == "__main__":
    payload = json.loads(sys.stdin.read(100000))
    if '--stream' in sys.argv:
        asyncio.run(stream(payload['rows']))
    else:
        print(json.dumps(asyncio.run(scrape(payload["rows"])), allow_nan=False))
