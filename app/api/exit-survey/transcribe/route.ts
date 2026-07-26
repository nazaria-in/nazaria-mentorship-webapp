// /app/api/exit-survey/transcribe/route.ts

import { NextRequest, NextResponse } from "next/server";
import { analyzeExitSurveyAudio } from "@/lib/google/gemini";

// We never write the audio to storage or disk — it's read into memory,
// sent to Gemini, and discarded when this request finishes.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const audioFile = formData.get("audio");
  const answersJson = formData.get("answers");

  if (!(audioFile instanceof Blob)) {
    console.error("[transcribe route] missing audio file in form data");
    return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
  }
  if (typeof answersJson !== "string") {
    console.error("[transcribe route] missing answers field in form data");
    return NextResponse.json({ error: "Missing answers." }, { status: 400 });
  }

  console.log("[transcribe route] request received", {
    audioType: audioFile.type,
    audioSize: audioFile.size,
    answersJsonPreview: answersJson.slice(0, 200),
  });

  try {
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const mimeType = audioFile.type || "audio/webm";

    const analysis = await analyzeExitSurveyAudio(audioBuffer, mimeType, answersJson);

    console.log("[transcribe route] success", {
      transcriptLength: analysis.transcript.length,
      concernTags: analysis.concernTags,
      followUpUrgency: analysis.followUpUrgency,
    });

    return NextResponse.json(analysis);
  } catch (error) {
    // Log the full error server-side (message + stack) — the client only
    // ever sees a generic message, so this is the only place to see why
    // a given request actually failed.
    console.error("[transcribe route] failed:", error);
    if (error instanceof Error) {
      console.error("[transcribe route] error name:", error.name);
      console.error("[transcribe route] error message:", error.message);
      console.error("[transcribe route] error stack:", error.stack);
    }

    const message = error instanceof Error ? error.message : "Transcription failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}