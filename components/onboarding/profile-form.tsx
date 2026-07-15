// components/onboarding/profile-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateUserProfile } from "@/lib/api/auth";
import { useSessionStore } from "@/store/session-store";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30";

const textareaClass = `${inputClass} min-h-24 resize-y`;

export function ProfileForm() {
  const router = useRouter();
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);

  const [bio, setBio] = useState("");
  const [backgroundNotes, setBackgroundNotes] = useState("");
  const [goalsInput, setGoalsInput] = useState("");
  const [interestsInput, setInterestsInput] = useState("");
  const [schoolOrOrg, setSchoolOrOrg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const canSubmit = bio.trim().length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !userId) return;

    setSubmitting(true);
    setError(null);
    try {
      await updateUserProfile({
        userId,
        fullName: useSessionStore.getState().fullName || undefined,
        bio: bio.trim(),
        backgroundNotes: backgroundNotes.trim(),
        goals: splitList(goalsInput),
        interests: splitList(interestsInput),
        schoolOrOrg: schoolOrOrg.trim(),
      });
      if (role === "mentee"){ router.push("/dashboard/mentee"); }
      router.push(role === "mentor" ? "/pending-approval" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your profile. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm"
    >
      <h1 className="text-lg font-heading text-text-primary">Tell us about yourself</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        This helps your {role === "mentor" ? "PM" : "mentor"} understand where you&apos;re coming from.
      </p>

      <div className="mt-6 space-y-4">
        <Field label="Bio" htmlFor="bio">
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className={textareaClass}
            placeholder="A couple sentences about who you are."
            required
          />
        </Field>

        <Field label="Background" htmlFor="backgroundNotes" optional>
          <textarea
            id="backgroundNotes"
            value={backgroundNotes}
            onChange={(e) => setBackgroundNotes(e.target.value)}
            className={textareaClass}
            placeholder="Relevant experience, skills, or context."
          />
        </Field>

        <Field label="School or organization" htmlFor="schoolOrOrg" optional>
          <input
            id="schoolOrOrg"
            type="text"
            value={schoolOrOrg}
            onChange={(e) => setSchoolOrOrg(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Goals" htmlFor="goals" optional hint="Comma-separated">
          <input
            id="goals"
            type="text"
            value={goalsInput}
            onChange={(e) => setGoalsInput(e.target.value)}
            className={inputClass}
            placeholder="Learn video editing, build a portfolio"
          />
        </Field>

        <Field label="Interests" htmlFor="interests" optional hint="Comma-separated">
          <input
            id="interests"
            type="text"
            value={interestsInput}
            onChange={(e) => setInterestsInput(e.target.value)}
            className={inputClass}
            placeholder="Photography, documentary film"
          />
        </Field>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-6 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Finish setup"}
      </button>
    </form>
  );
}

function splitList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function Field({
  label,
  htmlFor,
  children,
  optional,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  optional?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-text-primary">
        <span>
          {label} {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
        </span>
        {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
      </label>
      {children}
    </div>
  );
}