// /components/admin/UserRolesTab.tsx
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFilterState } from "@/hooks/use-filter-state";
import { SmartFilterBar } from "@/components/filters/SmartFilterBar";
import { USER_ROLE_FIELD_DEFS } from "@/lib/filtering/admin-user-fields";
import { fetchUsersForRolesTab, updateUserRole, type UserRole } from "@/lib/api/admin-users";
import { useRole } from "@/providers/role-provider";
import { RoleBadge } from "@/components/admin/RoleBadge";

const ROLE_OPTIONS: UserRole[] = ["mentee", "mentor", "associate", "pm"];

export function UserRolesTab() {
  const { role: currentUserRole } = useRole();
  const isPm = currentUserRole === "pm";
  const queryClient = useQueryClient();
  const filterState = useFilterState(USER_ROLE_FIELD_DEFS, "admin-users-roles");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users-roles", filterState.filterState, filterState.sortState],
    queryFn: () => fetchUsersForRolesTab(filterState.filterState, filterState.sortState),
  });

  async function handleRoleChange(userId: string, newRole: UserRole) {
    await updateUserRole(userId, newRole);
    queryClient.invalidateQueries({ queryKey: ["admin-users-roles"] });
  }

  return (
    <div className="flex flex-col gap-4">
      <SmartFilterBar fieldDefs={USER_ROLE_FIELD_DEFS} state={filterState} />

      {!isPm && (
        <p className="text-sm text-text-muted dark:text-text-muted">
          Only program managers can change roles — you can view this list but not edit it.
        </p>
      )}

      {isLoading && <p className="text-sm text-text-muted dark:text-text-muted">Loading...</p>}

      <div className="flex flex-col gap-2">
        {(users ?? []).map((user) => (
          <div
            key={user.id}
            className="surface-card flex items-center justify-between dark:surface-card"
          >
            <div className="flex items-center gap-3">
              <RoleBadge role={user.role} />
              <div>
                <p className="text-sm font-medium text-text-primary dark:text-text-primary">
                  {user.fullName ?? user.schoolOrOrg ?? user.id}
                </p>
                <p className="text-xs text-text-muted dark:text-text-muted">
                  {user.email ?? "no email"} · {user.approvalStatus}
                </p>
              </div>
            </div>

            <select
              value={user.role}
              disabled={!isPm}
              onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
              className="rounded-lg border border-border bg-card-alt px-3 py-1.5 text-sm text-text-primary disabled:opacity-60 dark:border-border dark:bg-card-alt dark:text-text-primary"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}