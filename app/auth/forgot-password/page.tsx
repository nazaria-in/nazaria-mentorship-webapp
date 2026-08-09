// app/auth/forgot-password/page.tsx
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <ForgotPasswordForm />
    </main>
  );
}