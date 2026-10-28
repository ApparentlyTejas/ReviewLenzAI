import { apiClient } from "./client";
import type { MembershipRole, OrgMember, Organization } from "../types";

export async function listOrganizations(): Promise<Organization[]> {
  const { data } = await apiClient.get<Organization[]>("/orgs");
  return data;
}

export async function createOrganization(name: string): Promise<Organization> {
  const { data } = await apiClient.post<Organization>("/orgs", { name });
  return data;
}

export async function listMembers(orgId: number): Promise<OrgMember[]> {
  const { data } = await apiClient.get<OrgMember[]>(`/orgs/${orgId}/members`);
  return data;
}

export async function inviteMember(orgId: number, email: string, role: MembershipRole): Promise<OrgMember> {
  const { data } = await apiClient.post<OrgMember>(`/orgs/${orgId}/members`, { email, role });
  return data;
}

export async function updateMemberRole(orgId: number, userId: number, role: MembershipRole): Promise<OrgMember> {
  const { data } = await apiClient.post<OrgMember>(`/orgs/${orgId}/members/${userId}/role`, { role });
  return data;
}

export async function removeMember(orgId: number, userId: number): Promise<void> {
  await apiClient.delete(`/orgs/${orgId}/members/${userId}`);
}
