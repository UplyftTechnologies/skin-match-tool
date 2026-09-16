"""Optional service for Next.js hosts that cannot execute Python."""
import hmac
import os
import json
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from price_scraper import scrape, scrape_iter, validate_rows

app = FastAPI()


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
