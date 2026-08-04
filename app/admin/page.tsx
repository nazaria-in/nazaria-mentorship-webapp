// app/admin/page.tsx
"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { NAV_BY_PERMISSION } from "@/components/shell/NavConfig";
import { useRole } from "@/providers/role-provider";
import { EmptyState } from "@/components/shared/EmptyState";
import { getEscalations, markEscalationReviewed } from "@/lib/api/escalations";
import { getPodStats, getMentorStats } from "@/lib/api/org-stats";
import { resolveAdminScope, type AdminScope } from "@/lib/api/admin-scope";
import { fetchUsersByApproval } from "@/lib/api/users";
import { createClient } from "@/lib/supabase/client";


import { UserCardPerson } from "@/components/shared/UserCard";
import { StatusStrip, type StatusTile } from "@/components/admin/dashboard/StatusStrip";
import { EscalationDesk } from "@/components/admin/dashboard/EscalationDesk";
import { PodCompletionSection } from "@/components/admin/dashboard/PodCompletionSection";
import { MentorCompletionSection } from "@/components/admin/dashboard/MentorCompletionSection";
import { ExitSurveySignalsSection } from "@/components/admin/dashboard/ExitSurveySignalsSection";
import { StaffScopeBlock } from "@/components/admin/dashboard/StaffScopeBlock";
import { AboutMenteeBlock } from "@/components/admin/dashboard/AboutMenteeBlock";
import { AboutMentorBlock } from "@/components/admin/dashboard/AboutMentorBlock";

function useScope(id: string | null) {
  return useQuery({
    queryKey: ["admin-scope", id],
    enabled: !!id,
    queryFn: () => resolveAdminScope(id as string),
  });
}

function useEscalationsData(scopedId: string | null, scope: AdminScope | undefined) {
  return useQuery({
    queryKey: ["dashboard-escalations", scopedId],
    enabled: scopedId === null || !!scope,
    queryFn: () => getEscalations(scope),
  });
}

function useEscalationSubjects(subjectIds: string[]) {
  return useQuery({
    queryKey: ["dashboard-escalation-subjects", subjectIds],
    enabled: subjectIds.length > 0,
    queryFn: async (): Promise<Record<string, UserCardPerson>> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, role, approval_status, email")
        .in("id", subjectIds);
      if (error) throw error;
      const map: Record<string, UserCardPerson> = {};
      for (const row of (data ?? []) as Array<{
        id: string;
        full_name: string | null;
        role: UserCardPerson["role"];
        approval_status: UserCardPerson["approvalStatus"];
        email: string | null;
      }>) {
        map[row.id] = {
          id: row.id,
          fullName: row.full_name,
          role: row.role,
          approvalStatus: row.approval_status,
          email: row.email,
        };
      }
      return map;
    },
  });
}

/** Count-only via existing fetchUsersByApproval — see plan §7: cheapest
 *  path, fetches full pending rows and takes .length. A dedicated
 *  count-only query would be cheaper but doesn't exist yet. */
function usePendingApprovalsCount() {
  return useQuery({
    queryKey: ["pending-approvals-count"],
    queryFn: async () => (await fetchUsersByApproval({ status: "pending" })).length,
  });
}

export function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const scopedId = searchParams.get("id");

  const scopeQuery = useScope(scopedId);
  const scope: AdminScope | undefined = scopeQuery.data;
  const isStaffTarget = !!scopedId && !!scope && scope.role !== "mentor" && scope.role !== "mentee";
  const isMenteeTarget = !!scope && scope.role === "mentee";
  const isMentorTarget = !!scope && scope.role === "mentor";
  // Unscoped (org-wide) view: either no ?id= at all, or ?id= hasn't resolved yet.
  const isUnscoped = scopedId === null;

  const escalations = useEscalationsData(scopedId, scope);
  const subjectIds = (escalations.data ?? [])
    .map((e) => e.subject_user_id)
    .filter((id): id is string => id !== null);
  const subjects = useEscalationSubjects(subjectIds);

  // Pod/mentor comparison tables only make sense unscoped — a single
  // mentee/mentor gets AboutMenteeBlock/AboutMentorBlock instead (plan §3
  // B/C). Only fetch these when there's something to show.
  const podStats = useQuery({
    queryKey: ["pod-stats", scopedId],
    enabled: isUnscoped,
    queryFn: () => getPodStats(undefined),
  });

  const mentorStats = useQuery({
    queryKey: ["mentor-stats", scopedId],
    enabled: isUnscoped,
    queryFn: () => getMentorStats(undefined),
  });

  const pendingCount = usePendingApprovalsCount();

  const handleMarkReviewed = async (exitSurveyId: string) => {
    await markEscalationReviewed(exitSurveyId);
    escalations.refetch();
  };

  // --- Case D: staff target — full block, dashboard doesn't render ---
  if (isStaffTarget) {
    return (
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        <StaffScopeBlock />
      </div>
    );
  }

  // Still resolving the scope for a given ?id= — avoid flashing the
  // unscoped org-wide layout before we know which branch to render.
  if (scopedId && !scope) {
    return <p className="max-w-5xl mx-auto p-6 text-sm text-text-muted dark:text-text-muted">Loading…</p>;
  }

  const orgWideTiles: StatusTile[] = [
    {
      label: "Open escalations",
      value: String(escalations.data?.length ?? 0),
      alert: (escalations.data?.length ?? 0) > 0,
    },
    {
      label: "Pending approvals",
      value: String(pendingCount.data ?? 0),
      alert: (pendingCount.data ?? 0) > 0,
      href: "/admin/users",
    },
    {
      label: "Assingment Completions",
      value:
        podStats.data && podStats.data.length > 0
          ? `${Math.round(
              (podStats.data.reduce((sum, p) => sum + p.completed_assignments, 0) /
                Math.max(
                  podStats.data.reduce((sum, p) => sum + p.total_assignments, 0),
                  1
                )) *
                100
            )}%`
          : "—",
    },
    {
      label: "Pods below 50% Completion",
      value: String(
        (podStats.data ?? []).filter(
          (p) => p.total_assignments > 0 && p.completed_assignments / p.total_assignments < 0.5
        ).length
      ),
    },
  ];

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-8">
      {/* --- Case B: mentee-scoped --- */}
      {isMenteeTarget && scope && (
        <section>
          <h2 className="font-heading text-lg font-semibold text-text-primary mb-3 dark:text-text-primary">
            About this mentee
          </h2>
          <AboutMenteeBlock scope={scope} />
        </section>
      )}

      {/* --- Case C: mentor-scoped --- */}
      {isMentorTarget && scope && (
        <section>
          <h2 className="font-heading text-lg font-semibold text-text-primary mb-3 dark:text-text-primary">
            About this mentor
          </h2>
          <AboutMentorBlock scope={scope} />
        </section>
      )}

      {/* --- Case A: unscoped status strip only --- */}
      {isUnscoped && (
        <section>
          <StatusStrip tiles={orgWideTiles} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary">
          Escalation Desk
        </h2>
        <EscalationDesk
          escalations={escalations.data ?? []}
          subjects={subjects.data ?? {}}
          isLoading={escalations.isLoading}
          onMarkReviewed={handleMarkReviewed}
        />
      </section>

      {/* --- Case A only: org-wide comparison tables --- */}
      {isUnscoped && (
        <>
          <section>
            <h2 className="font-heading text-lg font-semibold text-text-primary mb-3 dark:text-text-primary">
              Pods at a glance
            </h2>
            <PodCompletionSection data={podStats.data ?? []} isLoading={podStats.isLoading} />
          </section>

          <section>
            <h2 className="font-heading text-lg font-semibold text-text-primary mb-3 dark:text-text-primary">
              Mentors at a glance
            </h2>
            <MentorCompletionSection data={mentorStats.data ?? []} isLoading={mentorStats.isLoading} />
          </section>
        </>
      )}

      <section>
        <h2 className="font-heading text-lg font-semibold text-text-primary mb-3 dark:text-text-primary">
          Exit Survey Signals
        </h2>
        <ExitSurveySignalsSection
          scopePodId={isMentorTarget ? scope?.podId ?? null : null}
          scopeSubjectUserId={isMenteeTarget ? scope?.userId ?? null : null}
        />
      </section>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { permissionLevel } = useRole();

  if (permissionLevel !== "staff") {
    return (
        <div className="p-4">
          <EmptyState
            title="Staff only"
            description="This page is only available to associates and program managers."
          />
        </div>
    );
  }

  return (
      <Suspense fallback={<p className="p-6 text-text-muted">Loading…</p>}>
        <AdminDashboardContent />
      </Suspense>
  );
}