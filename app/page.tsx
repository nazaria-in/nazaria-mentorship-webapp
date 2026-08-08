// app/page.tsx
"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Compass,
  FileCheck2,
  GraduationCap,
  MessageCircle,
  Sparkles,
  Users,
} from "lucide-react";

interface SocialIconProps {
  className?: string;
}

// lucide-react's Instagram/Linkedin glyphs aren't exported in this project's
// pinned version, so these are small local stand-ins instead of a dependency bump.
function Instagram({ className }: SocialIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}


function Linkedin({ className }: SocialIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.6c0-1.34-.03-3.07-1.87-3.07-1.87 0-2.16 1.46-2.16 2.97V21h-4V9Z" />
    </svg>
  );
}

type Audience = "mentee" | "mentor";

interface AudienceCopy {
  eyebrow: string;
  headline: string;
  subhead: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  features: { icon: ReactNode; title: string; body: string }[];
}

const AUDIENCE_COPY: Record<Audience, AudienceCopy> = {
  mentee: {
    eyebrow: "For mentees",
    headline: "From Kalakar to creative professional.",
    subhead: "Your story doesn't end with a film. It begins with a career.",
    body: "You've already learnt to tell stories. Now it's time to learn how to work with clients, collaborate in teams, receive feedback, and build a career doing what you love. Every assignment, every conversation, and every piece of feedback brings you one step closer to becoming a professional storyteller.",
    ctaLabel: "Start this week's challenge",
    ctaHref: "/auth/signup",
    features: [
      {
        icon: <FileCheck2 className="h-5 w-5" aria-hidden="true" />,
        title: "Weekly assignments",
        body: "Structured briefs with clear submission slots, so you always know what's due and what's next.",
      },
      {
        icon: <MessageCircle className="h-5 w-5" aria-hidden="true" />,
        title: "Real feedback, every week",
        body: "Your mentor reviews your work and leaves feedback you can act on before the next session.",
      },
      {
        icon: <Users className="h-5 w-5" aria-hidden="true" />,
        title: "A team that has your back",
        body: "You're never learning alone — your team, your mentor, and the Nazaria team are one message away.",
      },
    ],
  },
  mentor: {
    eyebrow: "For mentors",
    headline: "Building a more inclusive media industry, one mentor at a time.",
    subhead:
      "When talented young people have access to guidance, opportunity, and encouragement, entire communities gain new storytellers.",
    body: "Thank you for mentoring with Nazaria and helping talented young people develop the confidence, professionalism, and resilience they need to thrive in the creative industry. This hub keeps your mentoring lightweight — track assignments, leave feedback, and flag a check-in in minutes.",
    ctaLabel: "Go to mentor dashboard",
    ctaHref: "/auth/login",
    features: [
      {
        icon: <Compass className="h-5 w-5" aria-hidden="true" />,
        title: "One place for every mentee",
        body: "See who's on track, who submitted late, and who needs a nudge — without digging through chats.",
      },
      {
        icon: <FileCheck2 className="h-5 w-5" aria-hidden="true" />,
        title: "Review in context",
        body: "Every submission arrives next to the brief it answers, so feedback takes minutes, not meetings.",
      },
      {
        icon: <Sparkles className="h-5 w-5" aria-hidden="true" />,
        title: "A two-minute exit check-in",
        body: "After every session, a short form turns your read on the meeting into a signal the Nazaria team can act on.",
      },
    ],
  },
};

const HOW_IT_WORKS: { step: string; title: string; body: string }[] = [
  {
    step: "01",
    title: "Get matched to a team",
    body: "Every mentee joins a small team with a dedicated mentor for the length of the cohort.",
  },
  {
    step: "02",
    title: "Do the work, get the feedback",
    body: "Weekly assignments come with submission slots and a review cycle — nothing sits unreviewed.",
  },
  {
    step: "03",
    title: "Build a career, not just a portfolio",
    body: "Progress compounds into industry-ready skills: communication, accountability, professionalism.",
  },
];

const SIGNALS: { color: string; ring: string; label: string; body: string }[] = [
  {
    color: "bg-[#2f9e5c] dark:bg-[#4ade80]",
    ring: "ring-[#2f9e5c]/30 dark:ring-[#4ade80]/30",
    label: "On track",
    body: "The session happened, the work is moving, no follow-up needed.",
  },
  {
    color: "bg-[#e0b400] dark:bg-[#fde047]",
    ring: "ring-[#e0b400]/30 dark:ring-[#fde047]/30",
    label: "Facing a few challenges",
    body: "Something's slowing things down — worth a mentor associate keeping an eye on it.",
  },
  {
    color: "bg-[#b3392f] dark:bg-[#f87171]",
    ring: "ring-[#b3392f]/30 dark:ring-[#f87171]/30",
    label: "Needs a check-in",
    body: "The Nazaria team follows up directly — no one has to read every form to catch it.",
  },
];

export default function LandingPage() {
  const [audience, setAudience] = useState<Audience>("mentee");
  const copy = AUDIENCE_COPY[audience];

  return (
    <div className="min-h-screen bg-surface text-text-primary">
      {/* ---------------- Nav ---------------- */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-heading text-xl font-semibold text-text-primary">
              Nazaria
            </span>
            <span className="hidden text-sm text-text-muted sm:inline">
              Kalkaaar Career Readiness Hub
            </span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="rounded-full px-4 py-2 text-sm font-medium text-text-primary hover:bg-card transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* ---------------- Hero ---------------- */}
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-2 md:items-center md:py-24">
        <div>
          <span className="inline-flex items-center rounded-full border border-border-strong bg-card-alt px-3 py-1 text-xs font-medium uppercase tracking-wide text-text-accent">
            Kalkaaar Career Readiness Hub
          </span>
          <h1 className="mt-5 font-heading text-4xl font-semibold leading-tight text-text-primary sm:text-5xl">
            Your story doesn&apos;t end with a film.
            <span className="block text-text-accent">It begins with a career.</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-text-muted sm:text-lg">
            You&apos;ve already learnt to tell stories. Now learn to work with
            clients, collaborate in teams, take feedback, and build a career
            doing what you love — with your mentor, your peers, and the
            Nazaria team behind every step.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Ready for this week&apos;s challenge?
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 rounded-full border border-border-strong px-6 py-3 text-sm font-semibold text-text-primary hover:bg-card transition-colors"
            >
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
              I&apos;m mentoring
            </Link>
          </div>
        </div>

        {/* Signature element: the signal system, rendered as concentric rings */}
        <div className="flex justify-center md:justify-end">
          <div className="surface-card-strong flex w-full max-w-sm flex-col items-center gap-6 p-8 text-center">
            <p className="text-sm font-medium text-text-muted">
              Every check-in becomes one signal
            </p>
            <svg
              viewBox="0 0 200 200"
              className="h-40 w-40"
              role="img"
              aria-label="Three concentric rings representing the green, yellow, and red exit-survey signals"
            >
              <circle cx="100" cy="100" r="90" className="fill-none stroke-[#b3392f]/25 dark:stroke-[#f87171]/25" strokeWidth="16" />
              <circle cx="100" cy="100" r="62" className="fill-none stroke-[#e0b400]/35 dark:stroke-[#fde047]/35" strokeWidth="16" />
              <circle cx="100" cy="100" r="34" className="fill-[#2f9e5c] dark:fill-[#4ade80]" />
              <circle cx="100" cy="100" r="90" className="fill-none stroke-[#b3392f] dark:stroke-[#f87171] opacity-70" strokeWidth="3" strokeDasharray="6 14" />
            </svg>
            <div className="grid w-full gap-3 text-left">
              {SIGNALS.map((signal) => (
                <div key={signal.label} className="flex items-start gap-3">
                  <span
                    className={`mt-1 h-3 w-3 shrink-0 rounded-full ring-4 ${signal.color} ${signal.ring}`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{signal.label}</p>
                    <p className="text-xs text-text-muted">{signal.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Audience switch ---------------- */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div className="mx-auto flex w-fit rounded-full border border-border bg-card p-1">
          {(Object.keys(AUDIENCE_COPY) as Audience[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setAudience(key)}
              aria-pressed={audience === key}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                audience === key
                  ? "bg-primary text-primary-foreground"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {key === "mentee" ? "I'm a mentee" : "I'm a mentor"}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="surface-card p-8 sm:p-10">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-accent">
            {copy.eyebrow}
          </span>
          <h2 className="mt-3 font-heading text-2xl font-semibold text-text-primary sm:text-3xl">
            {copy.headline}
          </h2>
          <p className="mt-2 text-base font-medium text-text-muted">{copy.subhead}</p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-text-muted sm:text-base">
            {copy.body}
          </p>
          <Link
            href={copy.ctaHref}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            {copy.ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {copy.features.map((feature) => (
              <div key={feature.title} className="surface-card-alt">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-card-strong text-text-accent">
                  {feature.icon}
                </div>
                <p className="mt-3 text-sm font-semibold text-text-primary">{feature.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- How it works (real sequence, so numbers earn their place) ---------------- */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="font-heading text-2xl font-semibold text-text-primary sm:text-3xl">
            How the cohort works
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {HOW_IT_WORKS.map((item, i) => (
              <div key={item.step} className="relative pl-2">
                <span className="font-heading text-4xl font-semibold text-border-strong">
                  {item.step}
                </span>
                <h3 className="mt-2 text-base font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{item.body}</p>
                {i < HOW_IT_WORKS.length - 1 && (
                  <span
                    className="absolute right-[-1rem] top-3 hidden text-border-strong sm:block"
                    aria-hidden="true"
                  >
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Closing CTA ---------------- */}
      <section className="mx-auto max-w-6xl px-6 py-16 text-center">
        <h2 className="font-heading text-2xl font-semibold text-text-primary sm:text-3xl">
          Your mentor, your peers, and the Nazaria team are here for every step.
        </h2>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Create your account
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 rounded-full border border-border-strong px-6 py-3 text-sm font-semibold text-text-primary hover:bg-card transition-colors"
          >
            I already have an account
          </Link>
        </div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-border bg-card-alt">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-heading text-lg font-semibold text-text-primary">
              Nazaria Arts Foundation
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Shahid Pascal Colony, Shankarwadi, Jogeshwari (E)
              <br />
              Mumbai, Maharashtra 400060
            </p>
            <a
              href="mailto:us@nazariacollective.in"
              className="mt-1 inline-block text-sm text-text-accent hover:underline"
            >
              us@nazariacollective.in
            </a>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://www.instagram.com/nazaria.in/"
              target="_blank"
              rel="noreferrer"
              aria-label="Nazaria on Instagram"
              className="text-text-muted hover:text-text-accent transition-colors"
            >
              <Instagram className="h-5 w-5" aria-hidden="true" />
            </a>
            <a
              href="https://www.linkedin.com/company/nazaria-arts-collective/"
              target="_blank"
              rel="noreferrer"
              aria-label="Nazaria on LinkedIn"
              className="text-text-muted hover:text-text-accent transition-colors"
            >
              <Linkedin className="h-5 w-5" aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="border-t border-border px-6 py-4 text-center text-xs text-text-muted">
          © Nazaria Arts Foundation {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}