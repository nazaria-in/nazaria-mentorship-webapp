// /app/exit-survey/[exitSurveyId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import { NAV_BY_PERMISSION } from "@/components/shell/NavConfig";
import { useRole } from "@/providers/role-provider";
import { ExitSurveyForm } from "@/components/exit-survey/ExitSurveyForm";
import { ExitSurveyReportView } from "@/components/exit-survey/ExitSurveyReportView";
import { getExitSurveyDetailById, submitExitSurvey, type ExitSurveyDetail } from "@/lib/api/exit-surveys";
import type { ExitSurveySubmission } from "@/types/exit-survey";

export default function ExitSurveyDetailPage() {
  const params = useParams<{ exitSurveyId: string }>();
  const exitSurveyId = params.exitSurveyId;
  const { permissionLevel } = useRole();
  const isStaff = permissionLevel === "staff";

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExitSurveyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser) {
          if (!cancelled) setError("Not logged in.");
          return;
        }

        const row = await getExitSurveyDetailById(exitSurveyId);
        if (!row) {
          if (!cancelled) setError("Exit survey not found.");
          return;
        }

        if (!cancelled) {
          setCurrentUserId(authUser.id);
          setDetail(row);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [exitSurveyId]);

  async function handleSubmit(submission: ExitSurveySubmission) {
    await submitExitSurvey(submission);
    const refreshed = await getExitSurveyDetailById(exitSurveyId);
    setDetail(refreshed);
  }

  return (
      <div className="mx-auto max-w-2xl p-4 md:p-6">
        {isLoading ? (
          <p className="text-sm text-text-muted dark:text-text-muted">Loading...</p>
        ) : error ? (
          <p className="text-sm text-destructive dark:text-destructive">{error}</p>
        ) : !detail || !currentUserId ? null : (
          renderContent(detail, currentUserId, isStaff, handleSubmit)
        )}
      </div>
  );
}

function renderContent(
  detail: ExitSurveyDetail,
  currentUserId: string,
  isStaff: boolean,
  onSubmit: (submission: ExitSurveySubmission) => Promise<void>
) {
  const isOwner = detail.userId === currentUserId;

  // Staff: always the full report, submitted or not.
  if (isStaff) {
    if (!detail.submittedAt) {
      return (
        <div className="surface-card dark:surface-card">
          <p className="text-sm font-medium text-text-primary dark:text-text-primary">
            {detail.meetingTitle} — not yet submitted
          </p>
          <p className="mt-1 text-sm text-text-muted dark:text-text-muted">
            {detail.userRole === "mentor" ? "Mentor" : "Mentee"} survey
            {detail.subjectFullName ? ` about ${detail.subjectFullName}` : ""}, waiting on{" "}
            {detail.submitterFullName ?? "the submitter"}.
          </p>
        </div>
      );
    }
    return <ExitSurveyReportView detail={detail} redacted={false} />;
  }

  // Not staff and not the owner — nothing to show.
  if (!isOwner) {
    return (
      <p className="text-sm text-text-muted dark:text-text-muted">
        This exit survey isn&apos;t visible to your account.
      </p>
    );
  }

  // Owner, not yet submitted — fill it in.
  if (!detail.submittedAt) {
    return (
      <ExitSurveyForm
        exitSurveyId={detail.id}
        role={detail.userRole}
        templateSnapshot={detail.templateSnapshot}
        voicePromptLabel={detail.voicePromptLabel}
        subjectFullName={detail.userRole === "mentor" ? detail.subjectFullName : undefined}
        onSubmit={onSubmit}
      />
    );
  }

  // Owner, already submitted — redacted view (no AI triage fields).
  return <ExitSurveyReportView detail={detail} redacted={true} />;
}