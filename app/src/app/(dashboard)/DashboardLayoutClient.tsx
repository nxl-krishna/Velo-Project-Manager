"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import VeloLogo from "@/components/VeloLogo";

const NAV_MAIN = [
  { href: "/dashboard", icon: "⌂", label: "Dashboard" },
  { href: "/projects", icon: "◫", label: "Projects" },
  { href: "/tasks", icon: "✓", label: "My Tasks" },
  { href: "/team", icon: "👥", label: "Team" },
  { href: "/calendar", icon: "📅", label: "Calendar" },
];

const NAV_REPORTS = [
  { href: "/analytics", icon: "📊", label: "Reports & Analytics" },
];

const NAV_BOTTOM = [
  { href: "/settings", icon: "⚙", label: "Settings" },
];

export default function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const SEARCHABLE_ITEMS = [
    { icon: "⌂", title: "Dashboard", subtitle: "Page", href: "/dashboard" },
    { icon: "◫", title: "Projects", subtitle: "Page", href: "/projects" },
    { icon: "✓", title: "My Tasks", subtitle: "Page", href: "/tasks" },
    { icon: "👥", title: "Team Directory", subtitle: "Page", href: "/team" },
    { icon: "📅", title: "Calendar", subtitle: "Page", href: "/calendar" },
    { icon: "📊", title: "Analytics & Reports", subtitle: "Page", href: "/analytics" },
    { icon: "⚙", title: "Settings", subtitle: "Page", href: "/settings" },
    { icon: "📁", title: "Website Redesign", subtitle: "Project", href: "/projects/1/board" },
    { icon: "📁", title: "Mobile App v2.0", subtitle: "Project", href: "/projects/2/board" },
    { icon: "⚡", title: "Design review for new dashboard", subtitle: "Task", href: "/tasks" },
    { icon: "👤", title: "Alice Engineer", subtitle: "Team Member", href: "/team" },
  ];

  const filteredSearch = SEARCHABLE_ITEMS.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === "Escape" && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen]);

  // Reset search when modal closes
  useEffect(() => {
    if (!isSearchOpen) setSearchQuery("");
  }, [isSearchOpen]);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/auth/login"); return; }

    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (d.data) setUser(d.data); else router.push("/auth/login"); })
      .catch(() => router.push("/auth/login"));
  }, [router]);

  async function handleLogout() {
    const token = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ refreshToken }),
    });
    localStorage.clear();
    router.push("/auth/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100dvh", background: "var(--surface-bg)" }}>
      {/* Sidebar */}
      {isSidebarOpen && (
        <aside className="sidebar">
          {/* Workspace Switcher / Logo */}
          <div style={{ padding: "16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Link href="/dashboard" style={{ display: "flex", alignItems: "center", textDecoration: "none", color: "inherit" }}>
              <VeloLogo size={36} />
            </Link>
            <button className="btn-ghost" onClick={() => setIsSidebarOpen(false)} style={{ padding: 4, border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)" }}>
              ◫
            </button>
          </div>

          {/* User Profile Menu (Mini) */}
          {user && (
            <div style={{ padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, background: "var(--surface-2)", border: "1px solid var(--border)", cursor: "pointer" }}>
                <div className="avatar avatar-sm" style={{ background: "var(--gray-300)" }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, overflow: "hidden", fontSize: "0.8125rem", fontWeight: 500, whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {user.name}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>▼</div>
              </div>
            </div>
          )}

          {/* Nav */}
          <nav style={{ padding: "8px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            {NAV_MAIN.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-item ${pathname === item.href || pathname.startsWith(item.href + "/") ? "active" : ""}`}
              >
                <span style={{ fontSize: "1.125rem", width: 20, textAlign: "center", opacity: 0.7 }}>{item.icon}</span>
                {item.label}
              </Link>
            ))}

            <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", padding: "16px 8px 6px", marginTop: 8 }}>
              Insights
            </div>
            {NAV_REPORTS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-item ${pathname === item.href || pathname.startsWith(item.href + "/") ? "active" : ""}`}
              >
                <span style={{ fontSize: "1.125rem", width: 20, textAlign: "center", opacity: 0.7 }}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Bottom Settings */}
          <div style={{ padding: "12px", borderTop: "1px solid var(--border)" }}>
            {NAV_BOTTOM.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-item ${pathname === item.href || pathname.startsWith(item.href + "/") ? "active" : ""}`}
              >
                <span style={{ fontSize: "1.125rem", width: 20, textAlign: "center", opacity: 0.7 }}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
            <button onClick={handleLogout} className="sidebar-item" style={{ color: "var(--text-secondary)", marginTop: 2, width: "100%", display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", cursor: "pointer" }}>
              <span style={{ fontSize: "1.125rem", width: 20, textAlign: "center", opacity: 0.7 }}>🚪</span> Sign out
            </button>
          </div>
        </aside>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

        {/* Topbar Navigation */}
        <header style={{ height: 48, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", background: "var(--surface-bg)", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {!isSidebarOpen && (
              <button className="btn-ghost" onClick={() => setIsSidebarOpen(true)} style={{ padding: 4, border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
                ◫
              </button>
            )}

            {/* Breadcrumbs Placeholder */}
            <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
              Workspace <span style={{ fontSize: "0.75rem" }}>/</span> <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{pathname.split("/")[1]?.charAt(0).toUpperCase() + pathname.split("/")[1]?.slice(1) || "Dashboard"}</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Global Search */}
            <div
              style={{ position: "relative", cursor: "pointer" }}
              onClick={() => setIsSearchOpen(true)}
            >
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: "0.875rem" }}>🔍</span>
              <div style={{ width: 240, padding: "6px 12px 6px 32px", fontSize: "0.8125rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Search workspace...</span>
                <span style={{ fontSize: "0.625rem", border: "1px solid var(--border)", padding: "2px 4px", borderRadius: 4 }}>Ctrl K</span>
              </div>
            </div>

            {/* Notifications Panel Trigger */}
            <div style={{ position: "relative" }}>
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)", position: "relative" }}
              >
                🔔
                <span style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, background: "var(--danger)", borderRadius: "50%" }} />
              </button>

              {isNotificationsOpen && (
                <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 12, width: 340, background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", zIndex: 50, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: "0.9375rem" }}>
                    Notifications
                  </div>
                  <div style={{ maxHeight: 300, overflowY: "auto" }}>
                    {[
                      { title: "New Task Assigned", desc: "You were assigned to 'Design review for new dashboard'.", time: "5m ago", unread: true },
                      { title: "Project Update", desc: "Mobile App v2.0 sprint started.", time: "2h ago", unread: false },
                      { title: "System Alert", desc: "Velo has been updated to v1.2.0.", time: "1d ago", unread: false },
                    ].map((n, i) => (
                      <div key={i} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: n.unread ? "rgba(99, 102, 241, 0.05)" : "transparent", cursor: "pointer" }} className="card-hover">
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>{n.title}</span>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{n.time}</span>
                        </div>
                        <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>{n.desc}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: "8px", textAlign: "center", borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
                    <Link href="/settings" style={{ fontSize: "0.75rem", color: "var(--brand-500)", textDecoration: "none", fontWeight: 500 }} onClick={() => setIsNotificationsOpen(false)}>
                      Notification Preferences
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
          {children}
        </main>
      </div>

      {/* Command Palette / Search Modal */}
      {isSearchOpen && (
        <div className="modal-overlay" onClick={() => setIsSearchOpen(false)} style={{ alignItems: "flex-start", paddingTop: "10vh" }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ padding: 0, overflow: "hidden", maxWidth: 600 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: "1.25rem", color: "var(--text-muted)" }}>🔍</span>
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects, tasks, or teammates..."
                style={{ flex: 1, border: "none", background: "transparent", fontSize: "1.125rem", outline: "none", color: "var(--text-primary)" }}
              />
              <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", background: "var(--surface-1)", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)" }}>ESC</span>
            </div>
            <div style={{ padding: "12px 8px", maxHeight: 300, overflowY: "auto" }}>
              {filteredSearch.length > 0 ? (
                <>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", padding: "8px 12px", textTransform: "uppercase" }}>
                    {searchQuery ? "Results" : "Suggestions"}
                  </div>
                  {filteredSearch.map((res, i) => (
                    <div
                      key={i}
                      className="card-hover"
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", borderRadius: 6, cursor: "pointer" }}
                      onClick={() => {
                        setIsSearchOpen(false);
                        router.push(res.href);
                      }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--surface-1)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{res.icon}</div>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: "0.9375rem" }}>{res.title}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{res.subtitle}</div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ padding: "32px 12px", textAlign: "center", color: "var(--text-muted)" }}>
                  No results found for "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
