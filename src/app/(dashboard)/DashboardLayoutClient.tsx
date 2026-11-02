"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import VeloLogo from "@/components/VeloLogo";
import NotificationBell from "@/components/NotificationBell";
import { CurrentUserContext, type CurrentUser } from "@/components/CurrentUserContext";
import { ROLE_BADGE } from "@/components/ProjectMembersModal";
import { apiFetch, clearSession } from "@/lib/client-api";
import { ROLE_LABEL } from "@/lib/permissions";
import {
  ChartColumn, CalendarDays, Folder, FolderKanban, LayoutDashboard, LogOut, PanelLeft,
  Search, Settings, SquareCheckBig, Users, type LucideIcon,
} from "lucide-react";

type NavItem = { icon: LucideIcon; title: string; subtitle: string; href: string };

const SEARCHABLE_PAGES: NavItem[] = [
  { icon: LayoutDashboard, title: "Dashboard", subtitle: "Page", href: "/dashboard" },
  { icon: FolderKanban, title: "Projects", subtitle: "Page", href: "/projects" },
  { icon: SquareCheckBig, title: "My Tasks", subtitle: "Page", href: "/tasks" },
  { icon: Users, title: "Team Directory", subtitle: "Page", href: "/team" },
  { icon: CalendarDays, title: "Calendar", subtitle: "Page", href: "/calendar" },
  { icon: ChartColumn, title: "Analytics & Reports", subtitle: "Page", href: "/analytics" },
  { icon: Settings, title: "Settings", subtitle: "Page", href: "/settings" },
];

const NAV_MAIN = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/projects", icon: FolderKanban, label: "Projects" },
  { href: "/tasks", icon: SquareCheckBig, label: "My Tasks" },
  { href: "/team", icon: Users, label: "Team" },
  { href: "/calendar", icon: CalendarDays, label: "Calendar" },
];

const NAV_REPORTS = [
  { href: "/analytics", icon: ChartColumn, label: "Reports & Analytics" },
];

const NAV_BOTTOM = [
  { href: "/settings", icon: Settings, label: "Settings" },
];

export default function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectItems, setProjectItems] = useState<NavItem[]>([]);

  const searchableItems = [...SEARCHABLE_PAGES, ...projectItems];
  const filteredSearch = searchableItems.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function closeSearch() {
    setIsSearchOpen(false);
    setSearchQuery("");
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === "Escape") {
        setIsSearchOpen(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Load real projects into the command palette each time it opens
  useEffect(() => {
    if (!isSearchOpen) return;
    apiFetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.data)) {
          setProjectItems(d.data.map((p: { id: string; name: string }) => ({
            icon: Folder, title: p.name, subtitle: "Project", href: `/projects/${p.id}/board`,
          })));
        }
      })
      .catch(console.error);
  }, [isSearchOpen]);

  useEffect(() => {
    if (!localStorage.getItem("accessToken") && !localStorage.getItem("refreshToken")) {
      router.push("/auth/login");
      return;
    }

    apiFetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.data) setUser(d.data); else router.push("/auth/login"); })
      .catch(() => router.push("/auth/login"));
  }, [router]);

  async function handleLogout() {
    const token = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ refreshToken }),
      });
    } catch (err) {
      console.error("Logout request failed", err);
    } finally {
      clearSession();
      router.push("/auth/login");
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100dvh", background: "var(--surface-bg)" }}>
      {/* Sidebar */}
      {isSidebarOpen && (
        <aside className="sidebar">
          {/* Workspace Switcher / Logo */}
          <div style={{ padding: "16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Link href="/dashboard" style={{ display: "flex", alignItems: "center", textDecoration: "none", color: "inherit" }}>
              <VeloLogo size={24} />
            </Link>
            <button className="btn-ghost" onClick={() => setIsSidebarOpen(false)} style={{ padding: 4, border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)" }}>
              <PanelLeft size={17} strokeWidth={1.75} />
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
                <span className={`badge ${ROLE_BADGE[user.role]}`} style={{ fontSize: "0.625rem" }} title={`Your role in ${user.workspace.name}`}>
                  {ROLE_LABEL[user.role]}
                </span>
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
                <item.icon size={17} strokeWidth={1.75} style={{ opacity: 0.75, flexShrink: 0 }} />
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
                <item.icon size={17} strokeWidth={1.75} style={{ opacity: 0.75, flexShrink: 0 }} />
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
                <item.icon size={17} strokeWidth={1.75} style={{ opacity: 0.75, flexShrink: 0 }} />
                {item.label}
              </Link>
            ))}
            <button onClick={handleLogout} className="sidebar-item" style={{ color: "var(--text-secondary)", marginTop: 2, width: "100%", display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", cursor: "pointer" }}>
              <LogOut size={17} strokeWidth={1.75} style={{ opacity: 0.75, flexShrink: 0 }} /> Sign out
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
                <PanelLeft size={17} strokeWidth={1.75} />
              </button>
            )}

            {/* Breadcrumbs Placeholder */}
            <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
              {user?.workspace.name ?? "Workspace"} <span style={{ fontSize: "0.75rem" }}>/</span> <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{pathname.split("/")[1]?.charAt(0).toUpperCase() + pathname.split("/")[1]?.slice(1) || "Dashboard"}</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Global Search */}
            <div
              style={{ position: "relative", cursor: "pointer" }}
              onClick={() => setIsSearchOpen(true)}
            >
              <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <div style={{ width: 240, padding: "6px 12px 6px 32px", fontSize: "0.8125rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Search workspace...</span>
                <span style={{ fontSize: "0.625rem", border: "1px solid var(--border)", padding: "2px 4px", borderRadius: 4 }}>Ctrl K</span>
              </div>
            </div>

            <NotificationBell />
          </div>
        </header>

        <main style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
          <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>
        </main>
      </div>

      {/* Command Palette / Search Modal */}
      {isSearchOpen && (
        <div className="modal-overlay" onClick={closeSearch} style={{ alignItems: "flex-start", paddingTop: "10vh" }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ padding: 0, overflow: "hidden", maxWidth: 600 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
              <Search size={20} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
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
                        closeSearch();
                        router.push(res.href);
                      }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--surface-1)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", color: "var(--text-secondary)" }}><res.icon size={16} strokeWidth={1.75} /></div>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: "0.9375rem" }}>{res.title}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{res.subtitle}</div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ padding: "32px 12px", textAlign: "center", color: "var(--text-muted)" }}>
                  No results found for &quot;{searchQuery}&quot;
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
