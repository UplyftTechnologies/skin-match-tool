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

  const { productUrl, fallbackUrls, restricted, profile } = body || {};
  // The scored dataset is a snapshot scrape that does not cover every live
  // listing — Nykaa is well covered, but Purplle/Amazon/Kindlife/Broadway and
  // part of Tira are not. `fallbackUrls` carries sibling listings for the same
  // physical product (GTIN-matched, from the compare-prices panel): same
  // ingredients, same score, so the first one the dataset does recognise is
  // used rather than leaving the shopper with no score at all.
  const candidates = [productUrl, ...(Array.isArray(fallbackUrls) ? fallbackUrls : [])].filter(Boolean);
  if (!candidates.length || !profile?.skinType) {
    return NextResponse.json({ scoring: null });
  }

  const restrictedIds = Array.isArray(restricted) ? restricted : [];
  const rows = candidates.map((url) => ({ product_url: url, restricted: restrictedIds }));
  const scored = attachScores(rows, profile, rows);
  const match = scored.find((row) => row.scoring);

  return NextResponse.json({ scoring: match?.scoring || null });
}
