export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://matchmyskin.roopsee.com"
).replace(/\/$/, "");

export const SITE_NAME = "Match My Skin";

export function absoluteUrl(pathname = "/") {
  return new URL(pathname, `${SITE_URL}/`).toString();
}

export function productPath(productUid) {
  return `/products/${encodeURIComponent(productUid)}`;
}

export function scoredProductPath(productUid, score) {
  const pathname = productPath(productUid);
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return pathname;
  return `${pathname}?score=${encodeURIComponent(String(numericScore))}`;
}
