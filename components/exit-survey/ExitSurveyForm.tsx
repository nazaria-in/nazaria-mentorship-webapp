// /components/exit-survey/ExitSurveyForm.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { transcribeAudio, isTranscribeServiceBusy } from "@/lib/api/exit-survey-transcribe";
import type {
  ExitSurveyConcernTag,
  ExitSurveyEntry,
  ExitSurveyRole,
  ExitSurveySentiment,
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
  /** PM/associate-customizable label above the recorder, e.g. "Anything else about this session?" */
  voicePromptLabel?: string | null;
  onSubmit: (submission: ExitSurveySubmission) => Promise<void>;
}

type AnswerValue = string | string[] | number;

const TRANSCRIPT_REQUIRED_ROLES: ExitSurveyRole[] = ["mentor"];

const FRIENDLY_BUSY_MESSAGE =
  "Something went wrong on our end and the voice note couldn't be processed right now — please type your note instead.";

export function ExitSurveyForm({
  exitSurveyId,
  role,
  templateSnapshot,
  subjectFullName,
  voicePromptLabel,
  onSubmit,
}: ExitSurveyFormProps) {
  const [answerValues, setAnswerValues] = useState<Record<string, AnswerValue>>({});
  const [signal, setSignal] = useState<ExitSurveySignal | null>(null);
  const [transcript, setTranscript] = useState<string>("");

  // AI analysis is computed here and submitted, but intentionally never
  // rendered to the person filling this out — see docs/EXIT_SURVEY_SYSTEM.md
  // "Access rules by role." Only staff see this data (ExitSurveyReportView
  // with redacted=false). Do not add a preview of these back into this form.
  const [aiHeadline, setAiHeadline] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiKeyPoints, setAiKeyPoints] = useState<string[]>([]);
  const [sentiment, setSentiment] = useState<ExitSurveySentiment | null>(null);
  const [concernTags, setConcernTags] = useState<ExitSurveyConcernTag[]>([]);
  const [needsFollowUp, setNeedsFollowUp] = useState(false);
  const [followUpUrgency, setFollowUpUrgency] = useState<ExitSurveyUrgency>("none");

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Friendly message shown when the AI transcription service is busy/out
  // of quota — rendered near both the recorder and the submit button so
  // it's visible wherever the person's attention currently is.
  const [aiError, setAiError] = useState<string | null>(null);

  const recorder = useAudioRecorder();
  const audioRef = useRef<HTMLAudioElement>(null);

  // Sync the audio blob to the DOM element directly without causing state renders
  useEffect(() => {
    if (recorder.status === "stopped" && recorder.audioBlob) {
      const url = URL.createObjectURL(recorder.audioBlob);
      if (audioRef.current) {
        audioRef.current.src = url;
      }
      return () => URL.revokeObjectURL(url);
    }
  }, [recorder.status, recorder.audioBlob]);

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
    setAiError(null);
    await recorder.start();
  }

  function buildAnswersPayload(): ExitSurveyEntry[] {
    return visibleEntries.map((entry) => toExitSurveyEntry(entry, answerValues[entry.id]));
  }

  async function handleUseRecording() {
    if (!recorder.audioBlob) return;
    setError(null);
    setAiError(null);
    setIsTranscribing(true);

    try {
      const result = await transcribeAudio(recorder.audioBlob, buildAnswersPayload());
      setTranscript(result.transcript);
      setAiHeadline(result.headline);
      setAiSummary(result.summary);
      setAiKeyPoints(result.keyPoints);
      setSentiment(result.sentiment);
      setConcernTags(result.concernTags);
      setNeedsFollowUp(result.needsFollowUp);
      setFollowUpUrgency(result.followUpUrgency);

      // Cleanup (replacing finally block due to React Compiler limitations)
      setIsTranscribing(false);
      recorder.reset();
    } catch (transcribeError) {
      setAiError(
        isTranscribeServiceBusy(transcribeError)
          ? FRIENDLY_BUSY_MESSAGE
          : transcribeError instanceof Error
            ? transcribeError.message
            : "Couldn't transcribe that recording. Try again or type your note instead."
      );

      // Cleanup (replacing finally block due to React Compiler limitations)
      setIsTranscribing(false);
      recorder.reset();
    }
  }

  function findFirstMissingAnswer(): string | null {
    for (const entry of visibleEntries) {
      if (entry.component === "multi_select") continue;
      if (entry.component === "short_answer") continue;
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
        aiHeadline: aiHeadline ?? undefined,
        aiSummary: aiSummary ?? undefined,
        aiKeyPoints: aiKeyPoints.length > 0 ? aiKeyPoints : undefined,
        sentiment: sentiment ?? undefined,
        concernTags: concernTags.length > 0 ? concernTags : undefined,
        needsFollowUp: needsFollowUp || undefined,
        followUpUrgency: followUpUrgency !== "none" ? followUpUrgency : undefined,
      });

      // Cleanup (replacing finally block due to React Compiler limitations)
      setIsSubmitting(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit survey.");

      // Cleanup (replacing finally block due to React Compiler limitations)
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
          {voicePromptLabel || "Voice note"} {transcriptRequired ? "(required)" : "(optional)"}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRecordToggle}
            disabled={recorder.status === "requesting_permission" || isTranscribing}
            className={`relative flex w-fit items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-all duration-200 disabled:opacity-60 ${
              recorder.status === "recording"
                ? "border-destructive/40 bg-destructive/10 text-destructive dark:border-destructive/40 dark:bg-destructive/10 dark:text-destructive"
                : "border-border bg-card-alt text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary"
            }`}
          >
            {recorder.status === "recording" && (
              <span className="flex h-3.5 items-center gap-0.5">
                <span className="h-full w-0.5 animate-[bounce_1s_infinite_100ms] rounded-full bg-destructive" />
                <span className="h-full w-0.5 animate-[bounce_1s_infinite_300ms] rounded-full bg-destructive" />
                <span className="h-full w-0.5 animate-[bounce_1s_infinite_200ms] rounded-full bg-destructive" />
              </span>
            )}
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

        {recorder.status === "stopped" && recorder.audioBlob && (
          // eslint-disable-next-line jsx-a11y/media-has-caption -- transient voice note, no captions to attach
          <audio ref={audioRef} controls className="w-full">
            Your browser doesn&apos;t support audio playback.
          </audio>
        )}

        {(recorder.status === "denied" || recorder.status === "error") && recorder.errorMessage && (
          <p className="text-sm text-text-muted dark:text-text-muted">{recorder.errorMessage}</p>
        )}

        {aiError && <p className="text-sm text-destructive dark:text-destructive">{aiError}</p>}

        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Transcript will appear here — you can edit it, or type a note directly instead of recording."
          rows={3}
          className="rounded-lg border border-border bg-card-alt p-2 text-sm text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary"
        />

        {/* Intentionally no AI summary/analysis preview here — see the
            comment on the state declarations above. */}
      </div>

      <SignalPicker value={signal} onChange={setSignal} />

      {error && <p className="text-sm text-destructive dark:text-destructive">{error}</p>}
      {aiError && <p className="text-sm text-destructive dark:text-destructive">{aiError}</p>}

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
    return evaluateShowIf(entry.showIf, answer);
  });
}

/**
 * Parent can be single_select (answer: string), multi_select (answer:
 * string[]), or rating (answer: number) — evaluated differently per shape.
 * See ExitSurveyShowIf in types/exit-survey.ts for which field applies to
 * which parent type.
 */
function evaluateShowIf(
  showIf: NonNullable<ExitSurveyTemplateEntry["showIf"]>,
  answer: AnswerValue | undefined
): boolean {
  if (showIf.atLeast !== undefined) {
    return typeof answer === "number" && answer >= showIf.atLeast;
  }
  if (showIf.equals !== undefined) {
    const triggers = Array.isArray(showIf.equals) ? showIf.equals : [showIf.equals];
    if (typeof answer === "string") return triggers.includes(answer);
    if (Array.isArray(answer)) return answer.some((a) => triggers.includes(a));
  }
  return false;
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