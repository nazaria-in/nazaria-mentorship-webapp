// /components/exit-survey/ExitSurveyStaffWidget.tsx
"use client";

import { useEffect, useState } from "react";
import { getRecentExitSurveysForStaff } from "@/lib/api/exit-surveys";
import type { ExitSurveyRow, ExitSurveySignal } from "@/types/exit-survey";

const SIGNAL_DOT: Record<ExitSurveySignal, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
};

/** For PM/associate dashboards. Pre-sorted red → yellow → green by the query. */
export function ExitSurveyStaffWidget() {
  const [surveys, setSurveys] = useState<ExitSurveyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getRecentExitSurveysForStaff();
        if (!cancelled) setSurveys(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load exit surveys.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="surface-card flex flex-col gap-3 dark:surface-card">
      <h3 className="font-heading text-lg text-text-primary dark:text-text-primary">Exit surveys</h3>

      {isLoading && <p className="text-sm text-text-muted dark:text-text-muted">Loading...</p>}
      {error && <p className="text-sm text-destructive dark:text-destructive">{error}</p>}

      {!isLoading && !error && surveys.length === 0 && (
        <p className="text-sm text-text-muted dark:text-text-muted">No exit surveys yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {surveys.map((survey) => (
          <div
            key={survey.id}
            className="surface-card-alt flex items-center justify-between dark:surface-card-alt"
          >
            <div>
              <p className="text-sm font-medium text-text-primary dark:text-text-primary">
                {survey.userRole} · {new Date(survey.createdAt).toLocaleDateString()}
              </p>
              {survey.aiSummary && (
                <p className="mt-1 text-xs text-text-muted dark:text-text-muted">{survey.aiSummary}</p>
              )}
            </div>
            <span
              className={`h-3 w-3 shrink-0 rounded-full ${SIGNAL_DOT[survey.signal]}`}
              aria-label={`Signal: ${survey.signal}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}