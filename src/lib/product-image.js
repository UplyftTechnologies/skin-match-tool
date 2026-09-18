// Some retailers (e.g. Tira) mix shade-swatch thumbnails into the same
// image field/array as real product photos, distinguishable only by a
// "_Swatch" suffix on the filename.
const NON_PRODUCT_IMAGE_PATTERN = /_swatch\.[a-z0-9]+(?:[?#].*)?$/i;

export function isNonProductImageUrl(url) {
  return NON_PRODUCT_IMAGE_PATTERN.test(String(url || ""));
}
