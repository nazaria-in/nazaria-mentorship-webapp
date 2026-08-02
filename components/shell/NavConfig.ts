// /components/shell/NavConfig.ts

import {
  CalendarDays,
  ClipboardCheck,
  LayoutGrid,
  LayoutDashboard,
  BookOpen,
  Users,
  ListChecks,
  Settings2,
} from "lucide-react";

import type { NavItem } from "@/components/shell/AppShell";
import type { PermissionLevel } from "@/providers/role-provider";

export const NAV_BY_PERMISSION: Record<PermissionLevel, NavItem[]> = {
  mentee: [
    { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
    { id: "assignments-and-courses", label: "Assignments and Courses", href: "/assignments-and-courses", icon: ClipboardCheck },
    { id: "meetings", label: "Meetings", href: "/meetings", icon: CalendarDays },
    { id: "exit-surveys", label: "Exit Surveys", href: "/exit-survey", icon: ListChecks },
  ],

  mentor: [
    { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
    { id: "assignments-and-courses", label: "Assignments and Courses", href: "/assignments-and-courses", icon: ClipboardCheck },
    { id: "meetings", label: "Meetings", href: "/meetings", icon: CalendarDays },
    { id: "exit-surveys", label: "Exit Surveys", href: "/exit-survey", icon: ListChecks },
  ],

  staff: [
    { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
    { id: "admin", label: "Admin", href: "/admin", icon: LayoutDashboard },
    { id: "assignments-and-courses", label: "Assignments and Courses", href: "/assignments-and-courses", icon: ClipboardCheck },
    { id: "meetings", label: "Meetings", href: "/meetings", icon: CalendarDays },
    { id: "exit-surveys", label: "Exit Surveys", href: "/exit-survey", icon: ListChecks },
    { id: "people", label: "People", href: "/admin/users", icon: Users },
  ],
};