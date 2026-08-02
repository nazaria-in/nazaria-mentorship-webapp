// components/exit-survey/PendingExitSurveysWidget.tsx
"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchPendingExitSurveys } from "@/lib/api/exit-surveys";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";

export interface PendingExitSurveysWidgetProps {
  userId: string | null;
  /** Extra className passed straight to CollapsibleSection, e.g. margin when mounted above the meetings calendar. */
  className?: string;
}

/**
 * Collapsible "unfilled exit surveys" list for a mentee/mentor's own
 * outstanding surveys. Shared between /dashboard and /meetings so both
 * surfaces stay in sync automatically.
 *
 * Renders nothing at all once loaded with zero pending surveys — this is
 * meant to behave like a notification, not a permanent fixture, so it
 * never adds visual weight to /meetings when there's nothing outstanding.
 */
export function PendingExitSurveysWidget({ userId, className }: PendingExitSurveysWidgetProps) {
  const { data: surveys, isLoading } = useQuery({
    queryKey: ["exit-surveys", "pending", userId],
    queryFn: () => fetchPendingExitSurveys(userId as string),
    enabled: !!userId,
  });

  if (isLoading || !surveys || surveys.length === 0) {
    return null;
  }

  return (
    <CollapsibleSection
      title="Unfilled exit surveys"
      count={surveys.length}
      defaultOpen={false}
      accentClassName="bg-destructive"
      className={className}
    >
      <div className="flex flex-col gap-2">
        {surveys.map((survey) => (
          <Link
            key={survey.exitSurveyId}
            href={`/exit-survey/${survey.exitSurveyId}`}
            className="flex flex-col gap-0.5 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:bg-card-alt dark:border-white/10"
          >
            <span className="text-sm font-medium text-text-primary">
              {survey.subjectFullName ?? survey.title}
            </span>
            <span className="text-xs text-text-muted">
              Meeting: {survey.title} · {formatRelativeAge(survey.createdAt)}
            </span>
          </Link>
        ))}
      </div>
    </CollapsibleSection>
  );
}

function formatRelativeAge(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDay < 1) return "created today";
  if (diffDay === 1) return "created 1 day ago";
  return `created ${diffDay} days ago`;
}