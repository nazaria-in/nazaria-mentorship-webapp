// app/onboarding/page.tsx
import { redirect } from "next/navigation";

export default function onboarding_base(): never {
  redirect("/onboarding/role");
}