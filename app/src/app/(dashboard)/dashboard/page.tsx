"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  _count?: { tasks: number; sprints: number };
  members?: { userId: string; role: string }[];
}

interface Stats {
  totalProjects: number;
  totalTasks: number;
  inProgress: number;
  overdue: number;
}

const STATUS_COLORS: Record<string, string> = {
  PLANNING: "badge-gray",
  ACTIVE: "badge-brand",
  ON_HOLD: "badge-yellow",
  COMPLETED: "badge-green",
  ARCHIVED: "badge-gray",
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<any>({ totalProjects: 0, totalTasks: 0, inProgress: 0, teamMembers: 0 });
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    
    Promise.all([
      fetch("/api/projects", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch("/api/dashboard", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
    ])
      .then(([projectsData, dashboardData]) => {
        if (projectsData.data) setProjects(projectsData.data);
        if (dashboardData.data) {
          if (dashboardData.data.stats) setStats(dashboardData.data.stats);
          if (dashboardData.data.insights) setInsights(dashboardData.data.insights);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch dashboard data", err);
        setLoading(false);
      });
  }, []);

  const STAT_CARDS = [
    { label: "Total Projects", value: stats.totalProjects.toString(), icon: "📁", change: "Active across orgs", color: "var(--brand-400)" },
    { label: "Open Tasks", value: stats.totalTasks.toString(), icon: "✓", change: "Needs attention", color: "var(--info)" },
    { label: "In Progress", value: stats.inProgress.toString(), icon: "⚡", change: "Currently active", color: "var(--warning)" },
    { label: "Team Members", value: stats.teamMembers.toString(), icon: "👥", change: "Collaborators", color: "var(--success)" },
  ];

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      {/* Topbar */}
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <h2 style={{ fontWeight: 600, fontSize: "1rem" }}>Dashboard</h2>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowNewProject(true)}
          id="new-project-btn"
        >
          + New Project
        </button>
      </div>

      <div style={{ padding: "24px" }}>
        {/* Welcome banner */}
        <div style={{
          background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(192,132,252,0.08))",
          border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: 16,
          padding: "24px 28px",
          marginBottom: 28,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>
              Good morning! 👋
            </h1>
            <p style={{ color: "var(--text-secondary)" }}>
              You have <strong style={{ color: "var(--warning)" }}>{stats.totalTasks} active tasks</strong> across <strong style={{ color: "var(--brand-400)" }}>{stats.totalProjects} projects</strong>.
            </p>
          </div>
          <div style={{ fontSize: "3rem" }}></div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
          {STAT_CARDS.map((s) => (
            <div key={s.label} className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                <div style={{ fontSize: "1.5rem" }}>{s.icon}</div>
              </div>
              <div className="stat-label">{s.label}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>{s.change}</div>
            </div>
          ))}
        </div>

        {/* Projects */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontWeight: 600, fontSize: "1.125rem" }}>Your Projects</h2>
          <Link href="/projects" style={{ fontSize: "0.875rem", color: "var(--brand-400)", textDecoration: "none" }}>View all →</Link>
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {[1,2,3,4].map(i => (
              <div key={i} className="skeleton" style={{ height: 160 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}/board`} style={{ textDecoration: "none" }}>
                <div className="card card-hover" style={{ cursor: "pointer", height: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, background: "var(--brand-700)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>
                      📁
                    </div>
                    <span className={`badge ${STATUS_COLORS[p.status] || "badge-gray"}`}>{p.status.replace("_", " ")}</span>
                  </div>
                  <h3 style={{ fontWeight: 600, marginBottom: 6 }}>{p.name}</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: 16, lineHeight: 1.5 }}>
                    {p.description}
                  </p>
                  <div style={{ display: "flex", gap: 16, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                    <span>✓ {p._count?.tasks ?? 0} tasks</span>
                    <span>⚡ {p._count?.sprints ?? 0} sprints</span>
                  </div>
                </div>
              </Link>
            ))}

            {/* New project card */}
            <button
              className="card"
              style={{ border: "2px dashed var(--border)", background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 160 }}
              onClick={() => setShowNewProject(true)}
              id="new-project-card-btn"
            >
              <div style={{ width: 48, height: 48, background: "var(--surface-2)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>+</div>
              <span style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", fontWeight: 500 }}>New Project</span>
            </button>
          </div>
        )}

        {/* AI Panel */}
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontWeight: 600, fontSize: "1.125rem", marginBottom: 16 }}>AI Insights (Powered by Gemini)</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            {insights.map((insight, idx) => (
              <div key={idx} className="ai-card">
                <div style={{ fontWeight: 600, marginBottom: 6, fontSize: "0.9375rem" }}>{insight.title}</div>
                <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6 }}>{insight.body}</div>
                <Link href="/projects" style={{ textDecoration: "none" }}>
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 12, padding: "6px 0", color: "var(--brand-400)" }}>
                    {insight.action} →
                  </button>
                </Link>
              </div>
            ))}
            {loading && insights.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Generating insights with Gemini...</div>
            )}
          </div>
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} />
      )}
    </div>
  );
}

function NewProjectModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: "", description: "", status: "PLANNING" });
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });
      
      if (res.ok) {
        window.location.reload(); // Quick refresh to show the new project!
      } else {
        const errData = await res.json();
        alert(errData?.error?.message || "Failed to create project");
      }
    } catch (err) {
      alert("Something went wrong");
    } finally {
      setLoading(false);
      onClose();
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontWeight: 700, fontSize: "1.25rem" }}>Create New Project</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: "4px 8px" }}>✕</button>
        </div>

        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="label" htmlFor="proj-name">Project name *</label>
            <input id="proj-name" className="input" placeholder="e.g. Website Redesign" value={form.name} onChange={(e) => setForm(p => ({...p, name: e.target.value}))} required />
          </div>
          <div>
            <label className="label" htmlFor="proj-desc">Description</label>
            <textarea id="proj-desc" className="input" style={{ resize: "vertical", minHeight: 80 }} placeholder="What is this project about?" value={form.description} onChange={(e) => setForm(p => ({...p, description: e.target.value}))} />
          </div>
          <div>
            <label className="label" htmlFor="proj-status">Status</label>
            <select id="proj-status" className="input" value={form.status} onChange={(e) => setForm(p => ({...p, status: e.target.value}))}>
              <option value="PLANNING">Planning</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1, justifyContent: "center" }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1, justifyContent: "center" }} id="create-project-confirm-btn">
              {loading ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

