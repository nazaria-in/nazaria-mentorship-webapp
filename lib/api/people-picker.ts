// /lib/api/people-picker.ts

import { fetchPodMemberGroups, type FetchPodMemberGroupsParams } from "@/lib/api/pods";
import type { UserCardPerson } from "@/components/shared/UserCard";

export interface SelectablePerson extends UserCardPerson {
  podName: string;
  podId: string;
  cohortId: string | null;
  cohortName: string | null;
}

export interface FetchSelectablePeopleParams extends FetchPodMemberGroupsParams {
  /**
   * ASSUMPTION: fetchPodMemberGroups scopes to a single mentor's pods when
   * mentorId is set (existing behavior). Staff (associate/pm) callers pass
   * mentorId: undefined to get every pod across every cohort — same param,
   * just omitted. If fetchPodMemberGroups doesn't already treat a missing
   * mentorId as "unscoped", it needs that branch added there.
   */
  mentorId?: string;
  /** Narrows to one cohort. Omit to fetch across all cohorts. */
  cohortId?: string;
}

/**
 * Flattens fetchPodMemberGroups' pod-grouped shape into a flat list
 * PeopleGrid can consume. Carries both podName/podId (for groupBy="pod")
 * and cohortId/cohortName (for groupBy="cohort") — same flat array can
 * back either grouping in PeopleGrid without a second fetch.
 *
 * ASSUMPTION: each pod group returned by fetchPodMemberGroups carries
 * cohortId alongside the existing cohortName. If it currently only
 * returns cohortName, add cohortId there too — grouping and "select all
 * in cohort" both need a stable id, not just the display label.
 *
 * approvalStatus is hardcoded "approved" because fetchPodMemberGroups
 * defaults onlyApproved: true and doesn't return the real value — if that
 * default is ever changed to false, this needs revisiting.
 */
export async function fetchSelectablePeople(
  params: FetchSelectablePeopleParams,
  search?: string
): Promise<SelectablePerson[]> {
  const pods = await fetchPodMemberGroups(params);
  const term = search?.trim().toLowerCase();
  const people: SelectablePerson[] = [];

  for (const pod of pods) {
    for (const member of pod.members) {
      if (term && !member.full_name.toLowerCase().includes(term)) continue;
      people.push({
        id: member.id,
        fullName: member.full_name,
        role: params.role,
        approvalStatus: "approved",
        podName: pod.cohortName ? `${pod.cohortName} — ${pod.name}` : pod.name,
        podId: pod.id,
        cohortId: pod.cohortId ?? null,
        cohortName: pod.cohortName ?? null,
      });
    }
  }

  return people;
}