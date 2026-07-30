// /components/shell/NavConfig.ts

import {
  CalendarDays,
  ClipboardCheck,
  LayoutGrid,
  LayoutDashboard,
  BookOpen,
  Users,
  UsersRound,
  ListChecks,
  Settings2,
} from "lucide-react";

import type { NavItem } from "@/components/shell/AppShell";
import type { PermissionLevel } from "@/providers/role-provider";

export const NAV_BY_PERMISSION: Record<PermissionLevel, NavItem[]> = {
  mentee: [
    { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
    { id: "assignments", label: "Assignments", href: "/assignments", icon: ClipboardCheck },
    { id: "resources", label: "Resources", href: "/resources", icon: BookOpen },
    { id: "meetings", label: "Meetings", href: "/meetings", icon: CalendarDays },
    { id: "exit-surveys", label: "Exit Surveys", href: "/exit-survey", icon: ListChecks },
  ],

  mentor: [
    { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
    { id: "assignments", label: "Assignments", href: "/assignments", icon: ClipboardCheck },
    { id: "resources", label: "Resources", href: "/resources", icon: BookOpen },
    { id: "meetings", label: "Meetings", href: "/meetings", icon: CalendarDays },
    { id: "exit-surveys", label: "Exit Surveys", href: "/exit-survey", icon: ListChecks },
  ],

  staff: [
    { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
    // New — the actual /admin overview page had no nav entry anywhere
    // until now, despite being the main thing this whole rework built.
    { id: "admin", label: "Admin", href: "/admin", icon: LayoutDashboard },
    { id: "assignments", label: "Assignments", href: "/assignments", icon: ClipboardCheck },
    { id: "resources", label: "Resources", href: "/resources", icon: BookOpen },
    { id: "meetings", label: "Meetings", href: "/meetings", icon: CalendarDays },
    { id: "exit-surveys", label: "Exit Surveys", href: "/exit-survey", icon: ListChecks },
    { id: "exit-survey-templates", label: "Survey Templates", href: "/admin/exit-survey-templates", icon: Settings2 },
    { id: "people", label: "People", href: "/admin/users", icon: Users },
  ],
};