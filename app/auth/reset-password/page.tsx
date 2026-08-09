// app/auth/reset-password/page.tsx
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <ResetPasswordForm />
    </main>
  );
}