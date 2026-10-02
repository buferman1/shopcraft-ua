function requiredEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseConfig() {
  return {
    url: requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    publishableKey: requiredEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  };
}
