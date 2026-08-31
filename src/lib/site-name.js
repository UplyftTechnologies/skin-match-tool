// Plain lookup, no React/browser dependency — kept out of retailer-logo.js
// (a 'use client' module for its Image/useState logo rendering) so Server
// Components can call it directly. Next.js does not allow a Server Component
// to invoke a plain function exported from a client module, only render its
// components.
const SITE_NAMES = {
  nykaa: "Nykaa",
  tira: "Tira",
  amazon: "Amazon",
  roopsee: "Roopsee",
  purplle: "Purplle",
  broadway: "Broadway",
  kindlife: "Kindlife",
};

export function siteName(site) {
  return SITE_NAMES[site] || site;
}
