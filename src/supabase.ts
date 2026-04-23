import { createClient } from '@supabase/supabase-js';

// Use environment variables or local fallbacks for development convenience
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// We only initialize if we have a URL, otherwise we export null or a dummy 
// to prevent the "supabaseUrl is required" crash on startup.
export const supabase = supabaseUrl 
  ? createClient(supabaseUrl, supabaseKey) 
  : null as any;

if (!supabase) {
  console.warn("Supabase credentials missing! Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.");
}
