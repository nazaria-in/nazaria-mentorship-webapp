// /types/users.ts

export type UserRole = "mentee" | "mentor" | "associate" | "pm"; // matches the `role` USER-DEFINED enum
export type ApprovalStatus = "pending" | "approved" | "rejected"; // requires the migration noted above

export interface AppUser {
  id: string;
  full_name: string;
  role: UserRole;
  bio: string | null;
  background_notes: string | null;
  goals: string[] | null;
  interests: string[] | null;
  school_or_org: string | null;
  approval_status: ApprovalStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}