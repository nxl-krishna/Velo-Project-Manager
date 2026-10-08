"use client";

import { useState } from "react";

export default function MyTasksPage() {
  const [filter, setFilter] = useState("incomplete");

  return (
    <div style={{ flex: 1, padding: "24px 32px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.02em" }}>My Tasks</h1>
        <button className="btn btn-primary btn-sm">Create Task</button>
      </div>

      <div style={{ display: "flex", gap: 16, borderBottom: "1px solid var(--border)", paddingBottom: 16, marginBottom: 24 }}>
        <button onClick={() => setFilter("incomplete")} style={{ background: "transparent", border: "none", color: filter === "incomplete" ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: filter === "incomplete" ? 600 : 500, fontSize: "0.875rem", cursor: "pointer" }}>Incomplete</button>
        <button onClick={() => setFilter("completed")} style={{ background: "transparent", border: "none", color: filter === "completed" ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: filter === "completed" ? 600 : 500, fontSize: "0.875rem", cursor: "pointer" }}>Completed</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { title: "Design review for new dashboard", project: "ProjectHub", due: "Today", priority: "HIGH" },
          { title: "Implement global search shortcut", project: "Web App", due: "Tomorrow", priority: "MEDIUM" },
          { title: "Update README documentation", project: "Marketing", due: "Oct 15", priority: "LOW" },
        ].map((t, i) => (
          <div key={i} className="card card-hover" style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderRadius: 8 }}>
             <input type="checkbox" style={{ marginRight: 16, width: 16, height: 16, cursor: "pointer", accentColor: "var(--brand-500)" }} />
             <div style={{ flex: 1 }}>
               <div style={{ fontWeight: 500, fontSize: "0.9375rem" }}>{t.title}</div>
               <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>{t.project}</div>
             </div>
             <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
               <span className={`priority-dot priority-${t.priority}`} />
               <span style={{ fontSize: "0.8125rem", color: t.due === "Today" ? "var(--danger)" : "var(--text-secondary)" }}>{t.due}</span>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
