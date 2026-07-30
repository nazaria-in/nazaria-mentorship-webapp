// components/admin/CohortsTab.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  fetchCohorts,
  fetchPodsForCohort,
  fetchPodRoster,
  type CohortSummary,
  type PodSummary,
} from "@/lib/api/cohorts-browser";
import { RoleBadge } from "@/components/admin/RoleBadge";
import { UserProfileSheet } from "@/components/shared/UserProfileSheet";

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
  if (crumb.level === "pod") {
    parts.push({ label: crumb.name, target: crumb });
  }

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
          <p className="font-heading font-semibold text-text-primary dark:text-text-primary">
            {cohort.name}
          </p>
          <p className="text-sm text-text-muted dark:text-text-muted capitalize">{cohort.status}</p>
        </button>
      ))}
    </div>
  );
}

function PodList({ cohortId, onSelect }: { cohortId: string; onSelect: (pod: PodSummary) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["pods-for-cohort", cohortId],
    queryFn: () => fetchPodsForCohort(cohortId),
  });

  if (isLoading) return <p className="text-sm text-text-muted dark:text-text-muted">Loading pods…</p>;
  if (!data || data.length === 0)
    return <p className="text-sm text-text-muted dark:text-text-muted">No pods in this cohort yet.</p>;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {data.map((pod) => (
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
  );
}

function PodRosterList({ podId }: { podId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isLoading } = useQuery({
    queryKey: ["pod-roster", podId],
    queryFn: () => fetchPodRoster(podId),
  });

  const openProfile = (userId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("user", userId);
    router.push(`?${params.toString()}`);
  };

  if (isLoading) return <p className="text-sm text-text-muted dark:text-text-muted">Loading roster…</p>;
  if (!data || data.length === 0)
    return <p className="text-sm text-text-muted dark:text-text-muted">No members in this pod yet.</p>;

  const mentors = data.filter((m) => m.role === "mentor");
  const mentees = data.filter((m) => m.role === "mentee");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-text-muted mb-2 dark:text-text-muted">
          Mentors ({mentors.length})
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {mentors.map((m) => (
            <button
              key={m.user_id}
              type="button"
              onClick={() => openProfile(m.user_id)}
              className="text-left bg-card border border-border rounded-xl p-3 hover:border-border-strong transition-colors dark:bg-card dark:border-border"
            >
              <div className="flex items-center gap-2">
                <RoleBadge role={m.role} />
                <span className="text-sm font-medium text-text-primary dark:text-text-primary">
                  {m.full_name ?? m.user_id}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5 dark:text-text-muted">
                {m.email ?? "no email"}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-text-muted mb-2 dark:text-text-muted">
          Mentees ({mentees.length})
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {mentees.map((m) => (
            <button
              key={m.user_id}
              type="button"
              onClick={() => openProfile(m.user_id)}
              className="text-left bg-card border border-border rounded-xl p-3 hover:border-border-strong transition-colors dark:bg-card dark:border-border"
            >
              <div className="flex items-center gap-2">
                <RoleBadge role={m.role} />
                <span className="text-sm font-medium text-text-primary dark:text-text-primary">
                  {m.full_name ?? m.user_id}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5 dark:text-text-muted">
                {m.email ?? "no email"}
              </p>
            </button>
          ))}
        </div>
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
        <CohortList
          onSelect={(cohort) => setCrumb({ level: "cohort", id: cohort.id, name: cohort.name })}
        />
      )}

      {crumb.level === "cohort" && (
        <PodList
          cohortId={crumb.id}
          onSelect={(pod) =>
            setCrumb({
              level: "pod",
              cohortId: crumb.id,
              cohortName: crumb.name,
              id: pod.id,
              name: pod.name,
            })
          }
        />
      )}

      {crumb.level === "pod" && <PodRosterList podId={crumb.id} />}

      <UserProfileSheet />
    </div>
  );
}