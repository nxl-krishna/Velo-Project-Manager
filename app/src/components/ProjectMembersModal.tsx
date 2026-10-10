"use client";

import { useState, useEffect, useCallback } from "react";
import type { Role } from "@prisma/client";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import { ROLE_LABEL } from "@/lib/permissions";

interface Person {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
}

interface Member extends Person {
  isOwner: boolean;
  openTasks: number;
  removable: boolean;
}

interface ProjectTeam {
  project: { id: string; name: string };
  myRole: Role;
  canManage: boolean;
  members: Member[];
  candidates: Person[];
}

export const ROLE_BADGE: Record<Role, string> = {
  ADMIN: "badge-brand",
  MANAGER: "badge-yellow",
  MEMBER: "badge-gray",
};

export function Avatar({ name, avatarUrl, size = 32 }: { name: string; avatarUrl?: string | null; size?: number }) {
  return (
    <div
      className="avatar"
      title={name}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        flexShrink: 0,
        background: avatarUrl ? `center / cover no-repeat url(${avatarUrl})` : `hsl(${name.charCodeAt(0) * 47}, 60%, 40%)`,
      }}
    >
      {!avatarUrl && name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function ProjectMembersModal({
  projectId,
  onClose,
  onChanged,
}: {
  projectId: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [team, setTeam] = useState<ProjectTeam | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    return apiFetch(`/api/projects/${projectId}/members`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setTeam(d.data);
        else setErrorMsg(d.error?.message || "Failed to load the project team");
      })
      .catch(() => setErrorMsg("Failed to load the project team"));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addMember() {
    if (!selected) return;
    setBusy("add");
    setErrorMsg("");
    try {
      const res = await apiFetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        body: JSON.stringify({ userId: selected }),
      });
      if (!res.ok) throw new Error((await res.json())?.error?.message || "Failed to add member");
      setSelected("");
      await load();
      onChanged?.();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to add member");
    } finally {
      setBusy(null);
    }
  }

  async function removeMember(member: Member) {
    if (!confirm(`Remove ${member.name} from ${team?.project.name}? Their tasks in this project will be unassigned.`)) return;
    setBusy(member.id);
    setErrorMsg("");
    try {
      const res = await apiFetch(`/api/projects/${projectId}/members/${member.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json())?.error?.message || "Failed to remove member");
      await load();
      onChanged?.();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to remove member");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 style={{ fontWeight: 700, fontSize: "1.25rem" }}>Project Team{team ? ` · ${team.project.name}` : ""}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: "4px 8px" }} aria-label="Close"><X size={16} /></button>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginBottom: 20 }}>
          {!team
            ? "Loading..."
            : team.myRole === "ADMIN"
              ? "As an admin you can add or remove anyone in the workspace."
              : team.canManage
                ? "As a manager you can add or remove engineers on this project."
                : "Only admins and managers can change who works on this project."}
        </p>

        {team?.canManage && (
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {team.candidates.length > 0 ? (
              <>
                <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)} style={{ flex: 1 }}>
                  <option value="">Select someone to add...</option>
                  {team.candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {ROLE_LABEL[c.role]} ({c.email})
                    </option>
                  ))}
                </select>
                <button className="btn btn-primary btn-sm" disabled={!selected || busy === "add"} onClick={addMember}>
                  {busy === "add" ? "Adding..." : "Add"}
                </button>
              </>
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                Everyone you can add is already on this project. Invite new people from the Team page.
              </p>
            )}
          </div>
        )}

        {errorMsg && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "10px 14px", fontSize: "0.875rem", color: "#f87171", marginBottom: 16 }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 360, overflowY: "auto" }}>
          {team?.members.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", borderRadius: 8, background: "var(--surface-2)" }}>
              <Avatar name={m.name} avatarUrl={m.avatarUrl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>
                  {m.name}
                  {m.isOwner && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · owner</span>}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.email} · {m.openTasks} open task{m.openTasks === 1 ? "" : "s"}
                </div>
              </div>
              <span className={`badge ${ROLE_BADGE[m.role]}`}>{ROLE_LABEL[m.role]}</span>
              {m.removable && (
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy === m.id}
                  onClick={() => removeMember(m)}
                  style={{ color: "var(--danger)", padding: "4px 8px" }}
                  title={`Remove ${m.name} from this project`}
                >
                  {busy === m.id ? "..." : "Remove"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
