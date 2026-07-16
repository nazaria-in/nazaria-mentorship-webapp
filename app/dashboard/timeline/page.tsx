// /app/dashboard/page.tsx

"use client";

import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/AppShell";
import { NAV_BY_PERMISSION } from "@/components/shell/NavConfig";
import { useRole } from "@/providers/role-provider";
import { useSessionStore } from "@/store/session-store";
import { fetchMeetingsInRange } from "@/lib/api/meetings";
import { fetchMenteeAssignmentsForTimeline, type MenteeAssignmentTimelineRow } from "@/lib/api/mentee-assignments";
import { Timeline } from "@/components/timeline/Timeline";
import type { MeetingWithParticipants } from "@/types/meetings";
import type { TimelineEvent } from "@/types/timeline";
import type { UserRole } from "@/types/users";

// DEV FLAG: when true, ignore role-scoping entirely and fetch every
// mentee_assignments row in range (same branch as pm/associate) so the
// timeline has data to render regardless of which user/role you're testing
// as. Flip to false before shipping — real users should only ever see
// assignments scoped to their own role per fetchMenteeAssignmentsForTimeline.
const IS_DEVELOPMENT_MODE: boolean = true;

interface DateRange {
  rangeStart: string;
  rangeEnd: string;
}

function meetingToTimelineEvent(meeting: MeetingWithParticipants): TimelineEvent {
  const durationMinutes =
    (new Date(meeting.ends_at).getTime() - new Date(meeting.starts_at).getTime()) / 60000;

  return {
    id: `meeting-${meeting.id}`,
    type: "meeting",
    title: meeting.title,
    startsAt: meeting.starts_at,
    endsAt: meeting.ends_at,
    durationVariant: durationMinutes <= 30 ? "short" : "standard",
    statusLabel: meeting.status !== "scheduled" ? meeting.status : undefined,
    renderDetails: () => meeting.description ?? "No description provided.",
  };
}

function menteeAssignmentToTimelineEvent(row: MenteeAssignmentTimelineRow): TimelineEvent {
  return {
    id: `assignment-${row.id}`,
    type: "assignment",
    title: row.assignment?.title ?? "Assignment",
    startsAt: row.due_at,
    endsAt: row.due_at,
    isMuted: row.is_completed,
    isDeadlineNode: true,
    statusLabel: row.is_completed ? "Completed" : undefined,
    renderDetails: () => `Due ${new Date(row.due_at).toLocaleString()}`,
  };
}

export default function DashboardPage(): React.JSX.Element {
  const { permissionLevel, role } = useRole();
  const userId = useSessionStore((s) => s.userId);
  const [range, setRange] = useState<DateRange | null>(null);

  const handleRangeChange = useCallback((rangeStartIso: string, rangeEndIso: string) => {
    setRange({ rangeStart: rangeStartIso, rangeEnd: rangeEndIso });
  }, []);

  // In dev mode, force the "everything in range" branch inside
  // fetchMenteeAssignmentsForTimeline (same one pm/associate uses) instead
  // of scoping by the real logged-in role.
  const effectiveAssignmentRole: UserRole = IS_DEVELOPMENT_MODE ? "pm" : role;

  const { data: meetings, isLoading: meetingsLoading } = useQuery<MeetingWithParticipants[]>({
    queryKey: ["meetings", "dashboard-timeline", userId, role, range?.rangeStart, range?.rangeEnd],
    queryFn: () =>
      fetchMeetingsInRange({ userId, role, rangeStart: range!.rangeStart, rangeEnd: range!.rangeEnd }),
    enabled: Boolean(range),
  });

  const { data: menteeAssignments, isLoading: assignmentsLoading } = useQuery<MenteeAssignmentTimelineRow[]>({
    queryKey: [
      "mentee-assignments",
      "dashboard-timeline",
      userId,
      effectiveAssignmentRole,
      range?.rangeStart,
      range?.rangeEnd,
    ],
    queryFn: () =>
      fetchMenteeAssignmentsForTimeline({
        role: effectiveAssignmentRole,
        userId,
        rangeStart: range!.rangeStart,
        rangeEnd: range!.rangeEnd,
      }),
    enabled: Boolean(range),
  });

  const events = useMemo<TimelineEvent[]>(() => {
    const meetingEvents = (meetings ?? []).map(meetingToTimelineEvent);
    const assignmentEvents = (menteeAssignments ?? []).map(menteeAssignmentToTimelineEvent);
    return [...meetingEvents, ...assignmentEvents];
  }, [meetings, menteeAssignments]);

  return (
    <AppShell navItems={NAV_BY_PERMISSION[permissionLevel]} pageTitle="Dashboard">
      <div className="flex flex-col gap-6 p-4 max-w-7xl mx-auto w-full">
        <DashboardGreeting />
        <Timeline events={events} isLoading={meetingsLoading || assignmentsLoading} onRangeChange={handleRangeChange} />
      </div>
    </AppShell>
  );
}

function DashboardGreeting(): React.JSX.Element {
  const { role } = useRole();
  const fullName = useSessionStore((s) => s.fullName);
  return (
    <div>
      <h1 className="font-heading text-xl font-semibold text-text-primary">
        Welcome{fullName ? `, ${fullName}` : ""}
      </h1>
      <p className="text-sm text-text-primary/60">Viewing as workspace {role}.</p>
    </div>
  );
}