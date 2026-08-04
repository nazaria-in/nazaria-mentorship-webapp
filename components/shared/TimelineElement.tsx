// /components/shared/TimelineElement.tsx

"use client";

import * as React from "react";
import { BookOpen, ClipboardList, FileBox, MapPin, Video, type LucideIcon } from "lucide-react";
import type { TimelineEventType } from "@/types/timeline";

/**
 * How much room the card actually has, decided by the caller (Timeline.tsx)
 * from real pixel height / event duration — not measured here. Keeps this
 * component a pure function of its props instead of doing its own
 * ResizeObserver plumbing.
 *   xs — icon only (e.g. a 10-15 min meeting slot)
 *   sm — icon + title, single line, no time text
 *   md — icon + title + time, room to breathe
 */
export type TimelineElementSizeHint = "xs" | "sm" | "md";

export interface TimelineElementProps {
  title: string;
  type: TimelineEventType;
  /** Layout context. "month" never renders time text — the day cell already
   * carries the date, so repeating it per-card is redundant. "hourGrid" is
   * the week/day view where a short time range is useful context. */
  layout: "hourGrid" | "month";
  /** Time range only — no weekday/date. Omit for "month" layout entirely. */
  timeLabel?: string;
  statusLabel?: string;
  isMuted?: boolean;
  isDeadlineNode?: boolean;
  onShowDetails: () => void;
  /** Only meaningful for layout="hourGrid" — see TimelineElementSizeHint. */
  sizeHint?: TimelineElementSizeHint;
}

interface TypeStyle {
  icon: LucideIcon;
  colorVar: string; // CSS custom property name, e.g. "--chart-2"
  label: string;
}

const TYPE_STYLES: Record<TimelineEventType, TypeStyle> = {
  meeting: { icon: Video, colorVar: "--chart-2", label: "Meeting" },
  in_person_session: { icon: MapPin, colorVar: "--chart-4", label: "In-person" },
  assignment: { icon: ClipboardList, colorVar: "--chart-1", label: "Assignment" },
  course: { icon: BookOpen, colorVar: "--chart-3", label: "Course" },
  resource: { icon: FileBox, colorVar: "--chart-5", label: "Resource" },
};

export function TimelineElement({
  title,
  type,
  layout,
  timeLabel,
  statusLabel,
  isMuted = false,
  isDeadlineNode = false,
  onShowDetails,
  sizeHint = "md",
}: TimelineElementProps): React.JSX.Element {
  const style = TYPE_STYLES[type];
  const Icon = style.icon;
  const colorValue = `var(${style.colorVar})`;

  if (layout === "month") {
    return (
      <button
        type="button"
        onClick={onShowDetails}
        title={title}
        aria-label={`${style.label}: ${title}`}
        className={`flex w-full items-center gap-1 rounded-md border-l-2 px-1.5 py-0.5 text-left text-[11px] leading-tight transition-opacity hover:opacity-80 ${
          isMuted ? "opacity-50" : ""
        }`}
        style={{
          borderLeftColor: colorValue,
          backgroundColor: `color-mix(in srgb, ${colorValue} 12%, transparent)`,
        }}
      >
        <Icon className="h-3 w-3 shrink-0" style={{ color: colorValue }} aria-hidden="true" />
        <span className={`truncate text-text-primary ${isMuted ? "line-through" : ""}`}>{title}</span>
        {isDeadlineNode && timeLabel && (
          <span className="ml-auto shrink-0 truncate text-[10px] font-semibold text-destructive">{timeLabel}</span>
        )}
      </button>
    );
  }

  // layout === "hourGrid"
  const iconSizePx = sizeHint === "xs" ? 12 : sizeHint === "sm" ? 13 : 14;

  if (sizeHint === "xs") {
    // Too little vertical room for any text — icon only, full details on
    // click, title available as a native tooltip on hover/focus.
    return (
      <button
        type="button"
        onClick={onShowDetails}
        title={`${title}${timeLabel ? ` · ${timeLabel}` : ""}`}
        aria-label={`${style.label}: ${title}`}
        className={`flex h-full w-full items-center justify-center rounded-md border transition-opacity hover:opacity-80 ${
          isMuted ? "opacity-50" : ""
        }`}
        style={{
          borderColor: `color-mix(in srgb, ${colorValue} 40%, transparent)`,
          backgroundColor: `color-mix(in srgb, ${colorValue} 14%, transparent)`,
        }}
      >
        <Icon style={{ color: colorValue, width: iconSizePx, height: iconSizePx }} aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onShowDetails}
      title={title}
      aria-label={`${style.label}: ${title}`}
      className={`flex h-full w-full flex-col items-start gap-0.5 overflow-hidden rounded-md border px-1.5 py-1 text-left transition-opacity hover:opacity-80 ${
        isMuted ? "opacity-50" : ""
      }`}
      style={{
        borderColor: `color-mix(in srgb, ${colorValue} 40%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${colorValue} 14%, transparent)`,
      }}
    >
      <span className="flex w-full items-center gap-1">
        <Icon
          className="shrink-0"
          style={{ color: colorValue, width: iconSizePx, height: iconSizePx }}
          aria-hidden="true"
        />
        <span
          className={`truncate text-xs font-medium text-text-primary ${isMuted ? "line-through" : ""}`}
        >
          {title}
        </span>
      </span>

      {isDeadlineNode && timeLabel && (
        <span className="truncate text-[10px] font-semibold text-destructive">{timeLabel}</span>
      )}

      {!isDeadlineNode && sizeHint === "md" && timeLabel && (
        <span className="truncate text-[10px] text-text-muted">{timeLabel}</span>
      )}

      {sizeHint === "md" && statusLabel && (
        <span className="truncate text-[10px] text-text-muted">{statusLabel}</span>
      )}
    </button>
  );
}