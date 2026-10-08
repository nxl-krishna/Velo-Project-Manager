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
  const [stats] = useState<Stats>({ totalProjects: 0, totalTasks: 0, inProgress: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);

  // Mock data for demo (replace with real API calls)
  useEffect(() => {
    setTimeout(() => {
      setProjects([
        { id: "1", name: "Website Redesign", description: "Q4 complete frontend overhaul with new brand guidelines", status: "ACTIVE", _count: { tasks: 24, sprints: 3 } },
        { id: "2", name: "Mobile App v2.0", description: "Cross-platform React Native app with offline support", status: "IN_PROGRESS" as never, _count: { tasks: 47, sprints: 5 } },
        { id: "3", name: "API Gateway Migration", description: "Move from REST to GraphQL microservices architecture", status: "PLANNING", _count: { tasks: 12, sprints: 1 } },
        { id: "4", name: "Data Pipeline", description: "Real-time ETL pipeline for analytics infrastructure", status: "COMPLETED", _count: { tasks: 31, sprints: 4 } },
      ]);
      setLoading(false);
    }, 600);
  }, []);

  const STAT_CARDS = [
    { label: "Total Projects", value: "4", icon: "📁", change: "+2 this month", color: "var(--brand-400)" },
    { label: "Open Tasks", value: "83", icon: "✓", change: "12 due today", color: "var(--info)" },
    { label: "In Progress", value: "21", icon: "⚡", change: "5 critical priority", color: "var(--warning)" },
    { label: "Team Members", value: "8", icon: "👥", change: "Across 3 orgs", color: "var(--success)" },
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
              You have <strong style={{ color: "var(--warning)" }}>12 tasks</strong> due today and <strong style={{ color: "var(--brand-400)" }}>3 sprints</strong> ending this week.
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
          <h2 style={{ fontWeight: 600, fontSize: "1.125rem", marginBottom: 16 }}>AI Insights</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            {AI_INSIGHTS.map((insight) => (
              <div key={insight.title} className="ai-card">
                <div style={{ fontWeight: 600, marginBottom: 6, fontSize: "0.9375rem" }}>{insight.title}</div>
                <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6 }}>{insight.body}</div>
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 12, padding: "6px 0", color: "var(--brand-400)" }}>
                  {insight.action} →
                </button>
              </div>
            ))}
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
    // In real app: call API
    setTimeout(() => { setLoading(false); onClose(); }, 1000);
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

const AI_INSIGHTS = [
  {
    title: "📋 Sprint overload detected",
    body: "Sprint 4 has 62 story points assigned to Jane — 40% above her historical velocity. Consider rebalancing.",
    action: "View sprint",
  },
  {
    title: "⏰ 3 deadlines at risk",
    body: "Based on current velocity, tasks 'Auth module', 'API docs', and 'Dashboard tests' are unlikely to complete on time.",
    action: "See predictions",
  },
  {
    title: "🎯 Suggested assignee",
    body: "Bob has the lowest workload this sprint and has completed 4 similar backend tasks recently.",
    action: "Assign task",
  },
];
