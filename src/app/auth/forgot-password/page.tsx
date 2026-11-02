"use client";

import { useState } from "react";
import Link from "next/link";
import VeloLogo from "@/components/VeloLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentMessage, setSentMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Something went wrong");
        return;
      }
      setSentMessage(data.data.message);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px", background: "var(--surface-bg)" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40, textDecoration: "none", color: "inherit" }}>
          <VeloLogo size={32} />
        </Link>

        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 8 }}>Forgot your password?</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>
          Enter the email you sign in with and we&apos;ll send you a link to choose a new password.
        </p>

        {sentMessage ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 8, padding: "14px 16px", fontSize: "0.875rem", lineHeight: 1.6 }}>
              {sentMessage} Check your inbox and spam folder. The link expires in 30 minutes.
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => setSentMessage("")} style={{ justifyContent: "center" }}>
              Use a different email
            </button>
          </div>
        ) : (
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
                autoFocus
                autoComplete="email"
              />
            </div>

            {error && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "10px 14px", fontSize: "0.875rem", color: "#f87171" }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ justifyContent: "center", padding: "12px 16px" }}>
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <p style={{ textAlign: "center", marginTop: 24, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          Remembered it?{" "}
          <Link href="/auth/login" style={{ color: "var(--brand-400)", textDecoration: "none", fontWeight: 500 }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
