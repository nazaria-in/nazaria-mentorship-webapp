// components/resources/ResourceFormModal.tsx

"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/shared/Modal";
import { PeopleGrid } from "@/components/shared/PeopleGrid";
import { fetchSelectablePeople } from "@/lib/api/people-picker";
import { ResourceTemplateForm, type ResourceDraft } from "@/components/resources/ResourceTemplateForm";
import { createResources, fetchResource, insertFileRecords, linkFilesToResource, updateResource } from "@/lib/api/resources";
import type { FilterFieldDef } from "@/lib/filtering/types";

const PICKER_FIELD_DEFS: FilterFieldDef[] = [
  { key: "search", kind: "text", columns: ["full_name"], searchable: true },
];

interface ResourceFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  resourceId?: string;
  currentUserId: string;
  creatorRole: "mentee" | "mentor" | "staff";
  scopeToMentorId?: string;
  onSaved: () => void;
}
type Step = "details" | "roster";

export function ResourceFormModal({ open, onClose, mode, resourceId, currentUserId, creatorRole, scopeToMentorId, onSaved }: ResourceFormModalProps) {
  const [step, setStep] = React.useState<Step>("details");
  const [draft, setDraft] = React.useState<ResourceDraft | null>(null);
  const [selectedMenteeIds, setSelectedMenteeIds] = React.useState<string[]>([]);
  const queryClient = useQueryClient();

  const needsRoster = mode === "create" && creatorRole !== "mentee";

  const { data: existingResource, isLoading: loadingResource } = useQuery({
    queryKey: ["resource", resourceId],
    queryFn: async () => {
      if (!resourceId) throw new Error("Missing resource ID");
      return fetchResource(resourceId);
    },
    enabled: open && mode === "edit" && !!resourceId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error("Missing form data");

      if (mode === "create") {
        const assignees = creatorRole === "mentee" ? [currentUserId] : selectedMenteeIds;
        const created = await createResources(
          { type: draft.type, title: draft.title, description: draft.description, links: draft.links, weekNumber: draft.weekNumber, createdBy: currentUserId },
          assignees
        );
        const fileIds = await insertFileRecords(
          draft.newFiles.map((f) => ({ title: f.name, url: f.url, fileType: f.fileType })),
          currentUserId
        );
        if (fileIds.length > 0) {
          await Promise.all(created.map((r) => linkFilesToResource(r.id, fileIds)));
        }
      } else if (resourceId) {
        await updateResource(resourceId, {
          type: draft.type,
          title: draft.title,
          description: draft.description,
          links: draft.links,
          weekNumber: draft.weekNumber,
        });
        const fileIds = await insertFileRecords(
          draft.newFiles.map((f) => ({ title: f.name, url: f.url, fileType: f.fileType })),
          currentUserId
        );
        if (fileIds.length > 0) {
          await linkFilesToResource(resourceId, fileIds);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources", "list"] });
      reset();
      onClose();
      onSaved();
    },
  });

  function reset() {
    setStep("details");
    setDraft(null);
    setSelectedMenteeIds([]);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleDetailsSaved(nextDraft: ResourceDraft) {
    setDraft(nextDraft);
    if (needsRoster) {
      setStep("roster");
    } else {
      saveMutation.mutate();
    }
  }

  const canFinishRoster = selectedMenteeIds.length > 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step === "details" ? (mode === "create" ? "Add resource" : "Edit resource") : "Assign to mentees"}
      description={
        step === "details"
          ? mode === "create"
            ? "Set up the resource details."
            : "Update this resource's details."
          : "Choose which mentees should get a copy of this resource — each mentee gets their own independent row to track progress against."
      }
      className="max-w-xl"
    >
      {step === "details" ? (
        loadingResource && mode === "edit" ? (
          <p className="p-4 text-sm text-text-primary/50">Loading resource…</p>
        ) : (
          <ResourceTemplateForm
            menteeId={currentUserId}
            resourceId={resourceId}
            mode={mode}
            initialValues={mode === "edit" ? existingResource ?? undefined : undefined}
            onSaved={handleDetailsSaved}
            onCancel={handleClose}
            submitLabel={needsRoster ? "Next: choose mentees" : mode === "create" ? "Create resource" : "Save changes"}
          />
        )
      ) : (
        <div className="flex flex-col gap-5">
          <PeopleGrid
            fieldDefs={PICKER_FIELD_DEFS}
            viewKey={`resource-roster-${resourceId ?? "new"}`}
            queryKey={["selectable-mentees", scopeToMentorId ?? "all"]}
            queryFn={(filterState) =>
              fetchSelectablePeople({ role: "mentee", mentorId: scopeToMentorId }, filterState.search)
            }
            groupBy="pod"
            groupKeyFn={(p) => (p as { podName?: string }).podName ?? "No pod"}
            selectable
            selectedIds={selectedMenteeIds}
            onSelectionChange={setSelectedMenteeIds}
            emptyMessage="No pods with mentees found."
          />

          {saveMutation.isError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive dark:bg-destructive/15">
              Couldn&apos;t create the resource. Try again.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={!canFinishRoster || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving…" : `Assign to ${selectedMenteeIds.length || ""} mentee${selectedMenteeIds.length === 1 ? "" : "s"}`}
            </button>
            <button type="button" onClick={() => setStep("details")} className="rounded-full px-4 py-2 text-sm font-medium text-text-primary/60 hover:bg-surface-muted dark:hover:bg-white/5">
              Back
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}