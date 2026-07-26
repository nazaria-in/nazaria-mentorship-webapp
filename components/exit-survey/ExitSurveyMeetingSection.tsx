// /components/exit-survey/ExitSurveyMeetingSection.tsx
"use client";

import { useEffect, useState } from "react";
import { ExitSurveyForm } from "@/components/exit-survey/ExitSurveyForm";
import {
  getExitSurveyForMeetingAndUser,
  submitExitSurvey,
} from "@/lib/api/exit-surveys";
import type { ExitSurveyRole, ExitSurveyRow, ExitSurveySubmission } from "@/types/exit-survey";

interface ExitSurveyMeetingSectionProps {
  meetingId: string;
  userId: string;
  role: ExitSurveyRole;
}

/**
 * Drop this into the meeting detail page. It's the "somewhere in the
 * meetings tab" entry point — independent of the notification nudge, so
 * someone who missed the notification can still find the form here.
 */
export function ExitSurveyMeetingSection({ meetingId, userId, role }: ExitSurveyMeetingSectionProps) {
  const [existingSurvey, setExistingSurvey] = useState<ExitSurveyRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const survey = await getExitSurveyForMeetingAndUser(meetingId, userId);
        if (!cancelled) setExistingSurvey(survey);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Couldn't load exit survey status.");
        }
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
    const saved = await submitExitSurvey(submission);
    setExistingSurvey(saved);
    setIsFormOpen(false);
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

  if (existingSurvey) {
    return (
      <div className="surface-card dark:surface-card">
        <p className="text-sm font-medium text-text-primary dark:text-text-primary">
          Exit survey submitted
        </p>
        <p className="mt-1 text-sm text-text-muted dark:text-text-muted">
          Signal: {existingSurvey.signal} · Submitted{" "}
          {new Date(existingSurvey.createdAt).toLocaleString()}
        </p>
      </div>
    );
  }

  if (!isFormOpen) {
    return (
      <div className="surface-card flex items-center justify-between dark:surface-card">
        <p className="text-sm text-text-primary dark:text-text-primary">Exit survey not yet submitted.</p>
        <button
          type="button"
          onClick={() => setIsFormOpen(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground dark:bg-primary dark:text-primary-foreground"
        >
          Fill exit survey
        </button>
      </div>
    );
  }

  return <ExitSurveyForm meetingId={meetingId} userId={userId} role={role} onSubmit={handleSubmit} />;
}