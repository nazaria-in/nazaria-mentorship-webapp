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
    headline: {
      type: Type.STRING,
      description: "One short sentence (under 12 words) capturing the single most important takeaway.",
    },
    summary: {
      type: Type.STRING,
      description:
        "3-5 sentence summary for a program manager who has not read the raw form. State concerns plainly.",
    },
    keyPoints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-5 short bullet points, each a standalone fact or observation. Empty array is fine if there's nothing beyond the headline.",
    },
    sentiment: {
      type: Type.STRING,
      enum: ["positive", "neutral", "negative"],
      description: "Overall emotional tone of the session as described, independent of the self-reported signal.",
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
  required: [
    "transcript",
    "headline",
    "summary",
    "keyPoints",
    "sentiment",
    "concernTags",
    "needsFollowUp",
    "followUpUrgency",
  ],
};

/**
 * Single call: transcribes the audio AND analyzes it (together with the
 * structured form answers) for PM/associate triage. This entire result is
 * structured data — no field is meant to be read as unstructured prose by
 * the UI; headline/sentiment/keyPoints/concernTags/followUpUrgency all
 * render as distinct UI elements (cards, badges, chips) rather than a
 * paragraph someone has to parse.
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
  });

  const prompt = [
    "This is a voice note recorded at the end of a mentorship session, paired",
    "with the structured yes/no/rating answers the same person just submitted.",
    "",
    "1. Transcribe the audio verbatim.",
    "2. Write a one-sentence headline capturing the single most important takeaway.",
    "3. Write a short summary combining the transcript and the structured answers.",
    "4. List 2-5 standalone key points (can be empty if the headline covers it all).",
    "5. Judge overall sentiment: positive, neutral, or negative.",
    "6. Flag concern categories ONLY if genuinely supported by the content — do not",
    "   guess or pad the list. Empty array is a valid and expected outcome.",
    "7. Decide if a program manager or associate should follow up, and how urgently.",
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
    console.error("[gemini] generateContent threw:", JSON.stringify(sdkError, null, 2));
    console.error("[gemini] generateContent threw (raw):", sdkError);
    const message =
      sdkError instanceof Error ? sdkError.message : "Gemini API call failed — see server logs.";
    throw new Error(`Gemini request failed: ${message}`);
  }

  if (!response.text) {
    console.error("[gemini] empty response, full object:", JSON.stringify(response, null, 2));
    throw new Error(
      "Gemini returned an empty response (likely blocked or filtered — check server logs)."
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.text);
  } catch {
    console.error("[gemini] JSON.parse failed on:", response.text);
    throw new Error("Gemini response was not valid JSON.");
  }

  return validateAnalysis(parsed);
}

function validateAnalysis(value: unknown): ExitSurveyAiAnalysis {
  if (typeof value !== "object" || value === null) {
    throw new Error("Gemini analysis response was malformed.");
  }
  const obj = value as Record<string, unknown>;

  if (
    typeof obj.transcript !== "string" ||
    typeof obj.headline !== "string" ||
    typeof obj.summary !== "string"
  ) {
    throw new Error("Gemini analysis response was missing transcript, headline, or summary.");
  }
  if (!Array.isArray(obj.keyPoints) || !obj.keyPoints.every((k) => typeof k === "string")) {
    throw new Error("Gemini analysis response had malformed keyPoints.");
  }
  if (obj.sentiment !== "positive" && obj.sentiment !== "neutral" && obj.sentiment !== "negative") {
    throw new Error("Gemini analysis response had malformed sentiment.");
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
    headline: obj.headline,
    summary: obj.summary,
    keyPoints: obj.keyPoints as string[],
    sentiment: obj.sentiment,
    concernTags: obj.concernTags as ExitSurveyAiAnalysis["concernTags"],
    needsFollowUp: obj.needsFollowUp,
    followUpUrgency: obj.followUpUrgency,
  };
}