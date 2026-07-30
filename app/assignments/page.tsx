// /app/assignments/page.tsx

"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { NAV_BY_PERMISSION } from "@/components/shell/NavConfig";
import { useRole } from "@/providers/role-provider";
import { useSessionStore } from "@/store/session-store";
import { AssignmentCard } from "@/components/assignments/AssignmentCard";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { AssignmentFormModal } from "@/components/assignments/AssignmentFormModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { fetchAssignmentsForRole, softDeleteAssignment } from "@/lib/api/assignments";
import type { Assignment } from "@/types/assignments";

type AssignmentLifecycle = "ongoing" | "upcoming" | "ended";

const MS_PER_DAY = 86_400_000;

function lifecycleOf(a: Assignment, today: string): AssignmentLifecycle {
  if (a.start_date > today) return "upcoming";
  if (a.end_date && a.end_date < today) return "ended";
  return "ongoing";
}

function daysSince(dateStr: string, today: string): number {
  return Math.floor((new Date(today).getTime() - new Date(dateStr).getTime()) / MS_PER_DAY);
}

function matchesSearch(a: Assignment, term: string): boolean {
  if (!term.trim()) return true;
  const needle = term.trim().toLowerCase();
  return a.title.toLowerCase().includes(needle) || a.description.toLowerCase().includes(needle);
}

interface FormModalState {
  mode: "create" | "edit";
  assignmentId?: string;
}

export default function AssignmentsListPage() {
  const { role, permissionLevel } = useRole();
  const userId = useSessionStore((s) => s.userId);
  const queryClient = useQueryClient();

  const [globalSearch, setGlobalSearch] = React.useState("");
  const [ongoingSearch, setOngoingSearch] = React.useState("");
  const [upcomingSearch, setUpcomingSearch] = React.useState("");
  const [endedSearch, setEndedSearch] = React.useState("");
  const [formModal, setFormModal] = React.useState<FormModalState | null>(null);

  const { data: assignments, isLoading, refetch } = useQuery({
    queryKey: ["assignments", "list", role, userId],
    queryFn: () => fetchAssignmentsForRole({ role, userId }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => softDeleteAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments", "list", role, userId] });
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const isMentee = permissionLevel === "mentee";
  const canCreate = permissionLevel === "mentor" || permissionLevel === "staff";
  const scopeToMentorId = role === "mentor" ? userId ?? undefined : undefined;

  const globallyFiltered = (assignments ?? []).filter((a) => matchesSearch(a, globalSearch));

  if (isMentee) {
    const visible = globallyFiltered.filter((a) => {
      const lifecycle = lifecycleOf(a, today);
      if (lifecycle === "upcoming") return false;
      if (lifecycle === "ended" && a.end_date && daysSince(a.end_date, today) > 7) return false;
      return true;
    });

    return (
        <div className="flex flex-col gap-4 p-4">
          <SearchInput value={globalSearch} onChange={setGlobalSearch} placeholder="Search assignments…" />
          {isLoading ? (
            <div className="text-sm text-text-primary/50 dark:text-text-primary/60">Loading…</div>
          ) : visible.length === 0 ? (
            <EmptyState title="No Active Assignments" description="No assignments are assigned to you at the moment." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((a) => (
                <AssignmentCard key={a.id} assignment={a} href={`/assignments/${a.id}`} />
              ))}
            </div>
          )}
        </div>
    );
  }

  const ongoing = globallyFiltered.filter((a) => lifecycleOf(a, today) === "ongoing" && matchesSearch(a, ongoingSearch));
  const upcoming = globallyFiltered.filter((a) => lifecycleOf(a, today) === "upcoming" && matchesSearch(a, upcomingSearch));
  const ended = globallyFiltered.filter((a) => lifecycleOf(a, today) === "ended" && matchesSearch(a, endedSearch));

  function renderManagedGrid(list: Assignment[], emptyLabel: string) {
    if (list.length === 0) {
      return <p className="px-1 text-xs text-text-primary/50 dark:text-text-primary/60">{emptyLabel}</p>;
    }
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => (
          <AssignmentCard
            key={a.id}
            assignment={a}
            href={`/assignments/${a.id}`}
            onEdit={() => setFormModal({ mode: "edit", assignmentId: a.id })}
            onDelete={() => deleteMutation.mutateAsync(a.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput value={globalSearch} onChange={setGlobalSearch} placeholder="Search all assignments…" className="sm:max-w-sm" />
          {canCreate && (
            <button
              type="button"
              onClick={() => setFormModal({ mode: "create" })}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground dark:bg-primary dark:text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Create assignment
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-sm text-text-primary/50 dark:text-text-primary/60">Loading…</div>
        ) : (
          <div className="flex flex-col gap-4">
            <CollapsibleSection title="Ongoing" count={ongoing.length} accentClassName="bg-primary" defaultOpen>
              <SearchInput value={ongoingSearch} onChange={setOngoingSearch} placeholder="Search ongoing…" />
              {renderManagedGrid(ongoing, "No ongoing assignments.")}
            </CollapsibleSection>

            <CollapsibleSection title="Upcoming" count={upcoming.length} accentClassName="bg-text-primary/40" defaultOpen={false}>
              <SearchInput value={upcomingSearch} onChange={setUpcomingSearch} placeholder="Search upcoming…" />
              {renderManagedGrid(upcoming, "No upcoming assignments.")}
            </CollapsibleSection>

            <CollapsibleSection title="Ended" count={ended.length} accentClassName="bg-secondary-foreground/40" defaultOpen={false}>
              <SearchInput value={endedSearch} onChange={setEndedSearch} placeholder="Search ended…" />
              {renderManagedGrid(ended, "No ended assignments.")}
            </CollapsibleSection>
          </div>
        )}
      </div>

      {canCreate && userId && formModal && (
        <AssignmentFormModal
          open={!!formModal}
          onClose={() => setFormModal(null)}
          mode={formModal.mode}
          assignmentId={formModal.assignmentId}
          currentUserId={userId}
          scopeToMentorId={scopeToMentorId}
          onSaved={() => {
            setFormModal(null);
            refetch();
          }}
        />
      )}
    </>
  );
}

function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={cnLocal("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-primary/40 dark:text-text-primary/50" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-background py-2 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-primary/40 focus:outline-none dark:bg-white/5 dark:border-border dark:text-text-primary dark:placeholder:text-text-primary/50"
      />
    </div>
  );
}

function cnLocal(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}