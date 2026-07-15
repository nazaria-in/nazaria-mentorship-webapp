// lib/supabase/admin.ts

/**
 * ============================================================================
 * Supabase Admin Client (Service Role)
 * ============================================================================
 *
 * Purpose
 * -------
 * A privileged Supabase client that bypasses Row Level Security (RLS).
 *
 * Used In
 * -------
 * - lib/auth/admin.ts (role assignment, cohort/pod management)
 * - Server-only admin operations
 *
 * Permissions
 * -----------
 * - Full database access
 * - Bypasses ALL RLS policies
 * - Can read and write any row in any table
 *
 * ⚠️  CRITICAL — Server Only
 * --------------------------
 * This client uses SUPABASE_SERVICE_ROLE_KEY, which is a secret.
 * It must NEVER be imported in any client-side file, Client Component,
 * or any file that runs in the browser.
 *
 * autoRefreshToken and persistSession are disabled because this
 * client is stateless and server-side — it does not represent
 * a logged-in user session.
 * ============================================================================
 */

import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);