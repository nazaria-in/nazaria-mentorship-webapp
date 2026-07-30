// components/admin/dashboard/EscalationDesk.tsx
"use client";

import { useMemo } from "react";
import { UserCard, type UserCardPerson } from "@/components/shared/UserCard";
import type { Escalation } from "@/types/admin";

export interface EscalationDeskProps {
  escalations: Escalation[];
  subjects: Record<string, UserCardPerson>;
  isLoading: boolean;
  onMarkReviewed: (exitSurveyId: string) => void;
}

const GROUP_ORDER: { key: Escalation["follow_up_urgency"] | "flagged"; label: string }[] = [
  { key: "urgent", label: "Urgent" },
  { key: "soon", label: "Needs follow-up soon" },
  { key: "flagged", label: "Flagged" },
];

export function EscalationDesk({ escalations, subjects, isLoading, onMarkReviewed }: EscalationDeskProps) {
  const groups = useMemo(() => {
    const buckets: Record<string, Escalation[]> = { urgent: [], soon: [], flagged: [] };
    for (const e of escalations) {
      if (e.follow_up_urgency === "urgent") buckets.urgent.push(e);
      else if (e.follow_up_urgency === "soon") buckets.soon.push(e);
      else buckets.flagged.push(e); // needs_follow_up or signal=red with urgency "none"
    }
    return buckets;
  }, [escalations]);

  if (isLoading) {
    return <p className="text-sm text-text-muted dark:text-text-muted">Loading…</p>;
  }

  if (escalations.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-6 text-center dark:border-border dark:bg-card">
        <p className="text-sm text-text-muted dark:text-text-muted">Nothing needs attention right now.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-gray-100 p-4 rounded-xl gap-5">
      {GROUP_ORDER.map(({ key, label }) => {
        const items = groups[key];
        if (items.length === 0) return null;
        return (
          <div key={key} className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted">
              {label} · {items.length}
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((e) => {
                const subject = e.subject_user_id ? subjects[e.subject_user_id] : undefined;
                if (!subject) return null;
                return (
                  <div key={e.exit_survey_id} className="space-y-2">
                    <UserCard person={subject} view="card" clickable={subject.role === "mentor" || subject.role === "mentee"} />
                    <button
                      type="button"
                      onClick={() => onMarkReviewed(e.exit_survey_id)}
                      className="text-xs text-text-accent hover:underline dark:text-text-accent"
                    >
                      Mark reviewed
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}