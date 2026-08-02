// lib/page-descriptions.ts
import type { PermissionLevel } from "@/providers/role-provider";

/**
 * Per-page descriptions, keyed by top-level path segment.
 * Value can be:
 *   - a plain string (same copy for every role)
 *   - a partial record keyed by PermissionLevel, with an optional
 *     "default" fallback for roles not explicitly listed
 *
 * Nested routes inherit their section's entry (e.g. /assignments/123
 * uses the "assignments" key) — see resolvePageDescription below.
 */
type RoleDescriptions = Partial<Record<PermissionLevel | "default", string>>;

type DescriptionEntry = string | RoleDescriptions;

export const PAGE_DESCRIPTIONS: Record<string, DescriptionEntry> = {
  dashboard: {
    mentee: "Here you can see all your pending assignments, pending exit surveys, and any upcoming meetings.",
    mentor: "Your mentees at a glance, plus anything waiting on you.",
    default: "Program overview and analytics.", // pm/associate
  },
  meetings: "This is where you Create/Join meetings — after the meeting you will havet to fill the exit survey.",
  assignments_and_courses: {
    mentee: "Browse and submit your Assignments, Courses, Resources here.",
    mentor: "Dispatch, track, and review your pod's Assignments, Courses, Resources.",
    default: "Browse and review Assignments, Courses, Resources across the program.",
  },
  chat: "",
  notifications: "All your notifications in one place.",
  profile: "Manage your profile details.",
  admin: "Program administration and oversight tools.",
};

/**
 * Resolves the description for a pathname + role.
 * - Falls back from role-specific -> "default" -> undefined (no description).
 * - Keyed by the first path segment, so /assignments/[id] inherits
 *   the "assignments" entry.
 */
export function resolvePageDescription(
  pathname: string,
  role: PermissionLevel
): string | undefined {
  const seg = pathname.split("/")[1];
  if (!seg) return undefined;

  const entry = PAGE_DESCRIPTIONS[seg];
  if (!entry) return undefined;

  if (typeof entry === "string") return entry;

  return entry[role] ?? entry.default;
}