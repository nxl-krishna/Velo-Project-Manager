"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import VeloLogo from "@/components/VeloLogo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || "Login failed");
        return;
      }

      // Store tokens
      localStorage.setItem("accessToken", data.data.accessToken);
      localStorage.setItem("refreshToken", data.data.refreshToken);
      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      background: "var(--surface-bg)",
    }}>
      {/* Left panel */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
      }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40, textDecoration: "none", color: "inherit" }}>
            <VeloLogo size={48} />
          </Link>

          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 8 }}>
            Welcome back
          </h1>
          <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>
            Sign in to your workspace
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label className="label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label className="label" htmlFor="password" style={{ margin: 0 }}>Password</label>
                <Link href="#" style={{ fontSize: "0.8125rem", color: "var(--brand-400)", textDecoration: "none" }}>
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: "0.875rem",
                color: "#f87171",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ justifyContent: "center", padding: "12px 16px" }}
              id="login-submit-btn"
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <LoadingSpinner /> Signing in...
                </span>
              ) : "Sign in →"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: 24, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Don&apos;t have an account?{" "}
            <Link href="/auth/register" style={{ color: "var(--brand-400)", textDecoration: "none", fontWeight: 500 }}>
              Sign up free
            </Link>
          </p>
        </div>
      </div>

      {/* Right panel — brand showcase */}
      <div style={{
        flex: 1,
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{
            position: "absolute", top: "10%", right: "-20%",
            width: 400, height: 400,
            background: "radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)",
            borderRadius: "50%",
          }} />
        </div>

        <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 16, color: "white" }}>
            AI-powered{" "}
            <span className="gradient-text">intelligence</span>
            {" "}for every project
          </h2>
          <p style={{ color: "rgba(255, 255, 255, 0.7)", lineHeight: 1.7, maxWidth: 380 }}>
            Let AI handle task assignment, deadline prediction, and sprint planning — so your team can focus on what matters.
          </p>

          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              "✓ Smart task summarization",
              "✓ Automatic assignee suggestions",
              "✓ Deadline prediction from history",
              "✓ Natural language task creation",
            ].map((item) => (
              <div key={item} style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "0.9375rem" }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx={12} cy={12} r={10} stroke="currentColor" strokeWidth={2} strokeOpacity={0.25} />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
