import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/users";

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
 * - mentor: role set, approval_status explicitly flipped to 'pending'
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