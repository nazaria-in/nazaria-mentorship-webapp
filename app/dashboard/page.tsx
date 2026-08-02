// /app/dashboard/page.tsx

"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { NAV_BY_PERMISSION } from "@/components/shell/NavConfig";
import { useRole } from "@/providers/role-provider";
import { useSessionStore } from "@/store/session-store";
import { fetchMeetingsInRange } from "@/lib/api/meetings";
import { EmptyState } from "@/components/shared/EmptyState";
import { TimelineElement } from "@/components/shared/TimelineElement";
import { PendingExitSurveysWidget } from "@/components/exit-survey/PendingExitSurveysWidget";
import { useState, useMemo } from "react";
import { TimelineElementDetailsModal } from "@/components/shared/TimelineElementDetailsModal";
import type { MeetingWithParticipants } from "@/types/meetings";


//depreciated
// import { AssignmentCard } from "@/components/assignments/AssignmentCard";
// import type { Assignment } from "@/types/assignments";
// import { fetchAssignedAssignmentsForUser } from "@/lib/api/mentee-assignments";



interface SelectedMeetingItem {
  kind: "meeting";
  title: string;
  description: string;
  meetLink: string | null;
}

interface SelectedAssignmentItem {
  kind: "assignment";
  title: string;
  description: string;
  assignmentId: string;
}

type SelectedItemState = SelectedMeetingItem | SelectedAssignmentItem;

// Roles that see their own "unfilled exit surveys" widget on the
// dashboard. Staff get an org-wide analytics section instead (built
// separately, in the admin dashboard) rather than a personal task list.
const ROLES_WITH_OWN_PENDING_SURVEYS = ["mentee", "mentor"] as const;

export default function DashboardPage() {
  const { permissionLevel, role } = useRole();
  const userId = useSessionStore((s) => s.userId);
  const [selectedItem, setSelectedItem] = useState<SelectedItemState | null>(null);

  const showOwnPendingSurveys = role !== null && (ROLES_WITH_OWN_PENDING_SURVEYS as readonly string[]).includes(role);

  // Compute a valid week boundary window for our API range rules
  const { rangeStart, rangeEnd } = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 999);
    return {
      rangeStart: start.toISOString(),
      rangeEnd: end.toISOString(),
    };
  }, []);


  /* Deperciated
  // Fetch active assignments safely with typed dataset
  const { data: assignments, isLoading: assignmentsLoading } = useQuery<Assignment[]>({
  queryKey: ["assignments", "dashboard", "assigned-to-me", userId, role],
  queryFn: () => fetchAssignedAssignmentsForUser({ role, userId }),
  enabled: !!userId,
  });
  */

  // Fetch upcoming meetings using the existing range function setup
  const { data: meetings, isLoading: meetingsLoading } = useQuery<MeetingWithParticipants[]>({
    queryKey: ["meetings", "dashboard", userId, role, rangeStart, rangeEnd],
    queryFn: () => fetchMeetingsInRange({ userId, role, rangeStart, rangeEnd }),
    enabled: !!userId,
  });

  return (
    <>
      <div className="flex flex-col gap-6 p-4 max-w-7xl mx-auto w-full">
        {showOwnPendingSurveys && <PendingExitSurveysWidget userId={userId} />}

        {/* Dual-Track Timeline Summary Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Meetings Track Column */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="font-heading text-sm font-semibold text-text-primary dark:text-text-primary">
              Upcoming Live Sessions
            </h2>

            {meetingsLoading ? (
              <div className="text-sm text-text-primary/50 dark:text-text-primary/50">Loading timeline...</div>
            ) : !meetings || meetings.length === 0 ? (
              <div className="border border-dashed border-border dark:border-border p-4 rounded-xl text-center text-xs text-text-muted dark:text-text-muted">
                No meetings scheduled for this week.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {meetings.slice(0, 5).map((meeting) => {
                  const durationMs = new Date(meeting.ends_at).getTime() - new Date(meeting.starts_at).getTime();
                  const durationMinutes = durationMs / (1000 * 60);
                  const timeString = new Date(meeting.starts_at).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  });

                  return (
                    <TimelineElement
                      key={meeting.id}
                      variant="meeting"
                      title={meeting.title}
                      timeLabel={`${timeString} (${durationMinutes} mins)`}
                      durationVariant={durationMinutes <= 30 ? "short" : "standard"}
                      onShowDetails={() =>
                        setSelectedItem({
                          kind: "meeting",
                          title: meeting.title,
                          description: meeting.description || "No description provided.",
                          meetLink: meeting.meet_link ?? null,
                        })
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
          {/*
          <div className="space-y-3">
            <h2 className="font-heading text-sm font-semibold text-text-primary dark:text-text-primary">
              Active Horizons & Deadlines
            </h2>

            {assignmentsLoading ? (
              <div className="text-sm text-text-primary/50 dark:text-text-primary/50">Loading horizons...</div>
            ) : !assignments || assignments.length === 0 ? (
              <div className="border border-dashed border-border dark:border-border p-4 rounded-xl text-center text-xs text-text-muted dark:text-text-muted">
                No long-term tasks assigned.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {assignments.slice(0, 4).map((assignment) => (
                  <TimelineElement
                    key={assignment.id}
                    variant="assignment"
                    title={assignment.title}
                    timeLabel="Due This Week"
                    isDeadlineNode={true}
                    onShowDetails={() =>
                      setSelectedItem({
                        kind: "assignment",
                        title: assignment.title,
                        description: assignment.description || "Project assignment dashboard viewport tracker card.",
                        assignmentId: assignment.id,
                      })
                    }
                  />
                ))}
              </div>
            )}
          </div>
          */}
        </section>

        {/* 
        <section>
          <h2 className="mb-3 font-heading text-sm font-semibold text-text-primary dark:text-text-primary">
            Assignments
          </h2>

          {assignmentsLoading ? (
            <div className="text-sm text-text-primary/50 dark:text-text-primary/50">Loading boards…</div>
          ) : !assignments || assignments.length === 0 ? (
            <EmptyState title="No active assignments" description="Check back once one is created." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {assignments.map((a) => (
                <AssignmentCard key={a.id} assignment={a} href={`/assignments/${a.id}`} />
              ))}
            </div>
          )}
        </section>
        */}

        {permissionLevel === "staff" && (
          <section className="rounded-2xl border border-dashed border-border dark:border-border p-4">
            <p className="text-sm text-text-primary/70 dark:text-text-primary/70">
              Mentor approvals waiting for review live at{" "}
              <Link href="/admin/users" className="text-text-accent dark:text-text-accent hover:underline">
                /admin/users
              </Link>
              .
            </p>
          </section>
        )}
      </div>

      {selectedItem && (
        <TimelineElementDetailsModal
          isOpen={true}
          title={selectedItem.title}
          description={selectedItem.description}
          onClose={() => setSelectedItem(null)}
        >
          {/* NOTE: assumes TimelineElementDetailsModal renders `children` below
              the description. If it doesn't accept children, this action area
              needs to be moved into that component instead. */}
          <div className="mt-4 flex justify-end">
            {selectedItem.kind === "meeting" ? (
              selectedItem.meetLink ? (
                <a
                  href={selectedItem.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg bg-primary dark:bg-primary text-primary-foreground dark:text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
                >
                  Join Meeting
                </a>
              ) : (
                <span className="text-xs text-text-muted dark:text-text-muted">
                  No meeting link available.
                </span>
              )
            ) : (
              <Link
                href={`/assignments/${selectedItem.assignmentId}`}
                className="inline-flex items-center rounded-lg bg-primary dark:bg-primary text-primary-foreground dark:text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
              >
                View Assignment Details
              </Link>
            )}
          </div>
        </TimelineElementDetailsModal>
      )}
    </>
  );
}