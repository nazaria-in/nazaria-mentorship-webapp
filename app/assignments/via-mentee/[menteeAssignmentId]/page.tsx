// /app/assignments/via-mentee/[menteeAssignmentId]/page.tsx
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface PageProps {
  params: Promise<{ menteeAssignmentId: string }>;
}

export default async function ViaMenteeAssignmentPage({ params }: PageProps) {
  const { menteeAssignmentId } = await params;

  const { data, error } = await supabaseAdmin
    .from("mentee_assignments")
    .select("assignment_id")
    .eq("id", menteeAssignmentId)
    .maybeSingle();

  if (error || !data) {
    redirect("/assignments");
  }

  redirect(`/assignments/${data.assignment_id as string}`);
}