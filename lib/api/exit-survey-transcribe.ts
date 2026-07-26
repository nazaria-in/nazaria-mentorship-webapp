// /lib/api/exit-survey-transcribe.ts

import type { ExitSurveyAiAnalysis, ExitSurveyEntry } from "@/types/exit-survey";

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
    throw new Error(message);
  }

  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    typeof (data as Record<string, unknown>).transcript !== "string" ||
    typeof (data as Record<string, unknown>).summary !== "string"
  ) {
    throw new Error("Transcription response was malformed.");
  }

  return data as ExitSurveyAiAnalysis;
}