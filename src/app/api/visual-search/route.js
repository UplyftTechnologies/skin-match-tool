import { NextResponse } from "next/server";
import { anthropic, hasAnthropicKey } from "@/lib/anthropic";
import { loadRetailerCatalog } from "@/lib/retailer-catalog";
import { rankCatalogMatches, rankCatalogMatchesFromText } from "@/lib/visual-match";
import { variantBaseKey } from "@/lib/variant-sizes";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
// Product-label extraction is a short vision task. Haiku is Anthropic's
// fastest vision-capable current model; deployments can still override this
// without a code change if they need to trade latency for more reasoning.
const VISUAL_MODEL = process.env.ANTHROPIC_VISUAL_MODEL || "claude-haiku-4-5";

// The catalog is small enough (~400 products, ~65 brands) to hand Claude the
// full brand list. Constraining the brand to something we actually stock is
// what turns a free-text guess into a value the matcher below can use — brand
// is the one attribute every downstream rule keys on.
function brandVocabulary(products) {
  return [...new Set(products.map((item) => item.brand_name).filter(Boolean))].sort();
}

// Every field the model has to write costs latency. `confidence` was read by
// nothing, and `is_product` is recoverable from an empty brand and name, so
// both are gone; `visible_text` stays because the matcher scores on it.
const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    brand: {
      type: "string",
      description:
        "Brand exactly as written in the supplied brand list, or as read off the package if it is not in that list. Empty string if unreadable, or if this is not a beauty product.",
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
  },
  required: ["brand", "product_name", "product_type", "strength", "size", "visible_text"],
  additionalProperties: false,
};

let promptCache = null;

/** The system prompt for this catalogue, built once and reused. */
function cachedSystemPrompt(products) {
  if (promptCache?.source === products) return promptCache.value;
  const value = systemPrompt(brandVocabulary(products));
  promptCache = { source: products, value };
  return value;
}

function systemPrompt(brands) {
  return [
    "You identify skincare and beauty products from a photograph of the packaging.",
    "Read the text printed on the package. Do not guess a product you cannot actually read.",
    "A partial read is still useful. If the brand is legible but the product name is not, return the brand and leave product_name empty.",
    "If neither is legible, put whatever words, numbers or claims you can make out into visible_text: a size, an SPF rating, an active, even a fragment of a word.",
    "Return every field empty only when the photo shows no product packaging at all, such as a face, a landscape or a blank surface.",
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

/**
 * Collapses repeat listings of the same product out of a result list.
 *
 * Keyed on brand plus the size-stripped name, the same identity the
 * catalogue groups sizes by — two rows differing only by a size, a brand's
 * capitalisation or a missing barcode are one product to a shopper. The
 * highest-scoring listing of each wins, so the ordering is unchanged apart
 * from the repeats being removed.
 */
function dedupeMatches(matches) {
  const seen = new Map();
  for (const entry of matches) {
    const key =
      variantBaseKey(entry.product) ||
      `uid:${entry.product.product_uid}`;
    const current = seen.get(key);
    if (!current || entry.score > current.score) seen.set(key, entry);
  }
  // rankCatalogMatches already sorted; re-sort because Map keeps insertion
  // order and a later, higher-scoring listing can replace an earlier one.
  return [...seen.values()].sort((left, right) => right.score - left.score);
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
    const { brand, matches: rawMatches, confident } = rankCatalogMatchesFromText(products, scannedText);
    const matches = dedupeMatches(rawMatches);
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
      model: VISUAL_MODEL,
      // The JSON extraction response is tiny. A small cap lets the API finish
      // promptly and prevents verbose output from delaying the result.
      max_tokens: 512,
      // cache_control marks the brand list as a stable prefix: it is the same
      // on every request, so after the first it is served from cache instead
      // of re-read, which is most of the time-to-first-token here.
      system: [
        {
          type: "text",
          text: cachedSystemPrompt(products),
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: {
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

  // Only a read with nothing at all in it means there was no product to see.
  // Treating an empty brand+name as 'not a product' threw away photos where
  // the brand was legible but the product name was not, which is the common
  // case for a jar photographed at an angle.
  const readAnything = [
    extracted?.brand,
    extracted?.product_name,
    extracted?.product_type,
    extracted?.visible_text,
  ].some((value) => String(value || "").trim());

  if (!readAnything) {
    return NextResponse.json({
      matched: false,
      reason: "not_a_product",
      message: "That does not look like a product label. Try a clear photo of the packaging.",
      extracted,
      matches: [],
      query: "",
    });
  }

  // rankCatalogMatches needs a brand to anchor on. When the brand did not
  // survive the photo, fall back to the brand-free text matcher built for the
  // OCR path: it ranks on how much distinctive product wording was read, so a
  // half-legible pack still returns the nearest products instead of nothing.
  let scored = dedupeMatches(rankCatalogMatches(products, extracted));
  let confident = scored.length > 0;

  if (!scored.length) {
    const readText = [
      extracted.brand,
      extracted.product_name,
      extracted.product_type,
      extracted.visible_text,
    ]
      .filter(Boolean)
      .join(" ");
    const fallback = rankCatalogMatchesFromText(products, readText);
    scored = dedupeMatches(fallback.matches);
    confident = false;
  }

  // Even with no catalog hit the shopper gets something useful: the text read
  // off the pack drops straight into the existing keyword filter.
  const query = [extracted.brand, extracted.product_name].filter(Boolean).join(" ").trim();

  return offerResults(scored, extracted, query, {
    // `confident` is false when the brand did not survive the photo and these
    // came from the text fallback. The dialog already renders a caveat for
    // that, so the shopper is told these are nearest guesses.
    confident,
    reason: scored.length
      ? undefined
      : extracted.brand
        ? "no_catalog_match"
        : "no_brand_read",
    message: scored.length
      ? undefined
      : extracted.brand
        ? "We read the brand but could not pin down which product. Try a closer photo of the front label."
        : "We could not read enough of that pack to find it. Try a straighter, closer photo of the front label.",
  });
}
