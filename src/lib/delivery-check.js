import { spawn } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
import { readPriceStream } from "./price-stream.js";

// Nykaa's own worst case is now ~50s (see NYKAA_TIMEOUT in delivery_check.py);
// this leaves headroom for that plus the other retailers running alongside it.
const TIMEOUT_MS = 70000;

function pythonExecutable() {
  const local = path.join(process.cwd(), ".venv-price-scraper", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  return process.env.PRICE_SCRAPER_PYTHON || (existsSync(local) ? local : "python");
}

function runLocally(rows, pincode, receive) {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonExecutable(), [path.join(process.cwd(), "scripts/delivery_check.py"), "--stream"], {
      windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
    });
    let buffer = "";
    let stderrTail = "";
    let topLevelError = "";
    let sawResult = false;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", chunk => { stderrTail = (stderrTail + chunk).slice(-2000); });

    const timer = setTimeout(() => {
      // A retailer's browser check (Nykaa) can hang past TIMEOUT_MS without
      // ever erroring out — killing the process and rejecting the whole
      // batch would also discard retailers that already reported back
      // (logged here since that's otherwise silently lost). Resolving
      // instead lets checkDelivery()'s existing "no answer" fallback mark
      // only the stuck row(s) as failed.
      console.error(
        "[delivery-check] Local subprocess timed out after", TIMEOUT_MS, "ms —",
        sawResult ? "some retailers already reported back." : "no retailer reported back yet.",
        stderrTail.trim() ? `stderr: ${stderrTail.trim()}` : "",
      );
      child.kill();
      resolve();
    }, TIMEOUT_MS);

    child.stdout.on("data", chunk => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.id != null) { sawResult = true; receive(parsed); }
          else if (parsed.error) topLevelError = parsed.error;
        } catch { /* ignore a malformed line */ }
      }
    });
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", code => {
      clearTimeout(timer);
      if (code !== 0 && !sawResult) {
        console.error("[delivery-check] Python exited with", code, stderrTail.trim());
        return reject(new Error(topLevelError || "Delivery check failed; check dependencies"));
      }
      resolve();
    });
    child.stdin.end(JSON.stringify({ rows, pincode }));
  });
}

async function runRemotely(rows, pincode, receive) {
  const response = await fetch(process.env.DELIVERY_CHECK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson",
      Authorization: `Bearer ${process.env.DELIVERY_CHECK_TOKEN || ""}`,
    },
    body: JSON.stringify({ rows, pincode }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Delivery check service returned ${response.status}`);
  if (response.headers?.get("content-type")?.includes("application/x-ndjson")) {
    await readPriceStream(response.body, receive);
  } else {
    const payload = await response.json();
    if (!Array.isArray(payload.results)) throw new Error("Invalid delivery check response");
    payload.results.forEach(receive);
  }
}

// Each row needs `site`, `product_id` and `product_url`; Nykaa also needs
// `sku`, Broadway falls back to `gtin`. Mirrors scrapePrices() in
// price-scraper.js — same local-subprocess/remote-service split and the same
// incremental-callback shape, since this runs the same Python/Scrapling
// stack against the same set of retailers, just for delivery instead of price.
export async function checkDelivery(rows, pincode, onResult) {
  const results = new Map();
  const receive = (result) => {
    if (result?.id == null) return;
    results.set(String(result.id), result);
    onResult?.(result);
  };

  if (process.env.DELIVERY_CHECK_URL) {
    await runRemotely(rows, pincode, receive);
  } else {
    await runLocally(rows, pincode, receive);
  }

  for (const row of rows) {
    if (!results.has(String(row.product_id))) {
      receive({ id: row.product_id, site: row.site, ok: false, error: "This retailer did not respond in time" });
    }
  }
  return rows.map((row) => results.get(String(row.product_id)));
}
