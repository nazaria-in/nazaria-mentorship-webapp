// /components/admin/UserPodsTab.tsx
"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFilterState } from "@/hooks/use-filter-state";
import { SmartFilterBar } from "@/components/filters/SmartFilterBar";
import { USER_POD_FIELD_DEFS } from "@/lib/filtering/admin-user-fields";
import {
  fetchUsersForPodsTab,
  fetchPodOptions,
  assignUserToPod,
  removeUserFromPod,
} from "@/lib/api/admin-users";
import type { FilterFieldDef } from "@/lib/filtering/types";
import { RoleBadge } from "@/components/admin/RoleBadge";
import { PodsOverviewPanel } from "@/components/admin/PodsOverviewPanel";

const UNASSIGNED_VALUE = "__unassigned__";
type SubView = "all_users" | "by_pod";

export function UserPodsTab() {
  const [subView, setSubView] = useState<SubView>("all_users");

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit rounded-full border border-border p-0.5 dark:border-border">
        <button
          type="button"
          onClick={() => setSubView("all_users")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium dark:text-text-primary ${
            subView === "all_users"
              ? "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground"
              : "text-text-primary/60"
          }`}
        >
          All users
        </button>
        <button
          type="button"
          onClick={() => setSubView("by_pod")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium dark:text-text-primary ${
            subView === "by_pod"
              ? "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground"
              : "text-text-primary/60"
          }`}
        >
          By pod
        </button>
      </div>

      {subView === "all_users" ? <AllUsersPodList /> : <PodsOverviewPanel />}
    </div>
  );
}

function AllUsersPodList() {
  const queryClient = useQueryClient();

  const { data: podOptions } = useQuery({
    queryKey: ["pod-options"],
    queryFn: fetchPodOptions,
  });

  // Pod options are fetched at runtime (they vary by cohort), so they're
  // spliced into the static field def here rather than hardcoded.
  const fieldDefs: FilterFieldDef[] = useMemo(
    () =>
      USER_POD_FIELD_DEFS.map((field) =>
        field.key === "pod" ? { ...field, options: podOptions ?? [] } : field
      ),
    [podOptions]
  );

  const filterState = useFilterState(fieldDefs, "admin-users-pods");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users-pods", filterState.filterState, filterState.sortState],
    queryFn: () => fetchUsersForPodsTab(filterState.filterState, filterState.sortState),
  });

  async function handlePodChange(userId: string, value: string) {
    if (value === UNASSIGNED_VALUE) {
      await removeUserFromPod(userId);
    } else {
      await assignUserToPod(userId, value);
    }
    queryClient.invalidateQueries({ queryKey: ["admin-users-pods"] });
    queryClient.invalidateQueries({ queryKey: ["pods-overview"] });
  }

  return (
    <div className="flex flex-col gap-4">
      <SmartFilterBar fieldDefs={fieldDefs} state={filterState} />

      {isLoading && <p className="text-sm text-text-muted dark:text-text-muted">Loading...</p>}

      <div className="flex flex-col gap-2">
        {(users ?? []).map((user) => (
          <div
            key={user.userId}
            className="surface-card flex items-center justify-between dark:surface-card"
          >
            <div className="flex items-center gap-3">
              <RoleBadge role={user.role} />
              <div>
                <p className="text-sm font-medium text-text-primary dark:text-text-primary">
                  {user.fullName ?? user.userId}
                </p>
                <p className="text-xs text-text-muted dark:text-text-muted">
                  {user.email ?? "no email"}
                  {user.podName ? ` · currently in ${user.podName}` : ""}
                </p>
              </div>
            </div>

            <select
              value={user.podId ?? UNASSIGNED_VALUE}
              onChange={(e) => handlePodChange(user.userId, e.target.value)}
              className="rounded-lg border border-border bg-card-alt px-3 py-1.5 text-sm text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary"
            >
              <option value={UNASSIGNED_VALUE}>No pod</option>
              {(podOptions ?? []).map((pod) => (
                <option key={pod.value} value={pod.value}>
                  {pod.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}