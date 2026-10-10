"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/client-api";

export default function NewProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", description: "", status: "PLANNING" });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await apiFetch("/api/projects", {
        method: "POST",
        body: JSON.stringify(form)
      });

      if (res.ok) {
        onCreated();
        onClose();
      } else {
        const errData = await res.json();
        setErrorMsg(errData?.error?.message || "Failed to create project");
      }
    } catch {
      setErrorMsg("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontWeight: 700, fontSize: "1.25rem" }}>Create New Project</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: "4px 8px" }}>✕</button>
        </div>

        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="label" htmlFor="proj-name">Project name *</label>
            <input id="proj-name" className="input" placeholder="e.g. Website Redesign" value={form.name} onChange={(e) => setForm(p => ({...p, name: e.target.value}))} required />
          </div>
          <div>
            <label className="label" htmlFor="proj-desc">Description</label>
            <textarea id="proj-desc" className="input" style={{ resize: "vertical", minHeight: 80 }} placeholder="What is this project about?" value={form.description} onChange={(e) => setForm(p => ({...p, description: e.target.value}))} />
          </div>
          <div>
            <label className="label" htmlFor="proj-status">Status</label>
            <select id="proj-status" className="input" value={form.status} onChange={(e) => setForm(p => ({...p, status: e.target.value}))}>
              <option value="PLANNING">Planning</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
            </select>
          </div>
          {errorMsg && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "10px 14px", fontSize: "0.875rem", color: "#f87171" }}>
              {errorMsg}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1, justifyContent: "center" }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1, justifyContent: "center" }} id="create-project-confirm-btn">
              {loading ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
