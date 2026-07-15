// /providers/role-provider.tsx

"use client";

import * as React from "react";
import { useSessionStore } from "@/store/session-store";

export type Role = "mentee" | "mentor" | "associate" | "pm";

// All possible roles in the system
export const ALL_ROLES: Role[] = ["mentee", "mentor", "associate", "pm"];

export type PermissionLevel = "mentee" | "mentor" | "staff";

export function permissionLevelFor(role: Role): PermissionLevel {
  if (role === "mentee") return "mentee";
  if (role === "mentor") return "mentor";
  return "staff";
}

export const ROLE_LABELS: Record<Role, string> = {
  mentee: "Mentee",
  mentor: "Mentor",
  associate: "Associate",
  pm: "Program Manager",
};

interface RoleContextValue {
  role: Role;
  permissionLevel: PermissionLevel;
  setRole: (role: Role) => void;
  canSwitchRole: boolean;
  availableRoles: Role[];
  isDebug: boolean;
}

const RoleContext = React.createContext<RoleContextValue | null>(null);

export interface RoleProviderProps {
  children: React.ReactNode;
  /** Roles this signed-in user is actually allowed to preview as.
   * Defaults to just their real role — pass more only for staff/dev. */
  availableRoles?: Role[];
  /** Bypasses session requirements and opens up all roles for debugging/development */
  isDebug?: boolean;
}

export function RoleProvider({ children, availableRoles, isDebug = false }: RoleProviderProps) {
  // Gracefully fetch session role if available
  const sessionRole = useSessionStore((s) => s.role) as Role | undefined;
  const [override, setOverride] = React.useState<Role | null>(null);

  // Compute available roles based on debug mode vs active session
  const roles = React.useMemo(() => {
    if (isDebug) return ALL_ROLES;
    if (availableRoles) return availableRoles;
    return sessionRole ? [sessionRole] : [];
  }, [availableRoles, sessionRole, isDebug]);

  // Determine current active role fallback logic
  const role = React.useMemo(() => {
    if (override && roles.includes(override)) return override;
    if (sessionRole && roles.includes(sessionRole)) return sessionRole;
    // Fallback if not logged in but in debug mode
    return roles[0] ?? "mentee";
  }, [override, sessionRole, roles]);

  const value: RoleContextValue = {
    role,
    permissionLevel: permissionLevelFor(role),
    setRole: setOverride,
    canSwitchRole: roles.length > 1,
    availableRoles: roles,
    isDebug,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = React.useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleProvider");
  return ctx;
}