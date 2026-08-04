// /components/content/ContentItemFormModal.tsx

"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, ClipboardList, FileBox, Plus, X } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { PeopleGrid } from "@/components/shared/PeopleGrid";
import { fetchSelectablePeople } from "@/lib/api/people-picker";
import {
  createContentItem,
  createTag,
  createWeek,
  defaultTemplateFor,
  fetchContentItem,
  fetchTags,
  fetchWeeks,
  updateContentItem,
} from "@/lib/api/content-items";
import {
  dispatchContentItem,
  fetchAssignedMenteeRefs,
  removeContentDispatch,
} from "@/lib/api/content-dispatches";
import {
  ContentSubmissionTemplateEditor,
  type ContentSubmissionTemplate,
  type ContentType,
} from "@/components/content/ContentSubmissionTemplateEditor";
import type { FilterFieldDef } from "@/lib/filtering/types";
import type { ContentItemWithMeta, Week } from "@/types/content";

const PICKER_FIELD_DEFS: FilterFieldDef[] = [
  { key: "search", kind: "text", columns: ["full_name"], searchable: true },
];

const TYPE_OPTIONS: { value: ContentType; label: string; icon: typeof ClipboardList }[] = [
  { value: "assignment", label: "Assignment", icon: ClipboardList },
  { value: "course", label: "Course", icon: BookOpen },
  { value: "resource", label: "Resource", icon: FileBox },
];

export interface ContentItemFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  /**
   * In create mode this is just the initial selection — the type selector
   * lets the mentor change it before the first save. In edit mode it's
   * authoritative and immutable (see TypeSelector below): content_type is
   * never sent in updateContentItem, only at createContentItem time.
   */
  contentType: ContentType;
  contentItemId?: string;
  currentUserId: string;
  scopeToMentorId?: string;
  onSaved: () => void;
}

type Step = "details" | "roster";

/** yyyy-mm-dd for a native <input type="date">, from an ISO timestamp or null. */
function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function ContentItemFormModal({
  open,
  onClose,
  mode,
  contentType: initialContentType,
  contentItemId,
  currentUserId,
  scopeToMentorId,
  onSaved,
}: ContentItemFormModalProps) {
  const queryClient = useQueryClient();

  const [step, setStep] = React.useState<Step>("details");
  const [contentType, setContentType] = React.useState<ContentType>(initialContentType);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [weekId, setWeekId] = React.useState<string | null>(null);
  const [tagIds, setTagIds] = React.useState<string[]>([]);
  const [template, setTemplate] = React.useState<ContentSubmissionTemplate>(defaultTemplateFor(initialContentType));
  // Submission window — required by content_items_submission_window_check
  // whenever the resolved requirement isn't "disabled". Kept as plain date
  // strings here (native <input type="date"> shape) and converted to ISO
  // only at save time; null/null is only ever sent when requirement is
  // "disabled", matching the DB constraint exactly.
  const [submissionStartsAt, setSubmissionStartsAt] = React.useState("");
  const [submissionEndsAt, setSubmissionEndsAt] = React.useState("");
  const [workingItem, setWorkingItem] = React.useState<ContentItemWithMeta | null>(null);
  const [selectedMenteeIds, setSelectedMenteeIds] = React.useState<string[]>([]);
  const [dueAt, setDueAt] = React.useState("");
  const [locallyRemovedIds, setLocallyRemovedIds] = React.useState<Set<string>>(new Set());

  const isInitialized = React.useRef(false);
  const hasHydrated = React.useRef(false);
  // Tracks whether the mentor has touched anything in the form yet. Used
  // only to decide whether switching the type selector is allowed to reset
  // the template without a confirmation — once true, a type switch instead
  // asks first (see handleTypeChange).
  const hasEditedTemplate = React.useRef(false);

  const { data: weeks } = useQuery({ queryKey: ["weeks"], queryFn: fetchWeeks, enabled: open });
  const { data: tags, refetch: refetchTags } = useQuery({ queryKey: ["tags"], queryFn: fetchTags, enabled: open });

  const { data: existingItem, isLoading: loadingItem } = useQuery({
    queryKey: ["content-item", contentItemId],
    queryFn: () => fetchContentItem(contentItemId!),
    enabled: open && mode === "edit" && !!contentItemId,
  });

  // Hydrate local form state when existingItem arrives for editing.
  // Type-agnostic on purpose: submission_template's shape (metadata /
  // resource_links / type_specific / additional_questions) is identical
  // across assignment/course/resource, only the populated type_specific
  // key and whether additional_questions is empty differ. A resource with
  // 0 questions hydrates the same way a course with 5 does — the editor
  // just renders an empty list rather than needing special-casing here.
  React.useEffect(() => {
    if (existingItem && mode === "edit" && !hasHydrated.current) {
      setContentType(existingItem.content_type);
      setTitle(existingItem.title);
      setDescription(existingItem.description ?? "");
      setInstructions(existingItem.instructions ?? "");
      setWeekId(existingItem.week_id);
      setTagIds(existingItem.tags.map((t) => t.id));
      setTemplate(existingItem.submission_template);
      setSubmissionStartsAt(toDateInputValue(existingItem.submission_starts_at));
      setSubmissionEndsAt(toDateInputValue(existingItem.submission_ends_at));
      hasHydrated.current = true;
    }
  }, [existingItem, mode]);

  const { data: assignedRefs, isLoading: loadingRoster } = useQuery({
    queryKey: ["content-item-roster", contentItemId],
    queryFn: () => fetchAssignedMenteeRefs(contentItemId!),
    enabled: open && mode === "edit" && !!contentItemId && step === "roster",
  });

  // Hydrate selected mentee IDs once roster refs are fetched
  React.useEffect(() => {
    if (assignedRefs && mode === "edit" && !isInitialized.current) {
      setSelectedMenteeIds(assignedRefs.map((r) => r.menteeId));
      isInitialized.current = true;
    }
  }, [assignedRefs, mode]);

  const committedIds = React.useMemo(() => (assignedRefs ?? []).map((r) => r.menteeId), [assignedRefs]);
  const effectiveCommittedIds = React.useMemo(
    () => committedIds.filter((id) => !locallyRemovedIds.has(id)),
    [committedIds, locallyRemovedIds]
  );
  const menteeIdToDispatchId = React.useMemo(() => {
    const map = new Map<string, string>();
    (assignedRefs ?? []).forEach((r) => map.set(r.menteeId, r.contentDispatchId));
    return map;
  }, [assignedRefs]);

  // Derived during render — no effect needed. Drives both whether the
  // window date fields render at all and whether they're required before
  // save (must match content_items_submission_window_check exactly: null
  // window is only valid when is_not_required is true).
  const requirement = template.metadata.is_not_required
    ? "disabled"
    : template.metadata.is_required
    ? "required"
    : "optional";
  const submissionWindowRequired = requirement !== "disabled";
  const canSubmitDetails =
    title.trim().length > 0 && (!submissionWindowRequired || (submissionStartsAt !== "" && submissionEndsAt !== ""));

  function handleTypeChange(next: ContentType) {
    if (next === contentType) return;
    if (hasEditedTemplate.current) {
      const confirmed = window.confirm(
        "Switching type resets the submission form below (type-specific fields and questions don't carry over cleanly between types). Continue?"
      );
      if (!confirmed) return;
    }
    setContentType(next);
    setTemplate(defaultTemplateFor(next));
    hasEditedTemplate.current = false;
  }

  function handleTemplateChange(next: ContentSubmissionTemplate) {
    hasEditedTemplate.current = true;
    setTemplate(next);
  }

  const saveDetailsMutation = useMutation({
    mutationFn: async () => {
      // Belt-and-suspenders alongside the disabled Continue button: never
      // send a populated window for a "No submission" item, and never send
      // an empty window for anything else — this must match
      // content_items_submission_window_check or the insert/update 500s.
      const windowStartsAt = submissionWindowRequired && submissionStartsAt ? new Date(submissionStartsAt).toISOString() : null;
      const windowEndsAt = submissionWindowRequired && submissionEndsAt ? new Date(submissionEndsAt).toISOString() : null;

      if (mode === "create") {
        return createContentItem({
          content_type: contentType,
          title,
          description: description || null,
          instructions: instructions || null,
          week_id: weekId,
          submission_template: template,
          created_by: currentUserId,
          tag_ids: tagIds,
          submission_starts_at: windowStartsAt,
          submission_ends_at: windowEndsAt,
        });
      }
      return updateContentItem({
        id: contentItemId!,
        title,
        description: description || null,
        instructions: instructions || null,
        week_id: weekId,
        submission_template: template,
        tag_ids: tagIds,
        submission_starts_at: windowStartsAt,
        submission_ends_at: windowEndsAt,
      });
    },
    onSuccess: (saved) => {
      setWorkingItem(saved);
      setStep("roster");
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      const target = workingItem ?? existingItem;
      if (!target) throw new Error("No content item to assign mentees to");
      const newIds = selectedMenteeIds.filter((id) => !effectiveCommittedIds.includes(id));
      if (newIds.length === 0) return;
      // Derived from `target` (the just-saved/loaded row), not local form
      // state — target.submission_starts_at/ends_at are the authoritative
      // saved values (already ISO), and its own metadata is the source of
      // truth for requirement, avoiding any drift from what's currently in
      // the (possibly since-edited-but-not-saved) form fields.
      const targetRequirement = target.submission_template.metadata.is_not_required
        ? "disabled"
        : target.submission_template.metadata.is_required
        ? "required"
        : "optional";
      return dispatchContentItem({
        contentItemId: target.id,
        menteeIds: newIds,
        assignedBy: currentUserId,
        dueAt: dueAt || null,
        contentItemTitle: target.title,
        requirement: targetRequirement,
        submissionStartsAt: target.submission_starts_at,
        submissionEndsAt: target.submission_ends_at,
      });
    },
    onSuccess: () => {
      reset();
      onClose();
      onSaved();
    },
  });

  async function handleRemoveCommitted(menteeId: string) {
    const dispatchId = menteeIdToDispatchId.get(menteeId);
    if (!dispatchId) return;
    await removeContentDispatch(dispatchId);
    setLocallyRemovedIds((prev) => new Set(prev).add(menteeId));
  }

  function reset() {
    setStep("details");
    setContentType(initialContentType);
    setTitle("");
    setDescription("");
    setInstructions("");
    setWeekId(null);
    setTagIds([]);
    setTemplate(defaultTemplateFor(initialContentType));
    setSubmissionStartsAt("");
    setSubmissionEndsAt("");
    setWorkingItem(null);
    setSelectedMenteeIds([]);
    setDueAt("");
    setLocallyRemovedIds(new Set());
    isInitialized.current = false;
    hasHydrated.current = false;
    hasEditedTemplate.current = false;
  }

  function handleClose() {
    reset();
    onClose();
  }

  const canFinishRoster = mode === "create" ? selectedMenteeIds.length > 0 : true;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        step === "details"
          ? `${mode === "create" ? "New" : "Edit"} ${contentTypeLabel(contentType)}`
          : "Assign to mentees"
      }
      description={
        step === "details"
          ? "Set the details and the submission form mentees will fill out."
          : "Choose which mentees should receive this, and when it's due for new additions."
      }
      className="max-w-2xl"
    >
      {step === "details" ? (
        loadingItem && mode === "edit" ? (
          <p className="p-4 text-sm text-text-muted dark:text-text-muted">Loading…</p>
        ) : (
          <form
            className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto p-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmitDetails) saveDetailsMutation.mutate();
            }}
          >
            <TypeSelector mode={mode} value={contentType} onChange={handleTypeChange} />

            <Field label="Title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
                placeholder="e.g. Week 3 — Character study"
              />
            </Field>

            <Field label="Description" optional>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className={inputClass}
              />
            </Field>

            <Field label="Instructions" optional>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                className={inputClass}
              />
            </Field>

            <Field label="Week" optional>
              <WeekField
                weeks={weeks ?? []}
                weekId={weekId}
                onSelect={setWeekId}
                onCreated={(week) => {
                  queryClient.setQueryData<Week[]>(["weeks"], (prev) => [...(prev ?? []), week]);
                  setWeekId(week.id);
                }}
              />
            </Field>

            <Field label="Tags" optional>
              <TagMultiSelect
                allTags={tags ?? []}
                selectedIds={tagIds}
                onChange={setTagIds}
                onCreateTag={async (name) => {
                  const tag = await createTag(name);
                  await refetchTags();
                  setTagIds((prev) => [...prev, tag.id]);
                }}
              />
            </Field>

            <div className="border-t border-border pt-4 dark:border-border">
              <ContentSubmissionTemplateEditor contentType={contentType} value={template} onChange={handleTemplateChange} />
            </div>

            {/*
              Placed right after the template editor (not before it) since
              its visibility depends on the requirement control living
              inside ContentSubmissionTemplateEditor's metadata section —
              reads as "here's when submissions are open" immediately after
              "here's what the submission asks for." Hidden entirely for
              "No submission" items, matching the DB constraint: a
              disabled item has no window, period.
            */}
            {submissionWindowRequired && (
              <Field label="Submission window">
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={submissionStartsAt}
                    onChange={(e) => setSubmissionStartsAt(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="date"
                    value={submissionEndsAt}
                    onChange={(e) => setSubmissionEndsAt(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <p className="mt-1 text-[11px] text-text-muted dark:text-text-muted">
                  When mentees can submit. Powers the calendar/timeline view and due-date reminders.
                </p>
              </Field>
            )}

            {saveDetailsMutation.isError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive dark:bg-destructive/15">
                Couldn&apos;t save. Try again.
              </p>
            )}

            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-border bg-surface pt-4 dark:border-border dark:bg-surface">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-text-primary dark:border-border dark:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmitDetails || saveDetailsMutation.isPending}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"
              >
                {saveDetailsMutation.isPending ? "Saving…" : "Continue"}
              </button>
            </div>
          </form>
        )
      ) : (
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-muted dark:text-text-muted">
              Due date for newly added mentees
            </span>
            <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={inputClass} />
          </label>

          {mode === "edit" && loadingRoster ? (
            <p className="text-xs text-text-muted dark:text-text-muted">Loading current roster…</p>
          ) : (
            // ASSUMPTION FLAGGED: PeopleGrid / fetchSelectablePeople props below
            // mirror the shape used by the pre-unification assignment form
            // (fieldDefs, viewKey, queryKey, queryFn, groupBy/groupKeyFn,
            // selectable/selectedIds/onSelectionChange, alreadyCommittedIds,
            // onRemoveCommitted, removalWarning*, emptyMessage). Neither
            // component's source was available to verify against — confirm
            // this still matches PeopleGrid.tsx's actual prop types before
            // relying on this in production.
            <PeopleGrid
              fieldDefs={PICKER_FIELD_DEFS}
              viewKey={`content-item-roster-${contentItemId ?? "new"}`}
              queryKey={["selectable-mentees", scopeToMentorId ?? "all"]}
              queryFn={(filterState) =>
                fetchSelectablePeople({ role: "mentee", mentorId: scopeToMentorId }, filterState.search)
              }
              groupBy="pod"
              groupKeyFn={(p) => (p as { podName?: string }).podName ?? "No pod"}
              selectable
              selectedIds={selectedMenteeIds}
              onSelectionChange={setSelectedMenteeIds}
              alreadyCommittedIds={mode === "edit" ? effectiveCommittedIds : undefined}
              onRemoveCommitted={mode === "edit" ? handleRemoveCommitted : undefined}
              removalWarningTitle="Remove from this item?"
              removalWarningDescription={(names) =>
                `This has already been assigned to ${names.join(", ")}. Remove ${
                  names.length > 1 ? "them" : "this mentee"
                }? This can't be undone.`
              }
              emptyMessage="No pods with mentees found."
            />
          )}

          {dispatchMutation.isError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive dark:bg-destructive/15">
              Couldn&apos;t update the mentee list. Try again.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={!canFinishRoster || dispatchMutation.isPending}
              onClick={() => dispatchMutation.mutate()}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"
            >
              {dispatchMutation.isPending
                ? "Saving…"
                : mode === "create"
                ? `Assign to ${selectedMenteeIds.length || ""} mentee${selectedMenteeIds.length === 1 ? "" : "s"}`
                : "Done"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function contentTypeLabel(contentType: ContentType): string {
  if (contentType === "assignment") return "assignment";
  if (contentType === "course") return "course";
  return "resource";
}

const inputClass =
  "w-full rounded-xl border border-border bg-card-alt px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary dark:border-border dark:bg-card-alt dark:text-text-primary dark:placeholder:text-text-muted dark:focus:border-primary";

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex w-full flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted">
        {label} {optional && <span className="lowercase font-normal text-text-muted/70 dark:text-text-muted/70">(optional)</span>}
      </span>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Type selector — create mode only; edit mode shows a fixed label chip
// since content_type is immutable once dispatches/submissions may exist
// against it (see PROJECT_BUILD_CONTEXT.md §3).
// ---------------------------------------------------------------------------

function TypeSelector({
  mode,
  value,
  onChange,
}: {
  mode: "create" | "edit";
  value: ContentType;
  onChange: (next: ContentType) => void;
}) {
  const activeOption = TYPE_OPTIONS.find((o) => o.value === value) ?? TYPE_OPTIONS[0];

  if (mode === "edit") {
    const Icon = activeOption.icon;
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted">Type</span>
        <span className="flex w-fit items-center gap-1.5 rounded-full border border-border bg-card-alt px-3 py-1.5 text-xs font-medium text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary">
          <Icon className="h-3.5 w-3.5" />
          {activeOption.label}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted">Type</span>
      <div className="inline-flex w-fit flex-wrap gap-1 rounded-full border border-border bg-card-alt p-1 dark:border-border dark:bg-card-alt">
        {TYPE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground"
                  : "text-text-muted hover:text-text-primary dark:text-text-muted dark:hover:text-text-primary"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Week field — select an existing week, or create one inline without
// leaving the form. Shared identically across all three content types
// since week_id lives on content_items regardless of content_type.
// ---------------------------------------------------------------------------

function WeekField({
  weeks,
  weekId,
  onSelect,
  onCreated,
}: {
  weeks: Week[];
  weekId: string | null;
  onSelect: (id: string | null) => void;
  onCreated: (week: Week) => void;
}) {
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");

  const createWeekMutation = useMutation({
    mutationFn: () =>
      createWeek(
        { name: name.trim(), start_date: startDate || null, end_date: endDate || null },
        weeks
      ),
    onSuccess: (week) => {
      onCreated(week);
      setCreating(false);
      setName("");
      setStartDate("");
      setEndDate("");
    },
  });

  const canCreate = name.trim().length > 0;

  if (!creating) {
    return (
      <div className="flex items-center gap-2">
        <select value={weekId ?? ""} onChange={(e) => onSelect(e.target.value || null)} className={inputClass}>
          <option value="">No week</option>
          {weeks.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-2 text-xs font-medium text-text-muted transition-colors hover:text-text-primary dark:border-border dark:text-text-muted dark:hover:text-text-primary"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      </div>
    );
  }

  return (
    <div className="surface-card-alt flex flex-col gap-2 dark:surface-card-alt">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-primary dark:text-text-primary">New week</span>
        <button
          type="button"
          onClick={() => setCreating(false)}
          aria-label="Cancel new week"
          className="rounded p-1 text-text-muted hover:bg-card hover:text-text-primary dark:text-text-muted dark:hover:bg-card dark:hover:text-text-primary"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Week 4"
        className="rounded border border-border bg-card px-2 py-1.5 text-xs text-text-primary dark:border-border dark:bg-card dark:text-text-primary"
      />
      <div className="flex gap-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="flex-1 rounded border border-border bg-card px-2 py-1.5 text-xs text-text-primary dark:border-border dark:bg-card dark:text-text-primary"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="flex-1 rounded border border-border bg-card px-2 py-1.5 text-xs text-text-primary dark:border-border dark:bg-card dark:text-text-primary"
        />
      </div>
      {createWeekMutation.isError && (
        <p className="text-[11px] text-destructive dark:text-destructive">Couldn&apos;t create week. Try again.</p>
      )}
      <button
        type="button"
        disabled={!canCreate || createWeekMutation.isPending}
        onClick={() => createWeekMutation.mutate()}
        className="w-fit rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"
      >
        {createWeekMutation.isPending ? "Creating…" : "Create & select"}
      </button>
    </div>
  );
}

function TagMultiSelect({
  allTags,
  selectedIds,
  onChange,
  onCreateTag,
}: {
  allTags: { id: string; name: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreateTag: (name: string) => Promise<void>;
}) {
  const [creating, setCreating] = React.useState(false);
  const [newTagName, setNewTagName] = React.useState("");

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id]);
  }

  async function handleCreate() {
    const name = newTagName.trim();
    if (!name) return;
    await onCreateTag(name);
    setNewTagName("");
    setCreating(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {allTags.map((tag) => (
        <button
          key={tag.id}
          type="button"
          onClick={() => toggle(tag.id)}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            selectedIds.includes(tag.id)
              ? "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground"
              : "border border-border text-text-muted hover:text-text-primary dark:border-border dark:text-text-muted dark:hover:text-text-primary"
          }`}
        >
          {tag.name}
        </button>
      ))}

      {creating ? (
        <span className="flex items-center gap-1">
          <input
            autoFocus
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
            placeholder="New tag"
            className="w-24 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-text-primary dark:border-border dark:bg-card dark:text-text-primary"
          />
          <button type="button" onClick={handleCreate} className="text-text-accent dark:text-text-accent">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => setCreating(false)} className="text-text-muted dark:text-text-muted">
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-text-muted hover:text-text-primary dark:border-border dark:text-text-muted dark:hover:text-text-primary"
        >
          <Plus className="h-3 w-3" />
          New tag
        </button>
      )}
    </div>
  );
}