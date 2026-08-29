import { NextResponse } from "next/server";
import { attachScores } from "@/lib/scoring/catalog-scores";

export const dynamic = "force-dynamic";

// Scores one exact retailer listing against the shopper's quiz profile.
//
// /api/retailer-products/catalog scores one card per cross-retailer product
// family (the "primary" listing), which is the right unit for a browsable
// grid but the wrong one here: the listing a shopper is actually looking at
// is not always the primary, so scoring the family card would sometimes
// silently score a different URL than the one on screen. attachScores keys
// on `product_url` alone, so handing it exactly this listing's own row
// scores the exact thing being viewed.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { productUrl, restricted, profile } = body || {};
  if (!productUrl || !profile?.skinType) {
    return NextResponse.json({ scoring: null });
  }

  const row = { product_url: productUrl, restricted: Array.isArray(restricted) ? restricted : [] };
  const [scored] = attachScores([row], profile, [row]);

  return NextResponse.json({ scoring: scored?.scoring || null });
}
