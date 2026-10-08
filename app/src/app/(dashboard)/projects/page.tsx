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

const MOCK_PROJECTS: Project[] = [
  { id: "1", name: "Website Redesign", description: "Q4 complete frontend overhaul with new brand guidelines.", status: "ACTIVE", progress: 65, dueDate: "2026-11-15", members: [{name: "A", color: "var(--brand-500)"}, {name: "B", color: "var(--info)"}] },
  { id: "2", name: "Mobile App v2.0", description: "Cross-platform React Native app with offline support.", status: "IN_PROGRESS", progress: 32, dueDate: "2026-12-01", members: [{name: "C", color: "var(--warning)"}] },
  { id: "3", name: "API Gateway Migration", description: "Move from REST to GraphQL microservices architecture.", status: "PLANNING", progress: 5, dueDate: "2027-01-20", members: [{name: "A", color: "var(--brand-500)"}, {name: "D", color: "var(--success)"}] },
  { id: "4", name: "Data Pipeline", description: "Real-time ETL pipeline for analytics infrastructure.", status: "COMPLETED", progress: 100, dueDate: "2026-09-30", members: [{name: "E", color: "var(--danger)"}] },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    // Simulate API fetch
    setTimeout(() => {
      setProjects(MOCK_PROJECTS);
      setLoading(false);
    }, 500);
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
