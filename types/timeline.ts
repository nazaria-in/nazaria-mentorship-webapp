// /types/timeline.ts

import type * as React from "react";

export type TimelineEventType =
  | "meeting"
  | "in_person_session"
  | "assignment"
  | "course"
  | "resource";

export type TimelineViewMode = "day" | "week" | "month";

export type TimelineDurationVariant = "point" | "short" | "long";

/**
 * Normalized shape every timeline source (meetings, content_items via
 * content_dispatches, in_person_sessions) gets adapted into before
 * reaching <Timeline />. Keep this the single contract the component
 * depends on — adapters live in lib/timeline/adapters.ts, not here.
 */
export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  /** ISO. For point-in-time items (e.g. an assignment due date), startsAt === endsAt. */
  startsAt: string;
  endsAt: string;
  statusLabel?: string;
  isMuted?: boolean;
  isDeadlineNode?: boolean;
  /** Card-only visual hint — each adapter populates what's relevant to its own type. */
  durationVariant?: TimelineDurationVariant;
  renderDetails: () => React.ReactNode;
  renderActions?: () => React.ReactNode;
}

/**
 * Source-specific ids kept around so the details modal / action buttons
 * can navigate or mutate without re-deriving them from the event id.
 */
export interface TimelineEventSourceRefs {
  meetingId?: string;
  inPersonSessionId?: string;
  inPersonSessionSeriesId?: string;
  contentDispatchId?: string;
  contentItemId?: string;
}