// lib/api/people-picker.ts

import { fetchPodMemberGroups, type FetchPodMemberGroupsParams } from "@/lib/api/pods";
import type { UserCardPerson } from "@/components/shared/UserCard";

export interface SelectablePerson extends UserCardPerson {
  podName: string;
  podId: string;
}

/**
 * Flattens fetchPodMemberGroups' pod-grouped shape into a flat list
 * PeopleGrid can consume, carrying podName/podId for groupBy="pod".
 * approvalStatus is hardcoded "approved" because fetchPodMemberGroups
 * defaults onlyApproved: true and doesn't return the real value — if that
 * default is ever changed to false, this needs revisiting.
 */
export async function fetchSelectablePeople(
  params: FetchPodMemberGroupsParams,
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
        podName: pod.name,
        podId: pod.id,
      });
    }
  }

  return people;
}