// /components/messages/AddParticipantModal.tsx
"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { PeopleGrid } from "@/components/shared/PeopleGrid";
import { fetchPodMemberGroups } from "@/lib/api/pods";
import { fetchSelectablePeople, type SelectablePerson } from "@/lib/api/people-picker";
import { addParticipant } from "@/lib/api/messages";
import { useRole } from "@/providers/role-provider";
import { useSessionStore } from "@/store/session-store";
import type { ConversationKind } from "@/types/messages";
import type { FilterFieldDef } from "@/lib/filtering/types";
import type { UserRole } from "@/types/users";

interface AddParticipantModalProps {
  conversationId: string;
  kind: ConversationKind;
  podId: string | null;
  existingParticipantIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
}

const EMPTY_FIELD_DEFS: FilterFieldDef[] = [
  { key: "search", kind: "text", columns: ["full_name"], searchable: true },
];

const STAFF_SELECTABLE_ROLES: UserRole[] = ["mentor", "mentee", "associate", "pm"];

export function AddParticipantModal({
  conversationId,
  kind,
  podId,
  existingParticipantIds,
  isOpen,
  onClose,
  onAdded,
}: AddParticipantModalProps) {
  const { role } = useRole();
  const currentUser = useSessionStore((state) => state.userId);
  const isStaff = role === "pm" || role === "associate";
  const isMentor = role === "mentor";

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingSet = useMemo(() => new Set(existingParticipantIds), [existingParticipantIds]);

  async function handleAdd() {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await Promise.all(selectedIds.map((userId) => addParticipant(conversationId, userId, true)));
      onAdded();
      setSelectedIds([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add participants.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={isOpen} onClose={onClose} title="Add people">
      <div className="flex flex-col gap-4 max-h-[70vh]">
        <div className="flex-1 overflow-y-auto">
          {isMentor && kind === "pod" && podId ? (
            <PeopleGrid
              fieldDefs={EMPTY_FIELD_DEFS}
              viewKey="add-participant-mentor"
              queryKey={["add-participant-picker", "mentor", podId]}
              queryFn={async () => {
                const groups = await fetchPodMemberGroups({ role: "mentee", mentorId: currentUser as string });
                const pod = groups.find((p) => p.id === podId);
                if (!pod) return [];
                return pod.members
                  .filter((m) => !existingSet.has(m.id))
                  .map((m) => ({
                    id: m.id,
                    fullName: m.full_name,
                    role: "mentee" as const,
                    approvalStatus: "approved" as const,
                    podName: pod.name,
                    podId: pod.id,
                  }));
              }}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              defaultView="list"
              emptyMessage="Everyone in this team is already here."
            />
          ) : (
            <PeopleGrid
              fieldDefs={EMPTY_FIELD_DEFS}
              viewKey="add-participant-staff"
              queryKey={["add-participant-picker", "staff", conversationId]}
              queryFn={async () => {
                const results = await Promise.all(STAFF_SELECTABLE_ROLES.map((r) => fetchSelectablePeople({ role: r })));
                return results.flat().filter((p: SelectablePerson) => !existingSet.has(p.id));
              }}
              groupBy="pod"
              groupKeyFn={(p) => (p as SelectablePerson).podName}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              defaultView="list"
              emptyMessage="No one left to add."
            />
          )}
        </div>

        {error && <p className="text-sm text-destructive dark:text-destructive">{error}</p>}

        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={submitting || selectedIds.length === 0}
          className="rounded-lg px-4 py-2 text-sm font-medium bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Adding…" : `Add ${selectedIds.length || ""}`.trim()}
        </button>
      </div>
    </Modal>
  );
}