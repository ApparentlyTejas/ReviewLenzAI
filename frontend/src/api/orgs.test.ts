import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from "./client";
import {
  createOrganization,
  inviteMember,
  listMembers,
  listOrganizations,
  removeMember,
  updateMemberRole,
} from "./orgs";

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;
const mockedPost = apiClient.post as unknown as ReturnType<typeof vi.fn>;
const mockedDelete = apiClient.delete as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.clearAllMocks();
});

describe("orgs api", () => {
  it("listOrganizations returns the org list", async () => {
    const orgs = [{ id: 1, name: "Acme" }];
    mockedGet.mockResolvedValueOnce({ data: orgs });

    await expect(listOrganizations()).resolves.toEqual(orgs);
    expect(mockedGet).toHaveBeenCalledWith("/orgs");
  });

  it("listOrganizations propagates errors", async () => {
    const error = { response: { status: 500 } };
    mockedGet.mockRejectedValueOnce(error);
    await expect(listOrganizations()).rejects.toBe(error);
  });

  it("createOrganization posts the org name", async () => {
    const org = { id: 2, name: "New Org" };
    mockedPost.mockResolvedValueOnce({ data: org });

    await expect(createOrganization("New Org")).resolves.toEqual(org);
    expect(mockedPost).toHaveBeenCalledWith("/orgs", { name: "New Org" });
  });

  it("listMembers returns the member list for an org", async () => {
    const members = [{ user_id: 1, email: "a@example.com", role: "owner" }];
    mockedGet.mockResolvedValueOnce({ data: members });

    await expect(listMembers(5)).resolves.toEqual(members);
    expect(mockedGet).toHaveBeenCalledWith("/orgs/5/members");
  });

  it("inviteMember posts the email and role", async () => {
    const member = { user_id: 2, email: "b@example.com", role: "member" };
    mockedPost.mockResolvedValueOnce({ data: member });

    await expect(inviteMember(5, "b@example.com", "member")).resolves.toEqual(member);
    expect(mockedPost).toHaveBeenCalledWith("/orgs/5/members", { email: "b@example.com", role: "member" });
  });

  it("inviteMember propagates a validation error", async () => {
    const error = { response: { status: 422, data: { detail: "invalid email" } } };
    mockedPost.mockRejectedValueOnce(error);
    await expect(inviteMember(5, "bad", "member")).rejects.toBe(error);
  });

  it("updateMemberRole posts the new role", async () => {
    const member = { user_id: 2, email: "b@example.com", role: "admin" };
    mockedPost.mockResolvedValueOnce({ data: member });

    await expect(updateMemberRole(5, 2, "admin")).resolves.toEqual(member);
    expect(mockedPost).toHaveBeenCalledWith("/orgs/5/members/2/role", { role: "admin" });
  });

  it("removeMember calls DELETE on the member path", async () => {
    mockedDelete.mockResolvedValueOnce({ data: undefined });
    await removeMember(5, 2);
    expect(mockedDelete).toHaveBeenCalledWith("/orgs/5/members/2");
  });

  it("removeMember propagates a forbidden error", async () => {
    const error = { response: { status: 403 } };
    mockedDelete.mockRejectedValueOnce(error);
    await expect(removeMember(5, 2)).rejects.toBe(error);
  });
});
