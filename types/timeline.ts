// /types/timeline.ts

import type { ReactNode } from "react";

export type TimelineEventType = "meeting" | "assignment";
export type TimelineViewMode = "month" | "week" | "day";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  /** ISO. For point-in-time items (e.g. an assignment due date), startsAt === endsAt. */
  startsAt: string;
  endsAt: string;
  isMuted?: boolean;
  statusLabel?: string;
  /** Card-only visual hints — optional, each adapter populates what's relevant to its own type. */
  durationVariant?: "short" | "standard";
  isDeadlineNode?: boolean;
  renderDetails: () => ReactNode;
  renderActions?: () => ReactNode;
}