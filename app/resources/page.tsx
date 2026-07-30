// /app/resources/page.tsx

"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { NAV_BY_PERMISSION } from "@/components/shell/NavConfig";
import { useRole } from "@/providers/role-provider";
import { useSessionStore } from "@/store/session-store";
import { supabase } from "@/lib/supabase/client";
import { applyFilters } from "@/lib/filtering/apply-filters";
import { applySort } from "@/lib/filtering/apply-sort";
import { useFilterState } from "@/hooks/use-filter-state";
import { SmartFilterBar } from "@/components/filters/SmartFilterBar";
import { getResourceFieldDefs, type MenteeFilterOption } from "@/lib/filtering/resource-fields";
import { fetchPodMemberGroups } from "@/lib/api/pods";
import { mapResourceRow, softDeleteResource } from "@/lib/api/resources";
import { ResourceCard } from "@/components/resources/ResourceCard";
import { ResourceFormModal } from "@/components/resources/ResourceFormModal";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { EmptyState } from "@/components/shared/EmptyState";
import type { ResourceListItem, ResourceStatus } from "@/types/resources";

interface ResourceListRow {
  id: string;
  type: string | null;
  title: string;
  description: string | null;
  links: string[] | null;
  status: string;
  week_number: number | null;
  created_by: string;
  assigned_to: string | null;
  created_at: string;
  deleted_at: string | null;
  assigned_user: { full_name: string | null } | null;
}

type FormModalState =
  | {
      mode: "create";
    }
  | {
      mode: "edit";
      resourceId: string;
    };

const STATUS_SECTIONS: { status: ResourceStatus; label: string; accent: string }[] = [
  { status: "ongoing", label: "Ongoing", accent: "bg-primary" },
  { status: "paused", label: "Paused", accent: "bg-yellow-500" },
  { status: "completed", label: "Completed", accent: "bg-secondary-foreground/40" },
  { status: "abandoned", label: "Abandoned", accent: "bg-destructive/50" },
];

export default function ResourcesListPage() {
  const { role, permissionLevel } = useRole();
  const userId = useSessionStore((s) => s.userId);
  const queryClient = useQueryClient();

  const isMentee = permissionLevel === "mentee";
  const canCreate = !!userId; // everyone can create — mentees for themselves, mentors/staff for their pods
  const scopeToMentorId = role === "mentor" ? userId ?? undefined : undefined;

  const [formModal, setFormModal] = React.useState<FormModalState | null>(null);

  const { data: podGroups } = useQuery({
    queryKey: ["pod-member-groups", "mentee", scopeToMentorId],
    queryFn: () => fetchPodMemberGroups({ role: "mentee", mentorId: scopeToMentorId }),
    enabled: !isMentee,
  });

  const menteeOptions: MenteeFilterOption[] = React.useMemo(() => {
    if (isMentee || !podGroups) return [];
    return podGroups.flatMap((pod) => pod.members.map((m) => ({ value: m.id, label: m.full_name })));
  }, [isMentee, podGroups]);

  const fieldDefs = React.useMemo(() => getResourceFieldDefs(menteeOptions), [menteeOptions]);
  const filterState = useFilterState(fieldDefs, "resources-list");

  const { data: resources, isLoading } = useQuery({
    queryKey: ["resources", "list", isMentee, userId, filterState.filterState, filterState.sortState],
    queryFn: async () => {
      let query = supabase
        .from("resources_and_courses")
        .select("*, assigned_user:users!assigned_to(full_name)")
        .is("deleted_at", null);

      if (isMentee && userId) {
        query = query.eq("assigned_to", userId);
      }

      query = applyFilters(query, fieldDefs, filterState.filterState);
      query = applySort(query, fieldDefs, filterState.sortState);

      const { data, error } = await query;
      if (error) throw error;

      return (data as ResourceListRow[]).map(
        (row): ResourceListItem => ({
          ...mapResourceRow(row),
          assigneeName: row.assigned_user?.full_name ?? null,
        })
      );
    },
    enabled: !isMentee || !!userId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => softDeleteResource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources", "list"] });
    },
  });

  function renderGrid(list: ResourceListItem[], emptyLabel: string, showManageActions: boolean) {
    if (list.length === 0) {
      return <p className="px-1 text-xs text-text-primary/50">{emptyLabel}</p>;
    }
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((r) => (
          <ResourceCard
            key={r.id}
            resource={r}
            href={`/resources/${r.id}`}
            assigneeName={!isMentee ? r.assigneeName : undefined}
            onEdit={showManageActions ? () => setFormModal({ mode: "edit", resourceId: r.id }) : undefined}
            onDelete={showManageActions ? () => deleteMutation.mutateAsync(r.id) : undefined}
          />
        ))}
      </div>
    );
  }

  const list = resources ?? [];

  return (
    <>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SmartFilterBar fieldDefs={fieldDefs} state={filterState} className="sm:max-w-2xl" />
          {canCreate && (
            <button
              type="button"
              onClick={() => setFormModal({ mode: "create" })}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Add resource
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-sm text-text-primary/50">Loading…</div>
        ) : isMentee ? (
          list.length === 0 ? (
            <EmptyState title="Nothing here yet" description="Resources assigned to you, or ones you add yourself, will show up here." />
          ) : (
            renderGrid(list, "Nothing to show.", true)
          )
        ) : (
          <div className="flex flex-col gap-4">
            {STATUS_SECTIONS.map(({ status, label, accent }) => {
              const filtered = list.filter((r) => r.status === status);
              return (
                <CollapsibleSection key={status} title={label} count={filtered.length} accentClassName={accent} defaultOpen={status === "ongoing"}>
                  {renderGrid(filtered, `No ${label.toLowerCase()} resources.`, true)}
                </CollapsibleSection>
              );
            })}
          </div>
        )}
      </div>

      {canCreate && userId && formModal && (
        <ResourceFormModal
          open={!!formModal}
          onClose={() => setFormModal(null)}
          mode={formModal.mode}
          resourceId={    
    formModal.mode === "edit"
      ? formModal.resourceId
      : undefined}
          currentUserId={userId}
          creatorRole={permissionLevel}
          scopeToMentorId={scopeToMentorId}
          onSaved={() => setFormModal(null)}
        />
      )}
    </>
  );
}