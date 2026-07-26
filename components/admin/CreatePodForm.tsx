// /components/admin/CreatePodForm.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCohortOptions, createPod } from "@/lib/api/admin-users";

interface CreatePodFormProps {
  onCreated: () => void;
}

export function CreatePodForm({ onCreated }: CreatePodFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [skillLevel, setSkillLevel] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: cohortOptions } = useQuery({
    queryKey: ["cohort-options"],
    queryFn: fetchCohortOptions,
    enabled: isOpen,
  });

  async function handleCreate() {
    setError(null);
    if (name.trim().length === 0) {
      setError("Pod name is required.");
      return;
    }
    if (!cohortId) {
      setError("Choose a cohort.");
      return;
    }

    setIsSaving(true);
    try {
      await createPod({ name: name.trim(), cohortId, skillLevel: skillLevel.trim() || undefined });
      setName("");
      setSkillLevel("");
      setCohortId("");
      setIsOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create pod.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground dark:bg-primary dark:text-primary-foreground"
      >
        Create pod
      </button>
    );
  }

  return (
    <div className="surface-card flex flex-col gap-3 dark:surface-card">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-text-muted dark:text-text-muted">Pod name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-border bg-card-alt px-3 py-1.5 text-sm text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-text-muted dark:text-text-muted">Cohort</label>
        <select
          value={cohortId}
          onChange={(e) => setCohortId(e.target.value)}
          className="rounded-lg border border-border bg-card-alt px-3 py-1.5 text-sm text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary"
        >
          <option value="">Select a cohort...</option>
          {(cohortOptions ?? []).map((cohort) => (
            <option key={cohort.value} value={cohort.value}>
              {cohort.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-text-muted dark:text-text-muted">
          Skill level (optional)
        </label>
        <input
          value={skillLevel}
          onChange={(e) => setSkillLevel(e.target.value)}
          className="rounded-lg border border-border bg-card-alt px-3 py-1.5 text-sm text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary"
        />
      </div>

      {error && <p className="text-sm text-destructive dark:text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCreate}
          disabled={isSaving}
          className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60 dark:bg-primary dark:text-primary-foreground"
        >
          {isSaving ? "Creating..." : "Create"}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="w-fit rounded-lg px-4 py-2 text-sm text-text-muted dark:text-text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}