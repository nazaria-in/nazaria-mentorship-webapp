// /app/admin/users/page.tsx

"use client";

import { AppShell } from "@/components/shell/AppShell";
import { NAV_BY_PERMISSION } from "@/components/shell/NavConfig";
import { useRole } from "@/providers/role-provider";
import { PendingApprovalsList } from "@/components/admin/PendingApprovalsList";
import { EmptyState } from "@/components/shared/EmptyState";

export default function AdminUsersPage() {
  const { permissionLevel } = useRole();

  if (permissionLevel !== "staff") {
    return (
      <AppShell navItems={NAV_BY_PERMISSION[permissionLevel]} pageTitle="Approvals">
        <div className="p-4">
          <EmptyState title="Staff only" description="This page is only available to associates and program managers." />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell navItems={NAV_BY_PERMISSION[permissionLevel]} pageTitle="Approvals">
      <PendingApprovalsList />
    </AppShell>
  );
}