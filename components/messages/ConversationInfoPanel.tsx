// /components/messages/ConversationInfoPanel.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { X, UserPlus, LogOut, Megaphone, Users, UsersRound, User } from "lucide-react";
import { ParticipantRow } from "./ParticipantRow";
import { AddParticipantModal } from "./AddParticipantModal";
import { WarningModal } from "@/components/shared/WarningModal";
import { leaveConversation, removeParticipant } from "@/lib/api/messages";
import { useRole } from "@/providers/role-provider";
import { useSessionStore } from "@/store/session-store";
import type { ConversationKind } from "@/types/messages";
import { cn } from "@/lib/utils";

type Role = "mentee" | "mentor" | "associate" | "pm";

interface ParticipantWithProfile {
  user_id: string;
  full_name: string | null;
  role: Role | null;
  pod_id?: string | null;
}

interface ConversationInfoPanelProps {
  conversationId: string;
  name: string;
  description: string | null;
  kind: ConversationKind;
  podId: string | null;
  participants: ParticipantWithProfile[];
  canLeave: boolean;
  onClose: () => void;
}

function KindIcon({ kind }: { kind: ConversationKind }) {
  const className = "h-5 w-5 text-text-muted dark:text-text-muted";
  if (kind === "broadcast") return <Megaphone className={className} />;
  if (kind === "team") return <Users className={className} />;
  if (kind === "group") return <UsersRound className={className} />;
  return <User className={className} />;
}

export function ConversationInfoPanel({
  conversationId,
  name,
  description,
  kind,
  podId,
  participants,
  canLeave,
  onClose,
}: ConversationInfoPanelProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { role } = useRole();
  const currentUserId = useSessionStore((state) => state.userId);

  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ParticipantWithProfile | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isStaff = role === "pm" || role === "associate";
  const isMentor = role === "mentor";
  const showLeaveOption = canLeave && kind !== "broadcast";

  // Staff can add/remove anyone. Mentors can add/remove mentee/mentor within
  // their own team conversations only. Mentees never see these controls.
  const canManageParticipants = isStaff || (isMentor && kind === "team");

  function canRemoveThisParticipant(participant: ParticipantWithProfile): boolean {
    if (participant.user_id === currentUserId) return false;
    if (isStaff) return true;
    if (isMentor && kind === "team" && podId) {
      return participant.role === "mentee" || participant.role === "mentor";
    }
    return false;
  }

  function invalidateAfterChange() {
    queryClient.invalidateQueries({ queryKey: ["conversation-participants", conversationId] });
    queryClient.invalidateQueries({ queryKey: ["conversations", "summary"] });
    queryClient.invalidateQueries({ queryKey: ["conversations", "oversight"] });
  }

  async function handleConfirmLeave() {
    setLeaving(true);
    setActionError(null);
    try {
      await leaveConversation(conversationId);
      invalidateAfterChange();
      setConfirmLeaveOpen(false);
      onClose();
      router.push("/chat");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't leave this conversation. Try again.");
    } finally {
      setLeaving(false);
    }
  }

  async function handleConfirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    setActionError(null);
    try {
      await removeParticipant(conversationId, removeTarget.user_id);
      invalidateAfterChange();
      setRemoveTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't remove this member. Try again.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-card dark:bg-card border-l border-border-strong dark:border-border-strong shadow-lg">
      <div className="flex items-center gap-2 border-b border-border-strong dark:border-border-strong px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 hover:bg-card-alt dark:hover:bg-card-alt"
          aria-label="Close details"
        >
          <X className="h-5 w-5 text-text-primary dark:text-text-primary" />
        </button>
        <p className="font-heading text-base text-text-primary dark:text-text-primary">Conversation details</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center gap-2 px-4 py-6 border-b border-border dark:border-border">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface dark:bg-surface border border-border-strong dark:border-border-strong">
            <KindIcon kind={kind} />
          </div>
          <p className="text-base font-heading text-text-primary dark:text-text-primary text-center">{name}</p>
          {description && (
            <p className="text-sm text-text-muted dark:text-text-muted text-center max-w-xs">{description}</p>
          )}
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted">
              {participants.length} {participants.length === 1 ? "participant" : "participants"}
            </p>
            {canManageParticipants && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1 text-xs font-medium text-primary dark:text-primary"
              >
                <UserPlus className="h-3.5 w-3.5" /> Add
              </button>
            )}
          </div>

          <div className="space-y-0.5">
            {participants.map((participant) => (
              <ParticipantRow
                key={participant.user_id}
                fullName={participant.full_name}
                role={participant.role}
                canRemove={canManageParticipants && canRemoveThisParticipant(participant)}
                onRemove={() => setRemoveTarget(participant)}
              />
            ))}
          </div>
        </div>
      </div>

      {showLeaveOption && (
        <div className="border-t border-border-strong dark:border-border-strong p-3">
          <button
            type="button"
            onClick={() => setConfirmLeaveOpen(true)}
            className={cn(
              "w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium",
              "text-destructive dark:text-destructive border border-destructive/30 dark:border-destructive/30",
              "hover:bg-destructive/5 dark:hover:bg-destructive/5"
            )}
          >
            <LogOut className="h-4 w-4" /> Leave conversation
          </button>
        </div>
      )}

      {actionError && (
        <p className="px-4 pb-3 text-sm text-destructive dark:text-destructive">{actionError}</p>
      )}

      {showAddModal && (
        <AddParticipantModal
          conversationId={conversationId}
          kind={kind}
          podId={podId}
          existingParticipantIds={participants.map((p) => p.user_id)}
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAdded={invalidateAfterChange}
        />
      )}

      <WarningModal
        open={confirmLeaveOpen}
        onClose={() => {
          if (!leaving) {
            setConfirmLeaveOpen(false);
            setActionError(null);
          }
        }}
        onConfirm={handleConfirmLeave}
        variant="danger"
        title="Leave this conversation?"
        description={`You'll stop receiving messages from "${name}" and won't be able to send new ones unless you're added back.`}
        confirmLabel="Leave"
        isLoading={leaving}
        errorMessage={actionError}
      />

      <WarningModal
        open={Boolean(removeTarget)}
        onClose={() => {
          if (!removing) {
            setRemoveTarget(null);
            setActionError(null);
          }
        }}
        onConfirm={handleConfirmRemove}
        variant="danger"
        title={`Remove ${removeTarget?.full_name ?? "this member"}?`}
        description="They'll stop seeing new messages in this conversation immediately."
        confirmLabel="Remove"
        isLoading={removing}
        errorMessage={actionError}
      />
    </div>
  );
}