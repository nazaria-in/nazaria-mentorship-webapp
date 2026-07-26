// /components/admin/ExitSurveyTemplateEditor.tsx
"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchTemplatesForRole,
  createTemplate,
  updateTemplateQuestions,
  activateTemplate,
} from "@/lib/api/exit-survey-templates";
import type { ExitSurveyRole, ExitSurveyTemplateEntry } from "@/types/exit-survey";

const COMPONENT_OPTIONS: ExitSurveyTemplateEntry["component"][] = [
  "single_select",
  "multi_select",
  "rating",
  "short_answer",
];

function newQuestion(component: ExitSurveyTemplateEntry["component"]): ExitSurveyTemplateEntry {
  const id = crypto.randomUUID();
  switch (component) {
    case "single_select":
      return { id, component, question: "New question", options: ["Yes", "No"] };
    case "multi_select":
      return { id, component, question: "New question", options: ["Option A", "Option B"] };
    case "rating":
      return { id, component, question: "New question", scale: 5 };
    case "short_answer":
      return { id, component, question: "New question" };
  }
}

interface ExitSurveyTemplateEditorProps {
  currentUserId: string;
}

export function ExitSurveyTemplateEditor({ currentUserId }: ExitSurveyTemplateEditorProps) {
  const [role, setRole] = useState<ExitSurveyRole>("mentor");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [draftQuestions, setDraftQuestions] = useState<ExitSurveyTemplateEntry[] | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: templates } = useQuery({
    queryKey: ["exit-survey-templates", role],
    queryFn: () => fetchTemplatesForRole(role),
  });

  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId) ?? null;
  const questions = draftQuestions ?? selectedTemplate?.questions ?? [];

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["exit-survey-templates", role] });
  }

  async function handleCreateTemplate() {
    setError(null);
    if (newTitle.trim().length === 0) {
      setError("Give the template a title.");
      return;
    }
    try {
      const created = await createTemplate({
        title: newTitle.trim(),
        role,
        questions: [],
        createdBy: currentUserId,
      });
      setNewTitle("");
      refresh();
      setSelectedTemplateId(created.id);
      setDraftQuestions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template.");
    }
  }

  function updateDraft(next: ExitSurveyTemplateEntry[]) {
    setDraftQuestions(next);
  }

  function addQuestion(component: ExitSurveyTemplateEntry["component"]) {
    updateDraft([...questions, newQuestion(component)]);
  }

  function removeQuestion(id: string) {
    updateDraft(questions.filter((q) => q.id !== id));
  }

  function updateQuestionText(id: string, text: string) {
    updateDraft(questions.map((q) => (q.id === id ? { ...q, question: text } : q)));
  }

  function updateOptions(id: string, optionsText: string) {
    const options = optionsText
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    updateDraft(
      questions.map((q) =>
        q.id === id && (q.component === "single_select" || q.component === "multi_select")
          ? { ...q, options }
          : q
      )
    );
  }

  function updateScale(id: string, scale: number) {
    updateDraft(questions.map((q) => (q.id === id && q.component === "rating" ? { ...q, scale } : q)));
  }

  async function handleSaveQuestions() {
    if (!selectedTemplateId) return;
    setError(null);
    try {
      await updateTemplateQuestions(selectedTemplateId, questions);
      setDraftQuestions(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    }
  }

  async function handleActivate() {
    if (!selectedTemplateId) return;
    setError(null);
    try {
      await activateTemplate(selectedTemplateId, role);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit rounded-full border border-border p-0.5 dark:border-border">
        {(["mentor", "mentee"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setRole(r);
              setSelectedTemplateId(null);
              setDraftQuestions(null);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize dark:text-text-primary ${
              role === r
                ? "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground"
                : "text-text-primary/60"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <select
          value={selectedTemplateId ?? ""}
          onChange={(e) => {
            setSelectedTemplateId(e.target.value || null);
            setDraftQuestions(null);
          }}
          className="rounded-lg border border-border bg-card-alt px-3 py-1.5 text-sm text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary"
        >
          <option value="">Select a template...</option>
          {(templates ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} {t.isActive ? "(active)" : ""}
            </option>
          ))}
        </select>

        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New template title"
          className="rounded-lg border border-border bg-card-alt px-3 py-1.5 text-sm text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary"
        />
        <button
          type="button"
          onClick={handleCreateTemplate}
          className="rounded-lg bg-primary px-4 py-1.5 text-sm text-primary-foreground dark:bg-primary dark:text-primary-foreground"
        >
          Create
        </button>
      </div>

      {error && <p className="text-sm text-destructive dark:text-destructive">{error}</p>}

      {selectedTemplate && (
        <div className="surface-card flex flex-col gap-4 dark:surface-card">
          <div className="flex items-center justify-between">
            <p className="font-heading text-lg text-text-primary dark:text-text-primary">
              {selectedTemplate.title}
            </p>
            <button
              type="button"
              onClick={handleActivate}
              disabled={selectedTemplate.isActive}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-60 dark:bg-accent dark:text-accent-foreground"
            >
              {selectedTemplate.isActive ? "Active" : "Make active"}
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {questions.map((q) => (
              <div key={q.id} className="surface-card-alt flex flex-col gap-2 dark:surface-card-alt">
                <div className="flex items-center justify-between gap-2">
                  <input
                    value={q.question}
                    onChange={(e) => updateQuestionText(q.id, e.target.value)}
                    className="flex-1 rounded border border-border bg-card px-2 py-1 text-sm text-text-primary dark:border-border dark:bg-card dark:text-text-primary"
                  />
                  <span className="text-xs text-text-muted dark:text-text-muted">{q.component}</span>
                  <button
                    type="button"
                    onClick={() => removeQuestion(q.id)}
                    className="text-xs text-destructive dark:text-destructive"
                  >
                    Remove
                  </button>
                </div>

                {(q.component === "single_select" || q.component === "multi_select") && (
                  <input
                    value={q.options.join(", ")}
                    onChange={(e) => updateOptions(q.id, e.target.value)}
                    placeholder="Options, comma separated"
                    className="rounded border border-border bg-card px-2 py-1 text-xs text-text-primary dark:border-border dark:bg-card dark:text-text-primary"
                  />
                )}

                {q.component === "rating" && (
                  <input
                    type="number"
                    value={q.scale}
                    onChange={(e) => updateScale(q.id, Number(e.target.value) || 5)}
                    className="w-20 rounded border border-border bg-card px-2 py-1 text-xs text-text-primary dark:border-border dark:bg-card dark:text-text-primary"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {COMPONENT_OPTIONS.map((component) => (
              <button
                key={component}
                type="button"
                onClick={() => addQuestion(component)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-primary dark:border-border dark:text-text-primary"
              >
                + {component}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSaveQuestions}
            className="w-fit rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground dark:bg-primary dark:text-primary-foreground"
          >
            Save questions
          </button>
        </div>
      )}
    </div>
  );
}