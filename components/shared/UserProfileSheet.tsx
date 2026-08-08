// components/shared/UserProfileSheet.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/admin";

interface MeetingRow {
  id: string;
  title: string;
  starts_at: string;
  status: string;
}

interface AssignmentStatusRow {
  mentee_assignment_id: string;
  due_at: string;
  total_slots: number;
  approved_slots: number;
  completion_status: string;
}

interface ResourceRow {
  id: string;
  title: string;
  status: string;
}

interface ExitSurveyRow {
  id: string;
  signal: string | null;
  needs_follow_up: boolean;
  follow_up_urgency: string;
  created_at: string;
}

interface PodRow {
  pod_id: string;
  pod_name: string;
}

interface ResourceUpdateRow {
  id: string;
  progress_note: string;
  progress_percent: number | null;
  created_at: string;
}

function useUserRole(userId: string | null) {
  return useQuery({
    queryKey: ["user-role", userId],
    enabled: !!userId,
    queryFn: async (): Promise<{ full_name: string | null; role: UserRole; email: string | null } | null> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("users")
        .select("full_name, role, email")
        .eq("id", userId as string)
        .single();
      if (error) throw error;
      return data as { full_name: string | null; role: UserRole; email: string | null };
    },
  });
}

function useAssignments(userId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["user-activity-assignments", userId],
    enabled,
    queryFn: async (): Promise<AssignmentStatusRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("v_mentee_assignment_status")
        .select("*")
        .eq("mentee_id", userId as string)
        .order("due_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AssignmentStatusRow[];
    },
  });
}

function useResources(userId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["user-activity-resources", userId],
    enabled,
    queryFn: async (): Promise<ResourceRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("resources_and_courses")
        .select("id, title, status")
        .eq("assigned_to", userId as string)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ResourceRow[];
    },
  });
}

function useMeetings(userId: string | null) {
  return useQuery({
    queryKey: ["user-activity-meetings", userId],
    enabled: !!userId,
    queryFn: async (): Promise<MeetingRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("meeting_participants")
        .select("meetings(id, title, starts_at, status)")
        .eq("user_id", userId as string)
        .order("meetings(starts_at)", { ascending: false })
        .limit(20);
      if (error) throw error;
      return ((data ?? []) as unknown as Array<{ meetings: MeetingRow | null }>)
        .map((row) => row.meetings)
        .filter((m): m is MeetingRow => m !== null);
    },
  });
}

function useExitSurveysAsSubject(userId: string | null) {
  return useQuery({
    queryKey: ["user-activity-exit-surveys-subject", userId],
    enabled: !!userId,
    queryFn: async (): Promise<ExitSurveyRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("exit_surveys")
        .select("id, signal, needs_follow_up, follow_up_urgency, created_at")
        .eq("subject_user_id", userId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExitSurveyRow[];
    },
  });
}

function useExitSurveysAsSubmitter(userId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["user-activity-exit-surveys-submitter", userId],
    enabled,
    queryFn: async (): Promise<ExitSurveyRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("exit_surveys")
        .select("id, signal, needs_follow_up, follow_up_urgency, created_at")
        .eq("user_id", userId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExitSurveyRow[];
    },
  });
}

function usePods(userId: string | null) {
  return useQuery({
    queryKey: ["user-activity-pods", userId],
    enabled: !!userId,
    queryFn: async (): Promise<PodRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("v_user_pods")
        .select("pod_id, pod_name")
        .eq("user_id", userId as string);
      if (error) throw error;
      return (data ?? []) as PodRow[];
    },
  });
}

function useResourceUpdates(userId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["user-activity-resource-updates", userId],
    enabled,
    queryFn: async (): Promise<ResourceUpdateRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("resource_updates")
        .select("id, progress_note, progress_percent, created_at")
        .eq("mentee_id", userId as string)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as ResourceUpdateRow[];
    },
  });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-xl p-4 dark:bg-card dark:border-border">
      <h3 className="font-heading font-semibold text-text-primary mb-2 dark:text-text-primary">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card-alt border border-border rounded-lg p-3 text-sm text-text-primary dark:bg-card-alt dark:border-border dark:text-text-primary">
      {children}
    </div>
  );
}

/**
 * Reads the user id to display from the `?user=` query param — shareable
 * and deep-linkable without a dedicated route. Render this once near the
 * root of any admin page that uses UserActivityCard, or the People/Cohorts
 * browser.
 *
 * Shows different sections depending on role: mentees get
 * assignments/resources/resource-updates, mentors (and pm/associate) get
 * exit surveys they submitted. Everyone gets meetings, pod membership, and
 * exit surveys about them.
 */
export function UserProfileSheet() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = searchParams.get("user");

  const profile = useUserRole(userId);
  const role = profile.data?.role;
  const isMentee = role === "mentee";
  const isStaffOrMentor = role === "mentor" || role === "pm" || role === "associate";

  const assignments = useAssignments(userId, isMentee);
  const resources = useResources(userId, isMentee);
  const resourceUpdates = useResourceUpdates(userId, isMentee);
  const meetings = useMeetings(userId);
  const surveysAsSubject = useExitSurveysAsSubject(userId);
  const surveysAsSubmitter = useExitSurveysAsSubmitter(userId, isStaffOrMentor);
  const pods = usePods(userId);

  if (!userId) return null;

  const close = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("user");
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden="true" />
      <div className="relative w-full max-w-lg h-full overflow-y-auto bg-surface p-6 space-y-4 dark:bg-surface">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-xl font-semibold text-text-primary dark:text-text-primary">
              {profile.data?.full_name ?? "Loading…"}
            </h2>
            {profile.data && (
              <p className="text-sm text-text-muted dark:text-text-muted">
                {profile.data.role} · {profile.data.email ?? "no email"}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            className="text-text-muted hover:text-text-primary dark:text-text-muted dark:hover:text-text-primary"
          >
            Close
          </button>
        </div>

        {isMentee && (
          <>
            <Section title="Assignments">
              {assignments.isLoading && <p className="text-sm text-text-muted">Loading…</p>}
              {assignments.data?.length === 0 && (
                <p className="text-sm text-text-muted">No assignments yet.</p>
              )}
              <div className="space-y-2">
                {assignments.data?.map((a) => (
                  <Row key={a.mentee_assignment_id}>
                    {a.completion_status} · {a.approved_slots}/{a.total_slots} slots approved
                  </Row>
                ))}
              </div>
            </Section>

            <Section title="Resources">
              {resources.isLoading && <p className="text-sm text-text-muted">Loading…</p>}
              {resources.data?.length === 0 && (
                <p className="text-sm text-text-muted">No resources assigned yet.</p>
              )}
              <div className="space-y-2">
                {resources.data?.map((r) => (
                  <Row key={r.id}>
                    {r.title} · {r.status}
                  </Row>
                ))}
              </div>
            </Section>

            <Section title="Resource progress notes">
              {resourceUpdates.isLoading && <p className="text-sm text-text-muted">Loading…</p>}
              {resourceUpdates.data?.length === 0 && (
                <p className="text-sm text-text-muted">No progress notes yet.</p>
              )}
              <div className="space-y-2">
                {resourceUpdates.data?.map((u) => (
                  <Row key={u.id}>
                    {u.progress_note}
                    {u.progress_percent !== null ? ` · ${u.progress_percent}%` : ""}
                  </Row>
                ))}
              </div>
            </Section>
          </>
        )}

        <Section title="Meetings">
          {meetings.isLoading && <p className="text-sm text-text-muted">Loading…</p>}
          {meetings.data?.length === 0 && (
            <p className="text-sm text-text-muted">No meetings yet.</p>
          )}
          <div className="space-y-2">
            {meetings.data?.map((m) => (
              <Row key={m.id}>
                {m.title} · {new Date(m.starts_at).toLocaleDateString()} · {m.status}
              </Row>
            ))}
          </div>
        </Section>

        <Section title="Exit surveys (about them)">
          {surveysAsSubject.isLoading && <p className="text-sm text-text-muted">Loading…</p>}
          {surveysAsSubject.data?.length === 0 && (
            <p className="text-sm text-text-muted">None on file.</p>
          )}
          <div className="space-y-2">
            {surveysAsSubject.data?.map((s) => (
              <Row key={s.id}>
                signal: {s.signal ?? "—"} · urgency: {s.follow_up_urgency}
              </Row>
            ))}
          </div>
        </Section>

        {isStaffOrMentor && (
          <Section title="Exit surveys (submitted by them)">
            {surveysAsSubmitter.isLoading && <p className="text-sm text-text-muted">Loading…</p>}
            {surveysAsSubmitter.data?.length === 0 && (
              <p className="text-sm text-text-muted">None submitted yet.</p>
            )}
            <div className="space-y-2">
              {surveysAsSubmitter.data?.map((s) => (
                <Row key={s.id}>
                  signal: {s.signal ?? "—"} · urgency: {s.follow_up_urgency}
                </Row>
              ))}
            </div>
          </Section>
        )}

        <Section title="Teams">
          {pods.isLoading && <p className="text-sm text-text-muted">Loading…</p>}
          {pods.data?.length === 0 && (
            <p className="text-sm text-text-muted">Not on a team yet.</p>
          )}
          <div className="space-y-2">
            {pods.data?.map((p) => <Row key={p.pod_id}>{p.pod_name}</Row>)}
          </div>
        </Section>
      </div>
    </div>
  );
}