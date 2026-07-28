// /components/admin/ExitSurveyTemplateEditor.tsx
"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchTemplatesForRole,
  createTemplate,
  updateTemplate,
  activateTemplate,
} from "@/lib/api/exit-survey-templates";
import type { ExitSurveyRole, ExitSurveyTemplate, ExitSurveyTemplateEntry } from "@/types/exit-survey";

const COMPONENT_LABELS: Record<ExitSurveyTemplateEntry["component"], string> = {
  single_select: "Single choice (radio)",
  multi_select: "Multiple choice (checkboxes)",
  rating: "Star rating",
  short_answer: "Short answer",
};

function newQuestion(component: ExitSurveyTemplateEntry["component"]): ExitSurveyTemplateEntry {
  const id = crypto.randomUUID();
  switch (component) {
    case "single_select":
      return { id, component, question: "New question", options: ["Yes", "No"] };
    case "multi_select":
      return { id, component, question: "New question", options: ["Option A"] };
    case "rating":
      return { id, component, question: "New question", scale: 5 };
    case "short_answer":
      return { id, component, question: "New question" };
  }
}

/** Local working copy of a template — the single source of truth while editing. */
interface WorkingTemplate {
  id: string;
  title: string;
  role: ExitSurveyRole;
  questions: ExitSurveyTemplateEntry[];
  voicePromptLabel: string;
  isActive: boolean;
}

function toWorkingTemplate(t: ExitSurveyTemplate): WorkingTemplate {
  return {
    id: t.id,
    title: t.title,
    role: t.role,
    questions: t.questions,
    voicePromptLabel: t.voicePromptLabel ?? "",
    isActive: t.isActive,
  };
}

interface ExitSurveyTemplateEditorProps {
  currentUserId: string;
}

export function ExitSurveyTemplateEditor({ currentUserId }: ExitSurveyTemplateEditorProps) {
  const [role, setRole] = useState<ExitSurveyRole>("mentor");
  // Working state is the ONLY source of truth once a template is open —
  // this is what fixes the "save looked stuck" bug: the editor used to
  // derive its display from the react-query cache, which hadn't refetched
  // yet right after a create/save, so the panel appeared empty/frozen.
  const [working, setWorking] = useState<WorkingTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["exit-survey-templates", role],
    queryFn: () => fetchTemplatesForRole(role),
  });

  function refreshList() {
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
        voicePromptLabel: null,
        createdBy: currentUserId,
      });
      setNewTitle("");
      setIsCreating(false);
      setWorking(toWorkingTemplate(created)); // ← open it immediately, don't wait on refetch
      refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template.");
    }
  }

  function updateWorking(patch: Partial<WorkingTemplate>) {
    setWorking((prev) => (prev ? { ...prev, ...patch } : prev));
    setSaveState("idle");
  }

  function addQuestion(component: ExitSurveyTemplateEntry["component"]) {
    if (!working) return;
    updateWorking({ questions: [...working.questions, newQuestion(component)] });
  }

  function removeQuestion(id: string) {
    if (!working) return;
    updateWorking({
      questions: working.questions
        .filter((q) => q.id !== id)
        // Also clear any showIf pointing at the removed question.
        .map((q) => (q.showIf?.questionId === id ? { ...q, showIf: undefined } : q)),
    });
  }

  function patchQuestion(id: string, patch: Partial<ExitSurveyTemplateEntry>) {
    if (!working) return;
    updateWorking({
      questions: working.questions.map((q) => (q.id === id ? ({ ...q, ...patch } as ExitSurveyTemplateEntry) : q)),
    });
  }

  function addOption(questionId: string) {
    if (!working) return;
    const q = working.questions.find((qq) => qq.id === questionId);
    if (!q || (q.component !== "single_select" && q.component !== "multi_select")) return;
    patchQuestion(questionId, { options: [...q.options, `Option ${q.options.length + 1}`] });
  }

  function updateOption(questionId: string, index: number, text: string) {
    if (!working) return;
    const q = working.questions.find((qq) => qq.id === questionId);
    if (!q || (q.component !== "single_select" && q.component !== "multi_select")) return;
    const options = [...q.options];
    options[index] = text;
    patchQuestion(questionId, { options });
  }

  function removeOption(questionId: string, index: number) {
    if (!working) return;
    const q = working.questions.find((qq) => qq.id === questionId);
    if (!q || (q.component !== "single_select" && q.component !== "multi_select")) return;
    patchQuestion(
      questionId,
      { options: q.options.filter((_, i) => i !== index) }
    );
  }

  async function handleSave() {
    if (!working) return;
    setError(null);
    setSaveState("saving");
    try {
      const saved = await updateTemplate(working.id, {
        title: working.title,
        questions: working.questions,
        voicePromptLabel: working.voicePromptLabel.trim() || null,
      });
      setWorking(toWorkingTemplate(saved)); // reflect exactly what the DB now has
      setSaveState("saved");
      refreshList();
    } catch (err) {
      setSaveState("error");
      setError(err instanceof Error ? err.message : "Failed to save.");
    }
  }

  async function handleActivate() {
    if (!working) return;
    setError(null);
    try {
      await activateTemplate(working.id, working.role);
      updateWorking({ isActive: true });
      refreshList();
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
              // Direct state update avoids cascading renders from useEffect
              setRole(r);
              setWorking(null);
              setIsCreating(false);
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

      {error && <p className="text-sm text-destructive dark:text-destructive">{error}</p>}

      {!working ? (
        <div className="flex flex-col gap-4">
          {/* Card list instead of a native <select> — active template is
              visually obvious, not just a "(active)" suffix in a dropdown. */}
          {templatesLoading && <p className="text-sm text-text-muted dark:text-text-muted">Loading...</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(templates ?? []).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setWorking(toWorkingTemplate(t))}
                className={`flex flex-col items-start gap-1 rounded-xl border p-4 text-left dark:border-border ${
                  t.isActive
                    ? "border-primary bg-accent dark:bg-accent"
                    : "border-border bg-card dark:bg-card"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <p className="font-medium text-text-primary dark:text-text-primary">{t.title}</p>
                  {t.isActive && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground dark:bg-primary dark:text-primary-foreground">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted dark:text-text-muted">
                  {t.questions.length} question{t.questions.length === 1 ? "" : "s"}
                </p>
              </button>
            ))}

            {isCreating ? (
              <div className="flex flex-col gap-2 rounded-xl border border-border p-4 dark:border-border">
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Template title"
                  autoFocus
                  className="rounded-lg border border-border bg-card-alt px-3 py-1.5 text-sm text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreateTemplate}
                    className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground dark:bg-primary dark:text-primary-foreground"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="rounded-lg px-3 py-1.5 text-sm text-text-muted dark:text-text-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="flex items-center justify-center rounded-xl border border-dashed border-border p-4 text-sm text-text-muted dark:border-border dark:text-text-muted"
              >
                + New template
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="surface-card flex flex-col gap-4 dark:surface-card">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setWorking(null)}
              className="text-sm text-text-muted underline dark:text-text-muted"
            >
              ← Back to templates
            </button>
            <button
              type="button"
              onClick={handleActivate}
              disabled={working.isActive}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-60 dark:bg-accent dark:text-accent-foreground"
            >
              {working.isActive ? "Active" : "Make active"}
            </button>
          </div>

          <input
            value={working.title}
            onChange={(e) => updateWorking({ title: e.target.value })}
            className="rounded-lg border border-border bg-card-alt px-3 py-2 text-lg font-medium text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary"
          />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-muted dark:text-text-muted">
              Voice recording prompt (shown above the record button — leave blank for default &quot;Voice note&quot;)
            </label>
            <input
              value={working.voicePromptLabel}
              onChange={(e) => updateWorking({ voicePromptLabel: e.target.value })}
              placeholder="e.g. Anything else about this session?"
              className="rounded-lg border border-border bg-card-alt px-3 py-1.5 text-sm text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary"
            />
          </div>

          <div className="flex flex-col gap-4">
            {working.questions.map((q, index) => (
              <QuestionEditor
                key={q.id}
                question={q}
                priorQuestions={working.questions
                  .slice(0, index)
                  .filter((p) => p.component !== "short_answer")}
                onChangeText={(text) => patchQuestion(q.id, { question: text })}
                onChangeScale={(scale) => patchQuestion(q.id, { scale })}
                onChangeShowIf={(showIf) => patchQuestion(q.id, { showIf })}
                onAddOption={() => addOption(q.id)}
                onUpdateOption={(i, text) => updateOption(q.id, i, text)}
                onRemoveOption={(i) => removeOption(q.id, i)}
                onRemove={() => removeQuestion(q.id)}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(COMPONENT_LABELS) as ExitSurveyTemplateEntry["component"][]).map((component) => (
              <button
                key={component}
                type="button"
                onClick={() => addQuestion(component)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-primary dark:border-border dark:text-text-primary"
              >
                + {COMPONENT_LABELS[component]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveState === "saving"}
              className="w-fit rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60 dark:bg-primary dark:text-primary-foreground"
            >
              {saveState === "saving" ? "Saving..." : "Save questions"}
            </button>
            {saveState === "saved" && (
              <span className="text-sm text-text-muted dark:text-text-muted">Saved.</span>
            )}
            {saveState === "error" && (
              <span className="text-sm text-destructive dark:text-destructive">Save failed — see error above.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface QuestionEditorProps {
  question: ExitSurveyTemplateEntry;
  /** Prior questions eligible as a showIf parent — anything but short_answer (free text has no enumerable trigger value). */
  priorQuestions: ExitSurveyTemplateEntry[];
  onChangeText: (text: string) => void;
  onChangeScale: (scale: number) => void;
  onChangeShowIf: (showIf: ExitSurveyTemplateEntry["showIf"]) => void;
  onAddOption: () => void;
  onUpdateOption: (index: number, text: string) => void;
  onRemoveOption: (index: number) => void;
  onRemove: () => void;
}

function QuestionEditor({
  question,
  priorQuestions,
  onChangeText,
  onChangeScale,
  onChangeShowIf,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
  onRemove,
}: QuestionEditorProps) {
  const parentQuestion = question.showIf
    ? priorQuestions.find((p) => p.id === question.showIf?.questionId)
    : undefined;

  return (
    <div className="surface-card-alt flex flex-col gap-3 dark:surface-card-alt">
      <div className="flex items-center justify-between gap-2">
        <input
          value={question.question}
          onChange={(e) => onChangeText(e.target.value)}
          className="flex-1 rounded border border-border bg-card px-2 py-1 text-sm text-text-primary dark:border-border dark:bg-card dark:text-text-primary"
        />
        <span className="whitespace-nowrap text-xs text-text-muted dark:text-text-muted">
          {COMPONENT_LABELS[question.component]}
        </span>
        <button type="button" onClick={onRemove} className="text-xs text-destructive dark:text-destructive">
          Remove
        </button>
      </div>

      {(question.component === "single_select" || question.component === "multi_select") && (
        <div className="flex flex-col gap-1.5 pl-2">
          {question.options.map((option, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={option}
                onChange={(e) => onUpdateOption(i, e.target.value)}
                className="flex-1 rounded border border-border bg-card px-2 py-1 text-xs text-text-primary dark:border-border dark:bg-card dark:text-text-primary"
              />
              <button
                type="button"
                onClick={() => onRemoveOption(i)}
                disabled={question.options.length <= 1}
                className="text-xs text-destructive disabled:opacity-40 dark:text-destructive"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={onAddOption}
            className="w-fit text-xs text-text-accent dark:text-text-accent"
          >
            + Add option
          </button>
        </div>
      )}

      {question.component === "rating" && (
        <div className="flex items-center gap-2 pl-2">
          <label className="text-xs text-text-muted dark:text-text-muted">Scale (out of):</label>
          <input
            type="number"
            value={question.scale}
            onChange={(e) => onChangeScale(Number(e.target.value) || 5)}
            className="w-16 rounded border border-border bg-card px-2 py-1 text-xs text-text-primary dark:border-border dark:bg-card dark:text-text-primary"
          />
        </div>
      )}

      {/* Sub-question / conditional visibility builder */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2 dark:border-border">
        <label className="text-xs text-text-muted dark:text-text-muted">Only show this if:</label>
        <select
          value={question.showIf?.questionId ?? ""}
          onChange={(e) => {
            if (!e.target.value) {
              onChangeShowIf(undefined);
              return;
            }
            const parent = priorQuestions.find((p) => p.id === e.target.value);
            if (parent?.component === "rating") {
              onChangeShowIf({ questionId: e.target.value, atLeast: Math.ceil(parent.scale / 2) });
            } else if (parent?.component === "single_select" || parent?.component === "multi_select") {
              onChangeShowIf({ questionId: e.target.value, equals: parent.options[0] });
            } else {
              onChangeShowIf({ questionId: e.target.value });
            }
          }}
          disabled={priorQuestions.length === 0}
          className="rounded border border-border bg-card px-2 py-1 text-xs text-text-primary disabled:opacity-40 dark:border-border dark:bg-card dark:text-text-primary"
        >
          <option value="">Always show</option>
          {priorQuestions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.question} ({COMPONENT_LABELS[p.component]})
            </option>
          ))}
        </select>

        {question.showIf &&
          (parentQuestion?.component === "single_select" || parentQuestion?.component === "multi_select") && (
            <>
              <label className="text-xs text-text-muted dark:text-text-muted">
                {parentQuestion.component === "multi_select" ? "includes" : "equals"}
              </label>
              <select
                value={typeof question.showIf.equals === "string" ? question.showIf.equals : ""}
                onChange={(e) =>
                  onChangeShowIf({ questionId: question.showIf!.questionId, equals: e.target.value })
                }
                className="rounded border border-border bg-card px-2 py-1 text-xs text-text-primary dark:border-border dark:bg-card dark:text-text-primary"
              >
                {parentQuestion.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </>
          )}

        {question.showIf && parentQuestion?.component === "rating" && (
          <>
            <label className="text-xs text-text-muted dark:text-text-muted">rated at least</label>
            <input
              type="number"
              min={1}
              max={parentQuestion.scale}
              value={question.showIf.atLeast ?? 1}
              onChange={(e) =>
                onChangeShowIf({
                  questionId: question.showIf!.questionId,
                  atLeast: Number(e.target.value) || 1,
                })
              }
              className="w-14 rounded border border-border bg-card px-2 py-1 text-xs text-text-primary dark:border-border dark:bg-card dark:text-text-primary"
            />
            <span className="text-xs text-text-muted dark:text-text-muted">/ {parentQuestion.scale}</span>
          </>
        )}
      </div>
      {priorQuestions.length === 0 && (
        <p className="pl-2 text-xs text-text-muted dark:text-text-muted">
          No earlier questions yet to make this conditional on.
        </p>
      )}
    </div>
  );
}