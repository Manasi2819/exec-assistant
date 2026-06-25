"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useToast } from "@/hooks/useToast";
import {
  fetchEmails,
  fetchMeetings,
  triggerPipeline,
  type Email,
  type Meeting,
  type PipelineResult,
} from "@/lib/api";

interface PriorityAction {
  id: string;
  type: string;
  typeIcon: string;
  confidence: number;
  confidenceColor: string;
  regarding: string;
  from: string;
  body: string;
  highlight: string | null;
  actionItems: { task: string; owner: string; ownerType: string }[] | null;
}

const today = new Date().toLocaleDateString("en-US", {
  weekday: "long", month: "long", day: "numeric", year: "numeric",
});

// ── Fallback static data (used if backend is unreachable) ─────────────────────
const FALLBACK_AGENDA = [
  {
    id: "a1", time: "09:00 AM", title: "Q3 Product Strategy Sync",
    desc: "Review finalized roadmap with Design & Eng leads.",
    status: "Brief Ready", statusType: "success", isNow: false,
    participants: ["JL", "KM", "RD"],
  },
  {
    id: "a2", time: "11:30 AM (Now)", title: "Vendor Negotiation: Acme Corp",
    desc: "AI flagged contract discrepancy in clause 4.2. Review suggested redlines before call.",
    status: "Action Req", statusType: "warning", isNow: true,
    participants: [],
  },
  {
    id: "a3", time: "02:00 PM", title: "Weekly All-Hands",
    desc: "Company-wide update. AI will record and summarize.",
    status: "MoM Pending", statusType: "neutral", isNow: false,
    participants: [],
  },
];

const FALLBACK_ACTIONS = [
  {
    id: "p1", type: "Drafted Reply", typeIcon: "mail", confidence: 98, confidenceColor: "#137333",
    regarding: "Urgent: Q4 Budget Reallocation Request", from: "Sarah Jenkins",
    body: `Hi Sarah,\n\nI have reviewed the proposed Q4 budget reallocation. Based on the current burn rate and the projected ROI of the new marketing initiative, I approve the shift of $50k from T&E to Digital Ad Spend as outlined in your memo.\n\nPlease proceed with updating the financial models. Let's touch base briefly on Thursday to review the initial ad campaign metrics.\n\nBest,`,
    highlight: "I approve the shift of $50k from T&E to Digital Ad Spend",
    actionItems: null,
  },
  {
    id: "p2", type: "MoM Review", typeIcon: "description", confidence: 85, confidenceColor: "#f5b041",
    regarding: "Board Meeting — Executive Summary", from: "System",
    body: "AI has generated the meeting minutes and extracted 3 key action items. One item requires manual assignment.",
    highlight: null,
    actionItems: [
      { task: "Finalize hiring plan for Q1", owner: "@HR_Lead", ownerType: "assigned" },
      { task: "Draft response to investor query on margins", owner: "Assign Owner", ownerType: "unassigned" },
    ],
  },
];

const FALLBACK_OVERDUE = [
  { id: "o1", task: "Sign off on Q3 expense reports", overdue: "2 days overdue" },
  { id: "o2", task: "Review proposed vendor SLA", overdue: "1 day overdue" },
];

const FALLBACK_INSIGHTS = [
  { text: "3 emails need responses before 5 PM", icon: "mail", type: "warning" },
  { text: "Board deck deadline is tomorrow", icon: "warning", type: "error" },
  { text: "98% confidence on Q3 budget reply", icon: "bolt", type: "success" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function meetingToAgendaItem(m: Meeting, index: number) {
  const dt = new Date(m.start_time);
  const timeStr = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const statusType = m.brief_status === "ready" ? "success" : "neutral";
  return {
    id: m.id,
    time: timeStr,
    title: m.title,
    desc: m.agenda_items?.join(", ") ?? "No agenda set.",
    status: m.brief_status === "ready" ? "Brief Ready" : "Pending",
    statusType,
    isNow: index === 0,
    participants: m.participants.map(p => p.slice(0, 2).toUpperCase()),
  };
}

function emailToPriorityAction(e: Email) {
  return {
    id: e.id,
    type: e.category === "approval_request" ? "Approval Needed" : "Action Required",
    typeIcon: e.category === "approval_request" ? "verified" : "warning",
    confidence: Math.round((e.confidence ?? 0.9) * 100),
    confidenceColor: (e.confidence ?? 0.9) >= 0.9 ? "#137333" : "#f5b041",
    regarding: e.subject,
    from: e.senderName ?? e.sender,
    body: e.preview ?? e.body?.slice(0, 200) ?? "",
    highlight: null,
    actionItems: null,
  };
}

export default function Dashboard() {
  const router = useRouter();
  const { toasts, showToast, removeToast } = useToast();
  const [agendaItems, setAgendaItems] = useState(FALLBACK_AGENDA);
  const [priorityActions, setPriorityActions] = useState<PriorityAction[]>(FALLBACK_ACTIONS);
  const [overdueItems, setOverdueItems] = useState(FALLBACK_OVERDUE);
  const [insights, setInsights] = useState(FALLBACK_INSIGHTS);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [editingAction, setEditingAction] = useState<PriorityAction | null>(null);
  const [editBody, setEditBody] = useState("");

  // Knowledge base query state
  const [kbQuery, setKbQuery] = useState("");
  const [kbResult, setKbResult] = useState<string | null>(null);
  const [kbLoading, setKbLoading] = useState(false);

  useEffect(() => {
    async function loadDashboardData() {
      setLoadingData(true);
      console.log("[ExecAI Dashboard] 🔄 Loading real data from backend...");

      const [meetings, approvalEmails] = await Promise.all([
        fetchMeetings(),
        fetchEmails("approval_request"),
      ]);

      const hasData = meetings.length > 0 || approvalEmails.length > 0;
      setBackendOnline(hasData);

      if (meetings.length > 0) {
        const realAgenda = meetings.map((m, i) => meetingToAgendaItem(m, i));
        setAgendaItems(realAgenda);
        console.log("[ExecAI Dashboard] ✅ Agenda loaded:", realAgenda.length, "meetings");
      } else {
        console.warn("[ExecAI Dashboard] ⚠️  No meetings from backend — using fallback agenda");
      }

      if (approvalEmails.length > 0) {
        const realActions = approvalEmails.map(emailToPriorityAction);
        setPriorityActions(realActions);
        console.log("[ExecAI Dashboard] ✅ Priority actions loaded:", realActions.length, "emails");
      } else {
        // Try all emails as fallback
        const allEmails = await fetchEmails();
        if (allEmails.length > 0) {
          const highPriority = allEmails.filter(e => e.priority === "high" || e.category === "approval_request");
          if (highPriority.length > 0) {
            setPriorityActions(highPriority.map(emailToPriorityAction));
            console.log("[ExecAI Dashboard] ✅ Priority actions from all emails:", highPriority.length);
          }
        } else {
          console.warn("[ExecAI Dashboard] ⚠️  No emails from backend — using fallback priority actions");
        }
      }

      setLoadingData(false);
    }

    loadDashboardData();
  }, []);

  const handleKbQuery = async () => {
    if (!kbQuery.trim()) return;
    setKbLoading(true);
    setKbResult(null);
    console.log("[ExecAI Dashboard] 🔄 Querying AI pipeline:", kbQuery);

    const result: PipelineResult | null = await triggerPipeline("user_query", { query: kbQuery });

    if (result) {
      // Extract the most useful text from the pipeline result
      const summary =
        result.reply_draft?.body ??
        (result.meeting_brief?.purpose) ??
        (result.email_category ? `Category: ${result.email_category}, Priority: ${result.email_priority}` : null) ??
        result.error ??
        "AI pipeline processed your query. Check browser console for full result.";
      setKbResult(summary);
      // Update insights with the query result
      setInsights(prev => [
        { text: `AI Query: "${kbQuery.slice(0, 40)}" — responded`, icon: "auto_awesome", type: "success" },
        ...prev.slice(0, 2),
      ]);
      console.log("[ExecAI Dashboard] ✅ Pipeline result:", result);
    } else {
      setKbResult("Backend pipeline is offline. Check the FastAPI server terminal for errors.");
      console.error("[ExecAI Dashboard] ❌ Pipeline trigger returned null — backend may be down");
    }
    setKbLoading(false);
  };

  const handleApprove = (action: PriorityAction) => {
    setPriorityActions(prev => prev.filter(a => a.id !== action.id));
    showToast(`✓ Approved & sent to ${action.from}: "${action.regarding.slice(0, 40)}${action.regarding.length > 40 ? '…' : ''}"`, "success");
  };

  const handleReject = (action: PriorityAction) => {
    setPriorityActions(prev => prev.filter(a => a.id !== action.id));
    showToast(`Rejected: "${action.regarding.slice(0, 45)}${action.regarding.length > 45 ? '…' : ''}"`, "warning");
  };

  const handleOpenEdit = (action: PriorityAction) => {
    setEditingAction(action);
    setEditBody(action.body);
  };

  const handleSaveEdit = () => {
    if (!editingAction) return;
    setPriorityActions(prev => prev.map(a => a.id === editingAction.id ? { ...a, body: editBody } : a));
    setEditingAction(null);
    showToast("Draft updated successfully.", "success");
  };

  const handleMarkOverdone = (id: string, task: string) => {
    setOverdueItems(prev => prev.filter(o => o.id !== id));
    showToast(`✓ "${task}" marked as complete.`, "success");
  };

  const handleAgendaClick = (item: typeof FALLBACK_AGENDA[0]) => {
    router.push("/meetings/m1/brief");
  };

  return (
    <>
      <TopBar title="Executive Dashboard" icon="insights" />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Edit Draft Modal */}
      {editingAction && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={e => e.target === e.currentTarget && setEditingAction(null)}
        >
          <div style={{
            background: "var(--surface)", borderRadius: 12, padding: 28,
            width: 540, boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--on-surface)", marginBottom: 4 }}>
              Edit Draft Reply
            </h3>
            <p style={{ fontSize: 12, color: "var(--on-surface-variant)", marginBottom: 16 }}>
              Regarding: <strong>{editingAction.regarding}</strong> · From: {editingAction.from}
            </p>
            <textarea
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
              style={{
                width: "100%", minHeight: 140, padding: 12, fontSize: 13,
                border: "1px solid var(--outline-variant)", borderRadius: 6,
                background: "var(--surface-container-low)", color: "var(--on-surface)",
                resize: "vertical", fontFamily: "inherit", lineHeight: 1.7,
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingAction(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}>
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>save</span>
                Save Draft
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="page-content">
        <div className="page-body animate-in">

          {/* Date header */}
          <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <p style={{ fontSize: 13, color: "var(--on-surface-variant)" }}>{today}</p>
              {backendOnline !== null && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500,
                  padding: "2px 8px", borderRadius: 99,
                  background: backendOnline ? "#e6f4ea" : "#fff8e1",
                  color: backendOnline ? "#137333" : "#f57f17",
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%", display: "inline-block",
                    background: backendOnline ? "#137333" : "#f57f17",
                  }} />
                  {backendOnline ? "Live Data" : "Fallback Mode"}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--on-surface-variant)" }}>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {priorityActions.length} Pending Approvals
              </span>
            </div>
          </div>

          {/* 3-Column Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 24 }}>

            {/* ── Column 1: Today's Agenda ── */}
            <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="section-header">
                <h3 className="section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>schedule</span>
                  Today&apos;s Agenda
                </h3>
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {loadingData ? "Loading..." : `${agendaItems.length} meetings`}
                </span>
              </div>

              <div className="timeline">
                {agendaItems.map((item) => (
                  <div key={item.id} className="timeline-item">
                    <div className={`timeline-dot ${item.isNow ? "active" : ""}`} />
                    <div
                      className="card-sm"
                      style={{
                        padding: 14, cursor: "pointer", transition: "background 0.15s",
                        border: item.isNow ? "1px solid var(--secondary)" : undefined,
                      }}
                      onClick={() => handleAgendaClick(item)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <p style={{
                          fontSize: 11, fontFamily: "var(--font-mono)",
                          color: item.isNow ? "var(--secondary)" : "var(--on-surface-variant)",
                          fontWeight: item.isNow ? 700 : 400,
                        }}>
                          {item.time}
                        </p>
                        <span
                          className="badge"
                          style={{
                            background: item.statusType === "success" ? "#e6f4ea" : item.statusType === "warning" ? "#fff8e1" : "var(--surface-container-high)",
                            color: item.statusType === "success" ? "#137333" : item.statusType === "warning" ? "#f57f17" : "var(--on-surface-variant)",
                          }}
                        >
                          {item.statusType === "warning" && (
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>warning</span>
                          )}
                          {item.status}
                        </span>
                      </div>
                      <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--on-surface)", marginBottom: 4 }}>
                        {item.title}
                      </h4>
                      <p className="line-clamp-2" style={{ fontSize: 13, color: "var(--on-surface-variant)" }}>
                        {item.desc}
                      </p>
                      {item.participants.length > 0 && (
                        <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
                          {item.participants.map((p, i) => (
                            <div key={i} style={{
                              width: 22, height: 22, borderRadius: "50%", background: "var(--surface-container)",
                              border: "2px solid var(--surface-container-lowest)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 9, fontWeight: 700, color: "var(--on-surface-variant)",
                              marginLeft: i > 0 ? -6 : 0,
                            }}>
                              {p}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Column 2: Priority Actions ── */}
            <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="section-header">
                <h3 className="section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--secondary)" }}>rule</span>
                  Priority Actions
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--on-surface-variant)" }}>
                    {loadingData ? "Loading..." : `${priorityActions.length} Pending`}
                  </span>
                  <a href="/inbox" style={{ fontSize: 12, color: "var(--secondary)", textDecoration: "none", fontWeight: 500 }}>View All</a>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {priorityActions.map((action) => (
                  <div key={action.id} className="card">
                    {/* Card Header */}
                    <div className="card-header">
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--on-surface-variant)" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{action.typeIcon}</span>
                        <span style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {action.type}
                        </span>
                      </div>
                      <div className="confidence-bar">
                        <span style={{ fontSize: 11, color: "var(--on-surface-variant)" }}>Confidence</span>
                        <div className="confidence-bar-track">
                          <div
                            className="confidence-bar-fill"
                            style={{ width: `${action.confidence}%`, background: action.confidenceColor }}
                          />
                        </div>
                        <span className="confidence-text" style={{ color: action.confidenceColor }}>
                          {action.confidence}%
                        </span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="card-body">
                      {action.regarding && (
                        <p style={{ fontSize: 12, color: "var(--on-surface-variant)", marginBottom: 10 }}>
                          Regarding: <strong style={{ color: "var(--on-surface)" }}>{action.regarding}</strong>
                          {action.from && ` from ${action.from}`}
                        </p>
                      )}

                      {action.body && !action.actionItems && (
                        <div style={{
                          background: "var(--surface-container-low)",
                          border: "1px solid var(--outline-variant)",
                          borderRadius: 4, padding: 12, fontSize: 13, color: "var(--on-surface)",
                          lineHeight: 1.6, whiteSpace: "pre-line", position: "relative",
                        }}>
                          {action.body}
                          <span className="material-symbols-outlined" style={{
                            position: "absolute", top: 8, right: 8, fontSize: 16,
                            color: "var(--outline-variant)", opacity: 0.6,
                          }}>
                            edit_note
                          </span>
                        </div>
                      )}

                      {action.actionItems && (
                        <>
                          <p style={{ fontSize: 13, color: "var(--on-surface-variant)", marginBottom: 12 }}>
                            {action.body}
                          </p>
                          <div style={{ border: "1px solid var(--outline-variant)", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{
                              background: "var(--surface-container-low)", padding: "6px 12px",
                              borderBottom: "1px solid var(--outline-variant)",
                              fontSize: 11, fontWeight: 600, color: "var(--on-surface)",
                            }}>
                              Extracted Action Items
                            </div>
                            {action.actionItems.map((ai, i) => (
                              <div key={i} style={{
                                padding: "8px 12px", display: "flex", justifyContent: "space-between",
                                alignItems: "center",
                                borderBottom: i < action.actionItems!.length - 1 ? "1px solid var(--outline-variant)" : "none",
                                background: ai.ownerType === "unassigned" ? "#fff8e1" : "transparent",
                                fontSize: 13,
                              }}>
                                <span style={{ color: "var(--on-surface)" }}>{ai.task}</span>
                                {ai.ownerType === "assigned" ? (
                                  <span style={{
                                    fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--secondary)",
                                    background: "rgba(82,94,125,0.1)", padding: "2px 6px", borderRadius: 3,
                                  }}>
                                    {ai.owner}
                                  </span>
                                ) : (
                                  <button className="btn btn-sm" style={{
                                    color: "#f57f17", border: "1px solid #f57f17",
                                    background: "transparent", fontSize: 11,
                                  }}>
                                    {ai.owner}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div className="card-footer">
                      <button className="btn btn-ghost btn-sm" onClick={() => handleReject(action)}>Reject</button>
                      <button className="btn btn-outline btn-sm" onClick={() => handleOpenEdit(action)}>Edit</button>
                      <button
                        className="btn btn-sm"
                        style={{ background: "#137333", color: "#fff", gap: 4 }}
                        onClick={() => handleApprove(action)}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>check</span>
                        Approve & Send
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Column 3: Focus Summary ── */}
            <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="section-header">
                <h3 className="section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>center_focus_strong</span>
                  Focus Summary
                </h3>
              </div>

              {/* Knowledge Base — AI Query */}
              <div className="card-sm" style={{ padding: 14 }}>
                <h4 style={{
                  fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em",
                  color: "var(--on-surface-variant)", marginBottom: 10,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>database</span>
                  Knowledge Base
                </h4>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ask AI about past decisions..."
                    style={{ fontSize: 13, paddingRight: 40 }}
                    value={kbQuery}
                    onChange={e => setKbQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleKbQuery()}
                  />
                  <button
                    style={{
                      position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", color: "var(--secondary)",
                      display: "flex", alignItems: "center",
                    }}
                    onClick={handleKbQuery}
                    disabled={kbLoading}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                      {kbLoading ? "sync" : "send"}
                    </span>
                  </button>
                </div>
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {['"Last week\'s OKR status"', '"Project Apollo risks"'].map((s, i) => (
                    <span
                      key={i}
                      className="chip chip-inactive"
                      style={{ fontSize: 11, cursor: "pointer" }}
                      onClick={() => setKbQuery(s.replace(/"/g, ""))}
                    >
                      {s}
                    </span>
                  ))}
                </div>
                {kbResult && (
                  <div style={{
                    marginTop: 10, padding: 10, borderRadius: 4, fontSize: 12, lineHeight: 1.6,
                    background: "var(--surface-container-low)", border: "1px solid var(--outline-variant)",
                    color: "var(--on-surface)",
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--secondary)", display: "block", marginBottom: 4 }}>
                      ✦ AI Response
                    </span>
                    {kbResult}
                  </div>
                )}
              </div>

              {/* Overdue Actions */}
              <div className="card">
                <div className="card-header" style={{ background: "rgba(186,26,26,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--error)" }}>
                      assignment_late
                    </span>
                    <h4 style={{
                      fontSize: 11, fontWeight: 600, textTransform: "uppercase",
                      letterSpacing: "0.04em", color: "var(--error)",
                    }}>
                      Overdue Actions ({overdueItems.length})
                    </h4>
                  </div>
                </div>
                <div>
                  {overdueItems.length === 0 ? (
                    <div style={{ padding: "16px 14px", fontSize: 13, color: "#137333", display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="material-symbols-outlined fill-icon" style={{ fontSize: 16, color: "#137333" }}>check_circle</span>
                      All caught up!
                    </div>
                  ) : overdueItems.map((item, i) => (
                    <div key={item.id} style={{
                      padding: "10px 14px",
                      borderBottom: i < overdueItems.length - 1 ? "1px solid var(--outline-variant)" : "none",
                      cursor: "pointer", transition: "background 0.12s",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}
                      onClick={() => handleMarkOverdone(item.id, item.task)}
                    >
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--on-surface)", lineHeight: 1.4 }}>
                          {item.task}
                        </p>
                        <span style={{ fontSize: 11, color: "var(--error)", fontWeight: 500 }}>{item.overdue}</span>
                      </div>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--outline)", flexShrink: 0 }}>check_circle</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Quick Insights */}
              <div className="card-sm" style={{ padding: 14 }}>
                <h4 style={{
                  fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em",
                  color: "var(--on-surface-variant)", marginBottom: 10,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>auto_awesome</span>
                  AI Quick Insights
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {insights.map((insight, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12,
                      color: "var(--on-surface-variant)",
                    }}>
                      <span className="material-symbols-outlined" style={{
                        fontSize: 15, flexShrink: 0, marginTop: 1,
                        color: insight.type === "error" ? "var(--error)" : insight.type === "warning" ? "#f57f17" : "#137333",
                      }}>
                        {insight.icon}
                      </span>
                      <span>{insight.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
