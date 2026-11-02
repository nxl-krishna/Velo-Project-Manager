"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client-api";
import NewProjectModal from "@/components/NewProjectModal";
import { useCan } from "@/components/CurrentUserContext";
import { ArrowRight, Folder, Loader, Plus, SquareCheckBig, Timer, Users } from "lucide-react";

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  _count?: { tasks: number; sprints: number };
}

interface Stats {
  totalProjects: number;
  totalTasks: number;
  openTasks: number;
  inProgress: number;
  teamMembers: number;
}

interface Insight {
  title: string;
  body: string;
  action: string;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
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
  const [stats, setStats] = useState<Stats>({ totalProjects: 0, totalTasks: 0, openTasks: 0, inProgress: 0, teamMembers: 0 });
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const canCreate = useCan("project.create");

  const loadData = useCallback(() => {
    const projectsReq = apiFetch("/api/projects")
      .then(r => r.json())
      .then(d => { if (d.data) setProjects(d.data); })
      .catch(err => console.error("Failed to fetch projects", err))
      .finally(() => setLoading(false));

    const statsReq = apiFetch("/api/dashboard?insights=false")
      .then(r => r.json())
      .then(d => { if (d.data?.stats) setStats(d.data.stats); })
      .catch(err => console.error("Failed to fetch dashboard stats", err));

    const insightsReq = apiFetch("/api/dashboard")
      .then(r => r.json())
      .then(d => { if (d.data?.insights) setInsights(d.data.insights); })
      .catch(err => console.error("Failed to fetch AI insights", err))
      .finally(() => setInsightsLoading(false));

    return Promise.all([projectsReq, statsReq, insightsReq]);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const STAT_CARDS = [
    { label: "Total Projects", value: stats.totalProjects.toString(), icon: Folder, change: "Active across orgs", color: "var(--brand-400)" },
    { label: "Open Tasks", value: stats.openTasks.toString(), icon: SquareCheckBig, change: "Needs attention", color: "var(--info)" },
    { label: "In Progress", value: stats.inProgress.toString(), icon: Loader, change: "Currently active", color: "var(--warning)" },
    { label: "Team Members", value: stats.teamMembers.toString(), icon: Users, change: "Collaborators", color: "var(--success)" },
  ];

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      {/* Topbar */}
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <h2 style={{ fontWeight: 600, fontSize: "1rem" }}>Dashboard</h2>
        </div>
        {canCreate && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowNewProject(true)}
            id="new-project-btn"
          >
            + New Project
          </button>
        )}
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
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }} suppressHydrationWarning>
              {greeting()}
            </h1>
            <p style={{ color: "var(--text-secondary)" }}>
              You have <strong style={{ color: "var(--warning)" }}>{stats.openTasks} active tasks</strong> across <strong style={{ color: "var(--brand-400)" }}>{stats.totalProjects} projects</strong>.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
          {STAT_CARDS.map((s) => (
            <div key={s.label} className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                <s.icon size={20} strokeWidth={1.75} style={{ color: s.color, opacity: 0.85 }} />
              </div>
              <div className="stat-label">{s.label}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>{s.change}</div>
            </div>
          ))}
        </div>

        {/* Projects */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontWeight: 600, fontSize: "1.125rem" }}>Your Projects</h2>
          <Link href="/projects" style={{ fontSize: "0.875rem", color: "var(--brand-400)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>View all <ArrowRight size={14} /></Link>
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
                    <div style={{ width: 40, height: 40, background: "var(--brand-700)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                      <Folder size={20} strokeWidth={1.75} />
                    </div>
                    <span className={`badge ${STATUS_COLORS[p.status] || "badge-gray"}`}>{p.status.replace("_", " ")}</span>
                  </div>
                  <h3 style={{ fontWeight: 600, marginBottom: 6 }}>{p.name}</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: 16, lineHeight: 1.5 }}>
                    {p.description}
                  </p>
                  <div style={{ display: "flex", gap: 16, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><SquareCheckBig size={14} /> {p._count?.tasks ?? 0} tasks</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Timer size={14} /> {p._count?.sprints ?? 0} sprints</span>
                  </div>
                </div>
              </Link>
            ))}

            {canCreate ? (
              <button
                className="card"
                style={{ border: "2px dashed var(--border)", background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 160 }}
                onClick={() => setShowNewProject(true)}
                id="new-project-card-btn"
              >
                <div style={{ width: 48, height: 48, background: "var(--surface-2)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}><Plus size={22} /></div>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", fontWeight: 500 }}>New Project</span>
              </button>
            ) : projects.length === 0 && (
              <div className="card" style={{ border: "2px dashed var(--border)", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 160, color: "var(--text-muted)", fontSize: "0.875rem", textAlign: "center" }}>
                You haven&apos;t been added to a project yet. A manager or admin can add you.
              </div>
            )}
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
                    {insight.action} <ArrowRight size={14} />
                  </button>
                </Link>
              </div>
            ))}
            {insightsLoading && insights.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Generating insights with Gemini...</div>
            )}
          </div>
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} onCreated={loadData} />
      )}
    </div>
  );
}
