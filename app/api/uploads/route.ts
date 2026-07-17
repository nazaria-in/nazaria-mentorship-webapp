// /app/api/uploads/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { makeFilePubliclyViewable, uploadFile as uploadToDrive } from "@/lib/google/drive-files";
import {
  resolveAssignmentMenteeFolder,
  resolveResourceMenteeFolder,
} from "@/lib/google/drive-folders";

export const runtime = "nodejs"; // needs Buffer + server env secrets, not edge

type FileLinkType = "file" | "image" | "document" | "other";

function mimeTypeToFileType(mimeType: string): FileLinkType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf" || mimeType.includes("document") || mimeType.includes("text")) {
    return "document";
  }
  return "file";
}

interface PodCohortRow {
  pod: {
    id: string;
    name: string;
    cohort: { id: string; name: string } | null;
  } | null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();

  if (authError || !userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const contextKind = formData.get("contextKind");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    let folderId: string;

    if (contextKind === "assignment_submission") {
      const menteeAssignmentId = formData.get("menteeAssignmentId");
      if (typeof menteeAssignmentId !== "string") {
        return NextResponse.json({ error: "Missing menteeAssignmentId" }, { status: 400 });
      }

      const { data: ma, error: maError } = await supabase
        .from("mentee_assignments")
        .select("mentee_id, assignment_id")
        .eq("id", menteeAssignmentId)
        .single();
      if (maError || !ma) throw new Error("Assignment dispatch not found");

      const [assignmentRes, menteeRes, podRes] = await Promise.all([
        supabase.from("assignments").select("title").eq("id", ma.assignment_id).single(),
        supabase.from("users").select("full_name").eq("id", ma.mentee_id).single(),
        supabase
          .from("pod_members")
          .select("pod:pods(id, name, cohort:cohorts(id, name))")
          .eq("user_id", ma.mentee_id)
          .limit(1)
          .maybeSingle<PodCohortRow>(),
      ]);

      if (assignmentRes.error || !assignmentRes.data) throw new Error("Assignment not found");
      if (menteeRes.error || !menteeRes.data) throw new Error("Mentee not found");
      if (podRes.error || !podRes.data?.pod) {
        throw new Error("Mentee isn't assigned to a pod yet — can't resolve Drive folder path");
      }
      const pod = podRes.data.pod;
      if (!pod.cohort) throw new Error("Pod has no cohort — can't resolve Drive folder path");

      folderId = await resolveAssignmentMenteeFolder({
        cohortName: pod.cohort.name,
        cohortId: pod.cohort.id,
        podName: pod.name,
        podId: pod.id,
        assignmentTitle: assignmentRes.data.title,
        assignmentId: ma.assignment_id,
        menteeName: menteeRes.data.full_name?.trim() || "Unnamed mentee",
        menteeId: ma.mentee_id,
      });
    } else if (contextKind === "resource_update") {
      const resourceId = formData.get("resourceId");
      const menteeId = formData.get("menteeId");
      if (typeof resourceId !== "string" || typeof menteeId !== "string") {
        return NextResponse.json({ error: "Missing resourceId/menteeId" }, { status: 400 });
      }

      const [resourceRes, menteeRes, podRes] = await Promise.all([
        supabase.from("resources_and_courses").select("title").eq("id", resourceId).single(),
        supabase.from("users").select("full_name").eq("id", menteeId).single(),
        supabase
          .from("pod_members")
          .select("pod:pods(id, name, cohort:cohorts(id, name))")
          .eq("user_id", menteeId)
          .limit(1)
          .maybeSingle<PodCohortRow>(),
      ]);

      if (resourceRes.error || !resourceRes.data) throw new Error("Resource not found");
      if (menteeRes.error || !menteeRes.data) throw new Error("Mentee not found");
      if (podRes.error || !podRes.data?.pod) {
        throw new Error("Mentee isn't assigned to a pod yet — can't resolve Drive folder path");
      }
      const pod = podRes.data.pod;
      if (!pod.cohort) throw new Error("Pod has no cohort — can't resolve Drive folder path");

      folderId = await resolveResourceMenteeFolder({
        cohortName: pod.cohort.name,
        cohortId: pod.cohort.id,
        podName: pod.name,
        podId: pod.id,
        resourceTitle: resourceRes.data.title,
        resourceId,
        menteeName: menteeRes.data.full_name?.trim() || "Unnamed mentee",
        menteeId,
      });
    } else {
      return NextResponse.json({ error: "Unknown contextKind" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type || "application/octet-stream" });

    const driveFile = await uploadToDrive({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      data: blob,
      parentFolderId: folderId,
    });
    await makeFilePubliclyViewable(driveFile.id);


    const fileUrl = driveFile.webViewLink ?? driveFile.webContentLink ?? "";

    const { data: fileRow, error: insertError } = await supabase
      .from("files")
      .insert({
        title: file.name,
        url: fileUrl,
        file_type: mimeTypeToFileType(file.type || ""),
        created_by: userData.user.id,
      })
      .select("id")
      .single();

    if (insertError || !fileRow) throw new Error("Failed to save file record");

    return NextResponse.json({ fileId: fileRow.id, url: fileUrl });
  } catch (err) {
    console.error("[uploads] failed:", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}