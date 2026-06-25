"use client";
import { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";

const INTEGRATIONS = [
  { id: "gmail", name: "Gmail", icon: "mail", status: "connected", iconColor: "#ea4335", description: "Email ingestion + send drafted replies" },
  { id: "outlook", name: "Outlook / Microsoft 365", icon: "mail", status: "disconnected", iconColor: "#0078d4", description: "Email ingestion + send drafted replies" },
  { id: "google_cal", name: "Google Calendar", icon: "calendar_today", status: "connected", iconColor: "#4285f4", description: "Free/busy, event creation, push notifications" },
  { id: "teams", name: "Microsoft Teams", icon: "groups", status: "disconnected", iconColor: "#5558af", description: "Calendar, meetings, transcript ingestion" },
  { id: "slack", name: "Slack", icon: "tag", status: "disconnected", iconColor: "#4a154b", description: "Notifications, approve/reject actions" },
  { id: "zoom", name: "Zoom", icon: "videocam", status: "disconnected", iconColor: "#2d8cff", description: "Recording webhook, transcript fetch" },
];

const POLICIES = [
  { id: "email_reply", label: "Email reply drafts", description: "Require approval before sending any drafted reply", enabled: true, locked: true },
  { id: "meeting_book", label: "Auto-book unambiguous meetings", description: "Book automatically when slot is clear and single option", enabled: false, locked: false },
  { id: "mom_send", label: "MoM follow-up send", description: "Require approval before sending MoM to attendees", enabled: true, locked: false },
  { id: "action_done", label: "Mark action items done (inferred)", description: "Suggest completion when reply implies task is done", enabled: true, locked: false },
];

const NOTIFICATIONS = [
  { label: "Meeting brief delivery", desc: "60 min and 15 min before each meeting", channel: "Email + Slack" },
  { label: "Email reply drafts", desc: "When a draft is ready for your review", channel: "Email" },
  { label: "MoM approval requests", desc: "After each meeting ends and transcript is processed", channel: "Slack" },
  { label: "Overdue action items", desc: "Daily digest of items past due date", channel: "Email" },
  { label: "Reminders", desc: "2 hours before meetings", channel: "Teams + Email" },
];

export default function SettingsPage() {
  const [integrations, setIntegrations] = useState(INTEGRATIONS);
  const [policies, setPolicies] = useState(POLICIES);
  const [activeTab, setActiveTab] = useState<"integrations" | "policies" | "notifications">("integrations");

  const toggleIntegration = (id: string) =>
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, status: i.status === "connected" ? "disconnected" : "connected" } : i));

  const togglePolicy = (id: string) =>
    setPolicies(prev => prev.map(p => p.id === id && !p.locked ? { ...p, enabled: !p.enabled } : p));

  const TABS = ["integrations", "policies", "notifications"] as const;

  return (
    <>
      <TopBar title="Agent Policy & Settings" icon="settings" />
      <div className="page-content">
        <div className="page-body animate-in" style={{ maxWidth: 900 }}>

          {/* Page title */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: "var(--on-surface)" }}>Settings</h2>
            <p style={{ fontSize: 13, color: "var(--on-surface-variant)", marginTop: 4 }}>
              Configure integrations, approval policies, and notification preferences
            </p>
          </div>

          {/* Tabs */}
          <div style={{
            display: "flex", gap: 2, padding: 4,
            background: "var(--surface-container-low)",
            borderRadius: 8, marginBottom: 24, width: "fit-content",
          }}>
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "6px 20px", borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 500, transition: "all 0.15s",
                  fontFamily: "var(--font-sans)", textTransform: "capitalize",
                  background: activeTab === tab ? "var(--surface-container-lowest)" : "transparent",
                  color: activeTab === tab ? "var(--on-surface)" : "var(--on-surface-variant)",
                  boxShadow: activeTab === tab ? "var(--shadow-sm)" : "none",
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* ── Integrations tab ── */}
          {activeTab === "integrations" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {integrations.map(integ => (
                <div key={integ.id} className="card-sm" style={{
                  padding: 20, display: "flex", alignItems: "center", gap: 16,
                }}>
                  {/* Icon */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                    background: `${integ.iconColor}18`, border: `1px solid ${integ.iconColor}33`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span className="material-symbols-outlined" style={{ color: integ.iconColor, fontSize: 22 }}>
                      {integ.icon}
                    </span>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--on-surface)" }}>{integ.name}</div>
                    <div style={{ fontSize: 13, color: "var(--on-surface-variant)", marginTop: 2 }}>{integ.description}</div>
                  </div>

                  {/* Status + Action */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    {integ.status === "connected" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#137333", fontWeight: 500 }}>
                        <span className="material-symbols-outlined fill-icon" style={{ fontSize: 16 }}>check_circle</span>
                        Connected
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--on-surface-variant)" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>cancel</span>
                        Disconnected
                      </div>
                    )}
                    <button
                      onClick={() => toggleIntegration(integ.id)}
                      className={`btn btn-sm ${integ.status === "connected" ? "btn-danger" : "btn-primary"}`}
                    >
                      {integ.status === "connected" ? "Disconnect" : "Connect"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Policies tab ── */}
          {activeTab === "policies" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Info banner */}
              <div style={{
                padding: 14, background: "var(--primary-fixed)", border: "1px solid var(--primary-fixed-dim)",
                borderRadius: 8, display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 4,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--primary)", flexShrink: 0, marginTop: 1 }}>
                  info
                </span>
                <p style={{ fontSize: 13, color: "var(--on-surface)", lineHeight: 1.5 }}>
                  Conservative defaults are enabled. All high-risk actions require your approval. Adjust as trust builds over time.
                </p>
              </div>

              {policies.map(policy => (
                <div key={policy.id} className="card-sm" style={{
                  padding: 20, display: "flex", alignItems: "center", gap: 16,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--on-surface)" }}>{policy.label}</span>
                      {policy.locked && (
                        <span className="badge badge-warning">Required</span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: "var(--on-surface-variant)" }}>{policy.description}</p>
                  </div>

                  <label className="toggle-wrap" style={{ flexShrink: 0, cursor: policy.locked ? "not-allowed" : "pointer" }}>
                    <input
                      type="checkbox"
                      checked={policy.enabled}
                      disabled={policy.locked}
                      onChange={() => togglePolicy(policy.id)}
                    />
                    <span className="toggle-slider" style={{ opacity: policy.locked ? 0.5 : 1 }} />
                  </label>
                </div>
              ))}
            </div>
          )}

          {/* ── Notifications tab ── */}
          {activeTab === "notifications" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {NOTIFICATIONS.map((n, i) => (
                <div key={i} className="card-sm" style={{
                  padding: 20, display: "flex", alignItems: "center", gap: 16,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--on-surface)", marginBottom: 4 }}>{n.label}</div>
                    <p style={{ fontSize: 13, color: "var(--on-surface-variant)" }}>{n.desc}</p>
                  </div>
                  <span style={{
                    padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 500,
                    background: "var(--primary-fixed)", color: "var(--primary)",
                    border: "1px solid var(--primary-fixed-dim)", flexShrink: 0,
                  }}>
                    {n.channel}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
