"""Optional service for Next.js hosts that cannot execute Python."""
import hmac
import os
import json
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from price_scraper import scrape, scrape_iter, validate_rows
from delivery_check import DeliveryError, check_delivery_iter, valid_pincode

app = FastAPI()


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/refresh")
async def refresh(body: dict, authorization: str = Header(default=""), accept: str = Header(default="")):
    token = os.environ.get("PRICE_SCRAPER_TOKEN")
    if not token or not hmac.compare_digest(authorization, f"Bearer {token}"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        validate_rows(body.get('rows'))
        if 'application/x-ndjson' in accept:
            async def events():
                async for result in scrape_iter(body['rows']):
                    yield json.dumps(result, allow_nan=False) + '\n'
            return StreamingResponse(events(), media_type='application/x-ndjson')
        return await scrape(body.get("rows"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid rows") from None


# check_delivery_iter() itself runs its retailer jobs on a thread pool (see
# delivery_check.py), so this stays a plain sync generator rather than async —
# FastAPI runs a sync StreamingResponse generator in its own worker thread.
def _serialize_delivery(result) -> dict:
    return {
        "id": result.product_id, "site": result.site, "ok": result.ok,
        "deliverable": result.deliverable, "message": result.message,
        "detail": result.detail, "error": result.error,
    }


@app.post("/delivery-check")
def delivery_check_endpoint(body: dict, authorization: str = Header(default=""), accept: str = Header(default="")):
    token = os.environ.get("DELIVERY_CHECK_TOKEN") or os.environ.get("PRICE_SCRAPER_TOKEN")
    if not token or not hmac.compare_digest(authorization, f"Bearer {token}"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    rows = body.get("rows")
    pincode = str(body.get("pincode") or "")
    if not isinstance(rows, list) or not rows or not valid_pincode(pincode):
        raise HTTPException(status_code=400, detail="Invalid rows or pincode")

    def events():
        try:
            for result in check_delivery_iter(rows, pincode):
                yield json.dumps(_serialize_delivery(result)) + '\n'
        except (ValueError, DeliveryError) as exc:
            yield json.dumps({"error": str(exc)}) + '\n'

    if 'application/x-ndjson' in accept:
        return StreamingResponse(events(), media_type='application/x-ndjson')
    results = []
    for line in events():
        parsed = json.loads(line)
        if "error" in parsed and "id" not in parsed:
            raise HTTPException(status_code=400, detail=parsed["error"])
        results.append(parsed)
    return {"results": results}
