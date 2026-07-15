// app/auth/signup/page.tsx
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <SignupForm />
    </main>
  );
}