"use client";

import { useState, useEffect } from "react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarColor: string;
  activeTasks: number;
  capacity: number;
}


export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    fetch("/api/team", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.data) {
          // Map workload to capacity for compatibility
          setTeam(d.data.map((m: any) => ({ ...m, capacity: m.workload, avatarColor: m.avatarUrl || "var(--brand-500)" })));
        }
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <h2 style={{ fontWeight: 600, fontSize: "1.125rem" }}>Team Directory</h2>
        </div>
        <button className="btn btn-primary btn-sm">Invite Member</button>
      </div>

      <div style={{ padding: "24px" }}>
        
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
             {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 180 }} />)}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {team.map((member) => (
              <div key={member.id} className="card card-hover" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "32px 20px" }}>
                <div className="avatar avatar-lg" style={{ width: 64, height: 64, fontSize: "1.5rem", background: member.avatarColor, marginBottom: 16 }}>
                  {member.name.charAt(0)}
                </div>
                
                <h3 style={{ fontWeight: 600, fontSize: "1.125rem", color: "var(--text-primary)", marginBottom: 4 }}>{member.name}</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: 16 }}>{member.email}</p>
                
                <span className={`badge ${member.role === 'ADMIN' ? 'badge-brand' : member.role === 'MANAGER' ? 'badge-yellow' : 'badge-gray'}`} style={{ marginBottom: 24 }}>
                  {member.role}
                </span>

                <div style={{ width: "100%", background: "var(--surface-2)", padding: "12px", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                   <div style={{ textAlign: "left" }}>
                     <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Active Tasks</div>
                     <div style={{ fontWeight: 600, fontSize: "1.125rem" }}>{member.activeTasks}</div>
                   </div>
                   <div style={{ textAlign: "right" }}>
                     <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Workload</div>
                     <div style={{ fontWeight: 600, fontSize: "1.125rem", color: member.capacity > 90 ? "var(--danger)" : "var(--success)" }}>{member.capacity}%</div>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
