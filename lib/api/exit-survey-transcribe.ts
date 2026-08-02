// /lib/api/exit-survey-transcribe.ts

import type { ExitSurveyAiAnalysis, ExitSurveyEntry } from "@/types/exit-survey";

/** Thrown by transcribeAudio — carries the HTTP status so callers can
 * distinguish "service is busy/out of quota" from other failures without
 * parsing message text. */
export class TranscribeError extends Error {
  status: number | null;
  constructor(message: string, status: number | null) {
    super(message);
    this.name = "TranscribeError";
    this.status = status;
  }
}

/**
 * Posts the recorded audio blob (plus answers so far) to the transcribe
 * route and gets back the full analysis in one call. Audio is never
 * persisted anywhere — sent, processed, and discarded server-side.
 */
export async function transcribeAudio(
  audioBlob: Blob,
  answersSoFar: ExitSurveyEntry[]
): Promise<ExitSurveyAiAnalysis> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "exit-survey-note.webm");
  formData.append("answers", JSON.stringify(answersSoFar));

  const response = await fetch("/api/exit-survey/transcribe", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === "object" && typeof (body as Record<string, unknown>).error === "string"
        ? (body as { error: string }).error
        : `Transcription failed (${response.status}).`;
    throw new TranscribeError(message, response.status);
  }

  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    typeof (data as Record<string, unknown>).transcript !== "string" ||
    typeof (data as Record<string, unknown>).summary !== "string"
  ) {
    throw new TranscribeError("Transcription response was malformed.", null);
  }

  return data as ExitSurveyAiAnalysis;
}

/** Status codes / message fragments that typically mean "the AI provider
 * is overloaded or we're out of quota" rather than a real client error. */
const BUSY_STATUS_CODES = new Set([429, 503, 502, 504]);
const BUSY_MESSAGE_HINTS = ["overloaded", "quota", "rate limit", "rate-limited", "capacity", "unavailable"];

export function isTranscribeServiceBusy(error: unknown): boolean {
  if (!(error instanceof TranscribeError)) return false;
  if (error.status !== null && BUSY_STATUS_CODES.has(error.status)) return true;
  const lower = error.message.toLowerCase();
  return BUSY_MESSAGE_HINTS.some((hint) => lower.includes(hint));
}