// components/assignments/AssignmentDetailsView.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAssignment } from "@/lib/api/assignments";
import { fetchMenteeAssignmentFor } from "@/lib/api/mentee-assignments";
import { SlotSubmissionsPanel } from "@/components/assignments/SlotSubmissionsPanel";
import { MenteeAssignmentGrid } from "@/components/assignments/MenteeAssignmentGrid";
import { EmptyState } from "@/components/shared/EmptyState";
import type { PermissionLevel } from "@/providers/role-provider";
import Linkify from "linkify-react";

export interface AssignmentDetailsViewProps {
  assignmentId: string;
  role: PermissionLevel;
  currentUserId: string; // when role === "mentee", this is the mentee viewing their own work
}

export function AssignmentDetailsView({ assignmentId, role, currentUserId }: AssignmentDetailsViewProps) {
  const { data: assignment, isLoading } = useQuery({
    queryKey: ["assignment", assignmentId],
    queryFn: () => fetchAssignment(assignmentId),
  });

  const isMentee = role === "mentee";
  const canReview = role === "mentor";

  const { data: menteeAssignment, isLoading: loadingDispatch } = useQuery({
    queryKey: ["mentee-assignment-for", assignmentId, currentUserId],
    queryFn: () => fetchMenteeAssignmentFor(assignmentId, currentUserId),
    enabled: isMentee,
  });

  if (isLoading) {
    return <div className="p-4 text-sm text-text-primary/50">Loading assignment…</div>;
  }

  if (!assignment) {
    return <EmptyState title="Assignment not found" description="It may have been removed." />;
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* surface-card gives the header its own bordered/shaded container,
          consistent with every other block on this page instead of text
          floating directly on the page background. */}
      <header className="surface-card flex flex-col gap-2">
        <h1 className="font-heading text-xl font-semibold text-text-primary">{assignment.title}</h1>
        <p className="text-sm text-text-primary/70">{assignment.description}</p>
        {assignment.instructions && (
          <Linkify
            options={{
              attributes: {
                class: "text-text-primary underline hover:text-text-primary/80 dark:text-text-accent",
                target: "_blank",
                rel: "noopener noreferrer",
              },
            }}
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary/60">
              {assignment.instructions}
            </p>
          </Linkify>
        )}
        <div className="mt-1.5 flex gap-3 text-xs text-text-primary/50">
          <span>Starts {formatDate(assignment.start_date)}</span>
          {assignment.end_date && <span>Due {formatDate(assignment.end_date)}</span>}
        </div>
      </header>

      {isMentee ? (
        loadingDispatch ? (
          <div className="text-sm text-text-primary/50">Loading your submissions…</div>
        ) : !menteeAssignment ? (
          <EmptyState
            title="Not assigned to you yet"
            description="This assignment hasn't been dispatched to you."
          />
        ) : (
          <SlotSubmissionsPanel
            assignmentId={assignmentId}
            menteeAssignmentId={menteeAssignment.id}
            mode="submit"
            slotsFromParent={assignment.slots}
          />
        )
      ) : (
        <MenteeAssignmentGrid
          assignment={assignment}
          viewerId={currentUserId}
          canReview={canReview}
        />
      )}
    </div>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}