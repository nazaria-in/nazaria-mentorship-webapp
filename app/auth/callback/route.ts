// app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("[auth/callback] exchange failed:", error?.message, error?.status);
    return NextResponse.redirect(
      `${origin}/auth/login?error=auth_callback_failed&reason=${encodeURIComponent(
        error?.message ?? "no_user"
      )}`
    );
  }

  // Double check that the trigger safely created their profile row
  const { data: userRow, error: userRowError } = await supabase
    .from("users")
    .select("id")
    .eq("id", data.user.id)
    .single();

  if (userRowError || !userRow) {
    console.error(
      "[auth/callback] Auth succeeded, but database trigger failed to create public.users row for:",
      data.user.id,
      userRowError.message
    );
    // You can choose to redirect to an error or onboarding with a warning flag here
  }

  // Always drop them safely into your main portal. 
  // Your app state/middleware will decide if they need to finish onboarding.
  return NextResponse.redirect(`${origin}/dashboard`);
}