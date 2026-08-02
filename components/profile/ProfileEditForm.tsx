// components/profile/ProfileEditForm.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateUserProfile } from "@/lib/api/auth";
import { useSessionStore } from "@/store/session-store";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30";

const textareaClass = `${inputClass} min-h-24 resize-y`;

interface ProfileRow {
  full_name: string | null;
  email: string | null;
  bio: string | null;
  background_notes: string | null;
  school_or_org: string | null;
  goals: string[] | null;
  interests: string[] | null;
}

export function ProfileEditForm() {
  const router = useRouter();
  const userId = useSessionStore((s) => s.userId);
  const hydrated = useSessionStore((s) => s.hydrated);
  const setFullName = useSessionStore((s) => s.setFullName);
  const clearSession = useSessionStore((s) => s.clearSession);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [fullName, setFullNameInput] = useState("");
  const [bio, setBio] = useState("");
  const [backgroundNotes, setBackgroundNotes] = useState("");
  const [goalsInput, setGoalsInput] = useState("");
  const [interestsInput, setInterestsInput] = useState("");
  const [schoolOrOrg, setSchoolOrOrg] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Profile fields (bio, goals, interests, etc.) don't live in the session
  // store — only userId/fullName/role do — so load the current row directly
  // once we have a userId.
  useEffect(() => {
    if (!userId) return;

    const controller = new AbortController();
    const supabase = createClient();

    async function loadProfile(): Promise<void> {
      const { data, error: fetchError } = await supabase
        .from("users")
        .select("full_name, email, bio, background_notes, school_or_org, goals, interests")
        .eq("id", userId)
        .single<ProfileRow>();

      if (controller.signal.aborted) return;

      if (fetchError || !data) {
        setLoadError("Couldn't load your profile. Try refreshing.");
        setLoading(false);
        return;
      }

      setFullNameInput(data.full_name ?? "");
      setEmail(data.email);
      setBio(data.bio ?? "");
      setBackgroundNotes(data.background_notes ?? "");
      setSchoolOrOrg(data.school_or_org ?? "");
      setGoalsInput((data.goals ?? []).join(", "));
      setInterestsInput((data.interests ?? []).join(", "));
      setLoading(false);
    }

    void loadProfile();

    return () => controller.abort();
  }, [userId]);

  const canSubmit = fullName.trim().length > 0 && bio.trim().length > 0 && !submitting && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !userId) return;

    setSubmitting(true);
    setError(null);
    setSavedAt(null);

    try {
      await updateUserProfile({
        userId,
        fullName: fullName.trim(),
        bio: bio.trim(),
        backgroundNotes: backgroundNotes.trim(),
        goals: splitList(goalsInput),
        interests: splitList(interestsInput),
        schoolOrOrg: schoolOrOrg.trim(),
      });
      setFullName(fullName.trim());
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your profile. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut(): Promise<void> {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Clear proactively rather than waiting for SessionProvider's
    // onAuthStateChange handler, so the UI doesn't flash stale data
    // before the redirect completes.
    clearSession();
    router.push("/auth/login");
  }

  if (!hydrated || loading) {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center text-sm text-text-muted shadow-sm">
        Loading your profile…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center text-sm text-destructive shadow-sm">
        {loadError}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm"
    >
      <h1 className="text-lg font-heading text-text-primary">Your profile</h1>
      {email && <p className="mt-1 text-sm text-muted-foreground">{email}</p>}

      <div className="mt-6 space-y-4">
        <Field label="Full name" htmlFor="fullName">
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullNameInput(e.target.value)}
            className={inputClass}
            required
          />
        </Field>

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
      {savedAt && !error && <p className="mt-4 text-sm text-text-accent">Saved.</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-6 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save changes"}
      </button>

      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={signingOut}
        className="mt-3 w-full rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
      >
        {signingOut ? "Signing out…" : "Sign out"}
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