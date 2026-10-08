"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import VeloLogo from "@/components/VeloLogo";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.message || "Registration failed"); return; }
      localStorage.setItem("accessToken", data.data.accessToken);
      localStorage.setItem("refreshToken", data.data.refreshToken);
      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const passwordStrength = form.password.length === 0 ? 0
    : form.password.length < 6 ? 1
      : form.password.length < 8 ? 2
        : /[A-Z]/.test(form.password) && /[0-9]/.test(form.password) ? 4
          : 3;

  const strengthColors = ["", "#ef4444", "#f59e0b", "#06b6d4", "#22c55e"];
  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-bg)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40, textDecoration: "none", color: "inherit", justifyContent: "center" }}>
          <VeloLogo size={48} />
        </Link>

        <div className="card" style={{ padding: "32px" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8, textAlign: "center" }}>Create your account</h1>
          <p style={{ color: "var(--text-secondary)", marginBottom: 28, textAlign: "center", fontSize: "0.9375rem" }}>
            Free forever for teams of up to 5
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label className="label" htmlFor="reg-name">Full name</label>
              <input id="reg-name" type="text" className="input" placeholder="Jane Smith" value={form.name} onChange={update("name")} required minLength={2} />
            </div>
            <div>
              <label className="label" htmlFor="reg-email">Work email</label>
              <input id="reg-email" type="email" className="input" placeholder="jane@company.com" value={form.email} onChange={update("email")} required />
            </div>
            <div>
              <label className="label" htmlFor="reg-password">Password</label>
              <input id="reg-password" type="password" className="input" placeholder="Min 8 chars, 1 uppercase, 1 number" value={form.password} onChange={update("password")} required minLength={8} />
              {form.password.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 4, background: "var(--surface-3)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${passwordStrength * 25}%`, background: strengthColors[passwordStrength], borderRadius: 2, transition: "all 0.3s" }} />
                  </div>
                  <span style={{ fontSize: "0.75rem", color: strengthColors[passwordStrength], minWidth: 40 }}>
                    {strengthLabels[passwordStrength]}
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "10px 14px", fontSize: "0.875rem", color: "#f87171" }}>
                {error}
              </div>
            )}

            <button id="register-submit-btn" type="submit" className="btn btn-primary" disabled={loading} style={{ justifyContent: "center", padding: "12px 16px", marginTop: 4 }}>
              {loading ? "Creating account..." : "Create account →"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: 20, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Already have an account?{" "}
            <Link href="/auth/login" style={{ color: "var(--brand-400)", textDecoration: "none", fontWeight: 500 }}>Sign in</Link>
          </p>
        </div>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          By signing up you agree to our Terms & Privacy Policy
        </p>
      </div>
    </div>
  );
}
