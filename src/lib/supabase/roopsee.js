import { createClient } from '@supabase/supabase-js';

const roopseeSupabaseUrl = process.env.ROOPSEE_NEXT_PUBLIC_SUPABASE_URL;
const roopseeServiceKey = process.env.ROOPSEE_SUPABASE_SERVICE_KEY;


export const roopseeAdmin = createClient(
  roopseeSupabaseUrl || '',
  roopseeServiceKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

export default roopseeAdmin;
