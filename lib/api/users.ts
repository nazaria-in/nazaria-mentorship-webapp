// /lib/api/users.ts

import { createClient } from "@/lib/supabase/client";
import type { AppUser, ApprovalStatus, UserRole } from "@/types/users";

export interface PendingUsersFilters {
  role?: UserRole;
  status?: ApprovalStatus;
}

/**
 * Fetches the profile of a specific user by their ID.
 */
export async function fetchUserProfile(userId: string): Promise<AppUser | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data as AppUser | null;
}

/**
 * Helper to fetch the profile of the currently logged-in user session.
 */
export async function fetchCurrentUserProfile(): Promise<AppUser | null> {
  const supabase = createClient();
  
  // 1. Get the authenticated auth user from the session
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  // 2. Fetch their application public profile
  return fetchUserProfile(user.id);
}

export async function fetchUsersByApproval(filters: PendingUsersFilters = {}): Promise<AppUser[]> {
  const supabase = createClient();
  let query = supabase.from("users").select("*").is("deleted_at", null);

  if (filters.role) query = query.eq("role", filters.role);
  if (filters.status) query = query.eq("approval_status", filters.status);

  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AppUser[];
}

export async function updateApprovalStatus(userId: string, status: ApprovalStatus): Promise<AppUser> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .update({ approval_status: status, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as AppUser;
}