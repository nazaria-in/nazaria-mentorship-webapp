// /components/exit-survey/ExitSurveyForm.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { transcribeAudio } from "@/lib/api/exit-survey-transcribe";
import type {
  ExitSurveyConcernTag,
  ExitSurveyEntry,
  ExitSurveyRole,
  ExitSurveySignal,
  ExitSurveySubmission,
  ExitSurveyTemplateEntry,
  ExitSurveyUrgency,
} from "@/types/exit-survey";

interface ExitSurveyFormProps {
  exitSurveyId: string;
  role: ExitSurveyRole;
  templateSnapshot: ExitSurveyTemplateEntry[];
  /** Mentor forms are about a specific mentee — shown as context above the form. */
  subjectFullName?: string | null;
  onSubmit: (submission: ExitSurveySubmission) => Promise<void>;
}

type AnswerValue = string | string[] | number;

const TRANSCRIPT_REQUIRED_ROLES: ExitSurveyRole[] = ["mentor"];

export function ExitSurveyForm({
  exitSurveyId,
  role,
  templateSnapshot,
  subjectFullName,
  onSubmit,
}: ExitSurveyFormProps) {
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

  // Playback: build an object URL for whatever's currently recorded so the
  // person can listen back before deciding to transcribe or discard it.
const playbackUrl = useMemo(() => {
    if (recorder.status === "stopped" && recorder.audioBlob) {
      return URL.createObjectURL(recorder.audioBlob);
    }
    return null;
  }, [recorder.status, recorder.audioBlob]);

  useEffect(() => {
    return () => {
      if (playbackUrl) {
        URL.revokeObjectURL(playbackUrl);
      }
    };
  }, [playbackUrl]);

  const visibleEntries = useMemo(
    () => getVisibleEntries(templateSnapshot, answerValues),
    [templateSnapshot, answerValues]
  );

  const transcriptRequired = TRANSCRIPT_REQUIRED_ROLES.includes(role);

  function setAnswer(questionId: string, value: AnswerValue) {
    setAnswerValues((prev) => ({ ...prev, [questionId]: value }));
  }

  function toggleMultiSelectOption(questionId: string, option: string) {
    const current = (answerValues[questionId] as string[] | undefined) ?? [];
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    setAnswer(questionId, next);
  }

  async function handleRecordToggle() {
    if (recorder.status === "recording") {
      recorder.stop();
      return;
    }
    await recorder.start();
  }

  function buildAnswersPayload(): ExitSurveyEntry[] {
    return visibleEntries.map((entry) => toExitSurveyEntry(entry, answerValues[entry.id]));
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
      if (entry.component === "multi_select") continue; // empty selection is valid
      if (entry.component === "short_answer") continue; // optional free text
      const value = answerValues[entry.id];
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
        exitSurveyId,
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
      <div>
        <h2 className="font-heading text-xl text-text-primary dark:text-text-primary">
          {role === "mentor" ? "Mentor exit form" : "Mentee exit form"}
        </h2>
        {role === "mentor" && subjectFullName && (
          <p className="text-sm text-text-muted dark:text-text-muted">About: {subjectFullName}</p>
        )}
      </div>

      {visibleEntries.length > 0 ? (
        <div className="flex flex-col gap-5">
          {visibleEntries.map((entry) => (
            <QuestionField
              key={entry.id}
              entry={entry}
              value={answerValues[entry.id]}
              onSelect={(value) => setAnswer(entry.id, value)}
              onToggleOption={(option) => toggleMultiSelectOption(entry.id, option)}
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

        {playbackUrl && (
          // eslint-disable-next-line jsx-a11y/media-has-caption -- transient voice note, no captions to attach
          <audio controls src={playbackUrl} className="w-full">
            Your browser doesn&apos;t support audio playback.
          </audio>
        )}

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

function getVisibleEntries(
  template: ExitSurveyTemplateEntry[],
  answerValues: Record<string, AnswerValue>
): ExitSurveyTemplateEntry[] {
  return template.filter((entry) => {
    if (!entry.showIf) return true;
    const answer = answerValues[entry.showIf.questionId];
    if (typeof answer !== "string") return false;
    return Array.isArray(entry.showIf.equals)
      ? entry.showIf.equals.includes(answer)
      : entry.showIf.equals === answer;
  });
}

function toExitSurveyEntry(
  template: ExitSurveyTemplateEntry,
  value: AnswerValue | undefined
): ExitSurveyEntry {
  switch (template.component) {
    case "single_select":
      return {
        id: template.id,
        component: "single_select",
        question: template.question,
        options: template.options,
        selected: typeof value === "string" ? value : "",
      };
    case "multi_select":
      return {
        id: template.id,
        component: "multi_select",
        question: template.question,
        options: template.options,
        selected: Array.isArray(value) ? value : [],
      };
    case "rating":
      return {
        id: template.id,
        component: "rating",
        question: template.question,
        scale: template.scale,
        selected: typeof value === "number" ? value : 0,
      };
    case "short_answer":
      return {
        id: template.id,
        component: "short_answer",
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
      <span className="text-sm font-medium text-text-primary dark:text-text-primary">{entry.question}</span>

      {/* single_select: real radio circles — visually distinct from multi_select's checkboxes */}
      {entry.component === "single_select" && (
        <div className="flex flex-col gap-1.5">
          {entry.options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 text-sm text-text-primary dark:text-text-primary"
            >
              <input
                type="radio"
                name={entry.id}
                checked={value === option}
                onChange={() => onSelect(option)}
                className="h-4 w-4 accent-primary"
              />
              {option}
            </label>
          ))}
        </div>
      )}

      {/* multi_select: checkboxes */}
      {entry.component === "multi_select" && (
        <div className="flex flex-col gap-1.5">
          {entry.options.map((option) => {
            const selected = Array.isArray(value) && value.includes(option);
            return (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2 text-sm text-text-primary dark:text-text-primary"
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleOption(option)}
                  className="h-4 w-4 accent-primary"
                />
                {option}
              </label>
            );
          })}
        </div>
      )}

      {entry.component === "rating" && (
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

      {entry.component === "short_answer" && (
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