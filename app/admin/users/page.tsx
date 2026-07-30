// /app/admin/users/page.tsx
"use client";

import { NAV_BY_PERMISSION } from "@/components/shell/NavConfig";
import { useRole } from "@/providers/role-provider";
import { UserManagementTabs } from "@/components/admin/UserManagementTabs";
import { EmptyState } from "@/components/shared/EmptyState";

export default function AdminUsersPage() {
  const { permissionLevel } = useRole();

  if (permissionLevel !== "staff") {
    return (
        <div className="p-4">
          <EmptyState title="Staff only" description="This page is only available to associates and program managers." />
        </div>
    );
  }

  return (
      <UserManagementTabs />
  );
}