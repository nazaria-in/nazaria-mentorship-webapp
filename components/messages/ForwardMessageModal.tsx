// /components/messages/ForwardMessageModal.tsx
"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { ConversationsListPanel } from "./ConversationsListPanel";
import { forwardMessage } from "@/lib/api/messages";
import type { Message } from "@/types/messages";
import { cn } from "@/lib/utils";

interface ForwardMessageModalProps {
  message: Message;
  isOpen: boolean;
  onClose: () => void;
}

export function ForwardMessageModal({ message, isOpen, onClose }: ForwardMessageModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [forwarding, setForwarding] = useState(false);

  function toggleSelection(conversationId: string) {
    setSelectedIds((prev) =>
      prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId]
    );
  }

  async function handleForward() {
    if (selectedIds.length === 0) return;
    setForwarding(true);
    try {
      await forwardMessage(message, selectedIds);
      onClose();
      setSelectedIds([]);
    } finally {
      setForwarding(false);
    }
  }

  return (
    <Modal open={isOpen} onClose={onClose} title="Forward message">
      <div className="flex flex-col h-[60vh]">
        <div className="flex-1 overflow-hidden">
          <ConversationsListPanel pickerMode onSelectForForward={toggleSelection} />
        </div>
        <div className="border-t border-border dark:border-border pt-3 flex items-center justify-between">
          <span className="text-sm text-text-muted dark:text-text-muted">
            {selectedIds.length} selected
          </span>
          <button
            type="button"
            onClick={() => void handleForward()}
            disabled={selectedIds.length === 0 || forwarding}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {forwarding ? "Forwarding…" : "Forward"}
          </button>
        </div>
      </div>
    </Modal>
  );
}