import { NextResponse } from "next/server";
import { anthropic, hasAnthropicKey } from "@/lib/anthropic";
import { loadRetailerCatalog } from "@/lib/retailer-catalog";
import { rankCatalogMatches, rankCatalogMatchesFromText } from "@/lib/visual-match";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// The catalog is small enough (~400 products, ~65 brands) to hand Claude the
// full brand list. Constraining the brand to something we actually stock is
// what turns a free-text guess into a value the matcher below can use — brand
// is the one attribute every downstream rule keys on.
function brandVocabulary(products) {
  return [...new Set(products.map((item) => item.brand_name).filter(Boolean))].sort();
}

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    is_product: {
      type: "boolean",
      description: "True only if the photo shows a skincare or beauty product package.",
    },
    brand: {
      type: "string",
      description:
        "Brand exactly as written in the supplied brand list, or as read off the package if it is not in that list. Empty string if unreadable.",
    },
    product_name: {
      type: "string",
      description: "Product name as printed on the package, without the brand. Empty string if unreadable.",
    },
    product_type: {
      type: "string",
      description: "Product form, such as serum, sunscreen, moisturiser, face wash, toner or mask.",
    },
    strength: {
      type: "string",
      description: "Any active concentration printed on the pack, such as 10% or 0.3%. Empty string if none.",
    },
    size: {
      type: "string",
      description: "Net quantity printed on the pack, such as 30ml or 50 g. Empty string if none.",
    },
    visible_text: {
      type: "string",
      description: "Other prominent identifying text on the package, such as an SPF rating or key actives.",
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description: "How confident you are that brand and product_name were read correctly.",
    },
  },
  required: [
    "is_product",
    "brand",
    "product_name",
    "product_type",
    "strength",
    "size",
    "visible_text",
    "confidence",
  ],
  additionalProperties: false,
};

function systemPrompt(brands) {
  return [
    "You identify skincare and beauty products from a photograph of the packaging.",
    "Read the text printed on the package. Do not guess a product you cannot actually read.",
    "If the photo is blurry, shows a person, or shows something that is not a beauty product, set is_product to false.",
    "",
    "These are the brands the catalogue stocks. If the package is one of them, return the brand string exactly as written here:",
    brands.join(" | "),
    "",
    "If the brand on the package is genuinely not in that list, return what is printed on the package instead.",
  ].join("\n");
}

// Lets the client pick its path before it uploads anything: with a key we send
// the photo to Claude, without one the browser does the reading itself.
export async function GET() {
  return NextResponse.json({ mode: hasAnthropicKey ? "vision" : "ocr" });
}

function offerResults(matches, extracted, query, extra = {}) {
  return NextResponse.json({
    matched: matches.length > 0,
    extracted,
    query,
    ...extra,
    matches: matches.map(({ product, score }) => ({
      product_uid: product.product_uid,
      product_name: product.product_name,
      brand_name: product.brand_name,
      category: product.category,
      product_type: product.product_type,
      image: product.image,
      score: Number(score.toFixed(3)),
    })),
  });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Text arrives already read by Tesseract in the shopper's browser. No key,
  // no upload, no per-search cost — the same matcher does the rest.
  const scannedText = String(body?.text || "").slice(0, 4000).trim();
  if (scannedText) {
    const products = await loadRetailerCatalog();
    const { brand, matches, confident } = rankCatalogMatchesFromText(products, scannedText);
    const extracted = { brand, product_name: "", scanned_text: scannedText };

    if (!matches.length) {
      return offerResults([], extracted, brand || "", {
        reason: brand ? "no_catalog_match" : "no_brand_read",
        message: brand
          ? "We read the brand but could not pin down which product. Try a closer photo of the front label."
          : "We read some text but could not identify the product. Try a straighter, closer photo of the front label.",
      });
    }
    // Brand-less matches rest on product words alone, so the UI says so rather
    // than presenting a guess with the same certainty as a brand-confirmed hit.
    return offerResults(matches, extracted, brand || "", { confident });
  }

  if (!hasAnthropicKey) {
    return NextResponse.json(
      { error: "Visual search is not configured on this environment." },
      { status: 503 },
    );
  }

  const image = String(body?.image || "");
  const parsed = image.match(/^data:([^;]+);base64,(.+)$/);
  if (!parsed) {
    return NextResponse.json({ error: "Send the photo as a base64 data URL." }, { status: 400 });
  }

  const [, mediaType, base64] = parsed;
  if (!ALLOWED_MEDIA.has(mediaType)) {
    return NextResponse.json({ error: "Use a JPEG, PNG or WebP photo." }, { status: 400 });
  }
  if (Buffer.byteLength(base64, "base64") > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "That photo is too large." }, { status: 413 });
  }

  const products = await loadRetailerCatalog();

  let extracted;
  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 2048,
      system: systemPrompt(brandVocabulary(products)),
      // Reading a label is a simple extraction and the shopper is waiting on
      // the result, so trade depth for latency rather than turning thinking off.
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: EXTRACTION_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "Identify this product from its packaging." },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "That photo could not be processed. Try another one." },
        { status: 422 },
      );
    }

    extracted = response.parsed_output;
    if (!extracted) {
      const text = response.content.find((block) => block.type === "text")?.text || "";
      extracted = JSON.parse(text);
    }
  } catch (error) {
    console.error("Visual search extraction failed:", error?.message || error);
    return NextResponse.json(
      { error: "Could not read that photo right now. Please try again." },
      { status: 502 },
    );
  }

  if (!extracted?.is_product) {
    return NextResponse.json({
      matched: false,
      reason: "not_a_product",
      message: "That does not look like a product label. Try a clear photo of the packaging.",
      extracted,
      matches: [],
      query: "",
    });
  }

  const scored = rankCatalogMatches(products, extracted);

  // Even with no catalog hit the shopper gets something useful: the text read
  // off the pack drops straight into the existing keyword filter.
  const query = [extracted.brand, extracted.product_name].filter(Boolean).join(" ").trim();

  return offerResults(scored, extracted, query, {
    reason: scored.length ? undefined : "no_catalog_match",
  });
}
