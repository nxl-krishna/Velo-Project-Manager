"use client";

export default function CalendarPage() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.02em" }}>Calendar</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm">&lt; Prev</button>
          <button className="btn btn-secondary btn-sm">Today</button>
          <button className="btn btn-secondary btn-sm">Next &gt;</button>
        </div>
      </div>

      <div style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-2)", display: "flex", flexDirection: "column" }}>
        {/* Calendar Grid Header */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--border)" }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} style={{ padding: "12px", textAlign: "center", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>{d}</div>
          ))}
        </div>
        
        {/* Calendar Grid Body (Placeholder) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridAutoRows: "1fr", flex: 1 }}>
           {Array.from({ length: 35 }).map((_, i) => (
             <div key={i} style={{ borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: 8, minHeight: 100 }}>
                <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: 4 }}>{i > 2 ? i - 2 : ""}</div>
                {i === 12 && (
                  <div style={{ background: "var(--brand-500)", color: "white", padding: "2px 6px", borderRadius: 4, fontSize: "0.75rem", marginBottom: 4, cursor: "pointer" }}>
                    Beta Launch
                  </div>
                )}
                {i === 15 && (
                  <div style={{ background: "var(--info)", color: "white", padding: "2px 6px", borderRadius: 4, fontSize: "0.75rem", cursor: "pointer" }}>
                    Design Sync
                  </div>
                )}
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}
