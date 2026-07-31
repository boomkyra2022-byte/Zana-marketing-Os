import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Use inside Server Components / Server Actions / Route Handlers.
// Runs with the signed-in user's session -> Postgres RLS applies.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component render — safe to ignore,
            // middleware.ts refreshes the session cookie on each request.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // see note above
          }
        }
      }
    }
  );
}

// Service-role client — server-only, never imported into client components.
// Reserved for background jobs (video download/ffmpeg processing) in Phase 3.
export function createServiceRoleClient() {
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
