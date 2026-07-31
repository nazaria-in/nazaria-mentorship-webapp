// /components/messages/NewConversationModal.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/shared/Modal";
import { PeopleGrid } from "@/components/shared/PeopleGrid";
import { fetchPodMemberGroups } from "@/lib/api/pods";
import { fetchSelectablePeople, type SelectablePerson } from "@/lib/api/people-picker";
import { createConversation } from "@/lib/api/messages";
import { useRole } from "@/providers/role-provider";
import { useSessionStore } from "@/store/session-store";
import type { FilterFieldDef } from "@/lib/filtering/types";
import type { UserRole } from "@/types/users";
import { cn } from "@/lib/utils";

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_FIELD_DEFS: FilterFieldDef[] = [
  { key: "search", kind: "text", columns: ["full_name"], searchable: true },
];

// Staff can message across every role — fetchSelectablePeople takes exactly one role per
// call (mirrors fetchPodMemberGroups), so this drives one call per role and merges results.
const STAFF_SELECTABLE_ROLES: UserRole[] = ["mentor", "mentee", "associate", "pm"];

export function NewConversationModal({ isOpen, onClose }: NewConversationModalProps) {
  const router = useRouter();
  const { role } = useRole();
  const currentUser = useSessionStore((state) => state.userId);
  const isStaff = role === "pm" || role === "associate";
  const isMentor = role === "mentor";

  const [selectedPodId, setSelectedPodId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [readOnlyIds, setReadOnlyIds] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For mentors: one call gets every pod they're in, each with its already-scoped, already-approved
  // mentee list. Nothing further to fetch once a pod is picked — just filter this in memory.
  const { data: mentorPodGroups, isLoading: podsLoading } = useQuery({
    queryKey: ["mentor-pod-groups", currentUser],
    queryFn: () => fetchPodMemberGroups({ role: "mentee", mentorId: currentUser as string }),
    enabled: isMentor && !!currentUser,
  });

  const mentorMentees: SelectablePerson[] = useMemo(() => {
    if (!selectedPodId || !mentorPodGroups) return [];
    const pod = mentorPodGroups.find((p) => p.id === selectedPodId);
    if (!pod) return [];
    return pod.members.map((m) => ({
      id: m.id,
      fullName: m.full_name,
      role: "mentee" as const,
      approvalStatus: "approved" as const,
      podName: pod.name,
      podId: pod.id,
    }));
  }, [selectedPodId, mentorPodGroups]);

  // Mentor must resolve a single pod before the picker unlocks — this is the
  // enforcement point for "no mixing mentees from two different pods."
  const podLocked = isMentor && !selectedPodId;

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    if (isMentor) {
      mentorMentees.forEach((p) => map.set(p.id, p.fullName));
    }
    // Staff-side names get filled in by handleStaffPeopleLoaded below.
    return map;
  }, [isMentor, mentorMentees]);

  const [staffNameById, setStaffNameById] = useState<Map<string, string>>(new Map());

  function resetAndClose() {
    setSelectedPodId(null);
    setSelectedIds([]);
    setReadOnlyIds(new Set());
    setName("");
    setError(null);
    setStaffNameById(new Map());
    onClose();
  }

  function toggleReadOnly(id: string) {
    setReadOnlyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (selectedIds.length === 0 || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const conversation = await createConversation({
        name: name.trim(),
        kind: isMentor ? "pod" : "direct",
        podId: isMentor ? selectedPodId ?? undefined : undefined,
        participants: selectedIds.map((userId) => ({
          userId,
          canMessage: !readOnlyIds.has(userId),
        })),
      });
      resetAndClose();
      router.push(`/chat/${conversation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create conversation.");
    } finally {
      setSubmitting(false);
    }
  }

  function displayNameFor(id: string): string {
    return nameById.get(id) ?? staffNameById.get(id) ?? "Unnamed";
  }

  return (
    <Modal open={isOpen} onClose={resetAndClose} title="New conversation">
      <div className="flex flex-col gap-4 max-h-[70vh]">
        <div>
          <label className="text-sm font-medium text-text-primary dark:text-text-primary">
            Conversation name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pod 3 check-in"
            className="mt-1 w-full rounded-lg border border-border dark:border-border bg-card dark:bg-card px-3 py-2 text-sm text-text-primary dark:text-text-primary outline-none focus:border-border-strong"
          />
        </div>

        {isMentor && (
          <div>
            <label className="text-sm font-medium text-text-primary dark:text-text-primary">Pod</label>
            <p className="text-xs text-text-muted dark:text-text-muted mb-1">
              You can only message mentees from one pod per conversation.
            </p>
            <select
              value={selectedPodId ?? ""}
              onChange={(e) => {
                setSelectedPodId(e.target.value || null);
                setSelectedIds([]);
              }}
              disabled={podsLoading}
              className="w-full rounded-lg border border-border dark:border-border bg-card dark:bg-card px-3 py-2 text-sm text-text-primary dark:text-text-primary"
            >
              <option value="">{podsLoading ? "Loading pods…" : "Select a pod…"}</option>
              {(mentorPodGroups ?? []).map((pod) => (
                <option key={pod.id} value={pod.id}>
                  {pod.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={cn("flex-1 overflow-y-auto", podLocked && "opacity-40 pointer-events-none")}>
          {isMentor ? (
            <PeopleGrid
              fieldDefs={EMPTY_FIELD_DEFS}
              viewKey="new-conversation-picker-mentor"
              queryKey={["new-conversation-picker", "mentor", selectedPodId]}
              queryFn={async () => mentorMentees}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              defaultView="list"
              emptyMessage="No mentees in this pod."
            />
          ) : (
            <PeopleGrid
              fieldDefs={EMPTY_FIELD_DEFS}
              viewKey="new-conversation-picker-staff"
              queryKey={["new-conversation-picker", "staff"]}
              queryFn={async () => {
                const results = await Promise.all(
                  STAFF_SELECTABLE_ROLES.map((r) => fetchSelectablePeople({ role: r }))
                );
                const flattened = results.flat();
                setStaffNameById(new Map(flattened.map((p) => [p.id, p.fullName])));
                return flattened;
              }}
              groupBy="pod"
              groupKeyFn={(p) => (p as SelectablePerson).podName}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              defaultView="list"
              emptyMessage="No one found."
            />
          )}
        </div>

        {selectedIds.length > 0 && (
          <div className="border-t border-border dark:border-border pt-3">
            <p className="text-xs font-medium text-text-muted dark:text-text-muted mb-2">
              Permissions — uncheck to make read-only
            </p>
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
              {selectedIds.map((id) => (
                <label key={id} className="flex items-center gap-2 text-sm text-text-primary dark:text-text-primary">
                  <input
                    type="checkbox"
                    checked={!readOnlyIds.has(id)}
                    onChange={() => toggleReadOnly(id)}
                    className="h-3.5 w-3.5 accent-[var(--color-nazaria-burgundy)]"
                  />
                  Can send messages — {displayNameFor(id)}
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive dark:text-destructive">{error}</p>}

        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={submitting || selectedIds.length === 0 || !name.trim()}
          className="rounded-lg px-4 py-2 text-sm font-medium bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating…" : "Create conversation"}
        </button>
      </div>
    </Modal>
  );
}