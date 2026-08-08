// /components/messages/ConversationHeader.tsx
"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Megaphone, Users, UsersRound, User, MoreVertical, Search } from "lucide-react";
import type { ConversationKind } from "@/types/messages";
import { cn } from "@/lib/utils";

interface ConversationHeaderProps {
  name: string;
  description?: string | null;
  kind: ConversationKind;
  onOpenInfo: () => void;
  onToggleSearch: () => void;
}

function KindIcon({ kind }: { kind: ConversationKind }) {
  const className = "h-4 w-4 text-text-muted dark:text-text-muted";
  if (kind === "broadcast") return <Megaphone className={className} />;
  if (kind === "team") return <Users className={className} />;
  if (kind === "group") return <UsersRound className={className} />;
  return <User className={className} />;
}

export function ConversationHeader({ name, description, kind, onOpenInfo, onToggleSearch }: ConversationHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3 border-b border-border-strong dark:border-border-strong bg-card dark:bg-card px-3 py-3 shadow-sm z-10">
      <button
        type="button"
        onClick={() => router.push("/chat")}
        className="md:hidden rounded-full p-1 hover:bg-card-alt dark:hover:bg-card-alt"
        aria-label="Back to conversations"
      >
        <ArrowLeft className="h-5 w-5 text-text-primary dark:text-text-primary" />
      </button>

      <button
        type="button"
        onClick={onOpenInfo}
        className="flex min-w-0 flex-1 items-center gap-3 text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-card-alt dark:hover:bg-card-alt transition-colors"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface dark:bg-surface border border-border-strong dark:border-border-strong">
          <KindIcon kind={kind} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-base text-text-primary dark:text-text-primary">{name}</p>
          {description && (
            <p className="truncate text-xs text-text-muted dark:text-text-muted">{description}</p>
          )}
        </div>
      </button>

      <button
        type="button"
        onClick={onToggleSearch}
        className="shrink-0 rounded-full p-1.5 hover:bg-card-alt dark:hover:bg-card-alt"
        aria-label="Search in conversation"
      >
        <Search className="h-4 w-4 text-text-muted dark:text-text-muted" />
      </button>

      <button
        type="button"
        onClick={onOpenInfo}
        className="shrink-0 rounded-full p-1.5 hover:bg-card-alt dark:hover:bg-card-alt"
        aria-label="Conversation details"
      >
        <MoreVertical className="h-4 w-4 text-text-muted dark:text-text-muted" />
      </button>
    </div>
  );
}