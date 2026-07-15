// lib/supabase/client.ts

/**
 * ============================================================================
 * Browser-Side Supabase Client
 * ============================================================================
 *
 * Purpose
 * -------
 * Creates a Supabase client for use in client-side Next.js contexts.
 *
 * Used In
 * -------
 * - Client Components  ("use client")
 * - React Hooks
 * - Sign Out buttons
 * - Realtime subscriptions
 *
 * Permissions
 * -----------
 * - Scoped to the current logged-in user's session
 * - RLS enforced
 * - Does NOT bypass RLS
 *
 * Important
 * ---------
 * Never use this file for admin operations.
 * Never import lib/supabase/admin.ts in any client-side file.
 * ============================================================================
 */

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}