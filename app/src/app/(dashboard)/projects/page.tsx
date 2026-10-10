"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Role } from "@prisma/client";
import { apiFetch } from "@/lib/client-api";
import { ROLE_LABEL } from "@/lib/permissions";
import NewProjectModal from "@/components/NewProjectModal";
import { useCan, useCurrentUser } from "@/components/CurrentUserContext";
import { Avatar, ROLE_BADGE } from "@/components/ProjectMembersModal";
import { Clock } from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  progress: number;
  dueDate: string | null;
  members: { id: string; name: string; avatarUrl: string | null; isOwner: boolean }[];
  myRole: Role | null;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [showNewProject, setShowNewProject] = useState(false);
  const canCreate = useCan("project.create");
  const me = useCurrentUser();

  const loadProjects = useCallback(() => {
    return apiFetch("/api/projects")
      .then(r => r.json())
      .then(d => {
        if (d.data) setProjects(d.data);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const filteredProjects = projects.filter(p => filter === "ALL" ? true : p.status === filter);

  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <h2 style={{ fontWeight: 600, fontSize: "1.125rem" }}>Projects</h2>
        </div>
        {canCreate && <button className="btn btn-primary btn-sm" onClick={() => setShowNewProject(true)}>+ New Project</button>}
      </div>

      <div style={{ padding: "24px", flex: 1 }}>
        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {["ALL", "ACTIVE", "PLANNING", "ON_HOLD", "COMPLETED"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 20 }}
            >
              {f.replace("_", " ")}
            </button>
          ))}
        </div>

        {loading ? (
           <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
             {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 200 }} />)}
           </div>
        ) : projects.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
            {canCreate || !me
              ? "No projects yet. Create one to get started."
              : "You haven't been added to any projects yet. Ask a manager or admin to add you."}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
            {filteredProjects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}/board`} style={{ textDecoration: "none" }}>
                <div className="card card-hover" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <h3 style={{ fontWeight: 600, fontSize: "1.125rem", color: "var(--text-primary)" }}>{p.name}</h3>
                    <span className="badge badge-brand">{p.status.replace("_", " ")}</span>
                  </div>
                  
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", flex: 1, marginBottom: 20 }}>
                    {p.description}
                  </p>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 6 }}>
                      <span>Progress</span>
                      <span>{p.progress}%</span>
                    </div>
                    <div className="progress-bar" style={{ marginBottom: 16 }}>
                      <div className="progress-fill" style={{ width: `${p.progress}%`, background: p.progress === 100 ? "var(--success)" : undefined }} />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="avatar-group">
                          {p.members.slice(0, 5).map((m) => (
                            <Avatar key={m.id} name={m.name} avatarUrl={m.avatarUrl} size={24} />
                          ))}
                        </div>
                        {p.members.length > 5 && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>+{p.members.length - 5}</span>}
                        {p.myRole && (
                          <span className={`badge ${ROLE_BADGE[p.myRole]}`} title="Your role on this project" style={{ fontSize: "0.625rem" }}>
                            {ROLE_LABEL[p.myRole]}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={12} /> {p.dueDate ? `Due ${new Date(p.dueDate).toLocaleDateString()}` : "No due date"}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} onCreated={loadProjects} />
      )}
    </div>
  );
}
