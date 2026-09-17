import { spawn } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
import { readPriceStream } from "./price-stream.js";

function normalizeResult(row, result) {
  const data = result?.data;
  if (result?.ok && data?.selling_price === null && data.in_stock === false) {
    return { id: row.id, site: row.site, ok: true, data: { selling_price: null, mrp: null, discount: null, in_stock: false } };
  }
  if (!result?.ok || !data || typeof data.selling_price !== "number" || !Number.isFinite(data.selling_price) || data.selling_price <= 0) {
    return { id: row.id, site: row.site, ok: false, reason: result?.reason || "invalid_price" };
  }
  return { id: row.id, site: row.site, ok: true, data: {
    selling_price: data.selling_price,
    mrp: Number.isFinite(data.mrp) && data.mrp >= data.selling_price ? data.mrp : null,
    discount: Number.isFinite(data.discount) && data.discount >= 0 && data.discount <= 100 ? data.discount : null,
    in_stock: typeof data.in_stock === "boolean" ? data.in_stock : null,
  } };
}

const standbyKey = Symbol.for("roopsee.priceScraperStandby");

function startScraperProcess() {
  const localPython = path.join(process.cwd(), ".venv-price-scraper", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  const executable = process.env.PRICE_SCRAPER_PYTHON || (existsSync(localPython) ? localPython : "python");
  const child = spawn(executable, [path.join(process.cwd(), "scripts/price_scraper.py"), "--stream"], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  child.stderrTail = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", chunk => { child.stderrTail = (child.stderrTail + chunk).slice(-2000); });
  child.stdin.on("error", () => {});
  // Remembered so a standby that failed while idle is never handed out.
  child.on("error", error => { child.startError = error; });
  return child;
}

// Python start-up plus the Scrapling import costs ~0.5s, so one process is
// started ahead for the next click. It waits on stdin and exits when this
// server does. Nothing is spawned until the first refresh.
function takeScraperProcess() {
  const standby = globalThis[standbyKey];
  const ready = standby && !standby.startError && standby.exitCode === null && standby.signalCode === null;
  globalThis[standbyKey] = startScraperProcess();
  return ready ? standby : startScraperProcess();
}

export async function scrapePrices(rows, onResult) {
  const results = new Map();
  const receive = result => {
    const row = rows.find(row => String(row.id) === String(result.id));
    if (!row || results.has(String(row.id))) return;
    const normalized = normalizeResult(row, result);
    results.set(String(row.id), normalized);
    onResult?.(normalized);
  };
  if (process.env.PRICE_SCRAPER_URL) {
    const response = await fetch(process.env.PRICE_SCRAPER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson", Authorization: `Bearer ${process.env.PRICE_SCRAPER_TOKEN || ""}` },
      body: JSON.stringify({ rows }), signal: AbortSignal.timeout(45000), cache: "no-store",
    });
    if (!response.ok) throw new Error(`Scraper service returned ${response.status}`);
    if (response.headers?.get("content-type")?.includes("application/x-ndjson")) {
      await readPriceStream(response.body, receive);
    } else {
      // Backward compatible with a separately deployed, older Python service.
      const payload = await response.json();
      if (!Array.isArray(payload.results)) throw new Error("Invalid scraper response");
      payload.results.forEach(receive);
    }
  } else {
    await new Promise((resolve, reject) => {
      const child = takeScraperProcess();
      let buffer = "";
      let bytes = 0;
      const timer = setTimeout(() => { child.kill(); reject(new Error("Scraper timeout")); }, 45000);
      child.stdout.on("data", chunk => {
        try {
          bytes += chunk.length;
          if (bytes > 100000) throw new Error("Scraper output too large");
          buffer += chunk;
          let newline;
          while ((newline = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            if (line) receive(JSON.parse(line));
          }
        } catch (error) { child.kill(); reject(error); }
      });
      child.on("error", error => { clearTimeout(timer); reject(error); });
      child.on("close", code => {
        clearTimeout(timer);
        if (code !== 0) {
          console.error("[price-refresh] Python scraper exited with", code, child.stderrTail.trim());
          return reject(new Error("Python scraper failed; check dependencies"));
        }
        try {
          if (buffer.trim()) receive(JSON.parse(buffer));
          resolve();
        } catch { reject(new Error("Invalid scraper response")); }
      });
      child.stdin.end(JSON.stringify({ rows }));
    });
  }
  for (const row of rows) {
    if (!results.has(String(row.id))) receive({ id: row.id, ok: false, reason: "missing_result" });
  }
  return rows.map(row => results.get(String(row.id)));
}
