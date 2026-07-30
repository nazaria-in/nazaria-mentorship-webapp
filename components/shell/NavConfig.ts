// /components/shell/NavConfig.ts

import {
  CalendarDays,
  ClipboardCheck,
  LayoutGrid,
  BookOpen,
  ShieldCheck,
  UsersRound,
  ListChecks,
  Settings2,
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
    {
      id: "exit-surveys",
      label: "Exit Surveys",
      href: "/exit-survey",
      icon: ListChecks,
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
    {
      id: "exit-surveys",
      label: "Exit Surveys",
      href: "/exit-survey",
      icon: ListChecks,
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
      id: "exit-surveys",
      label: "Exit Surveys",
      href: "/exit-survey",
      icon: ListChecks,
    },
    {
      id: "exit-survey-templates",
      label: "Survey Templates",
      href: "/admin/exit-survey-templates",
      icon: Settings2,
    },
    // Was "Approvals" pointing at the same /admin/users route — that page
    // now hosts Approvals + Roles + Pods + Cohorts as tabs, so it's
    // relabeled to reflect that. The old standalone "Cohorts" item
    // (-> /admin/cohorts, a page that never existed) is removed; cohorts
    // now live inside this page as a tab instead.
    {
      id: "people",
      label: "People",
      href: "/admin/users",
      icon: ShieldCheck,
    },
  ],
};