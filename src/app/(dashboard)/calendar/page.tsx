"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-api";

interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  priority: string;
  status: string;
  projectId: string;
  project?: { name: string };
}

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  
  useEffect(() => {
    apiFetch("/api/tasks?scope=projects")
      .then(r => r.json())
      .then(d => {
        if (d.data) setTasks(d.data);
      })
      .catch(console.error);
  }, []);

  const { calendarDays, monthName, year } = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    
    const startingDayOfWeek = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
    const totalDays = lastDay.getDate();
    
    const days = [];
    // Prev month padding
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    // Current month days
    for (let i = 1; i <= totalDays; i++) days.push(new Date(y, m, i));
    // Next month padding to complete grid
    while (days.length % 7 !== 0) days.push(null);
    
    return {
      calendarDays: days,
      monthName: firstDay.toLocaleString('default', { month: 'long' }),
      year: y
    };
  }, [currentDate]);

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const getTasksForDate = (date: Date) => {
    return tasks.filter(t => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d.getUTCDate() === date.getDate() && 
             d.getUTCMonth() === date.getMonth() && 
             d.getUTCFullYear() === date.getFullYear();
    });
  };

  const today = new Date();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.02em" }}>Calendar - {monthName} {year}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => changeMonth(-1)}>&lt; Prev</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setCurrentDate(new Date())}>Today</button>
          <button className="btn btn-secondary btn-sm" onClick={() => changeMonth(1)}>Next &gt;</button>
        </div>
      </div>

      <div style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-2)", display: "flex", flexDirection: "column" }}>
        {/* Calendar Grid Header */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--border)" }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} style={{ padding: "12px", textAlign: "center", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>{d}</div>
          ))}
        </div>
        
        {/* Calendar Grid Body */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridAutoRows: "1fr", flex: 1 }}>
           {calendarDays.map((date, i) => {
             const isToday = date && date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
             const dayTasks = date ? getTasksForDate(date) : [];
             
             return (
               <div key={i} style={{ borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: 8, minHeight: 100, background: isToday ? "var(--surface-1)" : "transparent" }}>
                  <div style={{ fontSize: "0.8125rem", color: isToday ? "var(--brand-500)" : "var(--text-muted)", marginBottom: 4, fontWeight: isToday ? 600 : 400 }}>
                    {date ? date.getDate() : ""}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {dayTasks.map(t => (
                      <div key={t.id} title={`${t.title}${t.project ? ` · ${t.project.name}` : ""}`} onClick={() => router.push(`/projects/${t.projectId}/board`)} style={{ 
                        background: t.priority === "HIGH" || t.priority === "CRITICAL" ? "var(--danger)" : "var(--brand-500)", 
                        opacity: t.status === "DONE" ? 0.5 : 1,
                        textDecoration: t.status === "DONE" ? "line-through" : "none",
                        color: "white", 
                        padding: "2px 6px", 
                        borderRadius: 4, 
                        fontSize: "0.75rem", 
                        cursor: "pointer",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}>
                        {t.title}
                      </div>
                    ))}
                  </div>
               </div>
             );
           })}
        </div>
      </div>
    </div>
  );
}
