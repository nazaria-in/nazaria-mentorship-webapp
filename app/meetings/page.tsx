// /app/meetings/page.tsx

"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Timeline } from "@/components/timeline/Timeline";
import { MeetingFormModal } from "@/components/meetings/MeetingFormModal";
import { AcceptDeclineControls } from "@/components/meetings/AcceptDeclineControls";
import { meetingToTimelineEvent } from "@/components/meetings/meeting-timeline-adapter";
import { fetchMeetingsInRange, fetchPendingInvitesForUser } from "@/lib/api/meetings";
import { useRole } from "@/providers/role-provider";
// TODO(Joseph): swap for your actual current-user hook if the field name differs
import { useSessionStore } from "@/store/session-store";
import type { TimelineEvent } from "@/types/timeline";

import { NAV_BY_PERMISSION } from "@/components/shell/NavConfig";


export default function MeetingsPage(): React.JSX.Element {
  const { role, permissionLevel, isDebug } = useRole();
  const userId = useSessionStore((s) => s.userId) as string | undefined;

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [prefillStartsAt, setPrefillStartsAt] = React.useState<string | undefined>(undefined);
  const [range, setRange] = React.useState<{ start: string; end: string } | null>(null);

  // Debug bypass: previewing as pm/associate via the RoleSwitcher's debug
  // mode skips the "not logged in" gate, so layout can be checked without a
  // real session. Any real (non-debug) visit still requires a session.
  const isDebugStaffPreview = isDebug && (role === "pm" || role === "associate");

  const handleRangeChange = React.useCallback((rangeStartIso: string, rangeEndIso: string) => {
    setRange({ start: rangeStartIso, end: rangeEndIso });
  }, []);

  const meetingsQuery = useQuery({
    queryKey: ["meetings", userId, role, range?.start, range?.end],
    queryFn: () =>
      fetchMeetingsInRange({ userId: userId ?? null, role, rangeStart: range!.start, rangeEnd: range!.end }),
    enabled: Boolean(range) && (Boolean(userId) || isDebugStaffPreview),
  });

  const pendingInvitesQuery = useQuery({
    queryKey: ["meeting-pending-invites", userId],
    queryFn: () => fetchPendingInvitesForUser(userId as string),
    enabled: Boolean(userId),
  });

  if (!userId && !isDebugStaffPreview) {
    return (
      <div className="surface-card mx-auto mt-12 flex max-w-sm flex-col items-center gap-4 p-6 text-center">
        <p className="text-sm text-text-primary">You are not logged in.</p>
        <Link href="/auth/login" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90">
          Log in
        </Link>
      </div>
    );
  }

  const events: TimelineEvent[] = userId
    ? (meetingsQuery.data ?? []).map((meeting) =>
        meetingToTimelineEvent(meeting, userId, [
          ["meeting-pending-invites", userId],
          ["meetings", userId],
        ]),
      )
    : [];
  // TODO(Joseph): merge in assignment events once wired, e.g.:
  //   const assignmentEvents = (assignmentsQuery.data ?? []).map(assignmentToTimelineEvent);
  //   const events = [...meetingEvents, ...assignmentEvents];
  // and pass availableTypes={["meeting", "assignment"]} to <Timeline /> below.

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-text-primary">Meetings</h1>
        <button
          type="button"
          onClick={() => {
            setPrefillStartsAt(undefined);
            setIsFormOpen(true);
          }}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
        >
          + Schedule meeting
        </button>
      </div>

      {(pendingInvitesQuery.data?.length ?? 0) > 0 && userId && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-text-muted">Pending invites</h2>
          {pendingInvitesQuery.data?.map((meeting) => (
            <AcceptDeclineControls
              key={meeting.id}
              meeting={meeting}
              currentUserId={userId}
              invalidateQueryKeys={[
                ["meeting-pending-invites", userId],
                ["meetings", userId],
              ]}
            />
          ))}
        </div>
      )}

      <Timeline
        events={events}
        isLoading={meetingsQuery.isLoading}
        onRangeChange={handleRangeChange}
        onSelectEmptySlot={(startsAtIso) => {
          setPrefillStartsAt(startsAtIso);
          setIsFormOpen(true);
        }}
        availableTypes={["meeting"]}
      />

      {userId && (
        <MeetingFormModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} currentUserId={userId} initialStartsAt={prefillStartsAt} />
      )}
    </div>
  );
}