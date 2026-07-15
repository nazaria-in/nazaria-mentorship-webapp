// /lib/api/uploads.ts

import { createClient } from "@/lib/supabase/client";
import type { FileOrLinkValue } from "@/components/shared/FileOrLinkInput";

// Resolves either a pasted link or a picked File into a `files.id`.
// Link mode: just inserts a `files` row with file_type='link' and the url.
// File mode: uploads to Supabase Storage first, then inserts the `files` row
// pointing at the resulting public URL. Swap the bucket name for your project's.
export async function uploadFile(value: FileOrLinkValue): Promise<string> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not authenticated");

  if (value.kind === "link") {
    const { data, error } = await supabase
      .from("files")
      .insert({ url: value.url, file_type: "link", created_by: userId })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  if (!value.file) throw new Error("No file selected");
  const path = `${userId}/${Date.now()}-${value.file.name}`;
  const { error: uploadError } = await supabase.storage.from("submissions").upload(path, value.file);
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from("submissions").getPublicUrl(path);

  const { data, error } = await supabase
    .from("files")
    .insert({
      title: value.file.name,
      url: publicUrlData.publicUrl,
      file_type: "file",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}