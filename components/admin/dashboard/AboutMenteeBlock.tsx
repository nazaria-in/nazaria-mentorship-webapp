// components/admin/dashboard/AboutMenteeBlock.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { fetchMenteeOverview } from "@/lib/api/admin-scope-details";
import { fetchPendingExitSurveysForUser } from "@/lib/api/exit-surveys";
import type { AdminScope } from "@/lib/api/admin-scope";

const SIGNAL_DOT: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-text-accent",
};

export function AboutMenteeBlock({ scope }: { scope: AdminScope }) {
  const { data, isLoading } = useQuery({
    queryKey: ["mentee-overview", scope.userId],
    queryFn: () => fetchMenteeOverview(scope),
  });

  const { data: pendingSurveys, isLoading: pendingSurveysLoading } = useQuery({
    queryKey: ["exit-surveys", "pending", scope.userId],
    queryFn: () => fetchPendingExitSurveysForUser(scope.userId),
  });

  if (isLoading || !data) {
    return <p className="text-sm text-text-muted dark:text-text-muted">Loading…</p>;
  }

  const pct = data.totalAssignments > 0 ? Math.round((data.completedAssignments / data.totalAssignments) * 100) : null;

  return (
    <div className="grid gap-3 bg-gray-100 p-4 rounded-xl sm:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-4 dark:border-border dark:bg-card">
        <p className="text-xs text-text-muted dark:text-text-muted">Pod</p>
        <p className="text-sm font-medium text-text-primary dark:text-text-primary">{data.podName ?? "No pod"}</p>
        {data.mentorNames.length > 0 && (
          <p className="mt-1 text-xs text-text-muted dark:text-text-muted">
            Mentor{data.mentorNames.length > 1 ? "s" : ""}: {data.mentorNames.join(", ")}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 dark:border-border dark:bg-card">
        <p className="text-xs text-text-muted dark:text-text-muted">Assignment completion</p>
        <p className="text-sm font-medium text-text-primary dark:text-text-primary">
          {pct !== null ? `${pct}%` : "No assignments yet"}
          {data.totalAssignments > 0 && (
            <span className="text-text-muted dark:text-text-muted"> ({data.completedAssignments}/{data.totalAssignments})</span>
          )}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 dark:border-border dark:bg-card">
        <p className="text-xs text-text-muted dark:text-text-muted">Resource progress</p>
        {Object.keys(data.resourceStatusCounts).length === 0 ? (
          <p className="text-sm text-text-muted dark:text-text-muted">No resources yet</p>
        ) : (
          <div className="mt-1 flex flex-wrap gap-2">
            {Object.entries(data.resourceStatusCounts).map(([status, count]) => (
              <span
                key={status}
                className="rounded-full bg-card-alt px-2 py-0.5 text-xs capitalize text-text-primary dark:bg-card-alt dark:text-text-primary"
              >
                {status}: {count}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 dark:border-border dark:bg-card">
        <p className="text-xs text-text-muted dark:text-text-muted">Most recent exit survey</p>
        {data.latestSurvey ? (
          <div className="mt-1 flex items-start gap-2">
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${data.latestSurvey.signal ? SIGNAL_DOT[data.latestSurvey.signal] : "bg-text-muted"}`} />
            <div>
              <p className="text-sm text-text-primary dark:text-text-primary">
                {data.latestSurvey.aiHeadline ?? "No summary available"}
              </p>
              <p className="text-xs text-text-muted dark:text-text-muted">
                {data.latestSurvey.submittedAt ? new Date(data.latestSurvey.submittedAt).toLocaleDateString() : ""}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted dark:text-text-muted">No submitted surveys yet</p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 dark:border-border dark:bg-card sm:col-span-2">
        <p className="text-xs text-text-muted dark:text-text-muted">Unfilled exit surveys</p>
        {pendingSurveysLoading ? (
          <p className="mt-1 text-sm text-text-muted dark:text-text-muted">Loading…</p>
        ) : !pendingSurveys || pendingSurveys.length === 0 ? (
          <p className="mt-1 text-sm text-text-primary dark:text-text-primary">None — all caught up.</p>
        ) : (
          <div className="mt-1.5 flex flex-col gap-1.5">
            {pendingSurveys.map((survey) => (
              <Link
                key={survey.exitSurveyId}
                href={`/exit-survey/${survey.exitSurveyId}`}
                className="flex items-center justify-between gap-2 rounded-lg bg-card-alt px-2.5 py-1.5 text-xs hover:opacity-90 dark:bg-card-alt"
              >
                <span className="truncate text-text-primary dark:text-text-primary">{survey.title}</span>
                <span className="shrink-0 text-text-muted dark:text-text-muted">
                  {new Date(survey.createdAt).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}