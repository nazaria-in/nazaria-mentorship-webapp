// /components/messages/ConversationHeader.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Megaphone, Users, User, MoreVertical, LogOut } from "lucide-react";
import { leaveConversation } from "@/lib/api/messages";
import { WarningModal } from "@/components/shared/WarningModal";
import type { ConversationKind } from "@/types/messages";
import { cn } from "@/lib/utils";

interface ConversationHeaderProps {
  conversationId: string;
  name: string;
  kind: ConversationKind;
  /** Precomputed seen-by label — see resolveSeenByLabel() usage in MessageList/thread page. */
  seenByLabel?: string;
  /** Hides the "leave" option entirely — e.g. staff viewing via oversight without having entered. */
  canLeave?: boolean;
}

function KindIcon({ kind }: { kind: ConversationKind }) {
  const className = "h-4 w-4 text-text-muted dark:text-text-muted";
  if (kind === "broadcast") return <Megaphone className={className} />;
  if (kind === "pod") return <Users className={className} />;
  return <User className={className} />;
}

export function ConversationHeader({
  conversationId,
  name,
  kind,
  seenByLabel,
  canLeave = true,
}: ConversationHeaderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  async function handleConfirmLeave() {
    setLeaving(true);
    setLeaveError(null);
    try {
      await leaveConversation(conversationId);
      queryClient.invalidateQueries({ queryKey: ["conversations", "summary"] });
      queryClient.invalidateQueries({ queryKey: ["conversations", "oversight"] });
      setConfirmLeaveOpen(false);
      router.push("/chat");
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : "Couldn't leave this conversation. Try again.");
    } finally {
      setLeaving(false);
    }
  }

  // Broadcast channels are managed by staff, not opted out of per-member.
  const showLeaveOption = canLeave && kind !== "broadcast";

  return (
    <div className="flex items-center gap-3 border-b border-border dark:border-border bg-surface dark:bg-surface px-3 py-3">
      <button
        type="button"
        onClick={() => router.push("/chat")}
        className="md:hidden rounded-full p-1 hover:bg-card-alt dark:hover:bg-card-alt"
        aria-label="Back to conversations"
      >
        <ArrowLeft className="h-5 w-5 text-text-primary dark:text-text-primary" />
      </button>

      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-card dark:bg-card border border-border dark:border-border">
        <KindIcon kind={kind} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-base text-text-primary dark:text-text-primary">{name}</p>
        {seenByLabel && (
          <p className="truncate text-xs text-text-muted dark:text-text-muted">{seenByLabel}</p>
        )}
      </div>

      {showLeaveOption && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-full p-1.5 hover:bg-card-alt dark:hover:bg-card-alt"
            aria-label="Conversation options"
          >
            <MoreVertical className="h-4 w-4 text-text-muted dark:text-text-muted" />
          </button>

          {menuOpen && (
            <>
              {/* Click-away catcher */}
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-border dark:border-border bg-card dark:bg-card shadow-sm py-1 min-w-[170px]">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmLeaveOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive dark:text-destructive hover:bg-card-alt dark:hover:bg-card-alt"
                >
                  <LogOut className="h-4 w-4" /> Leave conversation
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <WarningModal
        open={confirmLeaveOpen}
        onClose={() => {
          if (!leaving) {
            setConfirmLeaveOpen(false);
            setLeaveError(null);
          }
        }}
        onConfirm={handleConfirmLeave}
        variant="danger"
        title="Leave this conversation?"
        description={`You'll stop receiving messages from "${name}" and won't be able to send new ones unless you're added back.`}
        confirmLabel="Leave"
        isLoading={leaving}
        errorMessage={leaveError}
      />
    </div>
  );
}