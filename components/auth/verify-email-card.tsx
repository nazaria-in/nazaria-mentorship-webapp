// components/auth/verify-email-card.tsx
import { SiGmail } from "react-icons/si";

interface VerifyEmailCardProps {
  email: string;
}

const GMAIL_URL = "https://mail.google.com/mail/u/0/#inbox";

export function VerifyEmailCard({ email }: VerifyEmailCardProps) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm dark:shadow-none">
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted dark:bg-white/10">
        <span className="flex items-center justify-center rounded-md bg-white p-1"><SiGmail className="h-6 w-6 text-red-500" /></span>
      </div>

      <h1 className="text-lg font-heading text-text-primary">Check your inbox</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        We sent a confirmation link to{" "}
        <span className="font-medium text-text-primary">{email}</span>. Open Gmail
        and click the link to verify your account.
      </p>

      <a
        href={GMAIL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <span className="flex items-center justify-center rounded-md bg-white p-1"><SiGmail className="h-6 w-6 text-red-500" /> </span>
        Go to Gmail
      </a>

      <p className="mt-5 text-xs text-muted-foreground">
        Didn&apos;t get it? Check spam, or come back to this page after resending.
      </p>
    </div>
  );
}

