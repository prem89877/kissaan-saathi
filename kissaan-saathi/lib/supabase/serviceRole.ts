import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Bypasses Row Level Security entirely — this must NEVER be imported into
// a Client Component or any code that ships to the browser. It exists only
// so the payment-verification API routes can write payment_status values
// that the enforce_payment_status_transition trigger blocks from ordinary
// authenticated (client) requests.
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Add it in your hosting " +
      "provider's environment variables (never with a NEXT_PUBLIC_ prefix)."
    );
  }

  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
