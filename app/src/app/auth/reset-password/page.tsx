"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import VeloLogo from "@/components/VeloLogo";

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px", background: "var(--surface-bg)" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40, textDecoration: "none", color: "inherit" }}>
          <VeloLogo size={48} />
        </Link>
        <Suspense fallback={<p style={{ color: "var(--text-muted)" }}>Loading...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [linkState, setLinkState] = useState<"checking" | "valid" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => setLinkState(d.data?.valid ? "valid" : "invalid"))
      .catch(() => setLinkState("invalid"));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.code === "INVALID_TOKEN") setLinkState("invalid");
        setError(data.error?.message || "Could not reset the password");
        return;
      }
      // Any old session in this browser was revoked server-side
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      setDone(true);
      setTimeout(() => router.push("/auth/login"), 2500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 16 }}>Password updated</h1>
        <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 8, padding: "14px 16px", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: 20 }}>
          Your password was changed and you were signed out on all devices. Taking you to sign in...
        </div>
        <Link href="/auth/login" className="btn btn-primary" style={{ justifyContent: "center", textDecoration: "none" }}>Sign in now</Link>
      </>
    );
  }

  if (linkState === "checking") return <p style={{ color: "var(--text-muted)" }}>Checking your reset link...</p>;

  if (linkState === "invalid") {
    return (
      <>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 8 }}>Link expired</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
          This reset link is invalid, has expired, or was already used. Reset links last 30 minutes and work once.
        </p>
        <Link href="/auth/forgot-password" className="btn btn-primary" style={{ justifyContent: "center", textDecoration: "none" }}>
          Request a new link
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 8 }}>Choose a new password</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>
        At least 8 characters, with an uppercase letter and a number.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <label className="label" htmlFor="password">New password</label>
          <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm new password</label>
          <input id="confirm" type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "10px 14px", fontSize: "0.875rem", color: "#f87171" }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ justifyContent: "center", padding: "12px 16px" }}>
          {loading ? "Saving..." : "Update password"}
        </button>
      </form>
    </>
  );
}
