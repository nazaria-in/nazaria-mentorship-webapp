// /types/pods.ts

export interface PodMember {
  id: string;
  full_name: string;
}


export interface PodWithMembers {
  id: string;
  name: string;
  cohortId: string;
  cohortName?: string;
  members: PodMember[];
}