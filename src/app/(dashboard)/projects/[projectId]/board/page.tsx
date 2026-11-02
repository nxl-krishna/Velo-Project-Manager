"use client";

import { useState, use, useEffect } from "react";
import { apiFetch } from "@/lib/client-api";
import ProjectMembersModal from "@/components/ProjectMembersModal";
import { CalendarDays, Flame, ListTree, MessageSquare, Plus, Sparkles, UserCheck, Users, X } from "lucide-react";

// Types
interface Assignee {
  user: { id: string; name: string; avatarUrl?: string };
}

interface Task {
  id: string;
  title: string;
  description?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: string;
  columnId?: string | null;
  labels: string[];
  dueDate?: string | null;
  storyPoints?: number | null;
  assignees: Assignee[];
  _count?: { comments: number; subTasks: number };
}

interface Column {
  id: string;
  name: string;
  color: string;
  position: number;
  tasks: Task[];
}

const PRIORITY_CONFIG = {
  LOW:      { color: "#22c55e", label: "Low" },
  MEDIUM:   { color: "#06b6d4", label: "Med" },
  HIGH:     { color: "#f59e0b", label: "High" },
  CRITICAL: { color: "#ef4444", label: "Crit" },
};

export default function BoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState("");

  const [loadError, setLoadError] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTeam, setShowTeam] = useState(false);

  useEffect(() => {
    apiFetch(`/api/projects/${projectId}/board`)
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          if (data.data.columns) {
            const loadedColumns: Column[] = data.data.columns;
            setColumns(loadedColumns);
            const linkedTaskId = new URLSearchParams(window.location.search).get("task");
            const linkedTask = linkedTaskId && loadedColumns.flatMap((c) => c.tasks).find((t) => t.id === linkedTaskId);
            if (linkedTask) setSelectedTask(linkedTask);
          }
          if (data.data.project?.name) setProjectName(data.data.project.name);
        } else {
          setLoadError(data.error?.message || "Failed to load board");
        }
      })
      .catch(err => {
        console.error("Failed to fetch board", err);
        setLoadError("Failed to load board");
      })
      .finally(() => setLoading(false));
  }, [projectId]);
  const [dragging, setDragging] = useState<{ taskId: string; fromColId: string } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<Record<string, string>>({});

  const [newTaskColId, setNewTaskColId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  async function handleCreateTask(colId: string) {
    if (!newTaskTitle.trim()) return;
    setIsCreatingTask(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: newTaskTitle,
          columnId: colId,
        })
      });
      if (res.ok) {
        const data = await res.json();
        // Optimistically add to column
        setColumns(prev => {
          const next = [...prev];
          const colIndex = next.findIndex(c => c.id === colId);
          if (colIndex !== -1) {
            next[colIndex] = { ...next[colIndex], tasks: [...next[colIndex].tasks, data.data] };
          }
          return next;
        });
        setNewTaskTitle("");
        setNewTaskColId(null);
      } else {
        const err = await res.json();
        alert(err?.error?.message || "Failed to create task");
      }
    } catch {
      alert("Error creating task");
    } finally {
      setIsCreatingTask(false);
    }
  }

  function handleDragStart(taskId: string, fromColId: string) {
    setDragging({ taskId, fromColId });
  }

  async function handleDrop(toColId: string) {
    if (!dragging) return;
    const { taskId, fromColId } = dragging;
    setDragging(null);
    setDragOver(null);
    if (fromColId === toColId) return;

    const previousColumns = columns;
    setColumns((prev) => {
      const next = prev.map((col) => ({ ...col, tasks: [...col.tasks] }));
      const fromCol = next.find((c) => c.id === fromColId);
      const toCol = next.find((c) => c.id === toColId);
      const taskIdx = fromCol?.tasks.findIndex((t) => t.id === taskId) ?? -1;
      if (!fromCol || !toCol || taskIdx === -1) return prev;
      const [task] = fromCol.tasks.splice(taskIdx, 1);
      toCol.tasks.push(task);
      return next;
    });

    try {
      const res = await apiFetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ columnId: toColId })
      });
      if (!res.ok) throw new Error((await res.json())?.error?.message || "Failed to move task");
      const { data } = await res.json();
      setColumns(prev => prev.map(col => ({
        ...col,
        tasks: col.tasks.map(t => t.id === data.id ? data : t)
      })));
    } catch (err) {
      console.error(err);
      setColumns(previousColumns);
      alert(err instanceof Error ? err.message : "Failed to move task");
    }
  }

  async function triggerAI(taskId: string, type: "summarize" | "assign") {
    setAiLoading(taskId + type);
    try {
      const res = await apiFetch(`/api/ai/tasks/${taskId}`, {
        method: "POST",
        body: JSON.stringify({ type })
      });
      const d = await res.json();
      setAiResult((p) => ({
        ...p,
        [taskId + type]: res.ok ? d.data?.result || "No result" : d.error?.message || "AI request failed",
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(null);
    }
  }

  const totalTasks = columns.reduce((sum, c) => sum + c.tasks.length, 0);
  const doneTasks = columns.find((c) => c.name === "Done")?.tasks.length ?? 0;
  const progress = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const boardAssignees = [
    ...new Map(columns.flatMap((c) => c.tasks.flatMap((t) => t.assignees.map((a) => [a.user.id, a.user] as const)))).values(),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>
      {/* Topbar */}
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <h2 style={{ fontWeight: 600, fontSize: "1rem" }}>{projectName ? projectName : "Project"} — Board</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
            <div className="progress-bar" style={{ width: 120 }}>
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{progress}% complete · {totalTasks} tasks</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="avatar-group">
            {boardAssignees.slice(0, 4).map((u) => (
              <div key={u.id} className="avatar avatar-sm" title={u.name} style={{ background: `hsl(${u.name.charCodeAt(0) * 47}, 60%, 40%)` }}>{u.name.charAt(0)}</div>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowTeam(true)} disabled={!!loadError}>
            <Users size={15} /> Team
          </button>
          <button 
            className="btn btn-primary btn-sm" 
            id="add-task-btn"
            onClick={() => { if (columns.length > 0) { setNewTaskColId(columns[0].id); setNewTaskTitle(""); } }}
          >
            <Plus size={15} /> Add Task
          </button>
        </div>
      </div>

      {/* Board */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
        {loading ? (
          <div style={{ display: "flex", gap: 16, height: "100%" }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton" style={{ width: 280, height: "100%", borderRadius: 8 }} />
            ))}
          </div>
        ) : loadError ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>{loadError}</div>
        ) : (
          <div className="board-container">
            {columns.map((col) => (
            <div
              key={col.id}
              className="kanban-column"
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
              onDrop={() => handleDrop(col.id)}
              onDragLeave={() => setDragOver(null)}
              style={{
                boxShadow: dragOver === col.id ? `0 0 0 2px ${col.color}` : undefined,
              }}
            >
              {/* Column header */}
              <div className="kanban-column-header">
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
                <span>{col.name}</span>
                <span className="badge badge-gray" style={{ marginLeft: "auto" }}>{col.tasks.length}</span>
              </div>

              {/* Tasks */}
              <div className="kanban-column-body">
                {col.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="task-card"
                    draggable
                    onDragStart={() => handleDragStart(task.id, col.id)}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => setSelectedTask(task)}
                    style={{ opacity: dragging?.taskId === task.id ? 0.4 : 1 }}
                    id={`task-card-${task.id}`}
                  >
                    {/* Priority + labels */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <div
                        className="priority-dot"
                        style={{ background: PRIORITY_CONFIG[task.priority].color }}
                        title={PRIORITY_CONFIG[task.priority].label}
                      />
                      {task.labels.slice(0, 2).map((l) => (
                        <span key={l} className="badge badge-gray" style={{ padding: "1px 6px", fontSize: "0.6875rem" }}>{l}</span>
                      ))}
                      {task.priority === "CRITICAL" && (
                        <span className="badge badge-red" style={{ marginLeft: "auto", fontSize: "0.6875rem", display: "inline-flex", alignItems: "center", gap: 3 }}><Flame size={11} /> Critical</span>
                      )}
                    </div>

                    {/* Title */}
                    <div style={{ fontWeight: 500, fontSize: "0.875rem", lineHeight: 1.4, marginBottom: 10 }}>
                      {task.title}
                    </div>

                    {/* AI result */}
                    {aiResult[task.id + "summarize"] && (
                      <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 6, padding: "8px 10px", fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 10 }}>
                        {aiResult[task.id + "summarize"]}
                      </div>
                    )}
                    {aiResult[task.id + "assign"] && (
                      <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6, padding: "8px 10px", fontSize: "0.8125rem", color: "#4ade80", lineHeight: 1.5, marginBottom: 10 }}>
                        {aiResult[task.id + "assign"]}
                      </div>
                    )}

                    {/* Footer */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                      <div style={{ display: "flex", gap: 8, fontSize: "0.75rem", color: "var(--text-muted)", alignItems: "center" }}>
                        {task._count?.comments ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><MessageSquare size={12} /> {task._count.comments}</span> : null}
                        {task._count?.subTasks ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><ListTree size={12} /> {task._count.subTasks}</span> : null}
                        {task.storyPoints ? <span className="badge badge-gray" style={{ padding: "1px 5px" }}>{task.storyPoints}pt</span> : null}
                        {task.dueDate && (
                          <span style={{ color: "var(--danger)", display: "inline-flex", alignItems: "center", gap: 3 }}><CalendarDays size={12} /> {new Date(task.dueDate).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" })}</span>
                        )}
                      </div>

                      {/* Assignees */}
                      <div className="avatar-group">
                        {task.assignees.slice(0, 3).map((a) => (
                          <div
                            key={a.user.id}
                            className="avatar avatar-sm"
                            title={a.user.name}
                            style={{ background: `hsl(${a.user.name.charCodeAt(0) * 47}, 60%, 40%)` }}
                          >
                            {a.user.name.charAt(0)}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* AI buttons */}
                    <div style={{ display: "flex", gap: 6, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: "3px 8px", fontSize: "0.75rem", color: "var(--brand-400)" }}
                        onClick={(e) => { e.stopPropagation(); triggerAI(task.id, "summarize"); }}
                        disabled={aiLoading === task.id + "summarize"}
                        id={`ai-summarize-${task.id}`}
                      >
                        {aiLoading === task.id + "summarize" ? (
                          <span className="ai-thinking">
                            <span className="ai-thinking-dot" />
                            <span className="ai-thinking-dot" />
                            <span className="ai-thinking-dot" />
                          </span>
                        ) : <><Sparkles size={12} /> Summarize</>}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: "3px 8px", fontSize: "0.75rem", color: "var(--success)" }}
                        onClick={(e) => { e.stopPropagation(); triggerAI(task.id, "assign"); }}
                        disabled={aiLoading === task.id + "assign"}
                        id={`ai-assign-${task.id}`}
                      >
                        {aiLoading === task.id + "assign" ? "..." : <><UserCheck size={12} /> Assign</>}
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add task button */}
                {newTaskColId === col.id ? (
                  <div style={{ padding: "8px", background: "var(--surface-1)", borderRadius: 6, marginTop: 8 }}>
                    <input
                      autoFocus
                      className="input"
                      style={{ width: "100%", marginBottom: 8 }}
                      placeholder="Task title..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newTaskTitle.trim()) handleCreateTask(col.id);
                        if (e.key === "Escape") { setNewTaskColId(null); setNewTaskTitle(""); }
                      }}
                      disabled={isCreatingTask}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleCreateTask(col.id)} disabled={isCreatingTask || !newTaskTitle.trim()}>
                        {isCreatingTask ? "Saving..." : "Save"}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setNewTaskColId(null); setNewTaskTitle(""); }} disabled={isCreatingTask}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ width: "100%", justifyContent: "flex-start", color: "var(--text-muted)", padding: "8px 6px", marginTop: 8 }}
                    onClick={() => { setNewTaskColId(col.id); setNewTaskTitle(""); }}
                    id={`add-task-${col.id}`}
                  >
                    + Add task
                  </button>
                )}
              </div>
            </div>
          ))}

            {/* Add column */}
            <div style={{ flex: "0 0 260px" }}>
              <button
                className="card"
                style={{ border: "2px dashed var(--border)", background: "transparent", cursor: "pointer", width: "100%", padding: "20px", display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: "0.9375rem" }}
                id="add-column-btn"
              >
                + Add column
              </button>
            </div>
          </div>
        )}
      </div>

      {showTeam && <ProjectMembersModal projectId={projectId} onClose={() => setShowTeam(false)} />}

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal 
          task={selectedTask} 
          projectId={projectId}
          onClose={() => setSelectedTask(null)} 
          onUpdateTask={(updatedTask) => {
            setColumns(prev => prev.map(col => ({
              ...col,
              tasks: col.tasks.map(t => t.id === updatedTask.id ? updatedTask : t)
            })));
            setSelectedTask(updatedTask);
          }}
        />
      )}
    </div>
  );
}

function TaskDetailModal({ task, projectId, onClose, onUpdateTask }: { task: Task; projectId: string; onClose: () => void; onUpdateTask: (t: Task) => void; }) {
  const pc = PRIORITY_CONFIG[task.priority] || { color: "gray", label: "None" };

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value ? new Date(e.target.value).toISOString() : null;
    const res = await apiFetch(`/api/projects/${projectId}/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({ dueDate: newDate })
    });
    if (res.ok) {
      const { data } = await res.json();
      onUpdateTask(data);
    }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620, maxHeight: "85vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: pc.color, flexShrink: 0 }} />
            <span className="badge badge-gray">{pc.label} priority</span>
            {task.storyPoints && <span className="badge badge-brand">{task.storyPoints} pts</span>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: "4px 8px" }} aria-label="Close"><X size={16} /></button>
        </div>

        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 16 }}>{task.title}</h2>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {task.labels.map((l) => (
            <span key={l} className="badge badge-brand">{l}</span>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20, padding: "16px", background: "var(--surface-2)", borderRadius: 10 }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>ASSIGNEES</div>
            <div className="avatar-group" style={{ flexWrap: "wrap", gap: 4 }}>
              {task.assignees.length ? task.assignees.map(a => (
                <div key={a.user.id} className="avatar" title={a.user.name} style={{ background: `hsl(${a.user.name.charCodeAt(0) * 47}, 60%, 40%)` }}>
                  {a.user.name.charAt(0)}
                </div>
              )) : <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Unassigned</span>}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>DUE DATE</div>
            <input 
              type="date" 
              className="input" 
              style={{ padding: "4px 8px", fontSize: "0.9375rem" }}
              defaultValue={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ""} 
              onChange={handleDateChange} 
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Description</div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", lineHeight: 1.7 }}>
            {task.description || "No description provided yet."}
          </p>
        </div>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Comments ({task._count?.comments ?? 0})</div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div className="avatar avatar-sm">U</div>
            <input className="input" placeholder="Add a comment..." style={{ flex: 1 }} id="comment-input" />
          </div>
        </div>
      </div>
    </div>
  );
}
