export function concernAreaFor(profile = {}) {
  if (profile.concernArea === 'face' || profile.concernArea === 'body') return profile.concernArea;
  const concerns = [profile.concern, ...(profile.concerns || []), ...(profile.selectedFaceBodyConcerns || [])];
  return concerns.some(value => String(value).toLowerCase() === 'body acne') ? 'body' : 'face';
}

export function productConcernArea(product) {
  // Some SPF body lotions are incorrectly tagged "Face & Body" in the score
  // snapshot. Explicit usage in the name takes priority over that broad tag.
  const name = String(product.product_name || product.name || '').toLowerCase()
    .replace(/\b(?:the\s+)?body shop\b/g, '');
  if (/\b(?:face\s*(?:&|and|\/|,)\s*body|body\s*(?:&|and|\/|,)\s*face)\b/.test(name)) return 'both';
  if (/\bbody\b|\bhand (?:cream|lotion|wash)\b|\bfoot (?:cream|lotion|scrub)\b/.test(name)) return 'body';
  const category = String(product.category || '').toLowerCase().trim();
  if (['body', 'body care'].includes(category)) return 'body';
  if (/\bface\b|\bfacial\b/.test(name)) return 'face';
  if (['face & body', 'face and body'].includes(category)) return 'both';
  if (category === 'face') return 'face';
  return null;
}

export function matchesConcernArea(product, area) {
  const productArea = productConcernArea(product);
  return productArea === 'both' || productArea === area;
}

// A generic catalogue category (e.g. Serum) leaves the decision to the scoring
// dataset. Explicit Body Care/name evidence must also be enforced on live cards.
export function allowsConcernScore(product, area) {
  return !productConcernArea(product) || matchesConcernArea(product, area);
}
