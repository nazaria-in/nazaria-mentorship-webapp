// /components/messages/NewConversationModal.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/shared/Modal";
import { PeopleGrid } from "@/components/shared/PeopleGrid";
import { fetchPodMemberGroups } from "@/lib/api/pods";
import { fetchSelectablePeople, type SelectablePerson } from "@/lib/api/people-picker";
import { fetchCohorts } from "@/lib/api/cohorts-browser";
import { createConversation } from "@/lib/api/messages";
import { useRole } from "@/providers/role-provider";
import { useSessionStore } from "@/store/session-store";
import type { FilterFieldDef } from "@/lib/filtering/types";
import type { UserRole } from "@/types/users";
import type { ConversationKind } from "@/types/messages";
import { cn } from "@/lib/utils";

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_FIELD_DEFS: FilterFieldDef[] = [
  { key: "search", kind: "text", columns: ["full_name"], searchable: true },
];

const STAFF_SELECTABLE_ROLES: UserRole[] = ["mentor", "mentee", "associate", "pm"];

export function NewConversationModal({ isOpen, onClose }: NewConversationModalProps) {
  const router = useRouter();
  const { role } = useRole();
  const currentUser = useSessionStore((state) => state.userId);
  const isStaff = role === "pm" || role === "associate";
  const isMentor = role === "mentor";

  // Mentor can only ever create 'pod' conversations. Staff choose freely.
  const [kind, setKind] = useState<ConversationKind>(isMentor ? "team" : "group");
  const [selectedPodId, setSelectedPodId] = useState<string | null>(null);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [audience, setAudience] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [readOnlyIds, setReadOnlyIds] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staffNameById, setStaffNameById] = useState<Map<string, string>>(new Map());

  const { data: mentorPodGroups, isLoading: podsLoading } = useQuery({
    queryKey: ["mentor-pod-groups", currentUser],
    queryFn: () => fetchPodMemberGroups({ role: "mentee", mentorId: currentUser as string }),
    enabled: isMentor && !!currentUser,
  });

  const { data: cohorts, isLoading: cohortsLoading } = useQuery({
    queryKey: ["cohorts", "for-broadcast"],
    queryFn: () => fetchCohorts(),
    enabled: isStaff && kind === "broadcast",
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

  const podLocked = isMentor && kind === "team" && !selectedPodId;
  const isBroadcast = kind === "broadcast";

  function displayNameFor(id: string): string {
    if (isMentor) {
      return mentorMentees.find((p) => p.id === id)?.fullName ?? "Unnamed";
    }
    return staffNameById.get(id) ?? "Unnamed";
  }

  function resetAndClose() {
    setKind(isMentor ? "team" : "group");
    setSelectedPodId(null);
    setSelectedCohortId(null);
    setAudience("");
    setSelectedIds([]);
    setReadOnlyIds(new Set());
    setName("");
    setDescription("");
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
    if (isBroadcast) {
      if (!name.trim() || !selectedCohortId || !audience) return;
    } else if (selectedIds.length === 0 || !name.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const conversation = await createConversation({
        name: name.trim(),
        description: description.trim() || undefined,
        kind,
        podId: kind === "team" ? selectedPodId ?? undefined : undefined,
        cohortId: isBroadcast ? selectedCohortId ?? undefined : undefined,
        audience: isBroadcast ? audience : undefined,
        participants: isBroadcast
          ? [] // broadcast recipients are provisioned separately (cohort/audience-driven), not picked here
          : selectedIds.map((userId) => ({ userId, canMessage: !readOnlyIds.has(userId) })),
      });
      resetAndClose();
      router.push(`/chat/${conversation.id}`);
    } catch (err) {
      console.error("[NewConversationModal] create failed:", err);
      const message =
        err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "Couldn't create conversation.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const kindOptions: { value: ConversationKind; label: string }[] = isMentor
    ? [{ value: "team", label: "Team" }]
    : [
        { value: "group", label: "Group" },
        { value: "direct", label: "Direct message" },
        { value: "team", label: "Team" },
        { value: "broadcast", label: "Broadcast" },
      ];

  return (
    <Modal open={isOpen} onClose={resetAndClose} title="New conversation">
      <div className="flex flex-col gap-4 max-h-[70vh]">
        {kindOptions.length > 1 && (
          <div>
            <label className="text-sm font-medium text-text-primary dark:text-text-primary">Type</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {kindOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setKind(opt.value);
                    setSelectedIds([]);
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                    kind === opt.value
                      ? "bg-primary text-primary-foreground border-primary dark:bg-primary dark:text-primary-foreground"
                      : "bg-surface text-text-muted dark:bg-surface dark:text-text-muted border-border-strong dark:border-border-strong"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {kind !== "direct" && (
          <div>
            <label className="text-sm font-medium text-text-primary dark:text-text-primary">Conversation name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pod 3 check-in"
              className="mt-1 w-full rounded-lg border border-border-strong dark:border-border-strong bg-surface dark:bg-surface px-3 py-2 text-sm text-text-primary dark:text-text-primary outline-none focus:border-primary"
            />
          </div>
        )}

        {(kind === "team" || kind === "group") && (
          <div>
            <label className="text-sm font-medium text-text-primary dark:text-text-primary">
              Description <span className="text-text-muted dark:text-text-muted font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this conversation for?"
              rows={2}
              className="mt-1 w-full resize-none rounded-lg border border-border-strong dark:border-border-strong bg-surface dark:bg-surface px-3 py-2 text-sm text-text-primary dark:text-text-primary outline-none focus:border-primary"
            />
          </div>
        )}

        {isMentor && kind === "team" && (
          <div>
            <label className="text-sm font-medium text-text-primary dark:text-text-primary">Team</label>
            <p className="text-xs text-text-muted dark:text-text-muted mb-1">
              You can only message mentees from one team per conversation.
            </p>
            <select
              value={selectedPodId ?? ""}
              onChange={(e) => {
                setSelectedPodId(e.target.value || null);
                setSelectedIds([]);
              }}
              disabled={podsLoading}
              className="w-full rounded-lg border border-border-strong dark:border-border-strong bg-surface dark:bg-surface px-3 py-2 text-sm text-text-primary dark:text-text-primary"
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

        {isBroadcast && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-text-primary dark:text-text-primary">Cohort</label>
              <select
                value={selectedCohortId ?? ""}
                onChange={(e) => setSelectedCohortId(e.target.value || null)}
                disabled={cohortsLoading}
                className="mt-1 w-full rounded-lg border border-border-strong dark:border-border-strong bg-surface dark:bg-surface px-3 py-2 text-sm text-text-primary dark:text-text-primary"
              >
                <option value="">{cohortsLoading ? "Loading…" : "Select…"}</option>
                {(cohorts ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary dark:text-text-primary">Audience</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border-strong dark:border-border-strong bg-surface dark:bg-surface px-3 py-2 text-sm text-text-primary dark:text-text-primary"
              >
                <option value="">Select…</option>
                <option value="mentees">Mentees</option>
                <option value="mentors">Mentors</option>
                <option value="all">Everyone</option>
              </select>
            </div>
          </div>
        )}

        {!isBroadcast && (
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
                emptyMessage="No mentees in this Team."
              />
            ) : (
              <PeopleGrid
                fieldDefs={EMPTY_FIELD_DEFS}
                viewKey="new-conversation-picker-staff"
                queryKey={["new-conversation-picker", "staff"]}
                queryFn={async () => {
                  const results = await Promise.all(STAFF_SELECTABLE_ROLES.map((r) => fetchSelectablePeople({ role: r })));
                  const flattened = results.flat();
                  setStaffNameById(new Map(flattened.map((p) => [p.id, p.fullName ?? "Unnamed"] as const)));
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
        )}

        {!isBroadcast && selectedIds.length > 0 && (
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
                    className="h-3.5 w-3.5 accent-primary"
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
          disabled={submitting || (isBroadcast ? !name.trim() || !selectedCohortId || !audience : selectedIds.length === 0 || !name.trim())}
          className="rounded-lg px-4 py-2 text-sm font-medium bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating…" : "Create conversation"}
        </button>
      </div>
    </Modal>
  );
}