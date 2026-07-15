// components/auth/password-strength-meter.tsx
"use client";

import { Check, X } from "lucide-react";
import { PASSWORD_CHECKS, getPasswordStrength } from "@/lib/validations/password";
import { cn } from "@/lib/utils";

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const { passed, total } = getPasswordStrength(password);
  const filled = password.length === 0 ? 0 : passed;

  return (
    <div className="mt-3 space-y-2.5">
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i < filled ? strengthColor(filled, total) : "bg-border dark:bg-white/10",
            )}
          />
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {PASSWORD_CHECKS.map((check) => {
          const ok = password.length > 0 && check.test(password);
          return (
            <li
              key={check.id}
              className={cn(
                "flex items-center gap-1.5 text-xs",
                ok ? "text-text-primary" : "text-muted-foreground",
              )}
            >
              {ok ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-text-accent" />
              ) : (
                <X className="h-3.5 w-3.5 shrink-0 opacity-40 dark:opacity-30" />
              )}
              {check.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function strengthColor(filled: number, total: number) {
  const ratio = filled / total;
  if (ratio < 0.4) return "bg-destructive";
  if (ratio < 0.8) return "bg-accent dark:bg-accent";
  return "bg-primary";
}