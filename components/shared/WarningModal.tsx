// /components/shared/WarningModal.tsx

"use client";

import { AlertTriangle, Info } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { cn } from "@/lib/utils";

export interface WarningModalProps {
  open: boolean;
  onClose: () => void;
  /** Omit to render as an info notice with a single "Got it" button instead of confirm/cancel. */
  onConfirm?: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" = destructive (red). "warning" = cautionary, non-destructive (amber/brand). Default "warning". */
  variant?: "danger" | "warning";
  isLoading?: boolean;
  /** Keeps the modal open and shows this instead of closing on a failed confirm action. */
  errorMessage?: string | null;
}

export function WarningModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "warning",
  isLoading = false,
  errorMessage = null,
}: WarningModalProps) {
  const isInfoOnly = !onConfirm;

  return (
    <Modal open={open} onClose={onClose} title={title} className="max-w-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              variant === "danger"
                ? "bg-destructive/10 text-destructive dark:bg-destructive/20"
                : "bg-accent text-text-accent"
            )}
          >
            {variant === "danger" ? <AlertTriangle className="h-4.5 w-4.5" /> : <Info className="h-4.5 w-4.5" />}
          </span>
          <p className="pt-1.5 text-sm leading-relaxed text-text-primary/70">{description}</p>
        </div>

        {errorMessage && (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive dark:bg-destructive/15">
            {errorMessage}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          {!isInfoOnly && (
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={isInfoOnly ? onClose : onConfirm}
            disabled={isLoading}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-50",
              variant === "danger" ? "bg-destructive text-white hover:opacity-90" : "bg-primary text-primary-foreground hover:opacity-90"
            )}
          >
            {isLoading ? "Working…" : isInfoOnly ? "Got it" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}