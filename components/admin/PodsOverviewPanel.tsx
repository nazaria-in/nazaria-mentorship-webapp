// /components/admin/PodsOverviewPanel.tsx
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPodsOverview, removeUserFromPod, type PodMemberSummary } from "@/lib/api/admin-users";
import { RoleBadge } from "@/components/admin/RoleBadge";
import { CreatePodForm } from "@/components/admin/CreatePodForm";

export function PodsOverviewPanel() {
  const queryClient = useQueryClient();

  const { data: pods, isLoading, error } = useQuery({
    queryKey: ["pods-overview"],
    queryFn: fetchPodsOverview,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["pods-overview"] });
    queryClient.invalidateQueries({ queryKey: ["pod-options"] });
    queryClient.invalidateQueries({ queryKey: ["admin-users-pods"] });
  }

  async function handleRemove(userId: string) {
    await removeUserFromPod(userId);
    refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <CreatePodForm onCreated={refresh} />

      {isLoading && <p className="text-sm text-text-muted dark:text-text-muted">Loading pods...</p>}
      {error && (
        <p className="text-sm text-destructive dark:text-destructive">
          {error instanceof Error ? error.message : "Failed to load pods."}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(pods ?? []).map((pod) => (
          <div key={pod.id} className="surface-card flex flex-col gap-3 dark:surface-card">
            <div>
              <p className="font-heading text-lg text-text-primary dark:text-text-primary">{pod.name}</p>
              <p className="text-xs text-text-muted dark:text-text-muted">
                {pod.cohortName ?? "No cohort"}
                {pod.skillLevel ? ` · ${pod.skillLevel}` : ""}
              </p>
            </div>

            <MemberGroup label="Mentors" members={pod.mentors} onRemove={handleRemove} />
            <MemberGroup label="Mentees" members={pod.mentees} onRemove={handleRemove} />
            {pod.associatesAndPms.length > 0 && (
              <MemberGroup label="Staff" members={pod.associatesAndPms} onRemove={handleRemove} />
            )}

            {pod.mentors.length === 0 && pod.mentees.length === 0 && pod.associatesAndPms.length === 0 && (
              <p className="text-xs text-text-muted dark:text-text-muted">No members yet.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface MemberGroupProps {
  label: string;
  members: PodMemberSummary[];
  onRemove: (userId: string) => void;
}

function MemberGroup({ label, members, onRemove }: MemberGroupProps) {
  if (members.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted dark:text-text-muted">
        {label}
      </p>
      {members.map((member) => (
        <div
          key={member.userId}
          className="surface-card-alt flex items-center justify-between dark:surface-card-alt"
        >
          <div className="flex items-center gap-2">
            <RoleBadge role={member.role} />
            <span className="text-sm text-text-primary dark:text-text-primary">
              {member.fullName ?? member.email ?? member.userId}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onRemove(member.userId)}
            className="text-xs text-text-muted underline dark:text-text-muted"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}