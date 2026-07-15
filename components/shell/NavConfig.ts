// /components/shell/NavConfig.ts

import { LayoutGrid, BookOpen, Users, ShieldCheck } from "lucide-react";
import type { NavItem } from "@/components/shell/AppShell";
import type { PermissionLevel } from "@/providers/role-provider";

export const NAV_BY_PERMISSION: Record<PermissionLevel, NavItem[]> = {
  mentee: [
    { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
    { id: "assignments", label: "Assignments", href: "/assignments", icon: BookOpen },
  ],
  mentor: [
    { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
    { id: "assignments", label: "Assignments", href: "/assignments", icon: BookOpen },
    { id: "pod", label: "My pod", href: "/pod", icon: Users },
  ],
  staff: [
    { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
    { id: "assignments", label: "Assignments", href: "/assignments", icon: BookOpen },
    { id: "cohorts", label: "Cohorts", href: "/admin/cohorts", icon: Users },
    { id: "approvals", label: "Approvals", href: "/admin/users", icon: ShieldCheck },
  ],
};