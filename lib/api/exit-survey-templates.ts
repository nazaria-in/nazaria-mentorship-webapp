// /lib/api/exit-survey-templates.ts

import { createClient } from "@/lib/supabase/client";
import type { ExitSurveyRole, ExitSurveyTemplate, ExitSurveyTemplateEntry } from "@/types/exit-survey";

export async function fetchTemplatesForRole(role: ExitSurveyRole): Promise<ExitSurveyTemplate[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exit_survey_templates")
    .select()
    .eq("role", role)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTemplateRow);
}

export interface SaveTemplateInput {
  title: string;
  role: ExitSurveyRole;
  questions: ExitSurveyTemplateEntry[];
  voicePromptLabel: string | null;
  createdBy: string;
}

export async function createTemplate(input: SaveTemplateInput): Promise<ExitSurveyTemplate> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exit_survey_templates")
    .insert({
      title: input.title,
      role: input.role,
      questions: input.questions,
      voice_prompt_label: input.voicePromptLabel,
      created_by: input.createdBy,
      is_active: false,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create template.");
  return mapTemplateRow(data);
}

export interface UpdateTemplateInput {
  title?: string;
  questions?: ExitSurveyTemplateEntry[];
  voicePromptLabel?: string | null;
}

export async function updateTemplate(
  templateId: string,
  input: UpdateTemplateInput
): Promise<ExitSurveyTemplate> {
  const supabase = createClient();
  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.questions !== undefined) updates.questions = input.questions;
  if (input.voicePromptLabel !== undefined) updates.voice_prompt_label = input.voicePromptLabel;

  const { data, error } = await supabase
    .from("exit_survey_templates")
    .update(updates)
    .eq("id", templateId)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to save template.");
  return mapTemplateRow(data);
}

/**
 * Activates this template and deactivates whatever was previously active
 * for the same role (the DB's partial unique index rejects two active rows
 * for one role at once, so deactivate has to happen first).
 */
export async function activateTemplate(templateId: string, role: ExitSurveyRole): Promise<void> {
  const supabase = createClient();

  const { error: deactivateError } = await supabase
    .from("exit_survey_templates")
    .update({ is_active: false })
    .eq("role", role)
    .eq("is_active", true);
  if (deactivateError) throw new Error(deactivateError.message);

  const { error: activateError } = await supabase
    .from("exit_survey_templates")
    .update({ is_active: true })
    .eq("id", templateId);
  if (activateError) throw new Error(activateError.message);
}

function mapTemplateRow(row: Record<string, unknown>): ExitSurveyTemplate {
  return {
    id: row.id as string,
    title: row.title as string,
    role: row.role as ExitSurveyRole,
    questions: row.questions as ExitSurveyTemplateEntry[],
    voicePromptLabel: (row.voice_prompt_label as string) ?? null,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
  };
}