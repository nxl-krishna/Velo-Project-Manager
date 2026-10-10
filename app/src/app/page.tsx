"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight, Bell, Building2, ChartColumn, Gauge, KanbanSquare, Sparkles, ShieldCheck, Timer, Type,
} from "lucide-react";
import VeloLogo from "@/components/VeloLogo";

export default function HomePage() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      {/* Hero Section */}
      <header style={{
        background: "linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e1b4b 100%)",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Animated background orbs */}
        <div style={{
          position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none",
        }}>
          <div style={{
            position: "absolute", top: "-20%", left: "60%",
            width: "600px", height: "600px",
            background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
            borderRadius: "50%",
          }} />
          <div style={{
            position: "absolute", bottom: "-30%", left: "-10%",
            width: "500px", height: "500px",
            background: "radial-gradient(circle, rgba(192,132,252,0.1) 0%, transparent 70%)",
            borderRadius: "50%",
          }} />
        </div>

        {/* Nav */}
        <nav style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 48px", position: "relative", zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <VeloLogo size={28} variant="light" />
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <Link href="/auth/login" className="btn btn-ghost">Sign in</Link>
            <Link href="/auth/register" className="btn btn-primary">Get started free</Link>
          </div>
        </nav>

        {/* Hero content */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{
          textAlign: "center", padding: "80px 24px 100px",
          position: "relative", zIndex: 10,
        }}>
          <div className="badge badge-brand" style={{ margin: "0 auto 24px", display: "inline-flex" }}>
            AI-Powered Project Management
          </div>
          <h1 style={{
            fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: "24px",
            maxWidth: "800px",
            margin: "0 auto 24px",
            color: "#ffffff",
          }}>
            Ship faster with{" "}
            <span className="gradient-text">AI-assisted</span>
            {" "}project intelligence
          </h1>
          <p style={{
            fontSize: "1.25rem",
            color: "#e2e8f0",
            maxWidth: "600px",
            margin: "0 auto 40px",
            lineHeight: 1.7,
          }}>
            Kanban boards, sprint planning, smart task assignment, and deadline prediction — all in one beautiful workspace.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/auth/register" className="btn btn-primary btn-lg">
              Start for free <ArrowRight size={18} />
            </Link>
            <Link href="#features" className="btn btn-secondary btn-lg">
              See how it works
            </Link>
          </div>
          <p style={{ marginTop: "16px", fontSize: "0.875rem", color: "var(--text-muted)" }}>
            No credit card required · Free forever for small teams
          </p>
        </motion.div>
      </header>

      {/* Feature grid */}
      <section id="features" style={{ padding: "80px 48px", background: "var(--surface-bg)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "2.25rem", fontWeight: 700, marginBottom: "16px" }}>
            Everything your team needs
          </h2>
          <p style={{ textAlign: "center", color: "var(--text-secondary)", marginBottom: "56px", fontSize: "1.125rem" }}>
            Built for engineering teams who move fast
          </p>

          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "20px",
          }}>
            {FEATURES.map((f, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                key={f.title} className="card card-hover" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(99,102,241,0.1)", color: "var(--brand-500)",
                }}>
                  <f.icon size={20} strokeWidth={1.75} />
                </div>
                <h3 style={{ fontWeight: 600, fontSize: "1.125rem" }}>{f.title}</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", lineHeight: 1.6 }}>
                  {f.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Stats section */}
      <section style={{
        padding: "60px 48px",
        background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(192,132,252,0.05))",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{
          maxWidth: 900, margin: "0 auto",
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "32px", textAlign: "center",
        }}>
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="gradient-text" style={{ fontSize: "2.5rem", fontWeight: 800 }}>{s.value}</div>
              <div style={{ color: "var(--text-secondary)", marginTop: "4px" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "80px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: "2.25rem", fontWeight: 700, marginBottom: "16px" }}>
          Ready to transform how you work?
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "32px", fontSize: "1.125rem" }}>
          Join teams shipping 40% faster with AI-powered workflows
        </p>
        <Link href="/auth/register" className="btn btn-primary btn-lg">
          Create your workspace <ArrowRight size={18} />
        </Link>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid var(--border)",
        padding: "24px 48px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        color: "var(--text-muted)",
        fontSize: "0.875rem",
      }}>
        <span>© 2026 Velo</span>
        <div style={{ display: "flex", gap: "24px" }}>
          <Link href="/api/health" style={{ color: "inherit", textDecoration: "none" }}>API Status</Link>
          <Link href="#" style={{ color: "inherit", textDecoration: "none" }}>Privacy</Link>
          <Link href="#" style={{ color: "inherit", textDecoration: "none" }}>Terms</Link>
        </div>
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    icon: KanbanSquare,
    title: "Kanban Boards",
    description: "Drag-and-drop tasks across fully customizable columns with real-time sync across your team.",
  },
  {
    icon: Sparkles,
    title: "AI Task Intelligence",
    description: "Automatically summarize tasks, suggest the best assignee, and predict deadlines from historical data.",
  },
  {
    icon: Timer,
    title: "Sprint Planning",
    description: "Plan sprints with AI recommendations. Track velocity, burndown, and team workload in real time.",
  },
  {
    icon: ShieldCheck,
    title: "Role-Based Access",
    description: "Granular RBAC with Admins, Managers, and Members. Keep sensitive data secure across teams.",
  },
  {
    icon: ChartColumn,
    title: "Analytics & Reports",
    description: "Sprint burndowns, workload views, and project progress dashboards. Make data-driven decisions.",
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    description: "Get alerted on due dates, mentions, and status changes via in-app and email notifications.",
  },
  {
    icon: Type,
    title: "Natural Language Tasks",
    description: "Type a sentence, get a fully structured task. AI parses priority, assignees, and due dates automatically.",
  },
  {
    icon: Building2,
    title: "Multi-Organization",
    description: "Manage multiple companies or clients from a single account with isolated workspaces.",
  },
  {
    icon: Gauge,
    title: "Prometheus Metrics",
    description: "Built-in /health and /metrics endpoints for production monitoring with your existing observability stack.",
  },
];

const STATS = [
  { value: "10x", label: "Faster onboarding" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "<200ms", label: "API response P95" },
  { value: "∞", label: "Scalability" },
];
