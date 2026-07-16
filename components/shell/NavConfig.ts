// /components/shell/NavConfig.ts

import {
  CalendarDays,
  ClipboardCheck,
  LayoutGrid,
  BookOpen,
  ShieldCheck,
  Users,
  UsersRound,
} from "lucide-react";

import type { NavItem } from "@/components/shell/AppShell";
import type { PermissionLevel } from "@/providers/role-provider";

export const NAV_BY_PERMISSION: Record<PermissionLevel, NavItem[]> = {
  mentee: [
    {
      id: "dashboard",
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutGrid,
    },
    {
      id: "assignments",
      label: "Assignments",
      href: "/assignments",
      icon: ClipboardCheck,
    },
    {
      id: "resources",
      label: "Resources",
      href: "/resources",
      icon: BookOpen,
    },
    {
      id: "meetings",
      label: "Meetings",
      href: "/meetings",
      icon: CalendarDays,
    },
  ],

  mentor: [
    {
      id: "dashboard",
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutGrid,
    },
    {
      id: "assignments",
      label: "Assignments",
      href: "/assignments",
      icon: ClipboardCheck,
    },
    {
      id: "pod",
      label: "My Pod",
      href: "/pod",
      icon: UsersRound,
    },
    {
      id: "resources",
      label: "Resources",
      href: "/resources",
      icon: BookOpen,
    },
    {
      id: "meetings",
      label: "Meetings",
      href: "/meetings",
      icon: CalendarDays,
    },
  ],

  staff: [
    {
      id: "dashboard",
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutGrid,
    },
    {
      id: "assignments",
      label: "Assignments",
      href: "/assignments",
      icon: ClipboardCheck,
    },
    {
      id: "cohorts",
      label: "Cohorts",
      href: "/admin/cohorts",
      icon: Users,
    },
    {
      id: "resources",
      label: "Resources",
      href: "/resources",
      icon: BookOpen,
    },
    {
      id: "meetings",
      label: "Meetings",
      href: "/meetings",
      icon: CalendarDays,
    },
    {
      id: "approvals",
      label: "Approvals",
      href: "/admin/users",
      icon: ShieldCheck,
    },
  ],
};