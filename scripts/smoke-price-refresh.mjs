// Read-only live smoke check: node --env-file=.env scripts/smoke-price-refresh.mjs
import { createClient } from '@supabase/supabase-js';
import { scrapePrices } from '../src/lib/price-scraper.js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const rows = await Promise.all(['nykaa', 'tira', 'purplle'].map(async site => {
  const { data, error } = await db.from('retailer_products').select('id,site,product_url')
    .eq('site', site).not('product_url', 'is', null).limit(1);
  if (error) throw new Error('Could not load smoke-test listings');
  return data[0];
}));
console.log(JSON.stringify(await scrapePrices(rows.filter(Boolean)), null, 2));
