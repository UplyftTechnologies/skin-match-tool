import { supabaseAdmin } from "@/lib/supabase/server";
import { findProduct } from "@/lib/data";
import { isNonProductImageUrl } from "@/lib/product-image";

const FIELDS = "id,product_name,brand,image_url,mrp,selling_price,variant,categories,in_stock,product_url";

function retailerProduct(row, uid = String(row.id)) {
  return {
    product_uid: uid,
    retailer_product_id: String(row.id),
    product_name: row.product_name,
    brand_name: row.brand,
    image: isNonProductImageUrl(row.image_url) ? "" : row.image_url || "",
    mrp: row.mrp,
    selling_price: row.selling_price,
    size: row.variant,
    category: row.categories?.[0] || "Skincare",
    product_type: "Product",
    in_stock: row.in_stock,
    details_url: `/retailer-products/${row.id}`,
  };
}

// Keep the saved UID so old wishlist rows can still be removed. The retailer
// ID is also returned so a saved heart stays selected on its detail page.
export async function findWishlistProduct(uid) {
  if (/^\d+$/.test(uid)) {
    const { data, error } = await supabaseAdmin.from("retailer_products")
      .select(FIELDS).eq("id", uid).maybeSingle();
    if (error) throw error;
    return data ? retailerProduct(data) : null;
  }
  const legacy = await findProduct(uid);
  if (!legacy) return null;
  const { data, error } = await supabaseAdmin.from("retailer_products")
    .select(FIELDS).eq("product_name", legacy.product_name).eq("brand", legacy.brand_name)
    .eq("is_active", true).order("in_stock", { ascending: false }).order("id").limit(1).maybeSingle();
  if (error) throw error;
  return data ? retailerProduct(data, uid) : {
    ...legacy, selling_price: legacy.selling_price || legacy.sp,
    details_url: `/products/${encodeURIComponent(uid)}`,
  };
}
