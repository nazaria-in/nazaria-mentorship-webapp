// /components/timeline/Timeline.tsx

"use client";

import * as React from "react";
import { TimelineElement, type TimelineElementSizeHint } from "@/components/shared/TimelineElement";
import { TimelineElementDetailsModal } from "@/components/shared/TimelineElementDetailsModal";
import type { TimelineEvent, TimelineEventType, TimelineViewMode } from "@/types/timeline";

export interface TimelineProps {
  events: TimelineEvent[];
  isLoading?: boolean;
  /** Called whenever the visible date range changes (view switch or navigation) so the parent can refetch. Pass a stable (useCallback) function. */
  onRangeChange: (rangeStartIso: string, rangeEndIso: string) => void;
  onSelectEmptySlot?: (startsAtIso: string) => void;
  /** Which event types can appear in this mount — only these get a filter chip. Defaults to all five. */
  availableTypes?: TimelineEventType[];
}

const ALL_EVENT_TYPES: TimelineEventType[] = [
  "meeting",
  "in_person_session",
  "assignment",
  "course",
  "resource",
];

const TYPE_CHIP_LABELS: Record<TimelineEventType, string> = {
  meeting: "Meetings",
  in_person_session: "In-person",
  assignment: "Assignments",
  course: "Courses",
  resource: "Resources",
};

// 1. EXTENDED HOURS: Covers a standard full day from 12 AM to 11:59 PM (24 hours total)
const HOUR_START = 0;
const HOUR_END = 24;
const HOUR_HEIGHT_PX = 56;
const FOCUS_HOUR = 9; // The hour we want to scroll to initially
const HEADER_HEIGHT_PX = 52; // fixed so the all-day row below can stick at a known offset
const ALL_DAY_CHIP_HEIGHT_PX = 44;

// Duration thresholds (minutes) that decide how much a card can render.
// Tuned against HOUR_HEIGHT_PX = 56px/hour: a 15-min slot is ~14px tall,
// too little for any text — icon only. A 30-min slot (~28px) fits an icon
// + single truncated title line but not a time line under it too.
const SIZE_HINT_XS_MAX_MINUTES = 15;
const SIZE_HINT_SM_MAX_MINUTES = 30;

type ChipState = "neutral" | "include" | "exclude";

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function nextChipState(state: ChipState): ChipState {
  if (state === "neutral") return "include";
  if (state === "include") return "exclude";
  return "neutral";
}

function buildInitialTypeFilters(types: TimelineEventType[]): Record<TimelineEventType, ChipState> {
  const result = {} as Record<TimelineEventType, ChipState>;
  for (const type of types) {
    result[type] = "neutral";
  }
  return result;
}

/** Full context label (weekday, date, time) — used in the details modal, where repeating the date is useful, not redundant. */
function fullTimeLabelFor(event: TimelineEvent): string {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const dateLabel = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (event.startsAt === event.endsAt) {
    return `${dateLabel} · ${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }
  return `${dateLabel} · ${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

/** Time-only label for in-grid cards — the day/week grid already conveys which day this is, so weekday/date would just repeat what's visible from position. */
function timeOnlyLabelFor(event: TimelineEvent): string {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  if (event.startsAt === event.endsAt) {
    return start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return `${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

/** Deadline nodes (assignments/courses/resources) show the due date itself, not a time — rendered in red by TimelineElement via isDeadlineNode. */
function dueDateLabelFor(event: TimelineEvent): string {
  const due = new Date(event.endsAt);
  return `Due ${due.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function sizeHintFor(event: TimelineEvent): TimelineElementSizeHint {
  if (event.isDeadlineNode) return "sm"; // due-date chips: icon + title, "Due" tag, no time line needed
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const durationMinutes = (end.getTime() - start.getTime()) / 60000;
  if (durationMinutes <= SIZE_HINT_XS_MAX_MINUTES) return "xs";
  if (durationMinutes <= SIZE_HINT_SM_MAX_MINUTES) return "sm";
  return "md";
}

export function Timeline({
  events,
  isLoading = false,
  onRangeChange,
  onSelectEmptySlot,
  availableTypes = ALL_EVENT_TYPES,
}: TimelineProps): React.JSX.Element {
  const [viewMode, setViewMode] = React.useState<TimelineViewMode>("week");
  const [anchorDate, setAnchorDate] = React.useState(() => new Date());
  const [typeFilters, setTypeFilters] = React.useState<Record<TimelineEventType, ChipState>>(() =>
    buildInitialTypeFilters(availableTypes),
  );
  const [selectedEvent, setSelectedEvent] = React.useState<TimelineEvent | null>(null);

  const range = React.useMemo(() => {
    if (viewMode === "day") {
      const start = new Date(anchorDate);
      start.setHours(0, 0, 0, 0);
      return { start, end: addDays(start, 1) };
    }
    if (viewMode === "week") {
      const start = startOfWeek(anchorDate);
      return { start, end: addDays(start, 7) };
    }
    const start = startOfMonth(anchorDate);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return { start, end };
  }, [viewMode, anchorDate]);

  React.useEffect(() => {
    onRangeChange(range.start.toISOString(), range.end.toISOString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start.getTime(), range.end.getTime()]);

  const includedTypes = React.useMemo(
    () => Object.entries(typeFilters).filter(([, s]) => s === "include").map(([t]) => t as TimelineEventType),
    [typeFilters],
  );

  const excludedTypes = React.useMemo(
    () => Object.entries(typeFilters).filter(([, s]) => s === "exclude").map(([t]) => t as TimelineEventType),
    [typeFilters],
  );

  const visibleEvents = React.useMemo(() => {
    return events.filter((e) => {
      if (includedTypes.length > 0 && !includedTypes.includes(e.type)) return false;
      if (excludedTypes.includes(e.type)) return false;
      return true;
    });
  }, [events, includedTypes, excludedTypes]);

  function navigate(direction: -1 | 1): void {
    if (viewMode === "day") setAnchorDate((d) => addDays(d, direction));
    else if (viewMode === "week") setAnchorDate((d) => addDays(d, direction * 7));
    else setAnchorDate((d) => new Date(d.getFullYear(), d.getMonth() + direction, 1));
  }

  const rangeLabel = React.useMemo(() => {
    if (viewMode === "day") {
      return range.start.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    }
    if (viewMode === "week") {
      return `${range.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${addDays(
        range.end,
        -1,
      ).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    }
    return range.start.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [viewMode, range]);

  return (
    <div className="surface-card flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-primary hover:bg-card-alt"
          >
            ←
          </button>
          <p className="min-w-[10rem] text-sm font-semibold text-text-primary">{rangeLabel}</p>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-primary hover:bg-card-alt"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => setAnchorDate(new Date())}
            className="rounded-lg px-2 py-1.5 text-xs text-text-accent hover:underline"
          >
            Today
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            {(["month", "week", "day"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`rounded-md px-3 py-1 text-sm capitalize ${
                  viewMode === mode ? "bg-primary text-primary-foreground" : "text-text-primary hover:bg-card-alt"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {availableTypes.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {availableTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilters((prev) => ({ ...prev, [type]: nextChipState(prev[type]) }))}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    typeFilters[type] === "include"
                      ? "border-primary bg-primary text-primary-foreground"
                      : typeFilters[type] === "exclude"
                        ? "border-border bg-card text-text-muted line-through"
                        : "border-border text-text-primary hover:bg-card-alt"
                  }`}
                >
                  {TYPE_CHIP_LABELS[type]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : viewMode === "month" ? (
        <MonthGrid monthStart={range.start} events={visibleEvents} onSelectEvent={setSelectedEvent} />
      ) : (
        <HourGrid
          rangeStart={range.start}
          numDays={viewMode === "day" ? 1 : 7}
          events={visibleEvents}
          onSelectEvent={setSelectedEvent}
          onSelectEmptySlot={onSelectEmptySlot}
        />
      )}

      {selectedEvent && (
        <TimelineElementDetailsModal
          isOpen={Boolean(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          title={selectedEvent.title}
          timeLabel={fullTimeLabelFor(selectedEvent)}
          actions={selectedEvent.renderActions?.()}
        >
          {selectedEvent.renderDetails()}
        </TimelineElementDetailsModal>
      )}
    </div>
  );
}

interface HourGridProps {
  rangeStart: Date;
  numDays: number;
  events: TimelineEvent[];
  onSelectEvent: (event: TimelineEvent) => void;
  onSelectEmptySlot?: (startsAtIso: string) => void;
}

function HourGrid({ rangeStart, numDays, events, onSelectEvent, onSelectEmptySlot }: HourGridProps): React.JSX.Element {
  const days = React.useMemo(() => Array.from({ length: numDays }, (_, i) => addDays(rangeStart, i)), [rangeStart, numDays]);
  const hours = React.useMemo(() => Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i), []);

  // 2. SCROLL LOGIC: Reference to scrollable timeline viewport container
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollContainerRef.current) {
      // Calculates how far down 9 AM is based on the single hour row height config
      const targetScrollTop = (FOCUS_HOUR - HOUR_START) * HOUR_HEIGHT_PX;
      scrollContainerRef.current.scrollTop = targetScrollTop;
    }
  }, [numDays]); // Re-runs if switching toggles between Day (1) and Week (7) grid configurations

  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const event of events) {
      const key = new Date(event.startsAt).toDateString();
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  function positionFor(event: TimelineEvent): { top: number; height: number } {
    const start = new Date(event.startsAt);
    const end = new Date(event.endsAt);
    const startMinutes = (start.getHours() - HOUR_START) * 60 + start.getMinutes();
    const endMinutes = Math.max((end.getHours() - HOUR_START) * 60 + end.getMinutes(), startMinutes + 30);
    const top = (startMinutes / 60) * HOUR_HEIGHT_PX;
    const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT_PX;
    return { top, height };
  }

  return (
    /* 3. WRAPPER CONTAINER: Fixed height with custom scrolling layout added */
    <div
      ref={scrollContainerRef}
      className="grid overflow-auto max-h-[600px] scroll-smooth"
      style={{ gridTemplateColumns: `3.5rem repeat(${numDays}, minmax(8rem, 1fr))` }}
    >
      {/* Sticky Day Headers */}
      <div className="sticky top-0 z-20 bg-card" style={{ height: HEADER_HEIGHT_PX }} />
      {days.map((day) => (
        <div
          key={day.toISOString()}
          className="sticky top-0 z-20 flex flex-col items-center justify-center gap-0.5 border-b border-border bg-card"
          style={{ height: HEADER_HEIGHT_PX }}
        >
          <p className="text-xs font-medium uppercase text-text-muted">{day.toLocaleDateString(undefined, { weekday: "short" })}</p>
          <p className="text-sm font-semibold text-text-primary">{day.getDate()}</p>
        </div>
      ))}

      {/* Sticky all-day / due-date row — assignments, courses, and
          resources have no time-of-day, only a due date, so they don't
          belong inside the hourly grid below. Pinned under the headers,
          same pattern as a calendar's "all day" strip, so it stays visible
          while scrolling through the hours. */}
      <div
        className="sticky z-10 border-b border-border bg-card"
        style={{ top: HEADER_HEIGHT_PX }}
      />
      {days.map((day) => {
        const allDayEvents = (eventsByDay.get(day.toDateString()) ?? []).filter((e) => e.isDeadlineNode);
        return (
          <div
            key={`${day.toISOString()}-allday`}
            className="sticky z-10 flex flex-col gap-1 border-b border-l border-border bg-card p-1"
            style={{ top: HEADER_HEIGHT_PX }}
          >
            {allDayEvents.map((event) => (
              <div key={event.id} style={{ height: ALL_DAY_CHIP_HEIGHT_PX }}>
                <TimelineElement
                  title={event.title}
                  type={event.type}
                  layout="hourGrid"
                  timeLabel={dueDateLabelFor(event)}
                  statusLabel={event.statusLabel}
                  isMuted={event.isMuted}
                  isDeadlineNode
                  onShowDetails={() => onSelectEvent(event)}
                  sizeHint="md"
                />
              </div>
            ))}
          </div>
        );
      })}

      {/* Hour Column Labels */}
      <div className="relative flex flex-col">
        {hours.map((hour) => {
          const displayHour = hour === 0 || hour === 12 ? 12 : hour % 12;
          const ampm = hour < 12 ? "am" : "pm";
          return (
            <div key={hour} style={{ height: HOUR_HEIGHT_PX }} className="border-t border-border pr-2 text-right text-xs text-text-muted">
              {displayHour} {ampm}
            </div>
          );
        })}
      </div>

      {/* Grid Columns for Days and Elements */}
      {days.map((day) => (
        <div key={day.toISOString()} className="relative border-l border-border" style={{ height: hours.length * HOUR_HEIGHT_PX }}>
          {hours.map((hour) => (
            <button
              key={hour}
              type="button"
              onClick={() => {
                const slotStart = new Date(day);
                slotStart.setHours(hour, 0, 0, 0);
                onSelectEmptySlot?.(slotStart.toISOString());
              }}
              style={{ height: HOUR_HEIGHT_PX }}
              className="block w-full border-t border-border hover:bg-card-alt"
            />
          ))}

          {(eventsByDay.get(day.toDateString()) ?? [])
            .filter((event) => !event.isDeadlineNode)
            .map((event) => {
              const { top, height } = positionFor(event);
              return (
                <div key={event.id} className="absolute inset-x-1" style={{ top, height }}>
                  <TimelineElement
                    title={event.title}
                    type={event.type}
                    layout="hourGrid"
                    timeLabel={timeOnlyLabelFor(event)}
                    statusLabel={event.statusLabel}
                    isMuted={event.isMuted}
                    isDeadlineNode={event.isDeadlineNode}
                    onShowDetails={() => onSelectEvent(event)}
                    sizeHint={sizeHintFor(event)}
                  />
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}

interface MonthGridProps {
  monthStart: Date;
  events: TimelineEvent[];
  onSelectEvent: (event: TimelineEvent) => void;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_GRID_CELLS = 42; // 6 weeks — always enough to cover any month
const MONTH_CELL_VISIBLE_EVENTS = 3;

function MonthGrid({ monthStart, events, onSelectEvent }: MonthGridProps): React.JSX.Element {
  const gridStart = startOfWeek(monthStart);
  const days = React.useMemo(
    () => Array.from({ length: MONTH_GRID_CELLS }, (_, i) => addDays(gridStart, i)),
    [gridStart],
  );

  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const event of events) {
      const key = new Date(event.startsAt).toDateString();
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  return (
    <div className="grid grid-cols-7 gap-1">
      {WEEKDAY_LABELS.map((label) => (
        <div key={label} className="pb-1 text-center text-xs font-medium uppercase text-text-muted">
          {label}
        </div>
      ))}
      {days.map((day) => {
        const isCurrentMonth = day.getMonth() === monthStart.getMonth();
        const dayEvents = eventsByDay.get(day.toDateString()) ?? [];
        const visible = dayEvents.slice(0, MONTH_CELL_VISIBLE_EVENTS);
        const overflow = dayEvents.length - visible.length;

        return (
          <div
            key={day.toISOString()}
            className={`flex min-h-[6rem] flex-col gap-1 rounded-lg border border-border p-1 ${
              isCurrentMonth ? "bg-card" : "bg-surface opacity-60"
            }`}
          >
            <p className="text-xs font-medium text-text-muted">{day.getDate()}</p>
            {visible.map((event) => (
              <TimelineElement
                key={event.id}
                title={event.title}
                type={event.type}
                layout="month"
                timeLabel={event.isDeadlineNode ? dueDateLabelFor(event) : undefined}
                isDeadlineNode={event.isDeadlineNode}
                isMuted={event.isMuted}
                onShowDetails={() => onSelectEvent(event)}
              />
            ))}
            {overflow > 0 && <p className="text-[11px] text-text-muted">+{overflow} more</p>}
          </div>
        );
      })}
    </div>
  );
}