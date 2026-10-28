import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { motion } from "framer-motion";
import { useAuth } from "../auth/AuthContext";
import { getActiveOrgId, setActiveOrgId } from "../api/client";
import { createOrganization, inviteMember, listMembers, listOrganizations, removeMember, updateMemberRole } from "../api/orgs";
import { BackButton } from "../components/BackButton";
import { pageTransition } from "../components/pageTransition";
import { useToast } from "../components/Toast";
import { usePageTitle } from "../hooks/usePageTitle";
import type { MembershipRole } from "../types";

const MANAGE_ROLES: MembershipRole[] = ["owner", "admin"];

export function Team() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  usePageTitle("Team");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MembershipRole>("member");
  const [newOrgName, setNewOrgName] = useState("");
  const [showNewOrgForm, setShowNewOrgForm] = useState(false);

  const { data: orgs } = useQuery({ queryKey: ["orgs"], queryFn: listOrganizations });
  const activeOrgId = getActiveOrgId() ?? orgs?.[0]?.id ?? null;
  const activeOrg = orgs?.find((o) => o.id === activeOrgId) ?? orgs?.[0];

  const { data: members } = useQuery({
    queryKey: ["org-members", activeOrg?.id],
    queryFn: () => listMembers(activeOrg!.id),
    enabled: !!activeOrg,
  });

  const canManage = activeOrg ? MANAGE_ROLES.includes(activeOrg.role) : false;

  function switchOrg(orgId: number) {
    setActiveOrgId(orgId);
    queryClient.invalidateQueries();
  }

  const createOrgMutation = useMutation({
    mutationFn: () => createOrganization(newOrgName.trim()),
    onSuccess: (org) => {
      setNewOrgName("");
      setShowNewOrgForm(false);
      queryClient.invalidateQueries({ queryKey: ["orgs"] });
      switchOrg(org.id);
      toast(`Created ${org.name}.`);
    },
    onError: () => toast("Failed to create organization. Please try again.", "error"),
  });

  const inviteMutation = useMutation({
    mutationFn: () => inviteMember(activeOrg!.id, inviteEmail.trim(), inviteRole),
    onSuccess: () => {
      setInviteEmail("");
      setInviteRole("member");
      queryClient.invalidateQueries({ queryKey: ["org-members", activeOrg?.id] });
      toast("Member added.");
    },
    onError: (err: AxiosError<{ detail: string }>) => {
      toast(err.response?.data?.detail ?? "Failed to add member.", "error");
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: MembershipRole }) => updateMemberRole(activeOrg!.id, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members", activeOrg?.id] });
      toast("Role updated.");
    },
    onError: (err: AxiosError<{ detail: string }>) => {
      toast(err.response?.data?.detail ?? "Failed to update role.", "error");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: number) => removeMember(activeOrg!.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members", activeOrg?.id] });
      toast("Member removed.");
    },
    onError: (err: AxiosError<{ detail: string }>) => {
      toast(err.response?.data?.detail ?? "Failed to remove member.", "error");
    },
  });

  function handleInviteSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    inviteMutation.mutate();
  }

  function handleCreateOrgSubmit(e: FormEvent) {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    createOrgMutation.mutate();
  }

  return (
    <motion.div {...pageTransition}>
      <BackButton to="/projects" label="Dashboard" />
      <header className="page-header">
        <h1>Team</h1>
      </header>

      <div className="dash-section-header">
        <h2>Organizations</h2>
        <button type="button" className="secondary small" onClick={() => setShowNewOrgForm((v) => !v)}>
          {showNewOrgForm ? "Cancel" : "New organization"}
        </button>
      </div>

      {showNewOrgForm && (
        <form className="connect-repo-form" onSubmit={handleCreateOrgSubmit} style={{ maxWidth: 360, marginBottom: 20 }}>
          <label>
            Name
            <input
              type="text"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              required
              maxLength={255}
              placeholder="Acme Corp"
            />
          </label>
          <button type="submit" disabled={createOrgMutation.isPending}>
            {createOrgMutation.isPending ? "Creating..." : "Create"}
          </button>
        </form>
      )}

      <ul className="org-switcher-list">
        {orgs?.map((org) => (
          <li key={org.id}>
            <button
              type="button"
              className={`org-switcher-item${org.id === activeOrg?.id ? " active" : ""}`}
              onClick={() => switchOrg(org.id)}
            >
              <span>{org.name}</span>
              <span className="badge badge-category">{org.role}</span>
            </button>
          </li>
        ))}
      </ul>

      {activeOrg && (
        <>
          <div className="dash-section-header" style={{ marginTop: 28 }}>
            <h2>Members of {activeOrg.name}</h2>
          </div>

          <ul className="org-member-list">
            {members?.map((member) => (
              <li key={member.user_id} className="org-member-row">
                <div className="org-member-identity">
                  <span className="org-member-username">{member.username}</span>
                  <span className="org-member-email">{member.email}</span>
                </div>
                {canManage && member.user_id !== user?.id ? (
                  <div className="org-member-actions">
                    <select
                      value={member.role}
                      disabled={roleMutation.isPending}
                      onChange={(e) => roleMutation.mutate({ userId: member.user_id, role: e.target.value as MembershipRole })}
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                    <button
                      type="button"
                      className="secondary small"
                      disabled={removeMutation.isPending}
                      onClick={() => removeMutation.mutate(member.user_id)}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <span className="badge badge-category">{member.role}</span>
                )}
              </li>
            ))}
          </ul>

          {canManage && (
            <form className="connect-repo-form" onSubmit={handleInviteSubmit} style={{ maxWidth: 420, marginTop: 20 }}>
              <label>
                Add a member by email
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  required
                />
              </label>
              <label>
                Role
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as MembershipRole)}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </label>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                They need an existing ReviewLenzAI account with this email.
              </p>
              <button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? "Adding..." : "Add member"}
              </button>
            </form>
          )}
        </>
      )}
    </motion.div>
  );
}
