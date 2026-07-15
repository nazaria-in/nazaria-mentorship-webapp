// lib/supabase/server.ts

/**
 * ============================================================================
 * Server-Side Supabase Client
 * ============================================================================
 *
 * Purpose
 * -------
 * Creates a Supabase client for use in server-side Next.js contexts.
 *
 * Used In
 * -------
 * - Server Components
 * - Server Actions
 * - Route Handlers
 *
 * Permissions
 * -----------
 * - Scoped to the current logged-in user's session (via cookies)
 * - RLS enforced
 * - Does NOT bypass RLS (use lib/supabase/admin.ts for that)
 *
 * Cookie Handling
 * ---------------
 * Reads and writes auth cookies via next/headers.
 * The setAll try/catch is required because Server Components
 * cannot set cookies — only Route Handlers and Server Actions can.
 * ============================================================================
 */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component where cookies are read-only.
            // Safe to ignore — the middleware will handle cookie refresh.
          }
        },
      },
    }
  );
}