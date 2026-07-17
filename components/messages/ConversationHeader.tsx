// /components/messages/ConversationHeader.tsx
"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Megaphone, Users, User } from "lucide-react";
import type { ConversationKind } from "@/types/messages";

interface ConversationHeaderProps {
  name: string;
  kind: ConversationKind;
  /** Precomputed seen-by label — see resolveSeenByLabel() usage in MessageList/thread page. */
  seenByLabel?: string;
}

function KindIcon({ kind }: { kind: ConversationKind }) {
  const className = "h-4 w-4 text-text-muted dark:text-text-muted";
  if (kind === "broadcast") return <Megaphone className={className} />;
  if (kind === "pod") return <Users className={className} />;
  return <User className={className} />;
}

export function ConversationHeader({ name, kind, seenByLabel }: ConversationHeaderProps) {
  const router = useRouter();

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

      <div className="min-w-0">
        <p className="truncate font-heading text-base text-text-primary dark:text-text-primary">{name}</p>
        {seenByLabel && (
          <p className="truncate text-xs text-text-muted dark:text-text-muted">{seenByLabel}</p>
        )}
      </div>
    </div>
  );
}