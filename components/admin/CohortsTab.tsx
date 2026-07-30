// components/admin/CohortsTab.tsx
"use client";

import { Suspense, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import {
  fetchCohorts,
  fetchPodsForCohort,
  fetchPodRoster,
  type CohortSummary,
  type PodSummary,
} from "@/lib/api/cohorts-browser";
import { createPod, fetchUsersForPodsTab, assignUserToPod, removeUserFromPod } from "@/lib/api/admin-users";
import { USER_POD_FIELD_DEFS } from "@/lib/filtering/admin-user-fields";
import { PeopleGrid } from "@/components/shared/PeopleGrid";
import { RoleBadge } from "@/components/admin/RoleBadge";
import { UserProfileSheet } from "@/components/shared/UserProfileSheet";
import type { UserCardPerson } from "@/components/shared/UserCard";

type Crumb =
  | { level: "root" }
  | { level: "cohort"; id: string; name: string }
  | { level: "pod"; cohortId: string; cohortName: string; id: string; name: string };

function Breadcrumbs({ crumb, onNavigate }: { crumb: Crumb; onNavigate: (c: Crumb) => void }) {
  const parts: { label: string; target: Crumb }[] = [{ label: "All cohorts", target: { level: "root" } }];
  if (crumb.level === "cohort" || crumb.level === "pod") {
    parts.push({
      label: crumb.level === "cohort" ? crumb.name : crumb.cohortName,
      target: crumb.level === "cohort" ? crumb : { level: "cohort", id: crumb.cohortId, name: crumb.cohortName },
    });
  }
  if (crumb.level === "pod") parts.push({ label: crumb.name, target: crumb });

  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-text-muted dark:text-text-muted" />}
          <button
            type="button"
            onClick={() => onNavigate(part.target)}
            className={
              i === parts.length - 1
                ? "font-medium text-text-primary dark:text-text-primary"
                : "text-text-muted hover:text-text-primary dark:text-text-muted dark:hover:text-text-primary"
            }
          >
            {part.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

function CohortList({ onSelect }: { onSelect: (cohort: CohortSummary) => void }) {
  const { data, isLoading } = useQuery({ queryKey: ["cohorts-list"], queryFn: fetchCohorts });
  if (isLoading) return <p className="text-sm text-text-muted dark:text-text-muted">Loading cohorts…</p>;
  if (!data || data.length === 0)
    return <p className="text-sm text-text-muted dark:text-text-muted">No cohorts yet.</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {data.map((cohort) => (
        <button
          key={cohort.id}
          type="button"
          onClick={() => onSelect(cohort)}
          className="text-left bg-card border border-border rounded-xl p-4 hover:border-border-strong transition-colors dark:bg-card dark:border-border"
        >
          <p className="font-heading font-semibold text-text-primary dark:text-text-primary">{cohort.name}</p>
          <p className="text-sm text-text-muted dark:text-text-muted capitalize">{cohort.status}</p>
        </button>
      ))}
    </div>
  );
}

function AddPodForm({ cohortId, onCreated }: { cohortId: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => createPod({ name, cohortId }),
    onSuccess: () => {
      setName("");
      setOpen(false);
      onCreated();
    },
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-text-accent hover:underline dark:text-text-accent"
      >
        + Add pod
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) mutation.mutate();
      }}
      className="flex items-center gap-2"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Pod name"
        autoFocus
        className="rounded-lg border border-border bg-card-alt px-3 py-1.5 text-sm text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary"
      />
      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        Create
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-text-muted dark:text-text-muted">
        Cancel
      </button>
    </form>
  );
}

function PodList({ cohortId, onSelect }: { cohortId: string; onSelect: (pod: PodSummary) => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["pods-for-cohort", cohortId],
    queryFn: () => fetchPodsForCohort(cohortId),
  });

  return (
    <div className="space-y-3">
      <AddPodForm
        cohortId={cohortId}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["pods-for-cohort", cohortId] })}
      />
      {isLoading && <p className="text-sm text-text-muted dark:text-text-muted">Loading pods…</p>}
      {!isLoading && (!data || data.length === 0) && (
        <p className="text-sm text-text-muted dark:text-text-muted">No pods in this cohort yet.</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {(data ?? []).map((pod) => (
          <button
            key={pod.id}
            type="button"
            onClick={() => onSelect(pod)}
            className="text-left bg-card border border-border rounded-xl p-4 hover:border-border-strong transition-colors dark:bg-card dark:border-border"
          >
            <p className="font-medium text-text-primary dark:text-text-primary">{pod.name}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Lightweight add-member panel: browse everyone not already in this pod,
 *  "Add" assigns them here. Not the full PeopleGrid picker-mode with
 *  committed/warning-modal behavior — that's for assignment/resource
 *  rosters specifically, not pod membership, which has no "committed"
 *  concept to protect against. */
function AddMemberPanel({ podId, onAdded }: { podId: string; onAdded: () => void }) {
  const queryClient = useQueryClient();

  return (
    <PeopleGrid
      fieldDefs={USER_POD_FIELD_DEFS}
      viewKey={`add-to-pod-${podId}`}
      queryKey={["add-to-pod", podId]}
      queryFn={async (filterState, sortState) => {
        const rows = await fetchUsersForPodsTab(filterState, sortState);
        return rows
          .filter((r) => r.podId === null && r.approvalStatus === "approved") // was: r.podId !== podId
          .map((r) => ({
            id: r.userId,
            fullName: r.fullName,
            email: r.email,
            role: r.role,
            approvalStatus: r.approvalStatus,
          }));
      }}
      computeClickable={() => false}
      renderActions={(p: UserCardPerson) => (
        <button
          type="button"
          onClick={async () => {
            await assignUserToPod(p.id, podId);
            queryClient.invalidateQueries({ queryKey: ["pod-roster", podId] });
            onAdded();
          }}
          className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
        >
          Add
        </button>
      )}
      emptyMessage="Everyone matching these filters is already in this pod."
      defaultView="list"
    />
  );
}

interface PodRosterMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: UserCardPerson["role"];
}

function PodRosterView({ podId, cohortName, podName }: { podId: string; cohortName: string; podName: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [addingMember, setAddingMember] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["pod-roster", podId],
    queryFn: () => fetchPodRoster(podId),
  });

  async function handleRemove(userId: string) {
    await removeUserFromPod(userId);
    queryClient.invalidateQueries({ queryKey: ["pod-roster", podId] });
  }

  function openProfile(userId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("user", userId);
    router.push(`?${params.toString()}`);
  }

  const members = (data ?? []) as PodRosterMember[];

  return (
    <div className="space-y-4">
      {/* Pod name + Add button share the same header row, per spec */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-text-muted dark:text-text-muted">{cohortName}</p>
          <h3 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary">{podName}</h3>
        </div>
        <button
          type="button"
          onClick={() => setAddingMember((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          {addingMember ? "Close" : "Add member"}
        </button>
      </div>

      {addingMember && (
        <div className="bg-card-alt border border-border rounded-xl p-3 dark:bg-card-alt dark:border-border">
          <AddMemberPanel podId={podId} onAdded={() => setAddingMember(false)} />
        </div>
      )}

      {isLoading && <p className="text-sm text-text-muted dark:text-text-muted">Loading roster…</p>}
      {!isLoading && members.length === 0 && (
        <p className="text-sm text-text-muted dark:text-text-muted">No members in this pod yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {members.map((member) => (
          <div
            key={member.user_id}
            className="flex items-center justify-between gap-3 bg-card border border-border rounded-xl px-3 py-2.5 dark:bg-card dark:border-border"
          >
            <button
              type="button"
              onClick={() => openProfile(member.user_id)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <RoleBadge role={member.role} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary hover:text-text-accent hover:underline dark:text-text-primary dark:hover:text-text-accent">
                  {member.full_name ?? member.user_id}
                </p>
                <p className="truncate text-xs text-text-muted dark:text-text-muted">{member.email ?? "no email"}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleRemove(member.user_id)}
              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 dark:text-destructive dark:hover:bg-destructive/20"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CohortsTab() {
  const [crumb, setCrumb] = useState<Crumb>({ level: "root" });

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs crumb={crumb} onNavigate={setCrumb} />

      {crumb.level === "root" && (
        <CohortList onSelect={(cohort) => setCrumb({ level: "cohort", id: cohort.id, name: cohort.name })} />
      )}

      {crumb.level === "cohort" && (
        <PodList
          cohortId={crumb.id}
          onSelect={(pod) =>
            setCrumb({ level: "pod", cohortId: crumb.id, cohortName: crumb.name, id: pod.id, name: pod.name })
          }
        />
      )}

      {crumb.level === "pod" && (
        <PodRosterView podId={crumb.id} cohortName={crumb.cohortName} podName={crumb.name} />
      )}

      {/* Reads ?user= — needs a Suspense boundary per app router rules for useSearchParams */}
      <Suspense fallback={null}>
        <UserProfileSheet />
      </Suspense>
    </div>
  );
}