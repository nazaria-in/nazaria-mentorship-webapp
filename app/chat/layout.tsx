// /app/chat/layout.tsx
"use client";

import { usePathname } from "next/navigation";
import { ConversationsListPanel } from "@/components/messages/ConversationsListPanel";
import { cn } from "@/lib/utils";

interface MessagesLayoutProps {
  children: React.ReactNode;
}

export default function MessagesLayout({ children }: MessagesLayoutProps) {
  const pathname = usePathname();
  const isThreadRoute = pathname !== "/chat";

  const activeConversationId = isThreadRoute ? pathname.split("/")[2] : undefined;

  return (
    <div className="flex h-[calc(100dvh-var(--app-shell-offset,4rem))] bg-surface dark:bg-surface">
      <div
        className={cn(
          "w-full md:w-80 lg:w-96 shrink-0 border-r border-border-strong dark:border-border-strong",
          isThreadRoute ? "hidden md:block" : "block"
        )}
      >
        <ConversationsListPanel activeConversationId={activeConversationId} />
      </div>

      <div className={cn("flex-1 min-w-0", isThreadRoute ? "block" : "hidden md:block")}>{children}</div>
    </div>
  );
}