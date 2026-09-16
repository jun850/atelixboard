import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);

export const supabase = createClient(
  supabaseUrl || "https://invalid.supabase.co",
  supabasePublishableKey || "sb_publishable_missing",
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  },
);

export const requireSupabase = () => {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Atelix authentication is not configured. Add the Supabase project URL and publishable key.",
    );
  }
  return supabase;
};
