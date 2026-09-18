"""Pincode delivery check for the listings of one product.

Independent of the spiders and of price_refresh: given a pincode, asks each
retailer whether it delivers there and when, using the same call its own
product page makes:

    nykaa     POST /edd/product/edd/default/fetch, from inside a stealth
              browser (Akamai refuses the call without the browser's cookies)
    tira      Fynd storefront API .../sizes/<size>/price/?pincode=, with the
              application token the product page publishes
    broadway  the store's pincode worker, with the token the page embeds
    purplle   /neo/bff/product/pincode-check
    amazon    sets the location like the "Deliver to" popup, then reads the
              delivery block of each /dp/<asin> page

All retailers are checked concurrently. A retailer that cannot be reached is
reported per listing, never raised.

    python delivery_check.py <pincode> <site> <product_id> <url> [sku]
"""

from __future__ import annotations

import base64
import html
import json
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Callable
from urllib.parse import urlparse

from scrapling.fetchers import Fetcher, FetcherSession, StealthyFetcher

TIMEOUT = 30
# Nykaa's own browser fetch measured 17s-113s for the *same* blocked call —
# Akamai stalls suspicious traffic rather than rejecting it quickly, and
# fighting that harder is explicitly out of scope (see the note above
# _nykaa_edd_in_browser). Capping this short makes the frequent-failure case
# fail fast instead of holding up every other retailer's result for ~2min.
NYKAA_TIMEOUT = 20
PINCODE = re.compile(r"^[1-9]\d{5}$")

HEADERS = {
    "Accept-Language": "en-IN,en;q=0.9",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
    ),
}


@dataclass
class DeliveryResult:
    site: str
    product_id: str
    ok: bool                       # the retailer answered
    deliverable: bool | None = None
    message: str = ""              # the retailer's own wording, e.g. "Delivery by 20th Sep"
    detail: str = ""               # extra: shipping origin, faster option, COD
    error: str = ""
    checked_at: datetime = field(default_factory=datetime.now)


class DeliveryError(Exception):
    """A retailer answered, but not in a way we can read."""


def valid_pincode(pincode: str) -> bool:
    return bool(PINCODE.match(str(pincode or "").strip()))


def _json(response) -> dict:
    try:
        return json.loads(response.body.decode("utf-8", errors="ignore"))
    except ValueError as exc:
        raise DeliveryError(f"unexpected response (HTTP {response.status})") from exc


def _text(response, selector: str) -> str:
    return re.sub(r"\s+", " ", " ".join(response.css(f"{selector} ::text").getall())).strip()


# --------------------------------------------------------------------------
# one function per retailer: (listings, pincode) -> {product_id: result fields}
# --------------------------------------------------------------------------


_NYKAA_EDD = """async ([skus, pincode]) => {
    const r = await fetch('/edd/product/edd/default/fetch', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: JSON.stringify({skus, type: 'simple', domain: 'nykaa', source: 'pdp', pincode}),
    });
    return [r.status, await r.text()];
}"""



_NYKAA_CACHE: dict[tuple[str, str], tuple[float, dict[str, dict]]] = {}
_NYKAA_CACHE_TTL = 900  # 15 minutes


def _nykaa_cache_get(key):
    import time
    item = _NYKAA_CACHE.get(key)
    if not item:
        return None
    created, value = item
    if time.time() - created > _NYKAA_CACHE_TTL:
        _NYKAA_CACHE.pop(key, None)
        return None
    return value


def _nykaa_cache_put(key, value):
    import time
    _NYKAA_CACHE[key] = (time.time(), value)


def _nykaa(rows: list[dict], pincode: str) -> dict[str, dict]:
    cache_key = (str(rows[0].get("product_url", "")), pincode)
    cached = _nykaa_cache_get(cache_key)
    if cached is not None:
        return cached

    skus = {row["product_id"]: row.get("sku", "") for row in rows}
    wanted = sorted({sku for sku in skus.values() if sku})
    if not wanted:
        raise DeliveryError("no Nykaa SKU stored for this listing")
    # The browser runs in its own process: Streamlit on Windows switches asyncio
    # to a loop that cannot start the browser's subprocess (NotImplementedError).
    try:
        done = subprocess.run(
            [sys.executable, str(Path(__file__).resolve()), "--nykaa-edd",
             rows[0]["product_url"], pincode, *wanted],
            # Two attempts (one retry) at NYKAA_TIMEOUT each, plus the 1s
            # retry delay and margin for subprocess/browser startup.
            capture_output=True, text=True, timeout=NYKAA_TIMEOUT * 2 + 10,
        )
    except subprocess.TimeoutExpired as exc:
        raise DeliveryError("Nykaa took too long to respond") from exc
    lines = [line for line in done.stdout.splitlines() if line.startswith("[")]
    if not lines:
        error = (done.stderr.strip().splitlines() or ["browser failed to start"])[-1]
        raise DeliveryError(error[:120])
    answer = json.loads(lines[-1])
    if not answer or answer[0] != 200:
        raise DeliveryError(
            "Nykaa delivery check temporarily unavailable (HTTP 403)"
            if answer and answer[0] == 403
            else f"HTTP {answer[0] if answer else 'no answer'}"
        )
    details = (json.loads(answer[1]).get("data") or {}).get("details") or {}
    out = {}
    for product_id, sku in skus.items():
        info = details.get(sku)
        if not info:
            out[product_id] = DeliveryError("Nykaa returned nothing for this size")
            continue
        speed = {"SDD": "same-day", "NDD": "next-day"}.get(info.get("deliveryType") or "", "")
        serviceable = bool(info.get("serviceable"))
        out[product_id] = {
            "deliverable": serviceable,
            # Nykaa still quotes a date for pincodes it does not serve.
            "message": (info.get("message") or "Deliverable") if serviceable
            else "Not serviceable at this pincode",
            "detail": speed,
        }
    _nykaa_cache_put(cache_key, out)
    return out


_tira_auth: dict[str, str] = {}


def _tira_token(product_url: str) -> str:
    if "auth" not in _tira_auth:
        markup = Fetcher.get(product_url, headers=HEADERS, impersonate="chrome", timeout=TIMEOUT,
                             retries=2).body.decode("utf-8", errors="ignore")
        app_id = re.search(r'applicationID"\s*:\s*"([0-9a-f]{24})"', markup)
        token = re.search(r'applicationToken"\s*:\s*"([^"]+)"', markup)
        if not (app_id and token):
            raise DeliveryError("Tira application token not found on page")
        pair = f"{app_id.group(1)}:{token.group(1)}".encode()
        _tira_auth["auth"] = "Bearer " + base64.b64encode(pair).decode()
    return _tira_auth["auth"]


def _tira(row: dict, pincode: str) -> dict:
    url = row["product_url"]
    slug = urlparse(url).path.rstrip("/").split("/")[-1]
    api = f"https://www.tirabeauty.com/api/service/application/catalog"
    headers = {**HEADERS, "Accept": "application/json", "Authorization": _tira_token(url), "Referer": url}
    with FetcherSession(impersonate="chrome", timeout=TIMEOUT, retries=2) as session:
        sizes = _json(session.get(f"{api}/v1.0/products/{slug}/sizes/", headers=headers)).get("sizes") or []
        size = next((s.get("value") for s in sizes if s.get("is_available")), None) or (
            sizes[0].get("value") if sizes else "OS")
        response = session.get(f"{api}/v3.0/products/{slug}/sizes/{size}/price/?pincode={pincode}",
                               headers=headers)
    data = _json(response)
    if response.status == 400 and data.get("is_serviceable") is False:
        return {"deliverable": False, "message": data.get("message") or "Not deliverable"}
    if response.status != 200:
        raise DeliveryError(data.get("message") or f"HTTP {response.status}")
    promise = data.get("delivery_promise") or {}
    return {
        "deliverable": bool(data.get("is_serviceable", True)),
        "message": promise.get("message") or "Deliverable",
        "detail": "Cash on delivery available" if data.get("is_cod") else "",
    }


_broadway_auth: dict[str, tuple[str, str]] = {}


def _broadway(rows: list[dict], pincode: str) -> dict[str, dict]:
    url = rows[0]["product_url"].split("?")[0].rstrip("/")
    if "auth" not in _broadway_auth:
        markup = Fetcher.get(url, headers=HEADERS, impersonate="chrome", timeout=TIMEOUT,
                             retries=2).body.decode("utf-8", errors="ignore")
        token = re.search(r'TOKEN\s*=\s*"(eyJ[^"]+)"', markup)
        vendor = re.search(r"VENDOR_ID\s*=\s*(\d+)", markup)
        if not token:
            raise DeliveryError("Broadway delivery token not found on page")
        _broadway_auth["auth"] = (token.group(1), vendor.group(1) if vendor else "1")
    token, vendor = _broadway_auth["auth"]
    variants = _json(Fetcher.get(url + ".js", headers=HEADERS, timeout=TIMEOUT, retries=2)).get("variants") or []
    barcodes = {str(v.get("id")): v.get("barcode") for v in variants}
    out = {}
    for row in rows:
        barcode = barcodes.get(row["product_id"]) or row.get("gtin") or next(
            (b for b in barcodes.values() if b), "")
        if not barcode:
            out[row["product_id"]] = DeliveryError("no barcode to check delivery with")
            continue
        response = Fetcher.get(
            f"https://pincode.tech-066.workers.dev/?barcode={barcode}&pincode={pincode}&vendor_id={vendor}",
            headers={**HEADERS, "Accept": "application/json", "authorization": f"Bearer {token}",
                     "Origin": "https://shop.broadwaylive.in", "Referer": "https://shop.broadwaylive.in/"},
            timeout=TIMEOUT, retries=2,
        )
        data = (_json(response).get("data")) or {}
        eta = data.get("eta_obj") or {}
        message = eta.get("eta") or data.get("eta") or ""
        deliverable = data.get("is_deliverable")
        if deliverable is None:
            deliverable = bool(message) and not message.lower().startswith("sorry")
        out[row["product_id"]] = {
            "deliverable": bool(deliverable),
            "message": message or ("Deliverable" if deliverable else "Not deliverable"),
            "detail": (eta.get("ship_loc") or "").strip(),
        }
    return out


def _purplle(row: dict, pincode: str) -> dict:
    url = row["product_url"]
    with FetcherSession(impersonate="chrome", timeout=TIMEOUT, retries=2) as session:
        markup = session.get(url, headers=HEADERS).body.decode("utf-8", errors="ignore")
        # The product's own id comes first; later ones belong to recommendations.
        match = re.search(r"\bproduct_id\s*:\s*\"?(\d{3,10})", markup)
        if not match:
            raise DeliveryError("Purplle product id not found on page")
        response = session.get(
            f"https://www.purplle.com/neo/bff/product/pincode-check?pincode={pincode}&productid={match.group(1)}",
            headers={**HEADERS, "Accept": "application/json", "Referer": url},
        )
    data = _json(response)
    if response.status != 200:
        raise DeliveryError(data.get("message") or f"HTTP {response.status}")
    return {
        "deliverable": not data.get("is_location_error", False),
        "message": data.get("message") or "",
    }


AMAZON = "https://www.amazon.in"
_AMAZON_UNDELIVERABLE = re.compile(
    r"cannot be (?:delivered|shipped)|does not ship to|not deliverable|currently unavailable", re.I)
_ASIN_IN_URL = re.compile(r"/(?:dp|gp/product)/([A-Z0-9]{10})", re.I)
_ASIN_SHAPE = re.compile(r"^[A-Z0-9]{10}$", re.I)


def _asin_of(row: dict) -> str:
    # `product_id` is our own retailer_products.id, not Amazon's ASIN — using
    # it directly 404s the product page. The ASIN lives in the URL (usually
    # as the last segment, but Amazon also serves slugged URLs like
    # /some-title/dp/ASIN/ref=...), with `sku` as a second source for it.
    match = _ASIN_IN_URL.search(row.get("product_url") or "")
    if match:
        return match.group(1)
    sku = row.get("sku") or ""
    if _ASIN_SHAPE.match(sku):
        return sku
    return row["product_id"]


def _first_sentence(text: str) -> str:
    """Amazon repeats each delivery line for screen readers and appends 'Details'."""
    text = re.split(r"\s*\.?\s*Details\b", text)[0]
    text = text.split(". ")[0].strip(" .")
    repeated = re.match(r"^(.+?)\s+\1$", text)
    return repeated.group(1) if repeated else text


def _amazon(rows: list[dict], pincode: str) -> dict[str, dict]:
    headers = {**HEADERS, "Accept": "text/html,application/xhtml+xml", "Referer": AMAZON + "/"}
    out: dict[str, dict] = {}
    with FetcherSession(impersonate="chrome", stealthy_headers=True, timeout=TIMEOUT,
                        retries=3, retry_delay=2) as session:
        try:
            session.get(AMAZON + "/", headers=headers)  # cookies that stop connection resets
        except Exception:
            pass
        asins = [_asin_of(row) for row in rows]

        # Set the location once, the way the "Deliver to" popup does.
        page = session.get(f"{AMAZON}/dp/{asins[0]}", headers=headers)
        markup = html.unescape(page.body.decode("utf-8", errors="ignore"))
        token = re.search(r'"ajaxHeaders":\{"anti-csrftoken-a2z":"([^"]+)"\}, "name":"glow-modal"', markup)
        if not token:
            raise DeliveryError("Amazon location form not found (possibly blocked)")
        modal = session.get(
            f"{AMAZON}/portal-migration/hz/glow/get-rendered-address-selections?deviceType=desktop"
            "&pageType=Detail&storeContext=beauty&actionSource=desktop-modal",
            headers={**headers, "anti-csrftoken-a2z": token.group(1), "x-requested-with": "XMLHttpRequest"},
        ).body.decode("utf-8", errors="ignore")
        change_token = re.search(r'CSRF_TOKEN\s*:\s*"([^"]+)"', modal)
        change = session.post(
            f"{AMAZON}/portal-migration/hz/glow/address-change?actionSource=glow",
            headers={**headers, "Accept": "application/json, text/*", "Content-Type": "application/json",
                     "anti-csrftoken-a2z": change_token.group(1) if change_token else token.group(1),
                     "x-requested-with": "XMLHttpRequest", "Origin": AMAZON},
            json={"locationType": "LOCATION_INPUT", "zipCode": pincode, "deviceType": "web",
                  "storeContext": "beauty", "pageType": "Detail", "actionSource": "glow"},
        )
        result = _json(change)
        if not result.get("isValidAddress"):
            raise DeliveryError("Amazon did not accept this pincode")

        for row, asin in zip(rows, asins):
            try:
                page = session.get(f"{AMAZON}/dp/{asin}", headers=headers)
                primary = _text(page, "#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE")
                fastest = _text(page, "#mir-layout-DELIVERY_BLOCK-slot-SECONDARY_DELIVERY_MESSAGE_LARGE")
                block = _text(page, "#mir-layout-DELIVERY_BLOCK") or _text(page, "#deliveryBlockMessage")
                availability = _text(page, "#availability")
                blocked = _AMAZON_UNDELIVERABLE.search(f"{block} {availability}")
                has_date = bool(re.search(r"\b(?:today|tomorrow|\d{1,2} \w+|\w+day)\b", primary or block, re.I))
                deliverable = not blocked and has_date
                out[row["product_id"]] = {
                    "deliverable": deliverable,
                    "message": _first_sentence(primary or block) if deliverable
                    else "No delivery date offered for this pincode",
                    "detail": _first_sentence(fastest) if deliverable else "",
                }
            except Exception as exc:
                out[row["product_id"]] = exc
    return out


# --------------------------------------------------------------------------
# public entry point
# --------------------------------------------------------------------------


def _jobs(listings: list[dict], pincode: str) -> list[tuple[Callable[[], object], list[dict], bool]]:
    """(fetch, the listings it answers, whether its answer is keyed by product_id)."""
    jobs = []
    grouped: dict[tuple[str, str], list[dict]] = {}
    for row in listings:
        site = row["site"]
        if site == "tira":
            jobs.append((lambda r=row: _tira(r, pincode), [row], False))
        elif site == "purplle":
            jobs.append((lambda r=row: _purplle(r, pincode), [row], False))
        elif site == "broadway":
            grouped.setdefault(("broadway", row["product_url"].split("?")[0]), []).append(row)
        elif site in ("nykaa", "amazon"):
            grouped.setdefault((site, ""), []).append(row)  # one browser / one session each
        else:
            jobs.append((lambda s=site: (_ for _ in ()).throw(DeliveryError(f"unsupported retailer {s}")),
                         [row], False))
    runners = {"nykaa": _nykaa, "broadway": _broadway, "amazon": _amazon}
    for (site, _), rows in grouped.items():
        jobs.append((lambda f=runners[site], r=rows: f(r, pincode), rows, True))
    return jobs


def _message(exc: BaseException) -> str:
    text = str(exc) or exc.__class__.__name__
    lowered = text.lower()
    if "reset" in lowered or "curl: (35)" in lowered or "curl: (56)" in lowered:
        return "retailer dropped the connection, try again"
    if "timed out" in lowered or "timeout" in lowered:
        return "retailer took too long to respond"
    return text.split(". See ")[0][:120]


def _run(fetch, rows: list[dict], keyed: bool) -> list[DeliveryResult]:
    try:
        data = fetch()
    except Exception as exc:
        return [DeliveryResult(r["site"], r["product_id"], ok=False, error=_message(exc)) for r in rows]
    results = []
    for row in rows:
        answer = data.get(row["product_id"]) if keyed else data
        if isinstance(answer, Exception):
            results.append(DeliveryResult(row["site"], row["product_id"], ok=False, error=_message(answer)))
        elif answer is None:
            results.append(DeliveryResult(row["site"], row["product_id"], ok=False, error="no answer"))
        else:
            results.append(DeliveryResult(row["site"], row["product_id"], ok=True, **answer))
    return results


def check_delivery_iter(listings: list[dict], pincode: str):
    """Same job as check_delivery(), yielded as each retailer finishes.

    pool.map() (the old implementation) hands results back in submission
    order, so a caller printing them as they arrive was really waiting for
    the slowest retailer (Nykaa's real browser, sometimes ~2 minutes) before
    a single line came out — even though Purplle or Tira had answered in
    seconds. as_completed() yields whichever job's future resolves first.
    """
    pincode = str(pincode).strip()
    if not valid_pincode(pincode):
        raise ValueError("A pincode is 6 digits and does not start with 0.")
    jobs = _jobs(listings, pincode)
    with ThreadPoolExecutor(max_workers=max(1, len(jobs))) as pool:
        futures = [pool.submit(_run, *job) for job in jobs]
        for future in as_completed(futures):
            yield from future.result()


def check_delivery(listings: list[dict], pincode: str) -> dict[tuple[str, str], DeliveryResult]:
    """Check delivery to `pincode` for every listing, retailers in parallel.

    Each listing needs `site`, `product_id` and `product_url`; Nykaa also
    needs `sku`, Broadway uses `gtin` as a fallback barcode. Returns
    {(site, product_id): DeliveryResult}. Raises ValueError only for a
    malformed pincode.
    """
    results: dict[tuple[str, str], DeliveryResult] = {}
    for result in check_delivery_iter(listings, pincode):
        results[(result.site, result.product_id)] = result
    return results


# --------------------------------------------------------------------------
# Nykaa fast-path
# --------------------------------------------------------------------------
# Keep Nykaa delivery lookup bounded. Do not use synthetic activity or
# repeated requests to work around retailer bot protection. A 403 is treated
# as a temporary unavailable result so the other retailers can still return.

def _nykaa_edd_in_browser(url: str, pincode: str, skus: list[str]) -> list:
    """Run Nykaa's delivery call with a strict, bounded browser request."""
    answer: list = []

    def action(page):
        answer[:] = page.evaluate(_NYKAA_EDD, [skus, pincode])

    StealthyFetcher.fetch(
        url,
        headless=True,
        page_action=action,
        network_idle=False,
        timeout=NYKAA_TIMEOUT * 1000,
        # Scrapling defaults to 3 retries, each re-paying the full navigation
        # timeout — a single blocked/slow call was observed taking anywhere
        # from 17s to 113s depending on how many silent retries it took.
        # One retry is enough margin for a merely-slow load; it is not an
        # attempt to out-wait Akamai's blocking.
        retries=1,
        retry_delay=1,
    )
    return answer


def _serialize(result: DeliveryResult) -> dict:
    return {
        "id": result.product_id,
        "site": result.site,
        "ok": result.ok,
        "deliverable": result.deliverable,
        "message": result.message,
        "detail": result.detail,
        "error": result.error,
    }


def _stream(rows: list[dict], pincode: str) -> None:
    """stdin batch mode for the Node bridge: one NDJSON line per row, printed
    as each retailer finishes rather than only once the slowest one does."""
    for result in check_delivery_iter(rows, pincode):
        print(json.dumps(_serialize(result)), flush=True)


if __name__ == "__main__":
    if sys.argv[1:2] == ["--nykaa-edd"]:
        url, pin, *skus = sys.argv[2:]
        print(json.dumps(_nykaa_edd_in_browser(url, pin, skus)))
        sys.exit(0)

    if sys.argv[1:2] == ["--stream"]:
        payload = json.loads(sys.stdin.read(100000))
        try:
            _stream(payload["rows"], payload["pincode"])
        except ValueError as exc:
            print(json.dumps({"error": str(exc)}), flush=True)
            sys.exit(1)
        sys.exit(0)

    pin, site, pid, url, *rest = sys.argv[1:]
    row = {"site": site, "product_id": pid, "product_url": url, "sku": rest[0] if rest else ""}
    for key, value in check_delivery([row], pin).items():
        print(key, value)
