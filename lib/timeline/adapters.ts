// /lib/timeline/adapters.ts

import type * as React from "react";
import type { TimelineEvent } from "@/types/timeline";
import type { Meeting } from "@/types/meetings";
import type { MenteeContentDispatch, ContentItemWithMeta } from "@/types/content";
import type { InPersonSession } from "@/types/in-person-sessions";

/**
 * Meetings map 1:1 onto TimelineEvent — they already have starts_at/ends_at.
 * renderDetails/renderActions are passed in by the caller (page component)
 * rather than hardcoded here, since the modal content differs by role
 * (staff sees roster + cancel, mentee sees accept/decline).
 */
export function adaptMeetingToTimelineEvent(
  meeting: Meeting,
  options: {
    renderDetails: () => React.ReactNode;
    renderActions?: () => React.ReactNode;
    isMuted?: boolean;
  },
): TimelineEvent {
  return {
    id: `meeting:${meeting.id}`,
    type: "meeting",
    title: meeting.title,
    startsAt: meeting.starts_at,
    endsAt: meeting.ends_at,
    statusLabel: meeting.status === "cancelled" ? "Cancelled" : undefined,
    isMuted: options.isMuted ?? meeting.status === "cancelled",
    durationVariant: "short",
    renderDetails: options.renderDetails,
    renderActions: options.renderActions,
  };
}

/**
 * In-person sessions are materialized rows (see PROJECT_BUILD_CONTEXT §1) —
 * each week is a real row, so this adapter is identical in shape to the
 * meeting adapter. No recurrence-expansion logic belongs here; that
 * happens once, server-side, when occurrences are generated.
 */
export function adaptInPersonSessionToTimelineEvent(
  session: InPersonSession,
  options: {
    renderDetails: () => React.ReactNode;
    renderActions?: () => React.ReactNode;
  },
): TimelineEvent {
  return {
    id: `in_person_session:${session.id}`,
    type: "in_person_session",
    title: session.title,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    statusLabel: session.status === "cancelled" ? "Cancelled" : (session.location ?? undefined),
    isMuted: session.status === "cancelled",
    durationVariant: "short",
    renderDetails: options.renderDetails,
    renderActions: options.renderActions,
  };
}

/**
 * Content dispatches (assignment/course/resource) only belong on the
 * timeline when their parent content_item has a submission window set
 * (both submission_starts_at/submission_ends_at, per the DB's both-or-
 * neither constraint) — but on the timeline itself, only the due date
 * (submission_ends_at) is shown or used for placement. submission_starts_at
 * exists in the schema but is intentionally not surfaced here; every
 * dispatch event is a single point-in-time deadline node anchored at its
 * due date. Callers should filter dispatches with a null window out
 * *before* calling this — see filterDispatchesWithTimelineWindow below —
 * so this function can stay a pure mapper instead of silently dropping rows.
 */
export function adaptContentDispatchToTimelineEvent(
  dispatch: MenteeContentDispatch,
  options: {
    renderDetails: () => React.ReactNode;
    renderActions?: () => React.ReactNode;
  },
): TimelineEvent | null {
  const dueAt = dispatch.content_item.submission_ends_at;

  if (!dueAt || dispatch.content_item.submission_starts_at === null) {
    return null;
  }

  const isCompleted = dispatch.completed_at !== null;

  return {
    id: `content_dispatch:${dispatch.id}`,
    type: dispatch.content_item.content_type,
    title: dispatch.content_item.title,
    startsAt: dueAt,
    endsAt: dueAt,
    statusLabel: isCompleted ? "Completed" : undefined,
    isMuted: isCompleted,
    isDeadlineNode: true,
    durationVariant: "point",
    renderDetails: options.renderDetails,
    renderActions: options.renderActions,
  };
}

/**
 * Filters out dispatches whose content_item has no submission window
 * (is_not_required = true content — nothing to show on a timeline).
 * Run this before mapping so callers never have to null-check the
 * adapter's return value in a loop.
 */
export function filterDispatchesWithTimelineWindow(
  dispatches: MenteeContentDispatch[],
): MenteeContentDispatch[] {
  return dispatches.filter(
    (d) => d.content_item.submission_starts_at !== null && d.content_item.submission_ends_at !== null,
  );
}

/**
 * Staff/mentor view: one node per content_item, not per mentee dispatch —
 * see fetchContentItemsDueInRange for why. Callers should already have
 * filtered to items with a real window (that fetcher does this in its
 * query), so this stays a pure mapper like the dispatch adapter above.
 */
export function adaptContentItemToTimelineEvent(
  item: ContentItemWithMeta,
  options: {
    renderDetails: () => React.ReactNode;
    renderActions?: () => React.ReactNode;
  },
): TimelineEvent | null {
  const dueAt = item.submission_ends_at;

  if (!dueAt || item.submission_starts_at === null) {
    return null;
  }

  return {
    id: `content_item:${item.id}`,
    type: item.content_type,
    title: item.title,
    startsAt: dueAt,
    endsAt: dueAt,
    isDeadlineNode: true,
    durationVariant: "point",
    renderDetails: options.renderDetails,
    renderActions: options.renderActions,
  };
}