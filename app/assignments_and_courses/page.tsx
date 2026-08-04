// /app/assignments_and_courses/page.tsx

"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, SlidersHorizontal } from "lucide-react";
import { useRole } from "@/providers/role-provider";
import { useSessionStore } from "@/store/session-store";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { EmptyState } from "@/components/shared/EmptyState";
import { SmartFilterBar } from "@/components/filters/SmartFilterBar";
import { useFilterState } from "@/hooks/use-filter-state";
import { useContentFieldDefs } from "@/lib/filtering/content-fields";
import { fetchContentItems, fetchTags, fetchWeeks, softDeleteContentItem } from "@/lib/api/content-items";
import { fetchMenteeContentDispatches } from "@/lib/api/content-dispatches";
import { ContentItemCard } from "@/components/content/ContentItemCard";
import { MenteeContentCard } from "@/components/content/MenteeContentCard";
import { ContentItemFormModal } from "@/components/content/ContentItemFormModal";
import type { ContentType, Week } from "@/types/content";

// Widened from the old "GradedTab" (assignment | course) now that Resources
// is a full third tab sharing the same view logic instead of living on its
// own route. Every place this type appears below is otherwise unchanged —
// StaffView/MenteeView were already written generically off content_type.
type ContentTab = ContentType;

const TAB_DEFS: { value: ContentTab; label: string }[] = [
  { value: "assignment", label: "Assignments" },
  { value: "course", label: "Courses" },
  { value: "resource", label: "Resources" },
];

interface FormModalState {
  mode: "create" | "edit";
  contentItemId?: string;
  /** Only meaningful for mode: "create" — seeds the type selector to the active tab. */
  contentType?: ContentType;
}

export default function AssignmentsAndCoursesPage() {
  const { role, permissionLevel } = useRole();
  const userId = useSessionStore((s) => s.userId);
  const queryClient = useQueryClient();

  const [tab, setTab] = React.useState<ContentTab>("assignment");
  const [showFilters, setShowFilters] = React.useState(false);
  const [formModal, setFormModal] = React.useState<FormModalState | null>(null);

  const isMentee = permissionLevel === "mentee";
  const canCreate = permissionLevel === "mentor" || permissionLevel === "staff";
  const scopeToMentorId = role === "mentor" ? userId ?? undefined : undefined;
  const scopeToCreatedBy = role === "mentor" ? userId ?? undefined : undefined;

  const { data: weeks } = useQuery({ queryKey: ["weeks"], queryFn: fetchWeeks });
  const { data: tags } = useQuery({ queryKey: ["tags"], queryFn: fetchTags });
  const fieldDefs = useContentFieldDefs(weeks ?? [], tags ?? []);

  const filterState = useFilterState(fieldDefs, `content-${tab}-list`);

  const menteeQuery = useQuery({
    queryKey: ["content-dispatches", "mentee", tab, userId],
    queryFn: () => fetchMenteeContentDispatches(userId!, tab),
    enabled: isMentee && !!userId,
  });

  const staffQuery = useQuery({
    queryKey: ["content-items", "list", tab, scopeToCreatedBy, filterState.filterState, filterState.sortState],
    queryFn: () =>
      fetchContentItems({
        contentType: tab,
        fieldDefs,
        filterState: filterState.filterState,
        sortState: filterState.sortState,
        scopeToCreatedBy,
      }),
    enabled: !isMentee,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => softDeleteContentItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["content-items", "list", tab] }),
  });

  return (
    <>
      <div className="flex flex-col gap-4 p-4">
        <PageHeader tab={tab} onTabChange={setTab} />

        {isMentee ? (
          <MenteeView
            loading={menteeQuery.isLoading}
            dispatches={menteeQuery.data ?? []}
            tab={tab}
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters((s) => !s)}
            fieldDefs={fieldDefs}
            filterState={filterState}
          />
        ) : (
          <StaffView
            loading={staffQuery.isLoading}
            items={staffQuery.data ?? []}
            weeks={weeks ?? []}
            tab={tab}
            canCreate={canCreate}
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters((s) => !s)}
            fieldDefs={fieldDefs}
            filterState={filterState}
            onCreate={() => setFormModal({ mode: "create", contentType: tab })}
            onEdit={(id) => setFormModal({ mode: "edit", contentItemId: id })}
            onDelete={(id) => deleteMutation.mutateAsync(id)}
          />
        )}
      </div>

      {canCreate && userId && formModal && (
        <ContentItemFormModal
          open={!!formModal}
          onClose={() => setFormModal(null)}
          mode={formModal.mode}
          contentType={formModal.contentType ?? tab}
          contentItemId={formModal.contentItemId}
          currentUserId={userId}
          scopeToMentorId={scopeToMentorId}
          onSaved={() => {
            setFormModal(null);
            // Invalidate all three tabs' lists, not just the active one —
            // the form's type selector means a mentor can create/edit into
            // a different tab than the one they opened the modal from.
            queryClient.invalidateQueries({ queryKey: ["content-items", "list"] });
          }}
        />
      )}
    </>
  );
}

function PageHeader({ tab, onTabChange }: { tab: ContentTab; onTabChange: (t: ContentTab) => void }) {
  return (
    <div className="inline-flex w-fit rounded-full border border-border bg-card p-0.5 dark:border-border dark:bg-card">
      {TAB_DEFS.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onTabChange(t.value)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === t.value
              ? "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground"
              : "text-text-muted dark:text-text-muted"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

interface FilterToggleProps {
  showFilters: boolean;
  onToggleFilters: () => void;
  fieldDefs: ReturnType<typeof useContentFieldDefs>;
  filterState: ReturnType<typeof useFilterState>;
}

function FilterBarWithToggle({ showFilters, onToggleFilters, fieldDefs, filterState }: FilterToggleProps) {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onToggleFilters}
        className="flex w-fit items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-primary sm:hidden dark:border-border dark:text-text-primary"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filters
      </button>
      <div className={`${showFilters ? "block" : "hidden"} sm:block`}>
        <SmartFilterBar fieldDefs={fieldDefs} state={filterState} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mentee view — mobile-first: search/filter, then a flat "To do" / "Completed"
// split. No week grouping here; a mentee's own list is short enough that
// grouping adds friction rather than removing it. Type-agnostic already —
// works unchanged for the new Resources tab since
// fetchMenteeContentDispatches handles content_type !== "assignment"
// generically (binary completed_at status).
// ---------------------------------------------------------------------------

function MenteeView({
  loading,
  dispatches,
  tab,
  showFilters,
  onToggleFilters,
  fieldDefs,
  filterState,
}: {
  loading: boolean;
  dispatches: ReturnType<typeof fetchMenteeContentDispatches> extends Promise<infer T> ? T : never;
  tab: ContentTab;
  showFilters: boolean;
  onToggleFilters: () => void;
  fieldDefs: ReturnType<typeof useContentFieldDefs>;
  filterState: ReturnType<typeof useFilterState>;
}) {
  const search = filterState.filterState.search?.toLowerCase().trim() ?? "";
  const visible = dispatches.filter((d) => !search || d.content_item.title.toLowerCase().includes(search));
  const toDo = visible.filter((d) => d.completion_status !== "completed" && d.completion_status !== "approved_awaiting_completion");
  const completed = visible.filter((d) => d.completion_status === "completed" || d.completion_status === "approved_awaiting_completion");

  return (
    <div className="flex flex-col gap-4">
      <FilterBarWithToggle
        showFilters={showFilters}
        onToggleFilters={onToggleFilters}
        fieldDefs={fieldDefs}
        filterState={filterState}
      />

      {loading ? (
        <p className="text-sm text-text-muted dark:text-text-muted">Loading…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          title={`No ${tabNoun(tab, true)} yet`}
          description="Nothing has been assigned to you here at the moment."
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <SectionLabel label="To do" count={toDo.length} />
            {toDo.length === 0 ? (
              <p className="px-1 text-xs text-text-muted dark:text-text-muted">You&apos;re all caught up.</p>
            ) : (
              <CardGrid>
                {toDo.map((d) => (
                  <MenteeContentCard key={d.content_item.id} dispatch={d} href={`/assignments_and_courses/${d.content_item.id}`} />
                ))}
              </CardGrid>
            )}
          </div>

          {completed.length > 0 && (
            <div className="flex flex-col gap-3">
              <SectionLabel label="Completed" count={completed.length} />
              <CardGrid>
                {completed.map((d) => (
                  <MenteeContentCard key={d.content_item.id} dispatch={d} href={`/assignments_and_courses/${d.content_item.id}`} />
                ))}
              </CardGrid>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Staff/mentor view — filters + create, grouped by week (content_items have
// no start/end date of their own anymore, only their week does). Already
// generic over content_type; only the empty-state copy is tab-aware.
// ---------------------------------------------------------------------------

interface StaffViewProps {
  loading: boolean;
  items: ReturnType<typeof fetchContentItems> extends Promise<infer T> ? T : never;
  weeks: Week[];
  tab: ContentTab;
  canCreate: boolean;
  showFilters: boolean;
  onToggleFilters: () => void;
  fieldDefs: ReturnType<typeof useContentFieldDefs>;
  filterState: ReturnType<typeof useFilterState>;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}

function StaffView({
  loading,
  items,
  weeks,
  tab,
  canCreate,
  showFilters,
  onToggleFilters,
  fieldDefs,
  filterState,
  onCreate,
  onEdit,
  onDelete,
}: StaffViewProps) {
  const byWeek = new Map<string, typeof items>();
  const noWeek: typeof items = [];
  for (const item of items) {
    if (!item.week) {
      noWeek.push(item);
      continue;
    }
    const bucket = byWeek.get(item.week.id) ?? [];
    bucket.push(item);
    byWeek.set(item.week.id, bucket);
  }
  const orderedWeeks = weeks.filter((w) => byWeek.has(w.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <FilterBarWithToggle
          showFilters={showFilters}
          onToggleFilters={onToggleFilters}
          fieldDefs={fieldDefs}
          filterState={filterState}
        />
        {canCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground dark:bg-primary dark:text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Create {tabNoun(tab, false)}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-text-muted dark:text-text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState
          title={`No ${tabNoun(tab, true)} yet`}
          description="Nothing matches the current filters, or nothing has been created yet."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {orderedWeeks.map((week) => {
            const weekItems = byWeek.get(week.id) ?? [];
            return (
              <CollapsibleSection key={week.id} title={week.name} count={weekItems.length} accentClassName="bg-primary" defaultOpen>
                <CardGrid>
                  {weekItems.map((item) => (
                    <ContentItemCard
                      key={item.id}
                      item={item}
                      href={`/assignments_and_courses/${item.id}`}
                      onEdit={() => onEdit(item.id)}
                      onDelete={() => onDelete(item.id)}
                    />
                  ))}
                </CardGrid>
              </CollapsibleSection>
            );
          })}

          {noWeek.length > 0 && (
            <CollapsibleSection title="No week assigned" count={noWeek.length} accentClassName="bg-text-muted" defaultOpen={orderedWeeks.length === 0}>
              <CardGrid>
                {noWeek.map((item) => (
                  <ContentItemCard
                    key={item.id}
                    item={item}
                    href={`/assignments_and_courses/${item.id}`}
                    onEdit={() => onEdit(item.id)}
                    onDelete={() => onDelete(item.id)}
                  />
                ))}
              </CardGrid>
            </CollapsibleSection>
          )}
        </div>
      )}
    </div>
  );
}

function tabNoun(tab: ContentTab, plural: boolean): string {
  if (tab === "assignment") return plural ? "assignments" : "assignment";
  if (tab === "course") return plural ? "courses" : "course";
  return plural ? "resources" : "resource";
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <h2 className="text-sm font-semibold text-text-primary dark:text-text-primary">{label}</h2>
      <span className="rounded-full bg-card-alt px-1.5 py-0.5 text-[11px] text-text-muted dark:bg-card-alt dark:text-text-muted">
        {count}
      </span>
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}