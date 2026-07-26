// /components/exit-survey/ExitSurveyMeetingSection.tsx
"use client";

import { useEffect, useState } from "react";
import { ExitSurveyForm } from "@/components/exit-survey/ExitSurveyForm";
import { getExitSurveysForMeeting, submitExitSurvey } from "@/lib/api/exit-surveys";
import type { ExitSurveyRow, ExitSurveySubmission } from "@/types/exit-survey";

interface ExitSurveyMeetingSectionProps {
  meetingId: string;
  userId: string;
}

/**
 * Drop this into the meeting detail page. Shows every exit_surveys row that
 * belongs to the current user for this meeting — for a mentee that's one
 * row, for a mentor with multiple mentees in the meeting that's one row
 * per mentee (each with its own subjectUserId).
 */
export function ExitSurveyMeetingSection({ meetingId, userId }: ExitSurveyMeetingSectionProps) {
  const [rows, setRows] = useState<ExitSurveyRow[]>([]);
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const allRows = await getExitSurveysForMeeting(meetingId);
        if (!cancelled) setRows(allRows.filter((r) => r.userId === userId));
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Couldn't load exit surveys.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [meetingId, userId]);

  async function handleSubmit(submission: ExitSurveySubmission) {
    const updated = await submitExitSurvey(submission);
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setOpenRowId(null);
  }

  if (isLoading) {
    return (
      <div className="surface-card dark:surface-card">
        <p className="text-sm text-text-muted dark:text-text-muted">Checking exit survey status...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="surface-card dark:surface-card">
        <p className="text-sm text-destructive dark:text-destructive">{loadError}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="surface-card dark:surface-card">
        <p className="text-sm text-text-muted dark:text-text-muted">No exit survey for this meeting.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => {
        if (openRowId === row.id) {
          return (
            <ExitSurveyForm
              key={row.id}
              exitSurveyId={row.id}
              role={row.userRole}
              templateSnapshot={row.templateSnapshot}
              onSubmit={handleSubmit}
            />
          );
        }

        return (
          <div key={row.id} className="surface-card flex items-center justify-between dark:surface-card">
            <div>
              <p className="text-sm font-medium text-text-primary dark:text-text-primary">
                {row.submittedAt ? "Exit survey submitted" : "Exit survey not yet submitted"}
              </p>
              {row.submittedAt && (
                <p className="mt-1 text-xs text-text-muted dark:text-text-muted">
                  Signal: {row.signal} · Submitted {new Date(row.submittedAt).toLocaleString()}
                </p>
              )}
            </div>
            {!row.submittedAt && (
              <button
                type="button"
                onClick={() => setOpenRowId(row.id)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground dark:bg-primary dark:text-primary-foreground"
              >
                Fill exit survey
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}