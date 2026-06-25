"use client";
import { useState, useEffect, useCallback } from "react";
import {
  fetchEmails,
  classifyEmail,
  generateReplyDraft,
  type Email,
  type ClassifyResult,
} from "@/lib/api";

type Category = "all" | "meeting_request" | "follow_up" | "action_required" | "fyi" | "escalation" | "approval_request";

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: "all", label: "All Triaged", icon: "inbox" },
  { key: "meeting_request", label: "Meeting Request", icon: "event" },
  { key: "action_required", label: "Action Required", icon: "warning" },
  { key: "approval_request", label: "Approval", icon: "verified" },
  { key: "escalation", label: "Escalation", icon: "priority_high" },
  { key: "fyi", label: "FYI", icon: "info" },
];

// Fallback hardcoded emails used if backend is unreachable
const FALLBACK_EMAILS: Email[] = [
  {
    id: "e1", sender: "sarah@company.com", senderName: "Sarah Jenkins (Legal)",
    subject: "Q3 Compliance Audit Sign-off",
    preview: "The final draft of the Q3 compliance report is ready. I need your formal approval before we submit it to the board tomorrow.",
    body: `Hi,\n\nThe final draft of the Q3 compliance report is ready. I need your formal approval before we submit it to the board tomorrow. We've incorporated the changes discussed regarding PII handling.\n\nNo major flags remaining. Please confirm.\n\n- Sarah`,
    category: "approval_request", confidence: 0.98, time: "10:42 AM",
  },
  {
    id: "e2", sender: "david@company.com", senderName: "David Chen (Partnerships)",
    subject: "Acme Corp - Sync on Integration",
    preview: "Acme wants to schedule a technical sync next week to finalize the API integration timeline.",
    body: `Hi,\n\nAcme wants to schedule a technical sync next week to finalize the API integration timeline.\n\nCan you spare 30 mins?\n\nThanks,\nDavid`,
    category: "meeting_request", confidence: 0.95, time: "Yesterday",
  },
  {
    id: "e3", sender: "hr@company.com", senderName: "HR Department",
    subject: "Updated Holiday Schedule 2026",
    preview: "Please review the updated corporate holiday schedule for the upcoming year.",
    body: `Hi Team,\n\nPlease review the updated corporate holiday schedule for Q3/Q4 2026.\n\nNo action required.\n\nHR Team`,
    category: "fyi", confidence: 0.82, time: "Yesterday",
  },
  {
    id: "e4", sender: "cto@company.com", senderName: "CTO Office",
    subject: "URGENT: Production incident — action required",
    preview: "We have a critical production issue affecting 20% of users. Immediate action required.",
    body: `Urgent,\n\nWe have a critical production issue affecting 20% of users.\n\nImmediate escalation required. Please join the incident bridge.\n\nCTO Office`,
    category: "escalation", confidence: 0.97, time: "11:15 AM",
  },
  {
    id: "e5", sender: "finance@company.com", senderName: "Finance",
    subject: "Q3 budget approval needed by Friday",
    preview: "Please review and approve the attached Q3 budget proposal at your earliest convenience.",
    body: `Hi,\n\nPlease review and approve the attached Q3 budget proposal at your earliest convenience.\n\nDeadline: Friday EOD.\n\nFinance Team`,
    category: "approval_request", confidence: 0.91, time: "2:00 PM",
  },
];

const INTENT_COLOR_MAP: Record<string, { bg: string; color: string; border: string }> = {
  approval_request: { bg: "rgba(5,150,105,0.1)", color: "#059669", border: "rgba(5,150,105,0.2)" },
  meeting_request:  { bg: "rgba(52,89,165,0.1)", color: "#3459a5", border: "rgba(52,89,165,0.2)" },
  escalation:       { bg: "rgba(186,26,26,0.08)", color: "#ba1a1a", border: "rgba(186,26,26,0.2)" },
  fyi:              { bg: "var(--surface-container-high)", color: "var(--on-surface-variant)", border: "var(--outline-variant)" },
  action_required:  { bg: "rgba(186,26,26,0.08)", color: "#ba1a1a", border: "rgba(186,26,26,0.2)" },
  follow_up:        { bg: "#fff8e1", color: "#f57f17", border: "rgba(245,127,23,0.2)" },
  all:              { bg: "var(--surface-container)", color: "var(--on-surface-variant)", border: "var(--outline-variant)" },
};

const CATEGORY_INTENT_ICON: Record<string, string> = {
  approval_request: "verified",
  meeting_request:  "event",
  escalation:       "priority_high",
  fyi:              "info",
  action_required:  "warning",
  follow_up:        "replay",
};

export default function InboxPage() {
  const [emails, setEmails] = useState<Email[]>(FALLBACK_EMAILS);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [selectedEmail, setSelectedEmail] = useState<Email>(FALLBACK_EMAILS[0]);
  const [query, setQuery] = useState("");

  // Per-email AI state
  const [classifying, setClassifying] = useState<Record<string, boolean>>({});
  const [classifyResults, setClassifyResults] = useState<Record<string, ClassifyResult>>({});
  const [draftLoading, setDraftLoading] = useState<Record<string, boolean>>({});
  const [draftTexts, setDraftTexts] = useState<Record<string, string>>({});
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [declined, setDeclined] = useState<Record<string, boolean>>({});

  // Fetch emails from backend on mount
  useEffect(() => {
    async function load() {
      setLoadingEmails(true);
      const result = await fetchEmails();
      if (result.length > 0) {
        setEmails(result);
        setSelectedEmail(result[0]);
        setBackendOnline(true);
        console.log("[ExecAI Inbox] ✅ Loaded emails from backend:", result.length);
      } else {
        setBackendOnline(false);
        console.warn("[ExecAI Inbox] ⚠️  Backend unreachable — using fallback hardcoded emails");
      }
      setLoadingEmails(false);
    }
    load();
  }, []);

  const handleClassify = useCallback(async (email: Email) => {
    if (!email.body) {
      console.warn("[ExecAI Inbox] ⚠️  classifyEmail skipped — email has no body", { id: email.id });
      return;
    }
    setClassifying(prev => ({ ...prev, [email.id]: true }));
    const result = await classifyEmail({
      sender: email.sender,
      subject: email.subject,
      body: email.body,
      received_at: email.received_at,
    });
    if (result) {
      setClassifyResults(prev => ({ ...prev, [email.id]: result }));
    }
    setClassifying(prev => ({ ...prev, [email.id]: false }));
  }, []);

  const handleGetDraft = useCallback(async (email: Email) => {
    if (!email.body) {
      console.warn("[ExecAI Inbox] ⚠️  generateReplyDraft skipped — email has no body", { id: email.id });
      return;
    }
    setDraftLoading(prev => ({ ...prev, [email.id]: true }));
    const result = await generateReplyDraft({
      email_id: email.id,
      body: email.body,
      subject: email.subject,
      user_name: "Executive",
    });
    if (result?.body) {
      setDraftTexts(prev => ({ ...prev, [email.id]: result.body }));
    }
    setDraftLoading(prev => ({ ...prev, [email.id]: false }));
  }, []);

  const filtered = emails.filter(e => {
    if (activeCategory !== "all" && e.category !== activeCategory) return false;
    if (query && !e.subject?.toLowerCase().includes(query.toLowerCase()) &&
        !e.senderName?.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const categoryCounts = CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat.key] = cat.key === "all" ? emails.length : emails.filter(e => e.category === cat.key).length;
    return acc;
  }, {});

  const sel = selectedEmail;
  const selClassify = sel ? classifyResults[sel.id] : null;
  const selCategory = selClassify?.category ?? sel?.category ?? "all";
  const colors = INTENT_COLOR_MAP[selCategory] || INTENT_COLOR_MAP.all;
  const intentIcon = CATEGORY_INTENT_ICON[selCategory] ?? "mail";
  const intent = selClassify?.intent?.type?.replace(/_/g, " ") ?? sel?.category?.replace(/_/g, " ") ?? "Email";
  const confidence = selClassify ? Math.round(selClassify.confidence * 100) : Math.round((sel?.confidence ?? 0.85) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* Top Bar */}
      <header style={{
        height: 64, background: "var(--surface)", borderBottom: "1px solid var(--outline-variant)",
        display: "flex", alignItems: "center", padding: "0 32px", gap: 16, flexShrink: 0,
      }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <span className="material-symbols-outlined" style={{
            position: "absolute", left: 10, color: "var(--on-surface-variant)", fontSize: 18, pointerEvents: "none",
          }}>search</span>
          <input
            className="input"
            style={{ paddingLeft: 36, width: 256, fontSize: 13 }}
            placeholder="Search Inbox Intelligence..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        {/* Backend status indicator */}
        {backendOnline !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: backendOnline ? "#137333" : "#f57f17" }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: backendOnline ? "#137333" : "#f57f17", display: "inline-block",
            }} />
            {backendOnline ? "Backend Connected" : "Using Fallback Data"}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <button className="icon-btn" title="Notifications">
          <span className="material-symbols-outlined">notifications</span>
          <span className="badge-dot" />
        </button>
        <button className="icon-btn" title="Hub">
          <span className="material-symbols-outlined">hub</span>
        </button>
        <div style={{
          width: 32, height: 32, borderRadius: "50%", background: "var(--secondary)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, cursor: "pointer",
          border: "1px solid var(--outline-variant)", flexShrink: 0,
        }}>U</div>
      </header>

      {/* Three-pane layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Pane 1: Category Filter ── */}
        <div style={{
          width: 260, flexShrink: 0, borderRight: "1px solid var(--outline-variant)",
          background: "var(--surface-container-lowest)", display: "flex", flexDirection: "column", overflowY: "auto",
        }}>
          <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--outline-variant)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--on-surface)" }}>Intelligence</h2>
            <p style={{ fontSize: 13, color: "var(--on-surface-variant)", marginTop: 2 }}>AI Triaged Views</p>
          </div>
          <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                  padding: "8px 12px", borderRadius: 4, cursor: "pointer", border: "none",
                  background: activeCategory === cat.key ? "var(--surface-container-high)" : "transparent",
                  color: activeCategory === cat.key ? "var(--secondary)" : "var(--on-surface)",
                  fontWeight: activeCategory === cat.key ? 600 : 400, transition: "background 0.12s",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="material-symbols-outlined" style={{
                    fontSize: 18,
                    color: activeCategory === cat.key ? "var(--secondary)" : "var(--on-surface-variant)",
                  }}>{cat.icon}</span>
                  <span style={{ fontSize: 14 }}>{cat.label}</span>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, minWidth: 22, textAlign: "center",
                  padding: "1px 6px", borderRadius: 99,
                  background: cat.key === "escalation" ? "var(--error-container)" : "var(--surface-container)",
                  color: cat.key === "escalation" ? "var(--error)" : "var(--on-surface-variant)",
                }}>
                  {categoryCounts[cat.key] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Pane 2: Email List ── */}
        <div style={{
          flex: 1, borderRight: "1px solid var(--outline-variant)",
          background: "var(--surface-container-lowest)", display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid var(--outline-variant)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "var(--surface-container-lowest)", flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--on-surface)" }}>Needs Attention</h2>
              <span style={{
                padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 500,
                background: "var(--surface-container-high)", color: "var(--secondary)",
              }}>{loadingEmails ? "Loading..." : "AI Sorted"}</span>
            </div>
            <button className="icon-btn">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>filter_list</span>
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            {loadingEmails ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--on-surface-variant)", fontSize: 13 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, display: "block", marginBottom: 8, opacity: 0.5 }}>sync</span>
                Loading emails from backend...
              </div>
            ) : filtered.map(email => {
              const isSelected = selectedEmail?.id === email.id;
              const emailCategory = classifyResults[email.id]?.category ?? email.category ?? "all";
              const c = INTENT_COLOR_MAP[emailCategory] || INTENT_COLOR_MAP.all;
              const emailIntent = classifyResults[email.id]?.category?.replace(/_/g, " ") ?? email.category?.replace(/_/g, " ") ?? "Email";
              const emailConf = classifyResults[email.id]
                ? Math.round(classifyResults[email.id].confidence * 100)
                : Math.round((email.confidence ?? 0.85) * 100);
              return (
                <div
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  style={{
                    padding: 14, borderRadius: 6, cursor: "pointer", transition: "background 0.12s",
                    border: isSelected ? `1px solid var(--secondary)` : "1px solid var(--outline-variant)",
                    background: isSelected ? "var(--surface)" : "var(--surface-container-lowest)",
                    boxShadow: isSelected ? "var(--shadow-sm), 0 0 0 1px rgba(82,94,125,0.15)" : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {isSelected && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--secondary)", flexShrink: 0 }} />}
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--on-surface)" }}>{email.senderName ?? email.sender}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--on-surface-variant)" }}>{email.time ?? "—"}</span>
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 500, color: "var(--on-surface)", marginBottom: 6 }} className="truncate">
                    {email.subject}
                  </h3>
                  <p className="line-clamp-2" style={{ fontSize: 12, color: "var(--on-surface-variant)", marginBottom: 10 }}>
                    {email.preview ?? email.body?.slice(0, 100)}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500,
                      padding: "2px 8px", borderRadius: 3,
                      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{CATEGORY_INTENT_ICON[emailCategory] ?? "mail"}</span>
                      {emailIntent}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--secondary)" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>bolt</span>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{emailConf}% Confident</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Pane 3: Reading / Detail ── */}
        {sel && (
          <div style={{
            width: 420, flexShrink: 0, background: "var(--surface-container-lowest)",
            display: "flex", flexDirection: "column", overflowY: "auto",
            borderLeft: "1px solid var(--outline-variant)",
            boxShadow: "-4px 0 12px rgba(15,23,42,0.02)",
          }}>
            {/* Drawer header */}
            <div style={{
              padding: "14px 16px", borderBottom: "1px solid var(--outline-variant)",
              position: "sticky", top: 0, background: "rgba(250,248,255,0.9)",
              backdropFilter: "blur(8px)", zIndex: 10,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: colors.color, fontSize: 20 }}>
                  {intentIcon}
                </span>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--on-surface)", textTransform: "capitalize" }}>{intent}</h2>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Confidence badge */}
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                  background: confidence >= 90 ? "#e6f4ea" : "#fff8e1",
                  color: confidence >= 90 ? "#137333" : "#f57f17",
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: "middle" }}>bolt</span>
                  {confidence}%
                </span>
              </div>
            </div>

            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Original message */}
              <div style={{
                border: "1px solid var(--outline-variant)", borderRadius: 6, padding: 14,
                background: "var(--surface-bright)",
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid var(--outline-variant)",
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--on-surface)" }}>
                    From: {sel.senderName ?? sel.sender}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--on-surface-variant)" }}>Today, {sel.time ?? "—"}</span>
                </div>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--on-surface)", marginBottom: 8 }}>
                  Re: {sel.subject}
                </h4>
                <div style={{ fontSize: 13, color: "var(--on-surface-variant)", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                  {sel.body ?? sel.preview}
                </div>
              </div>

              {/* AI Classification Panel */}
              {selClassify ? (
                <div>
                  <h3 style={{
                    fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em",
                    color: "var(--on-surface-variant)", marginBottom: 6, padding: "0 2px",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>auto_awesome</span>
                    AI Extracted Intelligence
                  </h3>
                  <div style={{
                    background: "var(--surface-container-low)", border: "1px solid var(--outline-variant)",
                    borderRadius: 6, padding: 12,
                    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
                  }}>
                    {[
                      { label: "Category", value: selClassify.category?.replace(/_/g, " ") },
                      { label: "Priority", value: selClassify.priority },
                      { label: "Intent Type", value: selClassify.intent?.type?.replace(/_/g, " ") ?? "—" },
                      { label: "Agenda", value: selClassify.intent?.agenda ?? "—" },
                      { label: "Action Items", value: selClassify.intent?.action_items?.join(", ") || "None detected", full: true },
                    ].map((item, i) => (
                      <div key={i} style={(item as { full?: boolean }).full ? { gridColumn: "1/-1" } : {}}>
                        <span style={{ display: "block", fontSize: 11, color: "var(--on-surface-variant)", marginBottom: 2, textTransform: "capitalize" }}>
                          {item.label}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--on-surface)", textTransform: "capitalize" }}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  className="btn btn-outline btn-sm"
                  style={{ justifyContent: "center", gap: 6 }}
                  onClick={() => handleClassify(sel)}
                  disabled={classifying[sel.id]}
                >
                  {classifying[sel.id] ? (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: 15, animation: "spin 1s linear infinite" }}>sync</span>
                      AI is thinking...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>auto_awesome</span>
                      Classify with AI
                    </>
                  )}
                </button>
              )}

              {/* AI Draft Reply */}
              {!approved[sel.id] && !declined[sel.id] && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, padding: "0 2px" }}>
                    <h3 style={{
                      fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
                      color: "var(--secondary)", display: "flex", alignItems: "center", gap: 4,
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>auto_awesome</span>
                      {draftTexts[sel.id] ? "Suggested Reply" : "AI Reply Draft"}
                    </h3>
                    {draftTexts[sel.id] && (
                      <span style={{ fontSize: 11, color: "var(--on-surface-variant)" }}>Ready to send</span>
                    )}
                  </div>

                  {draftTexts[sel.id] ? (
                    <div style={{
                      border: "1px solid rgba(82,94,125,0.3)", borderRadius: 6, padding: 14,
                      background: "var(--surface)", position: "relative",
                      boxShadow: "0 0 0 1px rgba(82,94,125,0.1)",
                    }}>
                      <textarea
                        value={draftTexts[sel.id]}
                        onChange={e => setDraftTexts(prev => ({ ...prev, [sel.id]: e.target.value }))}
                        style={{
                          width: "100%", background: "transparent", border: "none", outline: "none",
                          fontSize: 13, color: "var(--on-surface)", resize: "none", height: 130,
                          fontFamily: "var(--font-sans)", lineHeight: 1.6,
                        }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#137333" }}>✓ AI Generated — Gemini</span>
                        <button className="btn btn-ghost btn-sm">Edit Draft</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ justifyContent: "center", gap: 6, width: "100%", borderStyle: "dashed" }}
                      onClick={() => handleGetDraft(sel)}
                      disabled={draftLoading[sel.id]}
                    >
                      {draftLoading[sel.id] ? (
                        <>
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>sync</span>
                          Generating AI draft...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit_note</span>
                          Get AI Draft Reply
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {approved[sel.id] && (
                <div style={{
                  padding: 14, background: "#e6f4ea", border: "1px solid #c3e6cb",
                  borderRadius: 6, textAlign: "center", color: "#137333", fontWeight: 600, fontSize: 13,
                }}>
                  ✓ Reply Approved & Sent
                </div>
              )}
              {declined[sel.id] && (
                <div style={{
                  padding: 14, background: "var(--error-container)", border: "1px solid rgba(186,26,26,0.2)",
                  borderRadius: 6, textAlign: "center", color: "var(--error)", fontWeight: 600, fontSize: 13,
                }}>
                  ✕ Declined
                </div>
              )}
            </div>

            {/* Footer Actions */}
            {!approved[sel.id] && !declined[sel.id] && (
              <div style={{
                marginTop: "auto", padding: "12px 16px",
                borderTop: "1px solid var(--outline-variant)",
                background: "var(--surface-container-lowest)",
                position: "sticky", bottom: 0,
                display: "flex", gap: 8,
              }}>
                {draftTexts[sel.id] ? (
                  <button
                    className="btn btn-approve"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => {
                      console.log("[ExecAI Inbox] 📤 Approving & sending reply for:", sel.subject);
                      setApproved(prev => ({ ...prev, [sel.id]: true }));
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
                    Approve & Send
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => handleGetDraft(sel)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
                    Generate Reply
                  </button>
                )}
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    console.log("[ExecAI Inbox] ❌ Declining email:", sel.subject);
                    setDeclined(prev => ({ ...prev, [sel.id]: true }));
                  }}
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
