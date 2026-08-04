// /components/content/UpcomingContentWidget.tsx

"use client";

import { useQueries } from "@tanstack/react-query";
import { fetchMenteeContentDispatches } from "@/lib/api/content-dispatches";
import { MenteeContentCard } from "@/components/content/MenteeContentCard";
import { EmptyState } from "@/components/shared/EmptyState";
import type { ContentType, MenteeContentDispatch } from "@/types/content";

const CONTENT_TYPES: ContentType[] = ["assignment", "course", "resource"];

interface UpcomingContentWidgetProps {
  menteeId: string;
  /** Cap on how many items to show — the widget fetches everything, sorts, then slices. */
  limit?: number;
}

/**
 * Dashboard widget: a mentee's nearest not-yet-done items across all three
 * content types, sorted by due date (items with no due date sort last).
 * Reuses fetchMenteeContentDispatches per type (same source the
 * /assignments_and_courses list page uses) rather than a new query, so
 * "upcoming" here always matches what the mentee sees on that page —
 * including the submission-window gating already applied there.
 */
export function UpcomingContentWidget({ menteeId, limit = 5 }: UpcomingContentWidgetProps) {
  const queries = useQueries({
    queries: CONTENT_TYPES.map((contentType) => ({
      queryKey: ["content-dispatches", "mentee", contentType, menteeId],
      queryFn: () => fetchMenteeContentDispatches(menteeId, contentType),
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const hasError = queries.some((q) => q.isError);

  const allDispatches: MenteeContentDispatch[] = queries.flatMap((q) => q.data ?? []);
  const notDone = allDispatches.filter(
    (d) => d.completion_status !== "completed" && d.completion_status !== "approved_awaiting_completion"
  );

  const sorted = [...notDone].sort((a, b) => {
    if (!a.due_at && !b.due_at) return 0;
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });

  const visible = sorted.slice(0, limit);

  return (
    <section className="surface-card flex flex-col gap-3 dark:surface-card">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted">
        Upcoming
      </h2>

      {isLoading ? (
        <p className="text-xs text-text-muted dark:text-text-muted">Loading…</p>
      ) : hasError ? (
        <p className="text-xs text-destructive dark:text-destructive">Couldn&apos;t load upcoming items.</p>
      ) : visible.length === 0 ? (
        <EmptyState title="You're all caught up" description="Nothing outstanding right now." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((d) => (
            <MenteeContentCard
              key={`${d.content_item.content_type}-${d.content_item.id}`}
              dispatch={d}
              href={`/assignments_and_courses/${d.content_item.id}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}