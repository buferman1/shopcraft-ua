export function getSupabaseConfig() {
  // Static property access is required for Next.js browser env substitution.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey)
    throw new Error("Supabase environment is not configured");
  return { url, publishableKey };
}
