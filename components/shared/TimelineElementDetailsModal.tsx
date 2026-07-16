// /components/shared/TimelineElementDetailsModal.tsx

"use client";

import * as React from "react";
import { Modal } from "@/components/shared/Modal";

export interface TimelineElementDetailsModalProps {
  isOpen: boolean;
  title: string;
  timeLabel?: string;
  description?: string;
  actions?: React.ReactNode;
  onClose: () => void;
  children?: React.ReactNode;
}

export function TimelineElementDetailsModal({
  isOpen,
  title,
  timeLabel,
  description,
  actions,
  onClose,
  children,
}: TimelineElementDetailsModalProps): React.JSX.Element {
  return (
    <Modal open={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4 p-1">
        {timeLabel && <p className="text-xs font-medium text-text-muted">{timeLabel}</p>}

        {description && (
          <div className="space-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Details & Context
            </h4>
            <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
              {description}
            </p>
          </div>
        )}

        {children}

        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="flex gap-2">{actions}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-surface-card border border-border px-4 py-2 text-xs font-medium text-text-primary transition hover:bg-border/30"
          >
            Dismiss View
          </button>
        </div>
      </div>
    </Modal>
  );
}