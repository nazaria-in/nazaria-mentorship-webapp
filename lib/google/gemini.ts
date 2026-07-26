// /lib/google/gemini.ts

import { GoogleGenAI, Type } from "@google/genai";
import { EXIT_SURVEY_CONCERN_TAGS, type ExitSurveyAiAnalysis } from "@/types/exit-survey";

// Model name is env-configurable on purpose — Gemini model names shift
// often; check https://ai.google.dev/gemini-api/docs/models for the
// current recommended flash model before relying on this default.
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

let cachedClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

const ANALYSIS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    transcript: {
      type: Type.STRING,
      description: "Verbatim transcript of the audio, no formatting or preamble.",
    },
    summary: {
      type: Type.STRING,
      description:
        "3-5 sentence summary for a program manager who has not read the raw form. State concerns plainly.",
    },
    concernTags: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: [...EXIT_SURVEY_CONCERN_TAGS] },
      description: "Zero or more concern categories genuinely raised in the transcript or answers.",
    },
    needsFollowUp: {
      type: Type.BOOLEAN,
      description: "True if a PM or associate should proactively check in with this person.",
    },
    followUpUrgency: {
      type: Type.STRING,
      enum: ["none", "soon", "urgent"],
      description:
        "'urgent' = check in within a day (safety, crisis, explicit distress). 'soon' = check in this week. 'none' = no action needed.",
    },
  },
  required: ["transcript", "summary", "concernTags", "needsFollowUp", "followUpUrgency"],
};

/**
 * Single call: transcribes the audio AND analyzes it (together with the
 * structured form answers) for PM/associate triage.
 */
export async function analyzeExitSurveyAudio(
  audioBuffer: Buffer,
  mimeType: string,
  answersJson: string
): Promise<ExitSurveyAiAnalysis> {
  const client = getGeminiClient();

  console.log("[gemini] analyzeExitSurveyAudio: starting", {
    model: GEMINI_MODEL,
    mimeType,
    audioBytes: audioBuffer.length,
    answersJsonLength: answersJson.length,
  });

  const prompt = [
    "This is a voice note recorded at the end of a mentorship session, paired",
    "with the structured yes/no/rating answers the same person just submitted.",
    "",
    "1. Transcribe the audio verbatim.",
    "2. Write a short summary combining the transcript and the structured answers.",
    "3. Flag concern categories ONLY if genuinely supported by the content — do not",
    "   guess or pad the list. Empty array is a valid and expected outcome.",
    "4. Decide if a program manager or associate should follow up, and how urgently.",
    "",
    "Structured answers (JSON):",
    answersJson,
  ].join("\n");

  let response;
  try {
    response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { data: audioBuffer.toString("base64"), mimeType } },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_RESPONSE_SCHEMA,
      },
    });
  } catch (sdkError) {
    // The Gemini SDK often throws objects that don't stringify well via
    // .message alone (nested error.error.message from the REST response) —
    // log the whole thing so the real cause shows up in the server logs.
    console.error("[gemini] generateContent threw:", JSON.stringify(sdkError, null, 2));
    console.error("[gemini] generateContent threw (raw):", sdkError);
    const message =
      sdkError instanceof Error ? sdkError.message : "Gemini API call failed — see server logs.";
    throw new Error(`Gemini request failed: ${message}`);
  }

  console.log("[gemini] raw response text:", response.text?.slice(0, 500));
  if (!response.text) {
    // Empty text usually means a safety block or finishReason other than
    // STOP — log the full response so that's visible instead of guessing.
    console.error("[gemini] empty response, full object:", JSON.stringify(response, null, 2));
  }

  const rawText = response.text;
  if (!rawText) {
    throw new Error(
      "Gemini returned an empty response (likely blocked or filtered — check server logs for the full response)."
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (parseError) {
    console.error("[gemini] JSON.parse failed on:", rawText);
    throw new Error("Gemini response was not valid JSON.");
  }

  return validateAnalysis(parsed);
}

function validateAnalysis(value: unknown): ExitSurveyAiAnalysis {
  if (typeof value !== "object" || value === null) {
    throw new Error("Gemini analysis response was malformed.");
  }
  const obj = value as Record<string, unknown>;

  if (typeof obj.transcript !== "string" || typeof obj.summary !== "string") {
    throw new Error("Gemini analysis response was missing transcript or summary.");
  }
  if (!Array.isArray(obj.concernTags) || !obj.concernTags.every((t) => typeof t === "string")) {
    throw new Error("Gemini analysis response had malformed concernTags.");
  }
  if (typeof obj.needsFollowUp !== "boolean") {
    throw new Error("Gemini analysis response had malformed needsFollowUp.");
  }
  if (
    obj.followUpUrgency !== "none" &&
    obj.followUpUrgency !== "soon" &&
    obj.followUpUrgency !== "urgent"
  ) {
    throw new Error("Gemini analysis response had malformed followUpUrgency.");
  }

  return {
    transcript: obj.transcript,
    summary: obj.summary,
    concernTags: obj.concernTags as ExitSurveyAiAnalysis["concernTags"],
    needsFollowUp: obj.needsFollowUp,
    followUpUrgency: obj.followUpUrgency,
  };
}