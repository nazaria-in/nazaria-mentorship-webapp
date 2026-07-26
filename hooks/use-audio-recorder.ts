// /hooks/use-audio-recorder.ts
"use client";

import { useCallback, useRef, useState } from "react";

export type RecordingStatus = "idle" | "requesting_permission" | "recording" | "stopped" | "denied" | "error";

interface UseAudioRecorderResult {
  status: RecordingStatus;
  audioBlob: Blob | null;
  errorMessage: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

/**
 * Records audio via MediaRecorder. Does not persist anything itself —
 * caller is responsible for uploading `audioBlob` to the transcribe route
 * and discarding it afterward, since we don't store voice files.
 */
export function useAudioRecorder(): UseAudioRecorderResult {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    setErrorMessage(null);
    setAudioBlob(null);
    setStatus("requesting_permission");

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setErrorMessage("Recording isn't supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setStatus("stopped");
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      recorder.start();
      setStatus("recording");
    } catch (err) {
      // NotAllowedError (denied), NotFoundError (no mic), etc. all land here.
      const isDenied = err instanceof DOMException && err.name === "NotAllowedError";
      setStatus(isDenied ? "denied" : "error");
      setErrorMessage(
        isDenied
          ? "Microphone access was denied. You can still submit without a voice note."
          : "Couldn't access the microphone. You can still submit without a voice note."
      );
    }
  }, []);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setAudioBlob(null);
    setErrorMessage(null);
    chunksRef.current = [];
  }, []);

  return { status, audioBlob, errorMessage, start, stop, reset };
}