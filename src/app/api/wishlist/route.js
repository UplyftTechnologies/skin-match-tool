import { supabaseAdmin, supabaseAuth } from "@/lib/supabase/server";
import { findWishlistProduct } from "@/lib/wishlist-products";

export const runtime = "nodejs";

async function authenticatedUser(request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;

  const token = authorization.slice(7).trim();
  if (!token) return null;

  const { data, error } = await supabaseAuth.auth.getUser(token);
  return error ? null : data.user;
}

function cleanProductUid(value) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const uid = String(value).trim();
  return uid.length <= 200 ? uid : "";
}

export async function GET(request) {
  const user = await authenticatedUser(request);
  if (!user) {
    return Response.json({ error: "Authentication is required" }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("wishlist")
      .select("product_uid")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const products = (await Promise.all(
      (data || []).map((row) => findWishlistProduct(String(row.product_uid))),
    )).filter(Boolean);

    return Response.json({ ok: true, products }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/wishlist] Fetch failed:", error);
    return Response.json(
      { error: "Unable to fetch wishlist", code: error?.code || "WISHLIST_FETCH_FAILED" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const user = await authenticatedUser(request);
  if (!user) {
    return Response.json({ error: "Authentication is required" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const productUid = cleanProductUid(body?.productUid);
  if (!productUid) {
    return Response.json({ error: "A valid productUid is required" }, { status: 400 });
  }

  try {
    const product = await findWishlistProduct(productUid);
    if (!product) return Response.json({ error: "Product not found" }, { status: 404 });
    const { error } = await supabaseAdmin
      .from("wishlist")
      .upsert(
        { user_id: user.id, product_uid: productUid },
        { onConflict: "user_id,product_uid", ignoreDuplicates: true },
      );

    if (error) throw error;

    return Response.json({ ok: true, product }, { status: 201 });
  } catch (error) {
    console.error("[api/wishlist] Add failed:", error);
    return Response.json(
      { error: "Unable to add product to wishlist", code: error?.code || "WISHLIST_ADD_FAILED" },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  const user = await authenticatedUser(request);
  if (!user) {
    return Response.json({ error: "Authentication is required" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const productUid = cleanProductUid(body?.productUid);
  if (!productUid) {
    return Response.json({ error: "A valid productUid is required" }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from("wishlist")
      .delete()
      .eq("user_id", user.id)
      .eq("product_uid", productUid);

    if (error) throw error;

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[api/wishlist] Remove failed:", error);
    return Response.json(
      { error: "Unable to remove product from wishlist", code: error?.code || "WISHLIST_REMOVE_FAILED" },
      { status: 500 },
    );
  }
}
