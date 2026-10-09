"use client";

import { useState, useEffect } from "react";

interface Task {
  id: string;
  title: string;
  project: { name: string };
  dueDate: string | null;
  priority: string;
  status: string;
}

export default function MyTasksPage() {
  const [filter, setFilter] = useState("incomplete");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    fetch("/api/tasks", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.data) setTasks(d.data);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  const filteredTasks = tasks.filter(t => 
    filter === "completed" ? t.status === "DONE" : t.status !== "DONE"
  );

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
        {loading ? (
          <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No {filter} tasks found.</div>
        ) : (
          filteredTasks.map((t) => (
            <div key={t.id} className="card card-hover" style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderRadius: 8 }}>
               <input type="checkbox" checked={t.status === "DONE"} readOnly style={{ marginRight: 16, width: 16, height: 16, cursor: "pointer", accentColor: "var(--brand-500)" }} />
               <div style={{ flex: 1 }}>
                 <div style={{ fontWeight: 500, fontSize: "0.9375rem" }}>{t.title}</div>
                 <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>{t.project?.name || "No Project"}</div>
               </div>
               <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                 <span className={`priority-dot priority-${t.priority}`} />
                 <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                   {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "No Due Date"}
                 </span>
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
