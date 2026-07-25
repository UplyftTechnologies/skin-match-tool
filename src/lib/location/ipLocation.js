// lib/location/ipLocation.js
// NOTE: this file didn't exist in what you sent — your Express file imported
// getClientIp/getVisitorLocationFromHeaders/getIpLocation from
// '../routes/locationRoutes.js', which wasn't in the upload. This is a fresh
// implementation for Next.js server route handlers (works with the standard
// `Request`/`headers()` API, not Express req/res).

/** Extracts the client's IP from standard proxy headers. */
export function getClientIp(headers) {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list — first entry is the client.
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp;

  return '';
}

/**
 * If deployed on Vercel, geo data is already attached to the request headers
 * for free — no external API call needed. Returns {} if not on Vercel.
 * https://vercel.com/docs/edge-network/headers#x-vercel-ip-country
 */
export function getVisitorLocationFromHeaders(headers) {
  const country = headers.get('x-vercel-ip-country');
  const city = headers.get('x-vercel-ip-city');
  const region = headers.get('x-vercel-ip-country-region');
  const latitude = headers.get('x-vercel-ip-latitude');
  const longitude = headers.get('x-vercel-ip-longitude');

  if (!country && !city) return null;

  return {
    country: country || '',
    city: city ? decodeURIComponent(city) : '',
    region: region || '',
    latitude: latitude ? Number(latitude) : null,
    longitude: longitude ? Number(longitude) : null,
    source: 'vercel-headers',
  };
}

/** Fallback for local dev / non-Vercel hosts: look the IP up via ipapi.co. */
export async function getIpLocation(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1') return {};

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: controller.signal,
    });

    clearTimeout(timer);
    if (!res.ok) return {};

    const data = await res.json().catch(() => ({}));
    return {
      city: data.city || '',
      region: data.region || '',
      country: data.country_name || '',
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      source: 'ip',
    };
  } catch (error) {
    console.warn('[location] IP lookup failed:', error?.message);
    return {};
  }
}