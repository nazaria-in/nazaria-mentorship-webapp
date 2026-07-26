// /components/exit-survey/ExitSurveyPendingList.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchPendingExitSurveys,
  fetchSubmittedExitSurveysForUser,
  type PendingExitSurvey,
} from "@/lib/api/exit-surveys";
import type { ExitSurveyRole, ExitSurveyRow } from "@/types/exit-survey";

interface ExitSurveyPendingListProps {
  userId: string;
  role: ExitSurveyRole;
}

export function ExitSurveyPendingList({ userId, role }: ExitSurveyPendingListProps) {
  const [pending, setPending] = useState<PendingExitSurvey[]>([]);
  const [submitted, setSubmitted] = useState<ExitSurveyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [pendingRows, submittedRows] = await Promise.all([
          fetchPendingExitSurveys(userId),
          fetchSubmittedExitSurveysForUser(userId),
        ]);
        if (!cancelled) {
          setPending(pendingRows);
          setSubmitted(submittedRows);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load exit surveys.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (isLoading) {
    return <p className="text-sm text-text-muted dark:text-text-muted">Loading...</p>;
  }
  if (error) {
    return <p className="text-sm text-destructive dark:text-destructive">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-text-muted dark:text-text-muted">
          Pending
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-text-muted dark:text-text-muted">Nothing pending — you&apos;re caught up.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map((item) => (
              <Link
                key={item.exitSurveyId}
                href={`/exit-survey/${item.exitSurveyId}`}
                className="surface-card flex items-center justify-between dark:surface-card"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary dark:text-text-primary">
                    {item.title}
                    {role === "mentor" && item.subjectFullName ? ` — about ${item.subjectFullName}` : ""}
                  </p>
                  <p className="text-xs text-text-muted dark:text-text-muted">
                    {new Date(item.startsAt).toLocaleString()}
                  </p>
                </div>
                <span className="text-sm text-text-accent dark:text-text-accent">Fill →</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-text-muted dark:text-text-muted">
          Previously submitted
        </h2>
        {submitted.length === 0 ? (
          <p className="text-sm text-text-muted dark:text-text-muted">Nothing submitted yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {submitted.map((row) => (
              <Link
                key={row.id}
                href={`/exit-survey/${row.id}`}
                className="surface-card flex items-center justify-between dark:surface-card"
              >
                <p className="text-sm text-text-primary dark:text-text-primary">
                  Submitted {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : ""}
                </p>
                <span className="text-sm text-text-accent dark:text-text-accent">View →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}