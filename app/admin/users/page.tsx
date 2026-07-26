// /app/admin/users/page.tsx
"use client";

import { AppShell } from "@/components/shell/AppShell";
import { NAV_BY_PERMISSION } from "@/components/shell/NavConfig";
import { useRole } from "@/providers/role-provider";
import { UserManagementTabs } from "@/components/admin/UserManagementTabs";
import { EmptyState } from "@/components/shared/EmptyState";

export default function AdminUsersPage() {
  const { permissionLevel } = useRole();

  if (permissionLevel !== "staff") {
    return (
      <AppShell navItems={NAV_BY_PERMISSION[permissionLevel]} pageTitle="Manage users">
        <div className="p-4">
          <EmptyState title="Staff only" description="This page is only available to associates and program managers." />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell navItems={NAV_BY_PERMISSION[permissionLevel]} pageTitle="Manage users">
      <UserManagementTabs />
    </AppShell>
  );
}