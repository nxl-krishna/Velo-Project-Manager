"use client";

import { useState, useRef, useEffect } from "react";
import { apiFetch } from "@/lib/client-api";
import { Bell, Construction, CreditCard, Lock, Palette, User } from "lucide-react";

type NotificationKey = "emailMentions" | "emailAssignments" | "pushReminders" | "marketing";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) {
          setName(d.data.name ?? "");
          setEmail(d.data.email ?? "");
          if (d.data.avatarUrl) setAvatarUrl(d.data.avatarUrl);
        }
      })
      .catch(console.error);
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (avatarUrl?.startsWith("blob:")) URL.revokeObjectURL(avatarUrl);
      setAvatarUrl(URL.createObjectURL(file));
    }
  };
  const [notifications, setNotifications] = useState<Record<NotificationKey, boolean>>({
    emailMentions: true,
    emailAssignments: true,
    pushReminders: false,
    marketing: false
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => setLoading(false), 800);
  };

  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", background: "var(--surface-bg)" }}>
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <h2 style={{ fontWeight: 600, fontSize: "1.125rem" }}>Settings</h2>
        </div>
      </div>

      <div style={{ padding: "32px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
        
        <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
          
          {/* Sidebar Nav */}
          <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { id: "profile", icon: User, label: "My Profile" },
              { id: "notifications", icon: Bell, label: "Notifications" },
              { id: "security", icon: Lock, label: "Security" },
              { id: "appearance", icon: Palette, label: "Appearance" },
              { id: "billing", icon: CreditCard, label: "Billing" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                  background: activeTab === tab.id ? "rgba(99, 102, 241, 0.1)" : "transparent",
                  color: activeTab === tab.id ? "var(--brand-400)" : "var(--text-secondary)",
                  border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left",
                  fontWeight: activeTab === tab.id ? 600 : 500, fontSize: "0.9375rem",
                  transition: "all 0.15s"
                }}
                className={activeTab !== tab.id ? "sidebar-item" : ""}
              >
                <tab.icon size={17} strokeWidth={1.75} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Main Content Area */}
          <div style={{ flex: 1 }}>
            
            {/* PROFILE TAB */}
            {activeTab === "profile" && (
              <div className="card" style={{ animation: "fadeIn 0.2s ease" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 8 }}>Profile Settings</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: 32 }}>
                  Update your personal information and how others see you on the platform.
                </p>

                <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
                   <div className="avatar" style={{ 
                      width: 80, height: 80, fontSize: "2rem", 
                      background: avatarUrl ? "transparent" : "var(--brand-600)",
                      backgroundImage: avatarUrl ? `url(${avatarUrl})` : "none",
                      backgroundSize: "cover",
                      backgroundPosition: "center"
                    }}>
                     {!avatarUrl && name.charAt(0)}
                   </div>
                   <div>
                     <input 
                       type="file" 
                       accept="image/jpeg,image/png,image/gif" 
                       style={{ display: "none" }} 
                       ref={fileInputRef} 
                       onChange={handleAvatarChange}
                     />
                     <button 
                       type="button"
                       className="btn btn-secondary btn-sm" 
                       style={{ marginBottom: 8 }}
                       onClick={() => fileInputRef.current?.click()}
                     >
                       Upload new avatar
                     </button>
                     <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>JPG, GIF or PNG. Max size of 800K.</div>
                   </div>
                </div>

                <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    <div>
                      <label className="label">Full Name</label>
                      <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div>
                      <label className="label">Email Address</label>
                      <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                  </div>
                  
                  <div>
                    <label className="label">Bio</label>
                    <textarea className="input" style={{ minHeight: 100, resize: "vertical" }} placeholder="Tell us a little about yourself..." defaultValue="Full-stack developer building awesome tools." />
                  </div>

                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      {loading ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* NOTIFICATIONS TAB */}
            {activeTab === "notifications" && (
              <div className="card" style={{ animation: "fadeIn 0.2s ease" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 8 }}>Notification Preferences</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: 32 }}>
                  Choose what updates you want to receive and how.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {([
                    { id: "emailMentions", title: "Email Mentions", desc: "Get an email when someone @mentions you in a task or comment." },
                    { id: "emailAssignments", title: "Task Assignments", desc: "Get notified when a new task is assigned to you." },
                    { id: "pushReminders", title: "Push Reminders", desc: "Receive browser push notifications for approaching deadlines." },
                    { id: "marketing", title: "Marketing Emails", desc: "Receive updates about new features and product announcements." },
                  ] satisfies { id: NotificationKey; title: string; desc: string }[]).map(item => (
                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>{item.title}</div>
                        <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>{item.desc}</div>
                      </div>
                      <label style={{ position: "relative", display: "inline-block", width: 44, height: 24 }}>
                        <input 
                          type="checkbox" 
                          style={{ opacity: 0, width: 0, height: 0 }} 
                          checked={notifications[item.id]} 
                          onChange={(e) => setNotifications({...notifications, [item.id]: e.target.checked})}
                        />
                        <span style={{ 
                          position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0, 
                          backgroundColor: notifications[item.id] ? "var(--brand-500)" : "var(--surface-3)", 
                          borderRadius: 34, transition: "0.2s" 
                        }}>
                          <span style={{
                            position: "absolute", content: '""', height: 18, width: 18, left: 3, bottom: 3,
                            backgroundColor: "white", borderRadius: "50%", transition: "0.2s",
                            transform: notifications[item.id] ? "translateX(20px)" : "translateX(0)"
                          }} />
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECURITY TAB */}
            {activeTab === "security" && (
              <div className="card" style={{ animation: "fadeIn 0.2s ease" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 8 }}>Security</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: 32 }}>
                  Manage your password and security settings.
                </p>

                <form style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <label className="label">Current Password</label>
                    <input type="password" className="input" placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="label">New Password</label>
                    <input type="password" className="input" placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="label">Confirm New Password</label>
                    <input type="password" className="input" placeholder="••••••••" />
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <button type="button" className="btn btn-primary">Update Password</button>
                  </div>
                </form>

                <div style={{ marginTop: 40, borderTop: "1px solid var(--border)", paddingTop: 24 }}>
                  <h4 style={{ color: "var(--danger)", fontWeight: 600, marginBottom: 8 }}>Danger Zone</h4>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: 16 }}>
                    Permanently delete your account and all of your data. This action cannot be undone.
                  </p>
                  <button className="btn btn-danger">Delete Account</button>
                </div>
              </div>
            )}

            {/* PLACEHOLDER FOR OTHERS */}
            {["appearance", "billing"].includes(activeTab) && (
              <div className="card" style={{ animation: "fadeIn 0.2s ease", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, color: "var(--text-muted)" }}>
                 <Construction size={40} strokeWidth={1.5} style={{ marginBottom: 16 }} />
                 <h3 style={{ fontWeight: 600, color: "var(--text-primary)" }}>Coming Soon</h3>
                 <p style={{ fontSize: "0.875rem", marginTop: 8 }}>This settings panel is under construction.</p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
