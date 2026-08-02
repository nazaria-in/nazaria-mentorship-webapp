// lib/api/auth.ts

import { createClient } from "@/lib/supabase/client";
import { useSessionStore } from "@/store/session-store";
import type { UserRole } from "@/types/users";
import type { Role } from "@/providers/role-provider";

/**
 * All functions here run in the browser (client component context).
 * Server-side session exchange lives in app/auth/callback/route.ts.
 */

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
}

export async function signUp({ fullName, email, password }: SignUpInput) {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Supabase requires this to be an absolute, allow-listed URL
      // (Auth → URL Configuration → Redirect URLs) in production.
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) throw error;

  if (!data.user) {
    throw new Error("Failed to create user.");
  }

  const { error: profileError } = await supabase
    .from("users")
    .insert({
      id: data.user.id,
      full_name: fullName,
      email: email,
      role: "mentee", // Default role until onboarding changes it.
    });

  if (profileError) {
    throw profileError;
  }

  return data;
}

export interface SignInInput {
  email: string;
  password: string;
}

export async function signIn({ email, password }: SignInInput) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

/**
 * Called from the onboarding role-choice step.
 * - mentee: role set, approval_status left at its default ('approved')
 * - mentor / associate: role set, approval_status explicitly flipped to
 *   'pending' — both require PM sign-off before the user gets access.
 */
export async function setUserRole(userId: string, role: UserRole) {
  const supabase = createClient();

  const needsApproval = role === "mentor" || role === "associate";

  const { error } = await supabase
    .from("users")
    .update({
      role,
      approval_status: needsApproval ? ("pending" as const) : ("approved" as const),
    })
    .eq("id", userId);

  if (error) throw error;
}

export interface UserProfileInput {
  userId: string;
  fullName?: string;
  bio?: string;
  backgroundNotes?: string;
  goals?: string[];
  interests?: string[];
  schoolOrOrg?: string;
}

/**
 * Updates the user's details directly in the consolidated 'users' table.
 */
export async function updateUserProfile({
  userId,
  fullName,
  bio,
  backgroundNotes,
  goals,
  interests,
  schoolOrOrg,
}: UserProfileInput) {
  const supabase = createClient();

  const { error } = await supabase
    .from("users")
    .update({
      full_name: fullName,
      bio,
      background_notes: backgroundNotes,
      goals,
      interests,
      school_or_org: schoolOrOrg,
      updated_at: new Date().toISOString(), // explicitly sets the update timestamp
    })
    .eq("id", userId);

  if (error) throw error;
}

/**
 * Re-fetches the current auth user + their public.users profile row and
 * writes it straight into the session store (bypassing React state/props,
 * via zustand's getState()/setSession so it's callable from anywhere,
 * not just inside a component tied to SessionProvider).
 *
 * Returns the resolved userId, or null if:
 * - there's no authenticated user (session store is cleared in this case), or
 * - the profile row isn't found yet — existing session state is left
 *   untouched here so callers (e.g. role-choice's retry loop) can try again
 *   instead of getting bounced to a cleared session mid-retry.
 */
export async function refetchSession(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  const authUser = data.user;

  if (!authUser) {
    useSessionStore.getState().clearSession();
    return null;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, full_name")
    .eq("id", authUser.id)
    .single();

  if (!profile) {
    return null;
  }

  useSessionStore.getState().setSession({
    userId: profile.id,
    fullName: profile.full_name ?? "Anonymous User",
    role: profile.role as Role,
  });

  return profile.id;
}