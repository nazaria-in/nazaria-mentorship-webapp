// /app/meetings/page.tsx — full file, only meetingsQuery changed

"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Timeline } from "@/components/timeline/Timeline";
import { MeetingFormModal } from "@/components/meetings/MeetingFormModal";
import { InPersonSessionFormModal } from "@/components/meetings/InPersonSessionFormModal";
import { AcceptDeclineControls } from "@/components/meetings/AcceptDeclineControls";
import { meetingToTimelineEvent } from "@/components/meetings/meeting-timeline-adapter";
import { inPersonSessionToTimelineEvent } from "@/components/meetings/in-person-session-timeline-adapter";
import { fetchMeetingsInRange, fetchPendingInvitesForUser } from "@/lib/api/meetings";
import { fetchInPersonSessions } from "@/lib/api/in-person-sessions";
import { fetchContentItemsDueInRange, fetchMenteeContentDispatchesInRange } from "@/lib/api/content-timeline";
import { adaptContentItemToTimelineEvent, adaptContentDispatchToTimelineEvent } from "@/lib/timeline/adapters";
import { PendingExitSurveysWidget } from "@/components/exit-survey/PendingExitSurveysWidget";
import { useRole } from "@/providers/role-provider";
// TODO(Joseph): swap for your actual current-user hook if the field name differs
import { useSessionStore } from "@/store/session-store";
import type { TimelineEvent, TimelineEventType } from "@/types/timeline";

// Same roles that get the widget on /dashboard — staff get their own
// org-wide analytics section elsewhere, not this personal list.
const ROLES_WITH_OWN_PENDING_SURVEYS = ["mentee", "mentor"] as const;

const AVAILABLE_TYPES: TimelineEventType[] = [
  "meeting",
  "in_person_session",
  "assignment",
  "course",
  "resource",
];

export default function MeetingsPage(): React.JSX.Element {
  const { role, permissionLevel, isDebug } = useRole();
  const userId = useSessionStore((s) => s.userId) as string | undefined;

  const [isMeetingFormOpen, setIsMeetingFormOpen] = React.useState(false);
  const [isSessionFormOpen, setIsSessionFormOpen] = React.useState(false);
  const [prefillStartsAt, setPrefillStartsAt] = React.useState<string | undefined>(undefined);
  const [range, setRange] = React.useState<{ start: string; end: string } | null>(null);

  // Debug bypass: previewing as pm/associate via the RoleSwitcher's debug
  // mode skips the "not logged in" gate, so layout can be checked without a
  // real session. Any real (non-debug) visit still requires a session.
  const isDebugStaffPreview = isDebug && (role === "pm" || role === "associate");

  const showOwnPendingSurveys = role !== null && (ROLES_WITH_OWN_PENDING_SURVEYS as readonly string[]).includes(role);

  // Only pm/associate can create/cancel in-person sessions — mentors and
  // mentees see them on the timeline but have no management controls.
  const canManageSessions = role === "pm" || role === "associate";

  // Mentees see their own dispatches (with completion status); staff/mentors
  // see one node per content_item due date instead of one per mentee — see
  // fetchContentItemsDueInRange for why.
  const isMenteeView = role === "mentee";

  // Mentors only see content items THEY created on the timeline, matching
  // /app/assignments_and_courses/page.tsx's scopeToCreatedBy. Staff
  // (pm/associate) get no scope — they see everything, same as before.
  const scopeToCreatedBy = role === "mentor" ? (userId ?? undefined) : undefined;

  const handleRangeChange = React.useCallback((rangeStartIso: string, rangeEndIso: string) => {
    setRange({ start: rangeStartIso, end: rangeEndIso });
  }, []);

  // `role` is `Role | null` while the session is still resolving — was
  // being passed directly into fetchMeetingsInRange's `role: UserRole`
  // param, which is where the "Type 'Role | null' is not assignable to
  // type 'UserRole'" error came from. Fixed the same way as
  // MeetingFormModal: gate the query on role !== null instead of casting
  // past the null, so queryFn is never actually invoked with one.
  const meetingsQuery = useQuery({
    queryKey: ["meetings", userId, role, range?.start, range?.end],
    queryFn: () => {
      if (!role) {
        return Promise.reject(new Error("Role not loaded yet"));
      }
      return fetchMeetingsInRange({ userId: userId ?? null, role, rangeStart: range!.start, rangeEnd: range!.end });
    },
    enabled: Boolean(range) && role !== null && (Boolean(userId) || isDebugStaffPreview),
  });

  const inPersonSessionsQuery = useQuery({
    queryKey: ["in-person-sessions", range?.start, range?.end],
    queryFn: () => fetchInPersonSessions(range!.start, range!.end),
    enabled: Boolean(range) && (Boolean(userId) || isDebugStaffPreview),
  });

  const menteeDispatchesQuery = useQuery({
    queryKey: ["content-dispatches-timeline", userId, range?.start, range?.end],
    queryFn: () => fetchMenteeContentDispatchesInRange(userId as string, range!.start, range!.end),
    enabled: Boolean(range) && isMenteeView && Boolean(userId),
  });

  const contentItemsQuery = useQuery({
    queryKey: ["content-items-timeline", range?.start, range?.end, scopeToCreatedBy],
    queryFn: () => fetchContentItemsDueInRange(range!.start, range!.end, scopeToCreatedBy),
    enabled: Boolean(range) && !isMenteeView && (Boolean(userId) || isDebugStaffPreview),
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

  const meetingEvents: TimelineEvent[] = userId
    ? (meetingsQuery.data ?? []).map((meeting) =>
        meetingToTimelineEvent(meeting, userId, [
          ["meeting-pending-invites", userId],
          ["meetings", userId],
        ]),
      )
    : [];

  const sessionEvents: TimelineEvent[] = (inPersonSessionsQuery.data ?? []).map((session) =>
    inPersonSessionToTimelineEvent(session, canManageSessions, [["in-person-sessions", range?.start, range?.end]]),
  );

  const menteeContentEvents: TimelineEvent[] = isMenteeView
    ? (menteeDispatchesQuery.data ?? [])
        .map((dispatch) =>
          adaptContentDispatchToTimelineEvent(dispatch, {
            renderDetails: () => (
              <div className="flex flex-col gap-1 text-sm text-text-primary">
                {dispatch.content_item.description && (
                  <p>{dispatch.content_item.description}</p>
                )}
                <p className="text-text-muted">
                  Status:{" "}
                  <span className="capitalize font-medium">
                    {dispatch.completion_status.replace("_", " ")}
                  </span>
                </p>
              </div>
            ),
            renderActions: () => (
              <a
                href={`/assignments_and_courses/${dispatch.content_item.id}`}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Open
              </a>
            ),
          })
        )
        .filter((e): e is TimelineEvent => e !== null)
    : [];

  const staffContentEvents: TimelineEvent[] = !isMenteeView
    ? (contentItemsQuery.data ?? [])
        .map((item) =>
          adaptContentItemToTimelineEvent(item, {
            renderDetails: () => (
              <div className="flex flex-col gap-1 text-sm text-text-primary">
                {item.description && <p>{item.description}</p>}
                {item.week && <p className="text-text-muted">{item.week.name}</p>}
              </div>
            ),
            renderActions: () => (
              <a
                href={`/assignments_and_courses/${item.id}`}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
              >
                Open
              </a>
            ),
          }),
        )
        .filter((e): e is TimelineEvent => e !== null)
    : [];

  const events: TimelineEvent[] = [...meetingEvents, ...sessionEvents, ...menteeContentEvents, ...staffContentEvents];

  const isLoading =
    meetingsQuery.isLoading ||
    inPersonSessionsQuery.isLoading ||
    (isMenteeView ? menteeDispatchesQuery.isLoading : contentItemsQuery.isLoading);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-2xl text-text-primary">Meetings</h1>
        <div className="flex gap-2">
          {canManageSessions && (
            <button
              type="button"
              onClick={() => {
                setPrefillStartsAt(undefined);
                setIsSessionFormOpen(true);
              }}
              className="rounded-lg border border-primary px-4 py-2 text-sm text-text-accent hover:bg-card-alt"
            >
              + In-person session
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setPrefillStartsAt(undefined);
              setIsMeetingFormOpen(true);
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
          >
            + Schedule meeting
          </button>
        </div>
      </div>

      {showOwnPendingSurveys && userId && <PendingExitSurveysWidget userId={userId} />}

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
        isLoading={isLoading}
        onRangeChange={handleRangeChange}
        onSelectEmptySlot={(startsAtIso) => {
          setPrefillStartsAt(startsAtIso);
          setIsMeetingFormOpen(true);
        }}
        availableTypes={AVAILABLE_TYPES}
      />

      {userId && (
        <MeetingFormModal
          isOpen={isMeetingFormOpen}
          onClose={() => setIsMeetingFormOpen(false)}
          currentUserId={userId}
          initialStartsAt={prefillStartsAt}
        />
      )}

      {userId && canManageSessions && (
        <InPersonSessionFormModal
          isOpen={isSessionFormOpen}
          onClose={() => setIsSessionFormOpen(false)}
          currentUserId={userId}
          cohortId={null}
          initialStartsAt={prefillStartsAt}
          invalidateQueryKeys={[["in-person-sessions", range?.start, range?.end]]}
        />
      )}
    </div>
  );
}