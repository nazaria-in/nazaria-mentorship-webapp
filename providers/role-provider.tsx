// /providers/role-provider.tsx

"use client";

import * as React from "react";
import { useSessionStore, type ApprovalStatus } from "@/store/session-store";

export type Role = "mentee" | "mentor" | "associate" | "pm";

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
  role: Role | null;
  permissionLevel: PermissionLevel;
  setRole: (role: Role) => void;
  canSwitchRole: boolean;
  availableRoles: Role[];
  isDebug: boolean;
  approvalStatus?: ApprovalStatus | null;
  isAuthenticated: boolean;
}

const RoleContext = React.createContext<RoleContextValue | null>(null);

export interface RoleProviderProps {
  children: React.ReactNode;
  availableRoles?: Role[];
  isDebug?: boolean;
}

export function RoleProvider({ children, availableRoles, isDebug = false }: RoleProviderProps) {
  const sessionRole = useSessionStore((s) => s.role) as Role | undefined;
  const userId = useSessionStore((s) => s.userId);
  const approvalStatus = useSessionStore((s) => s.approvalStatus);

  const [override, setOverride] = React.useState<Role | null>(null);

  // Strict check for active session
  const isAuthenticated = isDebug || Boolean(userId && sessionRole);

  const roles = React.useMemo(() => {
    if (isDebug) return ALL_ROLES;
    if (availableRoles) return availableRoles;
    return sessionRole ? [sessionRole] : [];
  }, [availableRoles, sessionRole, isDebug]);

  const activeRole: Role | null = React.useMemo(() => {
    if (override && roles.includes(override)) return override;
    if (sessionRole && roles.includes(sessionRole)) return sessionRole;
    if (isDebug) return roles[0] ?? "mentee";
    return null;
  }, [override, sessionRole, roles, isDebug]);

  const value: RoleContextValue = {
    role: activeRole,
    permissionLevel: permissionLevelFor(activeRole ?? "mentee"),
    setRole: setOverride,
    canSwitchRole: roles.length > 1,
    availableRoles: roles,
    isDebug,
    approvalStatus,
    isAuthenticated,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = React.useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleProvider");

  // Debug log to inspect what context values are active
  console.log("[useRole Context Check]:", {
    role: ctx.role,
    permissionLevel: ctx.permissionLevel,
    isAuthenticated: ctx.isAuthenticated,
    isDebug: ctx.isDebug,
    approvalStatus: ctx.approvalStatus,
  });

  return ctx;
}