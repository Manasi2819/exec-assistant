"use client";
import { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useToast } from "@/hooks/useToast";

const INITIAL_NOTIFS = [
  {
    id: "n1", type: "MoM Approval", typeIcon: "summarize", timeGroup: "Just now",
    title: "Q3 Dashboard Review — MoM Ready for Approval",
    preview: "Attendees: James, Ken, Utkarsh. 3 decisions, 4 action items captured. One item needs owner assignment.",
    requiresAction: true, read: false,
    color: "#3459a5", colorBg: "rgba(52,89,165,0.08)",
  },
  {
    id: "n2", type: "Meeting Brief", typeIcon: "description", timeGroup: "2 hours ago",
    title: "Brief ready: Sprint Planning at 4:30 PM",
    preview: "Purpose: Plan sprint 23 deliverables. 6 recommended preparation items. Participants confirmed.",
    requiresAction: false, read: false,
    color: "#137333", colorBg: "rgba(19,115,51,0.08)",
  },
  {
    id: "n3", type: "Reply Draft", typeIcon: "mail", timeGroup: "3 hours ago",
    title: "Draft reply ready: Finance Q3 budget approval",
    preview: "\"I will review the Q3 budget proposal today and provide approval by Friday.\" — 91% confidence.",
    requiresAction: true, read: false,
    color: "#525e7d", colorBg: "rgba(82,94,125,0.08)",
  },
  {
    id: "n4", type: "Overdue Alert", typeIcon: "assignment_late", timeGroup: "Yesterday",
    title: "Action item overdue: Sign off on Q3 expense reports",
    preview: "This item was due 2 days ago. Originally extracted from Q3 Review meeting.",
    requiresAction: false, read: true,
    color: "#ba1a1a", colorBg: "rgba(186,26,26,0.06)",
  },
  {
    id: "n5", type: "AI Update", typeIcon: "auto_awesome", timeGroup: "Yesterday",
    title: "AI Co-pilot processed 18 emails overnight",
    preview: "5 drafts ready for review, 8 categorized as FYI, 3 escalations flagged, 2 meeting requests found.",
    requiresAction: false, read: true,
    color: "#86458a", colorBg: "rgba(134,69,138,0.08)",
  },
];

const GROUPS = ["Just now", "2 hours ago", "3 hours ago", "Yesterday"];

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState(INITIAL_NOTIFS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const { toasts, showToast, removeToast } = useToast();

  const markAllRead = () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    showToast("All notifications marked as read", "success");
  };

  const handleApprove = (id: string, title: string) => {
    setNotifs(prev => prev.filter(n => n.id !== id));
    showToast(`✓ Approved & sent: "${title.slice(0, 50)}${title.length > 50 ? "…" : ""}"`, "success");
  };

  const handleReject = (id: string, title: string) => {
    setNotifs(prev => prev.filter(n => n.id !== id));
    showToast(`Rejected: "${title.slice(0, 45)}${title.length > 45 ? "…" : ""}"`, "warning");
  };

  const handleEdit = (n: typeof INITIAL_NOTIFS[0]) => {
    setEditingId(n.id);
    setEditText(n.preview);
  };

  const handleSaveEdit = () => {
    setNotifs(prev => prev.map(n => n.id === editingId ? { ...n, preview: editText } : n));
    setEditingId(null);
    showToast("Changes saved successfully", "success");
  };

  const handleClickNotif = (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <>
      <TopBar title="Notifications" icon="notifications" />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Edit Modal */}
      {editingId && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
          onClick={(e) => e.target === e.currentTarget && setEditingId(null)}
        >
          <div style={{
            background: "var(--surface)", borderRadius: 12, padding: 28,
            width: 480, boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--on-surface)", marginBottom: 16 }}>
              Edit Notification
            </h3>
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              style={{
                width: "100%", minHeight: 100, padding: 12, fontSize: 13,
                border: "1px solid var(--outline-variant)", borderRadius: 6,
                background: "var(--surface-container-low)", color: "var(--on-surface)",
                resize: "vertical", fontFamily: "inherit", lineHeight: 1.6,
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-content">
        <div className="page-body animate-in" style={{ maxWidth: 720 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: "var(--on-surface)" }}>Notifications</h2>
            <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>
          </div>

          {GROUPS.map(group => {
            const items = notifs.filter(n => n.timeGroup === group);
            if (!items.length) return null;
            return (
              <div key={group} style={{ marginBottom: 24 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
                  color: "var(--on-surface-variant)", marginBottom: 8, padding: "0 2px",
                }}>
                  {group}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {items.map(n => (
                    <div
                      key={n.id}
                      className="card-sm"
                      onClick={() => handleClickNotif(n.id)}
                      style={{
                        padding: 16, cursor: "pointer",
                        background: n.read ? "var(--surface-container-lowest)" : "var(--surface)",
                        borderLeft: n.requiresAction ? `3px solid ${n.color}` : undefined,
                        opacity: n.read ? 0.8 : 1,
                        transition: "opacity 0.2s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        {/* Icon */}
                        <div style={{
                          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                          background: n.colorBg, display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18, color: n.color }}>
                            {n.typeIcon}
                          </span>
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{
                              fontSize: 11, fontWeight: 500, padding: "1px 6px", borderRadius: 3,
                              background: n.colorBg, color: n.color,
                            }}>
                              {n.type}
                            </span>
                            {!n.read && (
                              <div style={{
                                width: 6, height: 6, borderRadius: "50%",
                                background: "var(--secondary)",
                              }} />
                            )}
                          </div>
                          <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--on-surface)", marginBottom: 4 }}>
                            {n.title}
                          </h4>
                          <p style={{ fontSize: 12, color: "var(--on-surface-variant)", lineHeight: 1.5 }}>
                            {n.preview}
                          </p>

                          {n.requiresAction && (
                            <div style={{ display: "flex", gap: 6, marginTop: 10 }} onClick={e => e.stopPropagation()}>
                              <button
                                className="btn btn-approve btn-sm"
                                onClick={() => handleApprove(n.id, n.title)}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
                                Approve &amp; Send
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleEdit(n)}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                                Edit
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleReject(n.id, n.title)}
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Time */}
                        <span style={{ fontSize: 11, color: "var(--on-surface-variant)", flexShrink: 0, whiteSpace: "nowrap" }}>
                          {n.timeGroup}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {notifs.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--on-surface-variant)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 48, display: "block", marginBottom: 12, opacity: 0.4 }}>
                notifications_off
              </span>
              <p style={{ fontSize: 14 }}>No notifications</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
