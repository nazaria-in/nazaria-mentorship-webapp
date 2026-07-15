// lib/supabase/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

/**
 * Refreshes the Supabase auth session on every request and keeps the
 * browser's session cookie in sync. This is the ONLY thing middleware does —
 * no role or approval-status checks here (those live in the client-side
 * ApprovalGate, per the architecture plan).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write to the incoming request (so downstream reads in this
          // same request see the refreshed cookies)...
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // ...then rebuild the response and write to it too (so the
          // browser actually receives the refreshed cookies).
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: this call is what actually triggers the token refresh.
  // Do not remove it, and do not add logic between client creation and
  // this call — Supabase's docs are explicit that this must run first.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No redirect logic here on purpose. Every route is reachable
  // unauthenticated; individual pages/layouts decide what to do with a
  // missing session (redirect to /login, show a gate, etc). Uncomment
  // below only if you later want a hard server-side wall for the whole
  // /dashboard tree:
  //
  // if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = "/login";
  //   return NextResponse.redirect(url);
  // }

  return supabaseResponse;
}