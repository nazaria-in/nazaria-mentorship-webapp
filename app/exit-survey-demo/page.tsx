// /app/(dev)/exit-survey-demo/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ExitSurveyForm } from "@/components/exit-survey/ExitSurveyForm";
import {
  fetchPendingExitSurveys,
  getExitSurveyById,
  submitExitSurvey,
  type PendingExitSurvey,
} from "@/lib/api/exit-surveys";
import type { ExitSurveyRole, ExitSurveyRow, ExitSurveySubmission } from "@/types/exit-survey";

/**
 * Dev-only page. Uses the real logged-in session and the real pending list
 * (rows are now pre-created at meeting-creation time — see
 * /app/api/meetings/route.ts — so "pending" means "row exists, not yet
 * submitted" rather than "no row yet"). Selecting a pending item fetches
 * that row's frozen template_snapshot and renders the form from it.
 */
export default function ExitSurveyDemoPage() {
  const [role, setRole] = useState<ExitSurveyRole | null>(null);
  const [pending, setPending] = useState<PendingExitSurvey[]>([]);
  const [selectedRow, setSelectedRow] = useState<ExitSurveyRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submittedCount, setSubmittedCount] = useState(0);

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

  async function handleSelect(exitSurveyId: string) {
    setLoadError(null);
    try {
      const row = await getExitSurveyById(exitSurveyId);
      if (!row) {
        setLoadError("Couldn't load that exit survey row.");
        return;
      }
      setSelectedRow(row);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load exit survey.");
    }
  }

  async function handleSubmit(submission: ExitSurveySubmission) {
    await submitExitSurvey(submission);
    setSubmittedCount((n) => n + 1);
    setPending((prev) => prev.filter((p) => p.exitSurveyId !== submission.exitSurveyId));
    setSelectedRow(null);
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

  if (!role) return null;

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

      {submittedCount > 0 && !selectedRow && (
        <p className="rounded-lg bg-card-alt p-3 text-sm text-text-primary dark:bg-card-alt dark:text-text-primary">
          {submittedCount} exit survey{submittedCount > 1 ? "s" : ""} submitted this session.
        </p>
      )}

      {pending.length === 0 && !selectedRow ? (
        <p className="text-sm text-text-muted dark:text-text-muted">
          No pending exit surveys — nothing left to fill in.
        </p>
      ) : selectedRow ? (
        <>
          <button
            type="button"
            onClick={() => setSelectedRow(null)}
            className="w-fit text-sm text-text-muted underline dark:text-text-muted"
          >
            ← Back to list
          </button>
          <ExitSurveyForm
            exitSurveyId={selectedRow.id}
            role={selectedRow.userRole}
            templateSnapshot={selectedRow.templateSnapshot}
            subjectFullName={
              pending.find((p) => p.exitSurveyId === selectedRow.id)?.subjectFullName ?? undefined
            }
            onSubmit={handleSubmit}
          />
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {pending.map((item) => (
            <button
              key={item.exitSurveyId}
              type="button"
              onClick={() => handleSelect(item.exitSurveyId)}
              className="surface-card flex items-center justify-between text-left dark:surface-card"
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
              <span className="text-sm text-text-accent dark:text-text-accent">Fill exit survey →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}