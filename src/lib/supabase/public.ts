import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./env";

// Deliberately no session cookies: even signed-in owners see only published data.
export function createPublicClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: init?.signal
            ? AbortSignal.any([init.signal, AbortSignal.timeout(30000)])
            : AbortSignal.timeout(30000),
        }),
    },
  });
}
