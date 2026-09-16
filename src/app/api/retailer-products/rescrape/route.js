import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { findComparableProducts } from "@/lib/retailer-product-match";
import { scrapePrices } from "@/lib/price-scraper";
import { recalledPriceListings, rememberPriceListings } from "@/lib/price-refresh-listings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  const body = await request.json().catch(() => null);
  // This catalogue identifies products by retailer row ID, not a canonical ID.
  const id = body?.id;
  if (!/^[1-9]\d*$/.test(String(id ?? ""))) {
    return NextResponse.json({ error: "A valid product id is required." }, { status: 400 });
  }
  try {
    let rows = recalledPriceListings(id);
    if (!rows) {
      const { data: product, error } = await supabaseAdmin
        .from("retailer_products").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
      // Matching also needs name, variant, MRP and categories.
      const comparable = await findComparableProducts(product);
      rows = rememberPriceListings(product, comparable);
    }
    if (request.headers.get("accept")?.includes("application/x-ndjson")) {
      const encoder = new TextEncoder();
      let cancelled = false;
      const stream = new ReadableStream({
        async start(controller) {
          const send = event => { if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")); };
          send({ type: "start", attempted: rows.length });
          try {
            const results = await scrapePrices(rows, result => send({ type: "result", result }));
            send({ type: "complete", attempted: results.length, succeeded: results.filter(result => result.ok).length });
          } catch (error) {
            console.error("[price-refresh]", error.message);
            send({ type: "error", error: "Price refresh was interrupted." });
          } finally {
            if (!cancelled) controller.close();
          }
        },
        cancel() { cancelled = true; },
      });
      return new Response(stream, { headers: {
        "Content-Type": "application/x-ndjson", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no",
      } });
    }
    const results = await scrapePrices(rows);
    return NextResponse.json({
      attempted: results.length, succeeded: results.filter(result => result.ok).length, results,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[price-refresh]", error.message);
    return NextResponse.json({ error: "Price refresh is unavailable. Your previous prices have been kept." }, { status: 503 });
  }
}

