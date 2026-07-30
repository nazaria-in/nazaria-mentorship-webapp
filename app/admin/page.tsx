// app/admin/page.tsx
"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { NAV_BY_PERMISSION } from "@/components/shell/NavConfig";
import { useRole } from "@/providers/role-provider";
import { EmptyState } from "@/components/shared/EmptyState";
import { getEscalations, markEscalationReviewed } from "@/lib/api/escalations";
import { createClient } from "@/lib/supabase/client";
import { UserActivityCard } from "@/components/shared/UserActivityCard";
import { UserProfileSheet } from "@/components/shared/UserProfileSheet";
import { PodStatsPanel } from "@/components/admin/PodStatsPanel";
import { MentorStatsPanel } from "@/components/admin/MentorStatsPanel";

// INTEGRATION NOTE: PendingApprovalsList / PodsOverviewPanel exist in
// components/admin/ already — mount them here once you confirm their real
// props (I don't have that file's contents). Left out for now rather than
// guessed, to avoid a silent prop mismatch.

interface EscalationSubject {
  id: string;
  full_name: string | null;
  role: "pm" | "associate" | "mentor" | "mentee";
  school_or_org: string | null;
  approval_status: "pending" | "approved" | "rejected";
}

function useEscalationsData() {
  return useQuery({
    queryKey: ["dashboard-escalations"],
    queryFn: getEscalations,
  });
}

function useEscalationSubjects(subjectIds: string[]) {
  return useQuery({
    queryKey: ["dashboard-escalation-subjects", subjectIds],
    enabled: subjectIds.length > 0,
    queryFn: async (): Promise<Record<string, EscalationSubject>> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, role, school_or_org, approval_status")
        .in("id", subjectIds);
      if (error) throw error;
      const map: Record<string, EscalationSubject> = {};
      for (const row of (data ?? []) as EscalationSubject[]) {
        map[row.id] = row;
      }
      return map;
    },
  });
}

function AdminDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const escalations = useEscalationsData();
  const subjectIds = (escalations.data ?? [])
    .map((e) => e.subject_user_id)
    .filter((id): id is string => id !== null);
  const subjects = useEscalationSubjects(subjectIds);

  const openProfile = (userId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("user", userId);
    router.push(`?${params.toString()}`);
  };

  const handleMarkReviewed = async (exitSurveyId: string) => {
    await markEscalationReviewed(exitSurveyId);
    escalations.refetch();
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Escalation Desk */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary">
          Escalation Desk
        </h2>

        {escalations.isLoading && <p className="text-sm text-text-muted">Loading…</p>}
        {escalations.data?.length === 0 && !escalations.isLoading && (
          <p className="text-sm text-text-muted">Nothing needs attention right now.</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {(escalations.data ?? []).map((e) => {
            const subject = e.subject_user_id ? subjects.data?.[e.subject_user_id] : undefined;
            if (!subject) return null;
            return (
              <div key={e.exit_survey_id} className="space-y-2">
                <UserActivityCard
                  userId={subject.id}
                  fullName={subject.full_name ?? "Unknown"}
                  role={subject.role}
                  schoolOrOrg={subject.school_or_org}
                  approvalStatus={subject.approval_status}
                  onViewDetails={openProfile}
                  variant="escalation"
                />
                {/* Red-signal-only escalations can't be fully dismissed —
                    see the limitation note in lib/api/escalations.ts.
                    This button still works for needs_follow_up-driven ones. */}
                <button
                  type="button"
                  onClick={() => handleMarkReviewed(e.exit_survey_id)}
                  className="text-xs text-text-accent hover:underline dark:text-text-accent"
                >
                  Mark reviewed
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pods at a glance */}
      <section>
        <h2 className="font-heading text-lg font-semibold text-text-primary mb-3 dark:text-text-primary">
          Pods at a glance
        </h2>
        <PodStatsPanel />
      </section>

      {/* Mentors at a glance */}
      <section>
        <h2 className="font-heading text-lg font-semibold text-text-primary mb-3 dark:text-text-primary">
          Mentors at a glance
        </h2>
        <MentorStatsPanel />
      </section>

      <UserProfileSheet />
    </div>
  );
}

export default function AdminDashboardPage() {
  const { permissionLevel } = useRole();

  if (permissionLevel !== "staff") {
    return (
      <AppShell navItems={NAV_BY_PERMISSION[permissionLevel]} pageTitle="Admin dashboard">
        <div className="p-4">
          <EmptyState
            title="Staff only"
            description="This page is only available to associates and program managers."
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell navItems={NAV_BY_PERMISSION[permissionLevel]} pageTitle="Admin dashboard">
      <Suspense fallback={<p className="p-6 text-text-muted">Loading…</p>}>
        <AdminDashboardContent />
      </Suspense>
    </AppShell>
  );
}