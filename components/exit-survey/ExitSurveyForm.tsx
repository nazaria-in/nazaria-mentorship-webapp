// /components/exit-survey/ExitSurveyForm.tsx
"use client";

import { useMemo, useState } from "react";
import {
  getTemplateForRole,
  getVisibleTemplateEntries,
  MENTEE_ACTION_ITEM_QUESTION,
  type ExitSurveyTemplateEntry,
} from "@/lib/exit-survey/templates";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { transcribeAudio } from "@/lib/api/exit-survey-transcribe";
import type {
  ExitSurveyConcernTag,
  ExitSurveyEntry,
  ExitSurveyRole,
  ExitSurveySignal,
  ExitSurveySubmission,
  ExitSurveyUrgency,
} from "@/types/exit-survey";

interface ExitSurveyFormProps {
  meetingId: string;
  userId: string;
  role: ExitSurveyRole;
  onSubmit: (submission: ExitSurveySubmission) => Promise<void>;
}

type AnswerValue = string | string[] | number;

const TRANSCRIPT_REQUIRED_ROLES: ExitSurveyRole[] = ["mentor"];

export function ExitSurveyForm({ meetingId, userId, role, onSubmit }: ExitSurveyFormProps) {
  const template = useMemo(() => getTemplateForRole(role), [role]);
  const [answerValues, setAnswerValues] = useState<Record<string, AnswerValue>>({});
  const [signal, setSignal] = useState<ExitSurveySignal | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [concernTags, setConcernTags] = useState<ExitSurveyConcernTag[]>([]);
  const [needsFollowUp, setNeedsFollowUp] = useState(false);
  const [followUpUrgency, setFollowUpUrgency] = useState<ExitSurveyUrgency>("none");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorder = useAudioRecorder();

  const visibleEntries = getVisibleTemplateEntries(
    template,
    answerValues as Partial<Record<string, ExitSurveyEntry["selected"]>>
  );

  const transcriptRequired = TRANSCRIPT_REQUIRED_ROLES.includes(role);

  function setAnswer(question: string, value: AnswerValue) {
    setAnswerValues((prev) => ({ ...prev, [question]: value }));
  }

  function toggleMultiSelectOption(question: string, option: string) {
    const current = (answerValues[question] as string[] | undefined) ?? [];
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    setAnswer(question, next);
  }

  async function handleRecordToggle() {
    if (recorder.status === "recording") {
      recorder.stop();
      return;
    }
    await recorder.start();
  }

  function buildAnswersPayload(): ExitSurveyEntry[] {
    return visibleEntries.map((templateEntry) => {
      const value = answerValues[templateEntry.question];
      return toExitSurveyEntry(templateEntry, value);
    });
  }

  async function handleUseRecording() {
    if (!recorder.audioBlob) return;
    setError(null);
    setIsTranscribing(true);
    try {
      const result = await transcribeAudio(recorder.audioBlob, buildAnswersPayload());
      setTranscript(result.transcript);
      setAiSummary(result.summary);
      setConcernTags(result.concernTags);
      setNeedsFollowUp(result.needsFollowUp);
      setFollowUpUrgency(result.followUpUrgency);
    } catch (transcribeError) {
      setError(
        transcribeError instanceof Error
          ? transcribeError.message
          : "Couldn't transcribe that recording. Try again or type your note instead."
      );
    } finally {
      setIsTranscribing(false);
      recorder.reset();
    }
  }

  function findFirstMissingAnswer(): string | null {
    for (const entry of visibleEntries) {
      const value = answerValues[entry.question];
      if (entry.type === "multi_select") continue;
      if (entry.type === "short_answer") continue;
      if (value === undefined || value === null || value === "") {
        return entry.question;
      }
    }
    return null;
  }

  async function handleSubmit() {
    setError(null);

    const missingQuestion = findFirstMissingAnswer();
    if (missingQuestion) {
      setError(`Please answer: "${missingQuestion}"`);
      return;
    }
    if (!signal) {
      setError("Please choose a signal before submitting.");
      return;
    }
    if (transcriptRequired && transcript.trim().length === 0) {
      setError("A voice note is required for this role.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        meetingId,
        userId,
        userRole: role,
        answers: buildAnswersPayload(),
        signal,
        transcript: transcript.trim().length > 0 ? transcript : undefined,
        aiSummary: aiSummary ?? undefined,
        concernTags: concernTags.length > 0 ? concernTags : undefined,
        needsFollowUp: needsFollowUp || undefined,
        followUpUrgency: followUpUrgency !== "none" ? followUpUrgency : undefined,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit survey.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 text-text-primary dark:border-border dark:bg-card dark:text-text-primary">
      <h2 className="font-heading text-xl text-text-primary dark:text-text-primary">
        {role === "mentor" ? "Mentor exit form" : "Mentee exit form"}
      </h2>

      {visibleEntries.length > 0 ? (
        <div className="flex flex-col gap-5">
          {visibleEntries.map((entry) => (
            <QuestionField
              key={entry.question}
              entry={entry}
              value={answerValues[entry.question]}
              onSelect={(value) => setAnswer(entry.question, value)}
              onToggleOption={(option) => toggleMultiSelectOption(entry.question, option)}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-muted dark:text-text-muted">
          No structured questions for this role yet — just share a voice note or a short note below.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-text-primary dark:text-text-primary">
          Voice note {transcriptRequired ? "(required)" : "(optional)"}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRecordToggle}
            disabled={recorder.status === "requesting_permission" || isTranscribing}
            className="w-fit rounded-lg border border-border bg-card-alt px-4 py-2 text-sm text-text-primary disabled:opacity-60 dark:border-border dark:bg-card-alt dark:text-text-primary"
          >
            {recorder.status === "recording"
              ? "Stop recording"
              : recorder.status === "requesting_permission"
                ? "Requesting mic access..."
                : "Start recording"}
          </button>

          {recorder.status === "stopped" && recorder.audioBlob && (
            <button
              type="button"
              onClick={handleUseRecording}
              disabled={isTranscribing}
              className="w-fit rounded-lg bg-accent px-4 py-2 text-sm text-accent-foreground disabled:opacity-60 dark:bg-accent dark:text-accent-foreground"
            >
              {isTranscribing ? "Transcribing..." : "Use this recording"}
            </button>
          )}

          {recorder.status === "stopped" && recorder.audioBlob && !isTranscribing && (
            <button
              type="button"
              onClick={recorder.reset}
              className="text-sm text-text-muted underline dark:text-text-muted"
            >
              Discard
            </button>
          )}
        </div>

        {(recorder.status === "denied" || recorder.status === "error") && recorder.errorMessage && (
          <p className="text-sm text-text-muted dark:text-text-muted">{recorder.errorMessage}</p>
        )}

        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Transcript will appear here — you can edit it, or type a note directly instead of recording."
          rows={3}
          className="rounded-lg border border-border bg-card-alt p-2 text-sm text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary"
        />

        {aiSummary && (
          <div className="rounded-lg bg-card-alt p-3 text-xs text-text-muted dark:bg-card-alt dark:text-text-muted">
            <p className="mb-1 font-medium text-text-primary dark:text-text-primary">AI summary preview</p>
            <p>{aiSummary}</p>
            {concernTags.length > 0 && <p className="mt-1">Flagged: {concernTags.join(", ")}</p>}
          </div>
        )}
      </div>

      <SignalPicker value={signal} onChange={setSignal} />

      {error && <p className="text-sm text-destructive dark:text-destructive">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-fit rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60 dark:bg-primary dark:text-primary-foreground"
      >
        {isSubmitting ? "Submitting..." : "Submit exit survey"}
      </button>
    </div>
  );
}

function toExitSurveyEntry(
  template: ExitSurveyTemplateEntry,
  value: AnswerValue | undefined
): ExitSurveyEntry {
  switch (template.type) {
    case "single_select":
      return {
        type: "single_select",
        question: template.question,
        options: template.options,
        selected: typeof value === "string" ? value : "",
      };
    case "multi_select":
      return {
        type: "multi_select",
        question: template.question,
        options: template.options,
        selected: Array.isArray(value) ? value : [],
      };
    case "rating":
      return {
        type: "rating",
        question: template.question,
        scale: template.scale,
        selected: typeof value === "number" ? value : 0,
      };
    case "short_answer":
      return {
        type: "short_answer",
        question: template.question,
        selected: typeof value === "string" ? value : "",
      };
  }
}

interface QuestionFieldProps {
  entry: ExitSurveyTemplateEntry;
  value: AnswerValue | undefined;
  onSelect: (value: AnswerValue) => void;
  onToggleOption: (option: string) => void;
}

function QuestionField({ entry, value, onSelect, onToggleOption }: QuestionFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-text-primary dark:text-text-primary">
        {entry.question}
        {entry.question === MENTEE_ACTION_ITEM_QUESTION && (
          <span className="ml-1 text-xs text-text-accent dark:text-text-accent">
            (shared with your pod if filled in)
          </span>
        )}
      </span>

      {entry.type === "single_select" && (
        <div className="flex flex-wrap gap-2">
          {entry.options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className={`rounded-full border px-3 py-1 text-sm dark:border-border ${
                value === option
                  ? "border-primary bg-accent text-accent-foreground dark:bg-accent dark:text-accent-foreground"
                  : "border-border bg-card-alt text-text-primary dark:bg-card-alt dark:text-text-primary"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {entry.type === "multi_select" && (
        <div className="flex flex-wrap gap-2">
          {entry.options.map((option) => {
            const selected = Array.isArray(value) && value.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => onToggleOption(option)}
                className={`rounded-full border px-3 py-1 text-sm dark:border-border ${
                  selected
                    ? "border-primary bg-accent text-accent-foreground dark:bg-accent dark:text-accent-foreground"
                    : "border-border bg-card-alt text-text-primary dark:bg-card-alt dark:text-text-primary"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}

      {entry.type === "rating" && (
        <div className="flex gap-1">
          {Array.from({ length: entry.scale }, (_, i) => i + 1).map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onSelect(star)}
              aria-label={`Rate ${star} out of ${entry.scale}`}
              className={`text-2xl ${
                typeof value === "number" && value >= star
                  ? "text-text-accent dark:text-text-accent"
                  : "text-border-strong dark:text-border-strong"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      )}

      {entry.type === "short_answer" && (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onSelect(e.target.value)}
          rows={2}
          className="rounded-lg border border-border bg-card-alt p-2 text-sm text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary"
        />
      )}
    </div>
  );
}

interface SignalPickerProps {
  value: ExitSurveySignal | null;
  onChange: (value: ExitSurveySignal) => void;
}

const SIGNAL_OPTIONS: { value: ExitSurveySignal; label: string; dotClass: string }[] = [
  { value: "green", label: "I'm on track", dotClass: "bg-green-500" },
  { value: "yellow", label: "I'm facing a few challenges", dotClass: "bg-yellow-500" },
  { value: "red", label: "I need someone from Nazaria to check in", dotClass: "bg-red-500" },
];

function SignalPicker({ value, onChange }: SignalPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-text-primary dark:text-text-primary">
        How are things overall?
      </span>
      <div className="flex flex-col gap-2">
        {SIGNAL_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm dark:border-border ${
              value === option.value
                ? "border-primary bg-accent dark:bg-accent"
                : "border-border bg-card-alt dark:bg-card-alt"
            } text-text-primary dark:text-text-primary`}
          >
            <span className={`h-3 w-3 rounded-full ${option.dotClass}`} />
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}