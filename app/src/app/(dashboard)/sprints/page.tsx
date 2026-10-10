"use client";

import { useState, useEffect } from "react";
import { CalendarDays, CircleCheckBig, Sparkles } from "lucide-react";

interface Sprint {
  id: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "UPCOMING" | "COMPLETED";
  completedPoints: number;
  totalPoints: number;
}

const MOCK_SPRINTS: Sprint[] = [
  { id: "1", name: "Sprint 42 - Auth Polish", goal: "Finalize OAuth integrations and fix refresh token rotation edge cases.", startDate: "2026-10-01", endDate: "2026-10-15", status: "ACTIVE", completedPoints: 34, totalPoints: 55 },
  { id: "2", name: "Sprint 43 - AI Features", goal: "Ship task summarization and auto-assignment engine.", startDate: "2026-10-16", endDate: "2026-10-30", status: "UPCOMING", completedPoints: 0, totalPoints: 48 },
  { id: "3", name: "Sprint 41 - Core MVP", goal: "Initial release of the Kanban board and task management.", startDate: "2026-09-15", endDate: "2026-09-30", status: "COMPLETED", completedPoints: 62, totalPoints: 62 },
];

export default function SprintsPage() {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setSprints(MOCK_SPRINTS);
      setLoading(false);
    }, 500);
  }, []);

  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <h2 style={{ fontWeight: 600, fontSize: "1.125rem" }}>Sprints</h2>
        </div>
        <button className="btn btn-primary btn-sm" style={{ background: "linear-gradient(90deg, var(--brand-500), var(--info))", border: "none" }}>
          <Sparkles size={15} /> Start AI Planning
        </button>
        <button className="btn btn-secondary btn-sm">+ New Sprint</button>
      </div>

      <div style={{ padding: "24px", maxWidth: 1000, margin: "0 auto", width: "100%" }}>
        
        {loading ? (
          <div className="skeleton" style={{ height: 400 }} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Active Sprint Emphasis */}
            {sprints.filter(s => s.status === "ACTIVE").map(sprint => (
              <div key={sprint.id} className="card" style={{ border: "1px solid var(--brand-500)", boxShadow: "0 8px 32px rgba(99, 102, 241, 0.1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                      <h2 style={{ fontSize: "1.5rem", fontWeight: 700, background: "linear-gradient(90deg, #fff, var(--gray-400))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        {sprint.name}
                      </h2>
                      <span className="badge badge-green">Active Now</span>
                    </div>
                    <p style={{ color: "var(--text-secondary)" }}>{sprint.goal}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>{new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--warning)", marginTop: 4 }}>7 days remaining</div>
                  </div>
                </div>

                <div style={{ padding: "20px", background: "var(--surface-2)", borderRadius: 8, marginTop: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontWeight: 600 }}>Sprint Progress</span>
                    <span style={{ color: "var(--brand-400)", fontWeight: 600 }}>{sprint.completedPoints} / {sprint.totalPoints} pts</span>
                  </div>
                  <div className="progress-bar" style={{ height: 12, borderRadius: 6 }}>
                    <div className="progress-fill" style={{ width: `${(sprint.completedPoints / sprint.totalPoints) * 100}%`, borderRadius: 6 }} />
                  </div>
                </div>
              </div>
            ))}

            {/* Other Sprints */}
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginTop: 16 }}>Past & Upcoming Sprints</h3>
            <div style={{ display: "grid", gap: 16 }}>
              {sprints.filter(s => s.status !== "ACTIVE").map(sprint => (
                <div key={sprint.id} className="card card-hover" style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: sprint.status === "COMPLETED" ? "rgba(34, 197, 94, 0.1)" : "rgba(100, 116, 139, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: sprint.status === "COMPLETED" ? "var(--success)" : "var(--text-muted)" }}>
                    {sprint.status === "COMPLETED" ? <CircleCheckBig size={22} strokeWidth={1.75} /> : <CalendarDays size={22} strokeWidth={1.75} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontWeight: 600, fontSize: "1rem" }}>{sprint.name}</h4>
                    <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: 4 }}>
                      {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 500 }}>{sprint.completedPoints} / {sprint.totalPoints} pts</div>
                    <span className={`badge ${sprint.status === "COMPLETED" ? "badge-green" : "badge-gray"}`} style={{ marginTop: 4 }}>
                      {sprint.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
