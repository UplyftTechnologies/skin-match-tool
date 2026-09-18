import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { findComparableProducts } from "@/lib/retailer-product-match";
import { checkDelivery } from "@/lib/delivery-check";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

const PINCODE = /^[1-9]\d{5}$/;

function toCheckRow(row) {
  return {
    site: row.site,
    product_id: String(row.id),
    product_url: row.product_url,
    sku: row.sku || "",
    gtin: row.gtin || "",
  };
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const id = body?.id;
  const pincode = String(body?.pincode || "").trim();

  if (!/^[1-9]\d*$/.test(String(id ?? ""))) {
    return NextResponse.json({ error: "A valid product id is required." }, { status: 400 });
  }
  if (!PINCODE.test(pincode)) {
    return NextResponse.json({ error: "Enter a valid 6-digit pincode." }, { status: 400 });
  }

  try {
    // Server-derived, same as /rescrape — the client sends only an id and a
    // pincode, never retailer URLs/SKUs, so a request can't be pointed at an
    // arbitrary listing.
    const { data: product, error } = await supabaseAdmin
      .from("retailer_products").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    const comparable = await findComparableProducts(product);
    const rows = [product, ...comparable.filter((row) => row.site !== product.site)].map(toCheckRow);

    if (request.headers.get("accept")?.includes("application/x-ndjson")) {
      const encoder = new TextEncoder();
      let cancelled = false;
      const stream = new ReadableStream({
        async start(controller) {
          const send = (event) => { if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")); };
          send({ type: "start", attempted: rows.length, pincode });
          try {
            const results = await checkDelivery(rows, pincode, (result) => send({ type: "result", result }));
            send({ type: "complete", attempted: results.length, succeeded: results.filter((result) => result.ok).length });
          } catch (deliveryError) {
            console.error("[delivery-check]", deliveryError.message);
            send({ type: "error", error: "Delivery check was interrupted." });
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

    const results = await checkDelivery(rows, pincode);
    return NextResponse.json({
      pincode, attempted: results.length, succeeded: results.filter((result) => result.ok).length, results,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[delivery-check]", error.message);
    return NextResponse.json({ error: "Delivery check is unavailable right now." }, { status: 503 });
  }
}
