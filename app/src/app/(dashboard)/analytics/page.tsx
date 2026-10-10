"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { apiFetch } from "@/lib/client-api";
import type { Analytics } from "@/lib/analytics";
import { ArrowUpRight, RefreshCw } from "lucide-react";

const POLL_MS = 60_000;

interface Insight {
  title: string;
  body: string;
  sources?: { taskId: string; title: string; link: string }[];
}

interface InsightMeta {
  generatedAt?: string;
  stale?: boolean;
  retryAt?: number;
  retrieval?: { indexed: number; semantic: boolean; context: number };
}

interface AnalyticsSync {
  changed: boolean;
  version: string;
  hashes?: string[];
  patch?: Partial<Analytics>;
}

type InsightSource = "ai" | "empty" | "unconfigured" | "error" | "quota";

function retrievalLabel(r: InsightMeta["retrieval"]): string {
  if (!r) return "";
  const grounded = `Grounded in ${r.context} task${r.context === 1 ? "" : "s"}`;
  if (!r.semantic) return `${grounded} · semantic search unavailable`;
  return r.indexed > 0 ? `${grounded} · ${r.indexed} indexed items` : `${grounded} · search index is building`;
}

const PRIORITY_STYLE: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: "Critical", color: "var(--danger)" },
  HIGH: { label: "High", color: "var(--warning)" },
  MEDIUM: { label: "Medium", color: "var(--info)" },
  LOW: { label: "Low", color: "var(--success)" },
};

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  BACKLOG: { label: "Backlog", color: "#64748b" },
  TODO: { label: "To Do", color: "#6366f1" },
  IN_PROGRESS: { label: "In Progress", color: "#f59e0b" },
  IN_REVIEW: { label: "In Review", color: "#06b6d4" },
  DONE: { label: "Done", color: "#22c55e" },
};

const INSIGHT_FALLBACK: Record<Exclude<InsightSource, "ai">, string> = {
  empty: "Add some tasks to your projects and AI insights will appear here.",
  unconfigured: "Set GOOGLE_AI_API_KEY to enable AI insights.",
  error: "AI insights are temporarily unavailable. Try again in a moment.",
  quota: "The Gemini API quota is used up for now.",
};

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(data: Analytics) {
  const rows: (string | number)[][] = [
    ["Section", "Name", "Value", "Percent"],
    ["Summary", "Projects", data.summary.totalProjects, ""],
    ["Summary", "Total tasks", data.summary.totalTasks, ""],
    ["Summary", "Completed tasks", data.summary.completedTasks, `${data.summary.completionRate}%`],
    ["Summary", "Open tasks", data.summary.openTasks, ""],
    ["Summary", "Overdue tasks", data.summary.overdueTasks, ""],
    ...data.velocity.points.map((p) => [`Velocity (${data.velocity.unit})`, p.label, p.value, ""]),
    ...data.priority.map((p) => ["Priority", PRIORITY_STYLE[p.priority].label, p.count, `${p.pct}%`]),
    ...data.status.map((s) => ["Status", STATUS_STYLE[s.status].label, s.count, `${s.pct}%`]),
    ...data.projects.map((p) => ["Project", p.name, `${p.done}/${p.total}`, `${p.progress}%`]),
  ];
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `velo-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightSource, setInsightSource] = useState<InsightSource | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightMeta, setInsightMeta] = useState<InsightMeta>({});
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const syncRef = useRef<{ version: string; hashes: string[]; at: number } | null>(null);

  const loadInsights = useCallback((refresh = false) => {
    return apiFetch(`/api/analytics/insights${refresh ? "?refresh=1" : ""}`)
      .then((r) => r.json())
      .then((d) => {
        setInsights(d.data?.insights ?? []);
        setInsightSource(d.data?.source ?? "error");
        setInsightMeta({
          generatedAt: d.data?.generatedAt,
          stale: d.data?.stale,
          retryAt: d.data?.retryAt,
          retrieval: d.data?.retrieval,
        });
      })
      .catch(() => setInsightSource("error"))
      .finally(() => setInsightsLoading(false));
  }, []);

  // First call fetches everything; later calls send the known version + section hashes and
  // receive either { changed: false } or only the sections that changed.
  const syncAnalytics = useCallback(() => {
    const prev = syncRef.current;
    const query = prev ? `?since=${prev.version}&h=${prev.hashes.join(",")}` : "";
    return apiFetch(`/api/analytics${query}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.data) {
          if (!prev) setLoadError(d.error?.message || "Failed to load analytics");
          return;
        }
        const res = d.data as AnalyticsSync;
        setLastSynced(new Date());
        if (!res.changed) {
          if (prev) prev.at = Date.now();
          return;
        }
        syncRef.current = { version: res.version, hashes: res.hashes ?? [], at: Date.now() };
        setData((cur) => ({ ...cur, ...res.patch }) as Analytics);
        if (prev) loadInsights();
      })
      .catch(() => {
        if (!prev) setLoadError("Failed to load analytics");
      });
  }, [loadInsights]);

  useEffect(() => {
    syncAnalytics().finally(() => setLoading(false));
    loadInsights();

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") syncAnalytics();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - (syncRef.current?.at ?? 0) >= POLL_MS) {
        syncAnalytics();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [syncAnalytics, loadInsights]);

  const maxVelocity = Math.max(1, ...(data?.velocity.points.map((p) => p.value) ?? [0]));

  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <h2 style={{ fontWeight: 600, fontSize: "1.125rem" }}>Analytics & Reports</h2>
        </div>
        {lastSynced && (
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginRight: 12 }} title="Checks for changes every minute">
            ● Live · synced {lastSynced.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </span>
        )}
        <button className="btn btn-secondary btn-sm" disabled={!data} onClick={() => data && exportCsv(data)}>
          Export CSV
        </button>
      </div>

      <div style={{ padding: "24px" }}>
        {loading ? (
          <div style={{ display: "grid", gap: 24 }}>
            <div className="skeleton" style={{ height: 100 }} />
            <div className="skeleton" style={{ height: 300 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div className="skeleton" style={{ height: 250 }} />
              <div className="skeleton" style={{ height: 250 }} />
            </div>
          </div>
        ) : !data ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>{loadError}</div>
        ) : (
          <div style={{ display: "grid", gap: 24 }}>
            {/* Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
              {[
                { label: "Projects", value: data.summary.totalProjects, color: "var(--brand-400)" },
                { label: "Total Tasks", value: data.summary.totalTasks, color: "var(--info)" },
                { label: "Completion Rate", value: `${data.summary.completionRate}%`, color: "var(--success)" },
                { label: "Open Tasks", value: data.summary.openTasks, color: "var(--warning)" },
                { label: "Overdue", value: data.summary.overdueTasks, color: data.summary.overdueTasks > 0 ? "var(--danger)" : "var(--text-muted)" },
              ].map((s) => (
                <div key={s.label} className="stat-card">
                  <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Velocity */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h3 style={{ fontWeight: 600, fontSize: "1rem" }}>
                  {data.velocity.mode === "sprints" ? "Velocity (Last Sprints)" : "Tasks Completed (Last 6 Weeks)"}
                </h3>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {data.velocity.unit === "points" ? "Story points completed" : "Tasks completed"}
                </span>
              </div>
              <div style={{ height: 300, background: "var(--surface-2)", display: "flex", alignItems: "flex-end", padding: "32px 40px 0", gap: 32 }}>
                {data.velocity.points.map((p, i) => (
                  <div key={i} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 500, marginBottom: 6 }}>{p.value}</span>
                    <div
                      title={`${p.label}: ${p.value}`}
                      style={{
                        width: "100%",
                        height: `${Math.max((p.value / maxVelocity) * 80, p.value > 0 ? 4 : 1)}%`,
                        background: p.value > 0 ? "var(--brand-500)" : "var(--gray-200)",
                        borderRadius: "4px 4px 0 0",
                        transition: "height 0.3s",
                      }}
                    />
                    <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", padding: "8px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{p.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 24 }}>
              {/* Priority */}
              <div className="card">
                <h3 style={{ fontWeight: 600, fontSize: "1rem", marginBottom: 20 }}>Task Distribution by Priority</h3>
                <BarList items={data.priority.map((p) => ({ key: p.priority, ...PRIORITY_STYLE[p.priority], count: p.count, pct: p.pct }))} />
              </div>

              {/* Status */}
              <div className="card">
                <h3 style={{ fontWeight: 600, fontSize: "1rem", marginBottom: 20 }}>Task Distribution by Status</h3>
                <BarList items={data.status.map((s) => ({ key: s.status, ...STATUS_STYLE[s.status], count: s.count, pct: s.pct }))} />
              </div>

              {/* AI Insights */}
              <div className="card ai-card" style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>AI Insights (Powered by Gemini)</h3>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={insightsLoading}
                    onClick={() => { setInsightsLoading(true); loadInsights(true); }}
                    style={{ fontSize: "0.75rem", color: "var(--brand-400)" }}
                  >
                    {insightsLoading ? "Analyzing..." : <><RefreshCw size={12} /> Refresh</>}
                  </button>
                </div>
                {insightsLoading && insights.length === 0 ? (
                  <div className="ai-thinking" style={{ padding: "12px 0" }}>
                    <span className="ai-thinking-dot" />
                    <span className="ai-thinking-dot" />
                    <span className="ai-thinking-dot" />
                  </div>
                ) : insights.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {insights.map((insight, i) => (
                      <div key={i}>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: 4 }}>{insight.title}</div>
                        <div style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", lineHeight: 1.6 }}>{insight.body}</div>
                        {insight.sources && insight.sources.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                            {insight.sources.map((s) => (
                              <Link
                                key={s.taskId}
                                href={s.link}
                                title="Open task"
                                style={{
                                  fontSize: "0.6875rem",
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  border: "1px solid var(--border)",
                                  color: "var(--brand-400)",
                                  textDecoration: "none",
                                  maxWidth: 220,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <ArrowUpRight size={12} style={{ verticalAlign: "-2px" }} /> {s.title}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {(insightMeta.generatedAt || insightMeta.retrieval) && (
                      <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                        {insightMeta.generatedAt && `Generated ${formatDistanceToNow(new Date(insightMeta.generatedAt), { addSuffix: true })}`}
                        {insightMeta.stale && " · data has changed since"}
                        {insightMeta.retryAt && ` · AI quota reached, refresh available ${formatDistanceToNow(new Date(insightMeta.retryAt), { addSuffix: true })}`}
                        {insightMeta.retrieval && ` · ${retrievalLabel(insightMeta.retrieval)}`}
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                    {INSIGHT_FALLBACK[insightSource === "ai" || !insightSource ? "error" : insightSource]}
                    {insightSource === "quota" && insightMeta.retryAt &&
                      ` Insights resume ${formatDistanceToNow(new Date(insightMeta.retryAt), { addSuffix: true })}.`}
                  </p>
                )}
              </div>

              {/* Project progress */}
              <div className="card">
                <h3 style={{ fontWeight: 600, fontSize: "1rem", marginBottom: 20 }}>Project Progress</h3>
                {data.projects.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No projects yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {data.projects.map((p) => (
                      <Link key={p.id} href={`/projects/${p.id}/board`} style={{ textDecoration: "none", color: "inherit" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", marginBottom: 6 }}>
                          <span style={{ fontWeight: 500 }}>{p.name}</span>
                          <span style={{ color: "var(--text-muted)" }}>{p.done}/{p.total} tasks · {p.progress}%</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${p.progress}%`, background: p.progress === 100 ? "var(--success)" : undefined }} />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BarList({ items }: { items: { key: string; label: string; color: string; count: number; pct: number }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {items.map((d) => (
        <div key={d.key}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", marginBottom: 6 }}>
            <span>{d.label}</span>
            <span style={{ color: "var(--text-muted)" }}>{d.count} · {d.pct}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${d.pct}%`, background: d.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
