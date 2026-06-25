"use client";
import { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useToast } from "@/hooks/useToast";

const MOCK_MOMS = [
  {
    mom_id: "mom-1",
    meeting_title: "Q3 Dashboard Review",
    meeting_date: "Jun 24, 2026",
    attendees: ["James (VP Analytics)", "Ken (Data Lead)", "Utkarsh (Director)"],
    discussion_summary:
      "The team reviewed Q3 performance metrics and identified a 12% revenue shortfall against forecast. James presented root cause analysis attributing the gap to delayed KPI data refresh. The team aligned on immediate action to fix the missing dashboard tiles and automate the data refresh pipeline. Ken confirmed the month-end report delay was caused by data source latency. All action items were assigned with clear deadlines.",
    decisions: [
      "Revenue KPI shortfall root cause: delayed data refresh — fix by Aug 12",
      "New KPI section to be added to production dashboard before Aug 15",
      "Automated data refresh pipeline to be activated by end of Q3",
      "Monthly report delivery process to be reviewed and streamlined",
    ],
    action_items: [
      { description: "Update Q3 Dashboard with new KPI section", owner: "Utkarsh", due_date: "Aug 15", confidence: 0.95 },
      { description: "Validate month-end revenue metrics with Finance", owner: "James", due_date: "Aug 12", confidence: 0.92 },
      { description: "Activate automated data refresh pipeline", owner: "Utkarsh", due_date: "Aug 10", confidence: 0.88 },
      { description: "Fix missing KPI tiles in production dashboard", owner: "Dev Team", due_date: "Aug 10", confidence: 0.97 },
    ],
    approval_status: "pending",
  },
  {
    mom_id: "mom-2",
    meeting_title: "Sprint 22 Planning",
    meeting_date: "Jun 20, 2026",
    attendees: ["Utkarsh (Director)", "Dev Team"],
    discussion_summary:
      "The team planned Sprint 22 deliverables focusing on dashboard automation and infrastructure improvements. User stories were estimated and assigned. Capacity was confirmed at 38 story points after accounting for planned leave.",
    decisions: [
      "Data refresh automation prioritized as Sprint 22 P1",
      "Dashboard KPI tiles fix included in Sprint 22 scope",
      "Sprint 22 demo scheduled for July 4th",
    ],
    action_items: [
      { description: "Implement data refresh cron job", owner: "Dev Team", due_date: "Jul 1", confidence: 0.9 },
      { description: "Fix 3 broken KPI dashboard tiles", owner: "Dev Team", due_date: "Jun 28", confidence: 0.95 },
    ],
    approval_status: "approved",
  },
];

type Mom = typeof MOCK_MOMS[0];

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending Approval", color: "#f57f17", bg: "#fff8e1" },
  approved: { label: "Approved", color: "#137333", bg: "#e6f4ea" },
  sent: { label: "Sent", color: "var(--primary)", bg: "var(--primary-fixed)" },
};

export default function MoMPage() {
  const [selected, setSelected] = useState<Mom>(MOCK_MOMS[0]);
  const [approvals, setApprovals] = useState<Record<string, string>>(
    Object.fromEntries(MOCK_MOMS.map(m => [m.mom_id, m.approval_status]))
  );
  const [editingMom, setEditingMom] = useState(false);
  const [editSummary, setEditSummary] = useState(selected.discussion_summary);
  const [summaries, setSummaries] = useState<Record<string, string>>(
    Object.fromEntries(MOCK_MOMS.map(m => [m.mom_id, m.discussion_summary]))
  );
  const { toasts, showToast, removeToast } = useToast();

  const approve = (id: string) => {
    setApprovals(prev => ({ ...prev, [id]: "approved" }));
    showToast(`MoM approved and sent to all attendees of ${selected.meeting_title}.`, "success");
  };

  const handleExport = () => {
    const mom = selected;
    const content = [
      `MINUTES OF MEETING\n`,
      `Meeting: ${mom.meeting_title}`,
      `Date: ${mom.meeting_date}`,
      `Attendees: ${mom.attendees.join(", ")}\n`,
      `DISCUSSION SUMMARY:\n${summaries[mom.mom_id]}\n`,
      `DECISIONS MADE:\n${mom.decisions.map((d, i) => `${i + 1}. ${d}`).join("\n")}\n`,
      `ACTION ITEMS:\n${mom.action_items.map(a => `- ${a.description} | Owner: ${a.owner} | Due: ${a.due_date}`).join("\n")}`,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MoM-${mom.meeting_title.replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("MoM exported and downloaded.", "success");
  };

  const handleOpenEdit = () => {
    setEditSummary(summaries[selected.mom_id]);
    setEditingMom(true);
  };

  const handleSaveEdit = () => {
    setSummaries(prev => ({ ...prev, [selected.mom_id]: editSummary }));
    setEditingMom(false);
    showToast("MoM updated successfully.", "success");
  };

  const status = approvals[selected.mom_id];
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.pending;

  return (
    <>
      <TopBar title="Minutes of Meeting" icon="summarize" />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Edit MoM Modal */}
      {editingMom && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={e => e.target === e.currentTarget && setEditingMom(false)}
        >
          <div style={{
            background: "var(--surface)", borderRadius: 12, padding: 28,
            width: 600, boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--on-surface)", marginBottom: 6 }}>
              Edit MoM — {selected.meeting_title}
            </h3>
            <p style={{ fontSize: 12, color: "var(--on-surface-variant)", marginBottom: 16 }}>
              Editing discussion summary. Action items and decisions can be updated from the action items panel.
            </p>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--on-surface-variant)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Discussion Summary
            </label>
            <textarea
              value={editSummary}
              onChange={e => setEditSummary(e.target.value)}
              style={{
                width: "100%", minHeight: 160, padding: 12, fontSize: 13,
                border: "1px solid var(--outline-variant)", borderRadius: 6,
                background: "var(--surface-container-low)", color: "var(--on-surface)",
                resize: "vertical", fontFamily: "inherit", lineHeight: 1.7,
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingMom(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}>
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>save</span>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden", background: "var(--surface-bright)" }}>

        {/* ── List Pane (left, 300px) ── */}
        <div style={{
          width: 300, flexShrink: 0, borderRight: "1px solid var(--outline-variant)",
          background: "var(--surface-container-lowest)", display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{
            padding: "14px 16px", borderBottom: "1px solid var(--outline-variant)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--on-surface)" }}>All MoMs</h2>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
              background: "var(--error-container)", color: "var(--error)",
            }}>
              {MOCK_MOMS.filter(m => approvals[m.mom_id] === "pending").length} pending
            </span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {MOCK_MOMS.map(mom => {
              const s = approvals[mom.mom_id];
              const ss = STATUS_STYLES[s];
              const isSel = selected.mom_id === mom.mom_id;
              return (
                <button
                  key={mom.mom_id}
                  onClick={() => setSelected(mom)}
                  style={{
                    textAlign: "left", padding: 14, borderRadius: 6, cursor: "pointer",
                    border: isSel ? "1px solid var(--secondary)" : "1px solid var(--outline-variant)",
                    background: isSel ? "var(--surface)" : "var(--surface-container-lowest)",
                    transition: "all 0.12s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--on-surface)", lineHeight: 1.3 }}>
                      {mom.meeting_title}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 3,
                      background: ss.bg, color: ss.color, flexShrink: 0, marginLeft: 6,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                    }}>
                      {ss.label}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--on-surface-variant)" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>calendar_today</span>
                    {mom.meeting_date}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--on-surface-variant)", marginTop: 4 }}>
                    {mom.action_items.length} action items · {mom.decisions.length} decisions
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Content Pane (right) ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>

            {/* Header */}
            <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 3,
                    background: statusStyle.bg, color: statusStyle.color,
                    textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>
                    {statusStyle.label}
                  </span>
                  <span className="badge badge-ai">
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>auto_awesome</span>
                    AI Generated
                  </span>
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--on-surface)", marginBottom: 6 }}>
                  {selected.meeting_title}
                </h1>
                <div style={{ display: "flex", gap: 16 }}>
                  <div className="info-row">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>calendar_today</span>
                    {selected.meeting_date}
                  </div>
                  <div className="info-row">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>people</span>
                    {selected.attendees.length} Attendees
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={handleExport}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                  Export
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleOpenEdit}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                  Edit
                </button>
              </div>
            </div>

            {/* Attendees */}
            <div className="card-sm" style={{ padding: 14, marginBottom: 16 }}>
              <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--on-surface-variant)", marginBottom: 10 }}>
                Attendees
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {selected.attendees.map((a, i) => (
                  <span key={i} style={{
                    fontSize: 12, fontWeight: 500, padding: "4px 10px",
                    background: "var(--surface-container-low)", border: "1px solid var(--outline-variant)",
                    borderRadius: 99, color: "var(--on-surface)",
                  }}>
                    {a}
                  </span>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--secondary)" }}>article</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--on-surface)" }}>Discussion Summary</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={handleOpenEdit} style={{ fontSize: 11 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                  Edit
                </button>
              </div>
              <div className="card-body">
                <p style={{ fontSize: 14, color: "var(--on-surface)", lineHeight: 1.7 }}>
                  {summaries[selected.mom_id]}
                </p>
              </div>
            </div>

            {/* Decisions */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--secondary)" }}>gavel</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--on-surface)" }}>Decisions Made</span>
                </div>
                <span className="badge badge-neutral">{selected.decisions.length}</span>
              </div>
              <div className="card-body">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {selected.decisions.map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#137333", flexShrink: 0, marginTop: 2 }}>
                        check_circle
                      </span>
                      <span style={{ fontSize: 13, color: "var(--on-surface)", lineHeight: 1.5 }}>{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Items table */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--secondary)" }}>assignment</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--on-surface)" }}>Action Items</span>
                </div>
                <span className="badge badge-info">{selected.action_items.length} items</span>
              </div>
              <div style={{ overflow: "hidden" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Action Item</th>
                      <th>Owner</th>
                      <th>Due Date</th>
                      <th>AI Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.action_items.map((item, i) => (
                      <tr key={i}>
                        <td style={{ maxWidth: 280 }}>
                          <span style={{ fontSize: 13, color: "var(--on-surface)" }}>{item.description}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{
                              width: 22, height: 22, borderRadius: "50%", background: "var(--secondary)",
                              color: "#fff", fontSize: 9, fontWeight: 700,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {item.owner.charAt(0)}
                            </div>
                            <span style={{ fontSize: 13, color: "var(--on-surface)" }}>{item.owner}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--on-surface-variant)" }}>
                            {item.due_date}
                          </span>
                        </td>
                        <td>
                          <div className="confidence-bar">
                            <div className="confidence-bar-track">
                              <div className="confidence-bar-fill" style={{ width: `${item.confidence * 100}%` }} />
                            </div>
                            <span className="confidence-text" style={{ color: "#137333" }}>
                              {Math.round(item.confidence * 100)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Approval actions */}
            {status === "pending" && (
              <div style={{
                display: "flex", gap: 10, padding: "16px 0", justifyContent: "flex-end",
                borderTop: "1px solid var(--outline-variant)",
              }}>
                <button className="btn btn-ghost" onClick={handleOpenEdit}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                  Edit MoM
                </button>
                <button
                  className="btn btn-approve"
                  onClick={() => approve(selected.mom_id)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
                  Approve &amp; Send to Attendees
                </button>
              </div>
            )}
            {status === "approved" && (
              <div style={{
                padding: "12px 16px", background: "#e6f4ea", border: "1px solid #c3e6cb",
                borderRadius: 6, display: "flex", alignItems: "center", gap: 8, marginTop: 8,
              }}>
                <span className="material-symbols-outlined fill-icon" style={{ color: "#137333", fontSize: 20 }}>
                  check_circle
                </span>
                <span style={{ fontSize: 13, color: "#137333", fontWeight: 500 }}>
                  MoM approved and sent to all attendees.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
