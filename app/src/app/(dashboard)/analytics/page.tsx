"use client";

import { useState, useEffect } from "react";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setLoading(false);
    }, 700);
  }, []);

  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <h2 style={{ fontWeight: 600, fontSize: "1.125rem" }}>Analytics & Reports</h2>
        </div>
        <button className="btn btn-secondary btn-sm">Export CSV</button>
      </div>

      <div style={{ padding: "24px" }}>
        {loading ? (
          <div style={{ display: "grid", gap: 24 }}>
             <div className="skeleton" style={{ height: 300 }} />
             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div className="skeleton" style={{ height: 250 }} />
                <div className="skeleton" style={{ height: 250 }} />
             </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 24 }}>
            {/* Main Chart Placeholder */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
               <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
                 <h3 style={{ fontWeight: 600, fontSize: "1rem" }}>Organization Velocity (Last 6 Sprints)</h3>
               </div>
               <div style={{ height: 300, background: "var(--surface-2)", display: "flex", alignItems: "flex-end", padding: "20px 40px", gap: 40, justifyContent: "space-between" }}>
                  {/* Mock Bar Chart */}
                  {[45, 52, 38, 65, 55, 72].map((val, i) => (
                    <div key={i} style={{ flex: 1, background: "var(--gray-200)", height: `${val}%`, borderRadius: "4px 4px 0 0", position: "relative", transition: "all 0.2s" }} className="card-hover">
                      <span style={{ position: "absolute", top: -24, left: "50%", transform: "translateX(-50%)", fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 500 }}>{val}</span>
                    </div>
                  ))}
               </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 24 }}>
               {/* Task Distribution */}
               <div className="card">
                 <h3 style={{ fontWeight: 600, fontSize: "1rem", marginBottom: 20 }}>Task Distribution by Priority</h3>
                 <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {[
                      { label: "Critical", color: "var(--danger)", pct: 15 },
                      { label: "High", color: "var(--warning)", pct: 30 },
                      { label: "Medium", color: "var(--info)", pct: 45 },
                      { label: "Low", color: "var(--success)", pct: 10 },
                    ].map(d => (
                      <div key={d.label}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", marginBottom: 6 }}>
                          <span>{d.label}</span>
                          <span style={{ color: "var(--text-muted)" }}>{d.pct}%</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${d.pct}%`, background: d.color }} />
                        </div>
                      </div>
                    ))}
                 </div>
               </div>

               {/* AI Stats */}
               <div className="card ai-card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
                  
                  <h3 style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: 8, color: "var(--text-primary)" }}>AI Automation Value</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: 24 }}>
                    Your team saved approximately <strong>14 hours</strong> this week using AI task summarization and automated sprint planning.
                  </p>
                  <button className="btn btn-primary">View AI Audit Log</button>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
