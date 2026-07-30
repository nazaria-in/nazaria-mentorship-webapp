// components/admin/PeopleTab.tsx
"use client";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchUsersByApproval, updateApprovalStatus } from "@/lib/api/users";
import {
  fetchUsersForPodsTab,
  fetchPodOptions,
  assignUserToPod,
  removeUserFromPod,
  updateUserRole,
  type AdminUserPodRow,
  type UserRole,
} from "@/lib/api/admin-users";
import { USER_POD_FIELD_DEFS } from "@/lib/filtering/admin-user-fields";
import { PeopleGrid } from "@/components/shared/PeopleGrid";
import { UserCard, type UserCardPerson } from "@/components/shared/UserCard";
import { useRole } from "@/providers/role-provider";
import type { AppUser } from "@/types/users";

const UNASSIGNED_VALUE = "__unassigned__";
const ROLE_OPTIONS: UserRole[] = ["mentee", "mentor", "associate", "pm"];

function toPerson(user: AppUser): UserCardPerson {
  return {
    id: user.id,
    fullName: user.full_name ?? null,
    role: user.role,
    approvalStatus: user.approval_status,
    schoolOrOrg: user.school_or_org ?? null,
  };
}

function podRowToPerson(row: AdminUserPodRow): UserCardPerson & { podId: string | null; podName: string | null } {
  return {
    id: row.userId,
    fullName: row.fullName,
    role: row.role,
    approvalStatus: row.approvalStatus,
    podId: row.podId,
    podName: row.podName,
  };
}

function PendingSection({
  title,
  emptyMessage,
  roles,
}: {
  title: string;
  emptyMessage: string;
  roles: UserRole[];
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["people-pending", roles.join(",")],
    queryFn: () => fetchUsersByApproval({ status: "pending" }),
  });

  const filtered = (data ?? []).filter((u) => roles.includes(u.role));

  async function handleDecision(userId: string, status: "approved" | "rejected") {
    await updateApprovalStatus(userId, status);
    queryClient.invalidateQueries({ queryKey: ["people-pending"] });
    queryClient.invalidateQueries({ queryKey: ["people-approved"] });
  }

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-text-primary dark:text-text-primary">{title}</h3>
      {isLoading && <p className="text-sm text-text-muted dark:text-text-muted">Loading…</p>}
      {!isLoading && filtered.length === 0 && (
        <p className="text-sm text-text-muted dark:text-text-muted">{emptyMessage}</p>
      )}
      <div className="flex flex-col gap-2">
        {filtered.map((user) => (
          <UserCard key={user.id} person={toPerson(user)} view="list" clickable={false}>
            <button
              type="button"
              onClick={() => handleDecision(user.id, "approved")}
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => handleDecision(user.id, "rejected")}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-muted dark:border-border dark:text-text-primary"
            >
              Reject
            </button>
          </UserCard>
        ))}
      </div>
    </section>
  );
}

function ApprovedRoster() {
  const queryClient = useQueryClient();
  const { role: currentUserRole } = useRole();
  const isPm = currentUserRole === "pm";
  const [grouped, setGrouped] = useState(false);

  const { data: podOptions } = useQuery({ queryKey: ["pod-options"], queryFn: fetchPodOptions });

  // Pod options are runtime data (vary by cohort) — USER_POD_FIELD_DEFS
  // ships with an empty options: [] placeholder for the pod field, same
  // pattern as the old UserPodsTab. Without this splice the pod filter
  // renders with nothing to select, which is the bug being fixed here.
  const fieldDefs = useMemo(
    () =>
      USER_POD_FIELD_DEFS.map((field) =>
        field.key === "pod" ? { ...field, options: podOptions ?? [] } : field
      ),
    [podOptions]
  );

  async function handleRoleChange(userId: string, role: UserRole) {
    await updateUserRole(userId, role);
    queryClient.invalidateQueries({ queryKey: ["people-approved"] });
  }

  async function handlePodChange(userId: string, value: string) {
    if (value === UNASSIGNED_VALUE) {
      await removeUserFromPod(userId);
    } else {
      await assignUserToPod(userId, value);
    }
    queryClient.invalidateQueries({ queryKey: ["people-approved"] });
    queryClient.invalidateQueries({ queryKey: ["pods-overview"] });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary dark:text-text-primary">All approved</h3>
        <button
          type="button"
          onClick={() => setGrouped((g) => !g)}
          aria-pressed={grouped}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            grouped
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-transparent text-text-primary hover:bg-surface-muted dark:border-border dark:text-text-primary dark:hover:bg-white/5"
          }`}
        >
          {grouped ? "Ungroup" : "Group by pod"}
        </button>
      </div>

      <PeopleGrid
        fieldDefs={fieldDefs}
        viewKey="admin-people-approved"
        queryKey={["people-approved"]}
        groupBy={grouped ? "pod" : "none"}
        groupKeyFn={(p) => (p as UserCardPerson & { podName: string | null }).podName ?? "No pod"}
        queryFn={async (filterState, sortState) => {
          const rows = await fetchUsersForPodsTab(filterState, sortState);
          return rows.filter((r) => r.approvalStatus === "approved").map(podRowToPerson);
        }}
        computeClickable={(p) => p.role === "mentor" || p.role === "mentee"}
        renderActions={(p) => {
          const podRow = p as UserCardPerson & { podId: string | null; podName: string | null };
          return (
            <>
              <select
                value={p.role}
                disabled={!isPm}
                onChange={(e) => handleRoleChange(p.id, e.target.value as UserRole)}
                className="rounded-lg border border-border bg-card-alt px-2 py-1 text-xs text-text-primary disabled:opacity-60 dark:border-border dark:bg-card-alt dark:text-text-primary"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                value={podRow.podId ?? UNASSIGNED_VALUE}
                onChange={(e) => handlePodChange(p.id, e.target.value)}
                className="rounded-lg border border-border bg-card-alt px-2 py-1 text-xs text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary"
              >
                <option value={UNASSIGNED_VALUE}>No pod</option>
                {(podOptions ?? []).map((pod) => (
                  <option key={pod.value} value={pod.value}>
                    {pod.label}
                  </option>
                ))}
              </select>
            </>
          );
        }}
      />

      {!isPm && (
        <p className="text-xs text-text-muted dark:text-text-muted">
          Only program managers can change roles — you can view but not edit.
        </p>
      )}
    </section>
  );
}
export function PeopleTab() {
  return (
    <div className="flex flex-col gap-8">
      <PendingSection
        title="Pending — Associate / PM requests"
        emptyMessage="No pending staff requests."
        roles={["associate", "pm"]}
      />
      <PendingSection
        title="Pending — Mentor requests"
        emptyMessage="No pending mentor requests."
        roles={["mentor"]}
      />
      <RejectedSection />
      <ApprovedRoster />
    </div>
  );
}

function RejectedSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["people-rejected"],
    queryFn: () => fetchUsersByApproval({ status: "rejected" }),
  });

  async function handleReconsider(userId: string) {
    await updateApprovalStatus(userId, "pending");
    queryClient.invalidateQueries({ queryKey: ["people-rejected"] });
    queryClient.invalidateQueries({ queryKey: ["people-pending"] });
  }

  const rejected = data ?? [];

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-text-primary dark:text-text-primary">Rejected</h3>
      {isLoading && <p className="text-sm text-text-muted dark:text-text-muted">Loading…</p>}
      {!isLoading && rejected.length === 0 && (
        <p className="text-sm text-text-muted dark:text-text-muted">No rejected requests.</p>
      )}
      <div className="flex flex-col gap-2">
        {rejected.map((user) => (
          <UserCard key={user.id} person={toPerson(user)} view="list" clickable={false}>
            <button
              type="button"
              onClick={() => handleReconsider(user.id)}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-muted dark:border-border dark:text-text-primary dark:hover:bg-white/5"
            >
              Move back to pending
            </button>
          </UserCard>
        ))}
      </div>
    </section>
  );
}