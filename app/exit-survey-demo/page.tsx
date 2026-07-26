// /app/(dev)/exit-survey-demo/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ExitSurveyForm } from "@/components/exit-survey/ExitSurveyForm";
import {
  fetchPendingExitSurveys,
  submitExitSurvey,
  type PendingExitSurvey,
} from "@/lib/api/exit-surveys";
import type { ExitSurveyRole, ExitSurveySubmission } from "@/types/exit-survey";

/**
 * Dev-only page. Unlike the earlier version, this uses the REAL logged-in
 * session and pulls the REAL list of meetings still needing an exit survey
 * (via v_pending_exit_surveys) instead of a hardcoded meetingId. This is
 * what makes the "log in as mentor in one browser profile, mentee in
 * another" demo flow work — each session sees only its own pending list.
 *
 * Run the seeder first (scripts/seed/exitSurveyDemoSeeder.ts) to get
 * accounts + a meeting to test against.
 */
export default function ExitSurveyDemoPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<ExitSurveyRole | null>(null);
  const [pending, setPending] = useState<PendingExitSurvey[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submittedMeetingId, setSubmittedMeetingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const supabase = createClient();
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser) {
          if (!cancelled) setLoadError("Not logged in. Log in as a mentor or mentee account first.");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("role")
          .eq("id", authUser.id)
          .single();

        if (profileError || !profile) {
          if (!cancelled) setLoadError("Couldn't load your user profile.");
          return;
        }

        const userRole = profile.role as string;
        if (userRole !== "mentor" && userRole !== "mentee") {
          if (!cancelled) {
            setLoadError(
              `Logged in as "${userRole}" — the exit survey form only applies to mentor/mentee accounts.`
            );
          }
          return;
        }

        const pendingSurveys = await fetchPendingExitSurveys(authUser.id);

        if (!cancelled) {
          setUserId(authUser.id);
          setRole(userRole as ExitSurveyRole);
          setPending(pendingSurveys);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(submission: ExitSurveySubmission) {
    await submitExitSurvey(submission);
    setSubmittedMeetingId(submission.meetingId);
    setPending((prev) => prev.filter((p) => p.meetingId !== submission.meetingId));
    setSelectedMeetingId(null);
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-text-muted dark:text-text-muted">Loading...</div>;
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <p className="text-sm text-destructive dark:text-destructive">{loadError}</p>
      </div>
    );
  }

  if (!userId || !role) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-heading text-2xl text-text-primary dark:text-text-primary">
          Exit survey demo
        </h1>
        <p className="text-sm text-text-muted dark:text-text-muted">
          Logged in as {role}. Showing meetings still needing your exit survey.
        </p>
      </div>

      {submittedMeetingId && (
        <p className="rounded-lg bg-card-alt p-3 text-sm text-text-primary dark:bg-card-alt dark:text-text-primary">
          Exit survey submitted for that meeting.
        </p>
      )}

      {pending.length === 0 ? (
        <p className="text-sm text-text-muted dark:text-text-muted">
          No pending exit surveys — nothing left to fill in.
        </p>
      ) : selectedMeetingId ? (
        <>
          <button
            type="button"
            onClick={() => setSelectedMeetingId(null)}
            className="w-fit text-sm text-text-muted underline dark:text-text-muted"
          >
            ← Back to list
          </button>
          <ExitSurveyForm
            meetingId={selectedMeetingId}
            userId={userId}
            role={role}
            onSubmit={handleSubmit}
          />
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {pending.map((meeting) => (
            <button
              key={meeting.meetingId}
              type="button"
              onClick={() => setSelectedMeetingId(meeting.meetingId)}
              className="surface-card flex items-center justify-between text-left dark:surface-card"
            >
              <div>
                <p className="text-sm font-medium text-text-primary dark:text-text-primary">
                  {meeting.title}
                </p>
                <p className="text-xs text-text-muted dark:text-text-muted">
                  {new Date(meeting.startsAt).toLocaleString()}
                </p>
              </div>
              <span className="text-sm text-text-accent dark:text-text-accent">Fill exit survey →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}