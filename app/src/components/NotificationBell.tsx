"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { apiFetch } from "@/lib/client-api";
import { AtSign, Bell, Clock, MessageSquare, Pin, RefreshCw, UserPlus, type LucideIcon } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const POLL_INTERVAL_MS = 60000;

const TYPE_ICONS: Record<string, LucideIcon> = {
  ASSIGNMENT: Pin,
  STATUS_CHANGE: RefreshCw,
  DUE_DATE_REMINDER: Clock,
  INVITE: UserPlus,
  MENTION: AtSign,
  COMMENT: MessageSquare,
};

export default function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    return apiFetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) {
          setNotifications(d.data.notifications);
          setUnreadCount(d.data.unreadCount);
        }
      })
      .catch((err) => console.error("Failed to load notifications", err))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  async function markRead(body: { ids: string[] } | { all: true }) {
    const ids = "ids" in body ? new Set(body.ids) : null;
    setNotifications((prev) => prev.map((n) => (!ids || ids.has(n.id) ? { ...n, read: true } : n)));
    setUnreadCount((prev) => (ids ? Math.max(0, prev - ids.size) : 0));
    try {
      await apiFetch("/api/notifications", { method: "PATCH", body: JSON.stringify(body) });
    } catch (err) {
      console.error("Failed to mark notifications read", err);
      load();
    }
  }

  function handleOpen() {
    const next = !isOpen;
    setIsOpen(next);
    if (next) load();
  }

  function handleClickNotification(n: Notification) {
    if (!n.read) markRead({ ids: [n.id] });
    setIsOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div style={{ position: "relative" }} ref={containerRef}>
      <button
        onClick={handleOpen}
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
        style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)", position: "relative", display: "flex", alignItems: "center", padding: 4 }}
      >
        <Bell size={18} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -6, minWidth: 16, height: 16, padding: "0 4px",
            background: "var(--danger)", color: "white", borderRadius: 8, fontSize: "0.625rem", fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
          }}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 12, width: 360, background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", zIndex: 50, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markRead({ all: true })}
                style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "0.75rem", color: "var(--brand-500)", fontWeight: 500 }}
              >
                Mark all read
              </button>
            )}
          </div>
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {!loaded ? (
              <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading...</div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                You&apos;re all caught up.
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] ?? Bell;
                return (
                <div
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className="card-hover"
                  style={{ display: "flex", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border)", background: n.read ? "transparent" : "rgba(99, 102, 241, 0.05)", cursor: n.link ? "pointer" : "default" }}
                >
                  <Icon size={16} strokeWidth={1.75} style={{ marginTop: 2, flexShrink: 0, color: "var(--text-secondary)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: n.read ? 500 : 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>{n.title}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>{n.body}</div>
                  </div>
                  {!n.read && <span style={{ width: 8, height: 8, marginTop: 6, background: "var(--brand-500)", borderRadius: "50%", flexShrink: 0 }} />}
                </div>
                );
              })
            )}
          </div>
          <div style={{ padding: "8px", textAlign: "center", borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
            <Link href="/settings" style={{ fontSize: "0.75rem", color: "var(--brand-500)", textDecoration: "none", fontWeight: 500 }} onClick={() => setIsOpen(false)}>
              Notification Preferences
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
