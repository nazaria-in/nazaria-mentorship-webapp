
// components/admin/dashboard/AboutMenteeBlock.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { fetchMenteeOverview } from "@/lib/api/admin-scope-details";
import { fetchMenteeProfileDetails } from "@/lib/api/admin-scope-details";
import { fetchPendingExitSurveysForUser } from "@/lib/api/exit-surveys";
import type { AdminScope } from "@/lib/api/admin-scope";

const SIGNAL_DOT: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-text-accent",
};

export function AboutMenteeBlock({ scope }: { scope: AdminScope }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["mentee-overview", scope.userId],
    queryFn: () => fetchMenteeOverview(scope),
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["mentee-profile-details", scope.userId],
    queryFn: () => fetchMenteeProfileDetails(scope.userId),
  });

  const { data: pendingSurveys, isLoading: pendingSurveysLoading } = useQuery({
    queryKey: ["exit-surveys", "pending", scope.userId],
    queryFn: () => fetchPendingExitSurveysForUser(scope.userId),
  });

  if (isError) {
    return (
      <p className="text-sm text-destructive dark:text-destructive">
        Couldn&apos;t load this mentee&apos;s overview — {error instanceof Error ? error.message : "unknown error"}.
      </p>
    );
  }

  if (isLoading || !data) {
    return <p className="text-sm text-text-muted dark:text-text-muted">Loading…</p>;
  }

  const pct = data.totalAssignments > 0 ? Math.round((data.completedAssignments / data.totalAssignments) * 100) : null;

  return (
    <div className="grid gap-3 bg-gray-100 p-4 rounded-xl sm:grid-cols-2">
      {/* --- Profile details --- */}
      <div className="rounded-xl border border-border bg-card p-4 dark:border-border dark:bg-card sm:col-span-2">
        <p className="text-xs text-text-muted dark:text-text-muted">Profile</p>
        {profileLoading ? (
          <p className="mt-1 text-sm text-text-muted dark:text-text-muted">Loading…</p>
        ) : !profile ? (
          <p className="mt-1 text-sm text-text-muted dark:text-text-muted">Couldn&apos;t load profile details.</p>
        ) : (
          <div className="mt-1.5 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-text-primary dark:text-text-primary">
                {profile.fullName ?? "Unnamed"}
              </span>
              <span className="rounded-full bg-card-alt px-2 py-0.5 text-[11px] capitalize text-text-muted dark:bg-card-alt dark:text-text-muted">
                {profile.role}
              </span>
              <span className="rounded-full bg-card-alt px-2 py-0.5 text-[11px] capitalize text-text-muted dark:bg-card-alt dark:text-text-muted">
                {profile.approvalStatus}
              </span>
            </div>
            <p className="text-xs text-text-muted dark:text-text-muted">{profile.email ?? "No email on file"}</p>

            {profile.schoolOrOrg && (
              <p className="text-sm text-text-primary dark:text-text-primary">{profile.schoolOrOrg}</p>
            )}
            {profile.bio && (
              <p className="text-sm text-text-primary dark:text-text-primary">{profile.bio}</p>
            )}
            {profile.backgroundNotes && (
              <p className="text-xs text-text-muted dark:text-text-muted">{profile.backgroundNotes}</p>
            )}
            {profile.goals && profile.goals.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {profile.goals.map((g, i) => (
                  <span key={i} className="rounded-full bg-card-alt px-2 py-0.5 text-[11px] text-text-primary dark:bg-card-alt dark:text-text-primary">
                    {g}
                  </span>
                ))}
              </div>
            )}
            {profile.interests && profile.interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {profile.interests.map((interest, i) => (
                  <span key={i} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted dark:border-border dark:text-text-muted">
                    {interest}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 dark:border-border dark:bg-card">
        <p className="text-xs text-text-muted dark:text-text-muted">Team</p>
        <p className="text-sm font-medium text-text-primary dark:text-text-primary">{data.podName ?? "No Team"}</p>
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