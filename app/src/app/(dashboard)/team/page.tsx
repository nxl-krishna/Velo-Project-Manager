"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Role } from "@prisma/client";
import { apiFetch } from "@/lib/client-api";
import { can, canManageRole, ROLE_LABEL, ROLES, type Permission } from "@/lib/permissions";
import ProjectMembersModal, { Avatar, ROLE_BADGE } from "@/components/ProjectMembersModal";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  isYou: boolean;
  activeTasks: number;
  workload: number;
  projects: { id: string; name: string }[];
}

interface ProjectTeam {
  id: string;
  name: string;
  status: string;
  canManage: boolean;
  members: { id: string; name: string; avatarUrl: string | null; role: Role; isOwner: boolean }[];
}

interface TeamData {
  viewer: { id: string; role: Role; permissions: Permission[] };
  members: TeamMember[];
  projects: ProjectTeam[];
}

export default function TeamPage() {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<"people" | "projects">("people");
  const [showInvite, setShowInvite] = useState(false);
  const [teamProjectId, setTeamProjectId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadTeam = useCallback(() => {
    return apiFetch("/api/team")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setData(d.data);
        else setLoadError(d.error?.message || "Failed to load team");
      })
      .catch(() => setLoadError("Failed to load team"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const viewerRole = data?.viewer.role;
  const canManageRoles = can(viewerRole, "team.manageRoles");

  async function changeRole(member: TeamMember, role: Role) {
    if (!confirm(`Make ${member.name} ${ROLE_LABEL[role].toLowerCase()}?`)) return;
    setBusyId(member.id);
    try {
      const res = await apiFetch(`/api/team/${member.id}`, { method: "PATCH", body: JSON.stringify({ role }) });
      if (!res.ok) throw new Error((await res.json())?.error?.message || "Failed to change role");
      await loadTeam();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to change role");
    } finally {
      setBusyId(null);
    }
  }

  async function removeFromTeam(member: TeamMember) {
    if (!confirm(`Remove ${member.name} from the workspace? They lose access to every project and their tasks are unassigned.`)) return;
    setBusyId(member.id);
    try {
      const res = await apiFetch(`/api/team/${member.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json())?.error?.message || "Failed to remove member");
      await loadTeam();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to remove member");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <h2 style={{ fontWeight: 600, fontSize: "1.125rem" }}>Team Directory</h2>
          {viewerRole && (
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
              {viewerRole === "ADMIN"
                ? "You can see everyone, every project team, and manage roles."
                : viewerRole === "MANAGER"
                  ? "You can invite engineers and staff them on your projects."
                  : "You can see the people who work on your projects."}
            </p>
          )}
        </div>
        {can(viewerRole, "team.invite") && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(true)}>Invite Member</button>
        )}
      </div>

      <div style={{ padding: "24px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {([["people", `People${data ? ` (${data.members.length})` : ""}`], ["projects", `Project Teams${data ? ` (${data.projects.length})` : ""}`]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={`btn btn-sm ${tab === key ? "btn-primary" : "btn-secondary"}`} style={{ borderRadius: 20 }}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 180 }} />)}
          </div>
        ) : !data ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>{loadError}</div>
        ) : tab === "people" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {data.members.map((member) => (
              <div key={member.id} className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "28px 20px" }}>
                <div style={{ marginBottom: 16 }}>
                  <Avatar name={member.name} avatarUrl={member.avatarUrl} size={64} />
                </div>
                <h3 style={{ fontWeight: 600, fontSize: "1.125rem", color: "var(--text-primary)", marginBottom: 4 }}>
                  {member.name}
                  {member.isYou && <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.875rem" }}> (you)</span>}
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: 12 }}>{member.email}</p>

                {canManageRoles && !member.isYou ? (
                  <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                    <select
                      className="input"
                      value={member.role}
                      disabled={busyId === member.id}
                      onChange={(e) => changeRole(member, e.target.value as Role)}
                      style={{ padding: "4px 8px", fontSize: "0.8125rem", width: "auto" }}
                      aria-label={`Role for ${member.name}`}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                    <button className="btn btn-ghost btn-sm" disabled={busyId === member.id} onClick={() => removeFromTeam(member)} style={{ color: "var(--danger)" }}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <span className={`badge ${ROLE_BADGE[member.role]}`} style={{ marginBottom: 16 }}>{ROLE_LABEL[member.role]}</span>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6, marginBottom: 16, minHeight: 22 }}>
                  {member.projects.length === 0 ? (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Not on any project yet</span>
                  ) : (
                    member.projects.map((p) => (
                      <Link key={p.id} href={`/projects/${p.id}/board`} style={{ fontSize: "0.6875rem", padding: "2px 8px", borderRadius: 999, border: "1px solid var(--border)", color: "var(--text-secondary)", textDecoration: "none" }}>
                        {p.name}
                      </Link>
                    ))
                  )}
                </div>

                <div style={{ width: "100%", marginTop: "auto", background: "var(--surface-2)", padding: "12px", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Active Tasks</div>
                    <div style={{ fontWeight: 600, fontSize: "1.125rem" }}>{member.activeTasks}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Workload</div>
                    <div style={{ fontWeight: 600, fontSize: "1.125rem", color: member.workload > 90 ? "var(--danger)" : "var(--success)" }}>{member.workload}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : data.projects.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>No projects yet.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 }}>
            {data.projects.map((p) => (
              <div key={p.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <Link href={`/projects/${p.id}/board`} style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-primary)", textDecoration: "none" }}>{p.name}</Link>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                      {p.status.replace("_", " ")} · {p.members.length} {p.members.length === 1 ? "person" : "people"}
                    </div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setTeamProjectId(p.id)}>
                    {p.canManage ? "Manage team" : "View team"}
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {p.members.map((m) => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={m.name} avatarUrl={m.avatarUrl} size={28} />
                      <span style={{ flex: 1, fontSize: "0.8125rem" }}>
                        {m.name}
                        {m.isOwner && <span style={{ color: "var(--text-muted)" }}> · owner</span>}
                      </span>
                      <span className={`badge ${ROLE_BADGE[m.role]}`}>{ROLE_LABEL[m.role]}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showInvite && data && (
        <InviteMemberModal
          viewerRole={data.viewer.role}
          projects={data.projects.filter((p) => p.canManage)}
          onClose={() => setShowInvite(false)}
          onInvited={loadTeam}
        />
      )}
      {teamProjectId && (
        <ProjectMembersModal projectId={teamProjectId} onClose={() => setTeamProjectId(null)} onChanged={loadTeam} />
      )}
    </div>
  );
}

function InviteMemberModal({
  viewerRole,
  projects,
  onClose,
  onInvited,
}: {
  viewerRole: Role;
  projects: ProjectTeam[];
  onClose: () => void;
  onInvited: () => void;
}) {
  const allowedRoles = [...ROLES].reverse().filter((r) => canManageRole(viewerRole, r));
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function toggleProject(id: string) {
    setProjectIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await apiFetch("/api/team", {
        method: "POST",
        body: JSON.stringify({ email, role, projectIds }),
      });
      if (res.ok) {
        onInvited();
        onClose();
      } else {
        const d = await res.json();
        setErrorMsg(d?.error?.message || "Failed to invite member");
      }
    } catch {
      setErrorMsg("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ fontWeight: 700, fontSize: "1.25rem" }}>Invite Member</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: "4px 8px" }}>✕</button>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: 20 }}>
          They need a Velo account. They only get access to the projects you add them to.
        </p>

        <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="label" htmlFor="invite-email">Email address</label>
            <input id="invite-email" type="email" className="input" placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="invite-role">Role</label>
            <select id="invite-role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={allowedRoles.length === 1}>
              {allowedRoles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            {viewerRole === "MANAGER" && (
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 6 }}>Managers can invite engineers. Ask an admin to add managers or admins.</p>
            )}
          </div>
          {projects.length > 0 && (
            <div>
              <div className="label">Add to projects (optional)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8 }}>
                {projects.map((p) => (
                  <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem", cursor: "pointer" }}>
                    <input type="checkbox" checked={projectIds.includes(p.id)} onChange={() => toggleProject(p.id)} />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          {errorMsg && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "10px 14px", fontSize: "0.875rem", color: "#f87171" }}>
              {errorMsg}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1, justifyContent: "center" }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1, justifyContent: "center" }}>
              {loading ? "Adding..." : "Add to team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
