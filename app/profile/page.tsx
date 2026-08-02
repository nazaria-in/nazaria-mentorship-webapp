// app/profile/page.tsx
import { ProfileEditForm } from "@/components/profile/ProfileEditForm";

export default function ProfilePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <ProfileEditForm />
    </main>
  );
}