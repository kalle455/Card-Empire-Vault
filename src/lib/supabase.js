import { createClient } from "@supabase/supabase-js";

// Public browser credentials. The policies in supabase/schema.sql protect the data.
const url = import.meta.env.VITE_SUPABASE_URL ?? "https://ewpqnrhhrqvlywmdbral.supabase.co";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "sb_publishable_1TfSf_SXnqVROAidTGvuIQ_5qo7xIPt";

export const isSupabaseConfigured = Boolean(url && anonKey);
export const supabase = createClient(url, anonKey);
