"use client";
import { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { TopBar } from "@/components/layout/TopBar";

type Status = "pending" | "in_progress" | "done" | "blocked";

interface Task {
  id: string; description: string; owner: string; due: string;
  status: Status; priority: string; source: string; overdue: boolean;
  progress?: number; aiSuggested?: boolean;
}

const INITIAL_TASKS: Task[] = [
  { id: "t1", description: "Review updated Q3 forecast models from finance team", owner: "Sarah Jenkins", due: "Oct 12", status: "pending", priority: "high", source: "Fwd: Q3 Numbers", overdue: false, aiSuggested: true },
  { id: "t2", description: "Draft initial response to Acme Corp acquisition proposal", owner: "David Chen", due: "Oct 10", status: "pending", priority: "urgent", source: "M&A Sync", overdue: true },
  { id: "t3", description: "Prepare board deck slides 10-15 focusing on APAC growth", owner: "David Chen", due: "Tomorrow", status: "in_progress", priority: "high", source: "Q3 Board Prep", overdue: false, progress: 65 },
  { id: "t4", description: "Finalize budget allocation for new IT infrastructure", owner: "David Chen", due: "Oct 15", status: "blocked", priority: "high", source: "IT Planning", overdue: false },
  { id: "t5", description: "Approve vendor contracts for Q4 marketing push", owner: "Ken", due: "Oct 10", status: "done", priority: "normal", source: "Vendor Review", overdue: false },
  { id: "t6", description: "Archive Q2 meeting notes", owner: "Utkarsh", due: "Jul 15", status: "done", priority: "low", source: "Admin", overdue: false },
  { id: "t7", description: "Update Q3 Dashboard with new KPI section", owner: "Utkarsh", due: "Aug 15", status: "pending", priority: "normal", source: "Q3 Review", overdue: false, aiSuggested: true },
];

const COLUMNS: { key: Status; label: string; dotColor: string; dotIcon?: string }[] = [
  { key: "pending", label: "Pending", dotColor: "var(--outline)" },
  { key: "in_progress", label: "In Progress", dotColor: "var(--primary)" },
  { key: "done", label: "Done", dotColor: "#137333", dotIcon: "check_circle" },
  { key: "blocked", label: "Blocked", dotColor: "var(--error)" },
];

const SOURCE_ICON: Record<string, string> = {
  "Fwd: Q3 Numbers": "mail",
  "M&A Sync": "groups",
  "Q3 Board Prep": "analytics",
  "IT Planning": "mail",
  "Vendor Review": "description",
  "Admin": "description",
  "Q3 Review": "groups",
};

function TaskCard({ task, index }: { task: Task; index: number }) {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="task-card"
          style={{
            ...provided.draggableProps.style,
            borderLeft: task.status === "in_progress" ? "3px solid var(--primary)"
              : task.status === "blocked" ? "3px solid var(--error)"
              : undefined,
          }}
        >
          {/* Source icon + task */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10, paddingRight: 24 }}>
            <span className="material-symbols-outlined" style={{
              fontSize: 15, color: "var(--primary)", flexShrink: 0, marginTop: 2,
            }}>
              {SOURCE_ICON[task.source] || "assignment"}
            </span>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--on-surface)", lineHeight: 1.4 }}>
              {task.description}
            </p>
          </div>

          {/* Blocked reason */}
          {task.status === "blocked" && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 6,
              padding: "6px 8px", background: "rgba(186,26,26,0.06)",
              border: "1px solid rgba(186,26,26,0.15)", borderRadius: 4,
              fontSize: 11, color: "var(--error)", marginBottom: 10,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13, marginTop: 1 }}>block</span>
              Waiting on security audit report from vendor.
            </div>
          )}

          {/* Progress bar */}
          {task.progress !== undefined && (
            <div style={{ marginBottom: 10 }}>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${task.progress}%` }} />
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%", background: "var(--surface-container)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 700, color: "var(--on-surface-variant)",
                border: "2px solid var(--surface-container-lowest)",
              }}>
                {task.owner.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
            </div>

            {task.overdue ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
                color: "#f57f17", background: "#fff8e1", padding: "2px 6px",
                borderRadius: 3, textTransform: "uppercase", letterSpacing: "0.04em",
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>warning</span>
                {task.due} (Overdue)
              </div>
            ) : task.status === "done" ? (
              <div style={{ fontSize: 11, color: "#137333", display: "flex", alignItems: "center", gap: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>done_all</span>
                Completed {task.due}
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--on-surface-variant)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>calendar_today</span>
                {task.due}
              </div>
            )}
          </div>

          {/* Source + AI badge */}
          <div style={{
            marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--outline-variant)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 11, color: "var(--on-surface-variant)", display: "flex", alignItems: "center", gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>link</span>
              {task.source}
            </span>
            {task.aiSuggested && (
              <span style={{
                fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em",
                padding: "2px 6px", borderRadius: 2,
                background: "var(--primary)", color: "var(--on-primary)",
              }}>
                AI Suggested
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [filterOwner, setFilterOwner] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterDue, setFilterDue] = useState("all");

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;
    setTasks(prev => prev.map(t =>
      t.id === draggableId ? { ...t, status: destination.droppableId as Status } : t
    ));
  };

  const owners = [...new Set(tasks.map(t => t.owner))];

  const colTasks = (status: Status) => tasks.filter(t => {
    if (t.status !== status) return false;
    if (filterOwner !== "all" && t.owner !== filterOwner) return false;
    if (filterDue === "overdue" && !t.overdue) return false;
    if (filterDue === "today" && !t.due.toLowerCase().includes("today")) return false;
    return true;
  });

  return (
    <>
      <header style={{
        height: 64, background: "var(--surface)", borderBottom: "1px solid var(--outline-variant)",
        display: "flex", alignItems: "center", padding: "0 32px", gap: 16, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--primary)" }}>Action Items</h1>
        </div>
        {/* Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            className="input select"
            style={{ width: "auto", fontSize: 12, padding: "5px 28px 5px 10px", borderRadius: 99, height: 32 }}
            value={filterOwner} onChange={e => setFilterOwner(e.target.value)}
          >
            <option value="all">Owner: All</option>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select
            className="input select"
            style={{ width: "auto", fontSize: 12, padding: "5px 28px 5px 10px", borderRadius: 99, height: 32 }}
            value={filterSource} onChange={e => setFilterSource(e.target.value)}
          >
            <option value="all">Source: All</option>
            <option value="meetings">Meetings</option>
            <option value="email">Emails</option>
          </select>
          <select
            className="input select"
            style={{ width: "auto", fontSize: 12, padding: "5px 28px 5px 10px", borderRadius: 99, height: 32 }}
            value={filterDue} onChange={e => setFilterDue(e.target.value)}
          >
            <option value="all">Due: Any Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--on-surface-variant)" }}>
          <button className="icon-btn" title="Notifications">
            <span className="material-symbols-outlined">notifications</span>
            <span className="badge-dot" />
          </button>
          <button className="icon-btn" title="Hub">
            <span className="material-symbols-outlined">hub</span>
          </button>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", background: "var(--secondary)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600,
            cursor: "pointer", border: "1px solid var(--outline-variant)", flexShrink: 0,
          }}>U</div>
        </div>
      </header>

      <div style={{ flex: 1, overflow: "auto", padding: 32, background: "var(--surface-bright)" }}>
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="kanban-board">
            {COLUMNS.map(col => (
              <div key={col.key} className="kanban-column">
                <div className="kanban-col-header">
                  <h3 className="kanban-col-title">
                    {col.dotIcon ? (
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: col.dotColor }}>
                        {col.dotIcon}
                      </span>
                    ) : (
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.dotColor, display: "inline-block" }} />
                    )}
                    {col.label}
                  </h3>
                  <span className="kanban-col-count"
                    style={col.key === "blocked" ? { background: "var(--error-container)", color: "var(--error)" } : {}}>
                    {colTasks(col.key).length}
                  </span>
                </div>
                <Droppable droppableId={col.key}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="kanban-col-body"
                      style={{
                        background: snapshot.isDraggingOver ? "var(--primary-fixed)" : undefined,
                        transition: "background 0.15s",
                        opacity: col.key === "done" ? 0.85 : 1,
                      }}
                    >
                      {colTasks(col.key).map((task, i) => (
                        <TaskCard key={task.id} task={task} index={i} />
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </>
  );
}
