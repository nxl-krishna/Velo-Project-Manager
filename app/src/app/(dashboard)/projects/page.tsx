"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  progress: number;
  dueDate: string;
  members: { name: string, color: string }[];
}



export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    fetch("/api/projects", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        if (d.data) setProjects(d.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const filteredProjects = projects.filter(p => filter === "ALL" ? true : p.status === filter);

  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <h2 style={{ fontWeight: 600, fontSize: "1.125rem" }}>Projects</h2>
        </div>
        <button className="btn btn-primary btn-sm">+ New Project</button>
      </div>

      <div style={{ padding: "24px", flex: 1 }}>
        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {["ALL", "ACTIVE", "IN_PROGRESS", "PLANNING", "COMPLETED"].map(f => (
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
                      <div className="avatar-group">
                        {p.members.map((m, i) => (
                          <div key={i} className="avatar avatar-sm" style={{ background: m.color }}>{m.name}</div>
                        ))}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                        ⏱ Due {new Date(p.dueDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
