"use client";
import { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useToast } from "@/hooks/useToast";

const BRIEF = {
  meeting: "Q3 Performance Dashboard Review",
  time: "Tomorrow, 3:00 PM",
  duration: "60 min",
  location: "Conference Room B / Zoom",
  participants: [
    { name: "James", role: "VP Analytics", initials: "JL" },
    { name: "Ken", role: "Data Lead", initials: "KD" },
    { name: "Utkarsh", role: "Director", initials: "U" },
  ],
  purpose: "Review Q3 performance metrics, discuss outstanding dashboard issues, and align on KPI discrepancies identified in the month-end report.",
  context: "This meeting follows up on the Sprint 22 planning session where data refresh automation was identified as a P1 priority. Revenue is tracking 12% below Q3 forecast.",
  important_topics: [
    "Revenue variance — 12% below forecast",
    "Missing dashboard metrics (3 KPI tiles not loading)",
    "Month-end reporting delays — root cause analysis",
    "Data refresh automation proposal",
  ],
  previous_decisions: [
    { text: "Add new Revenue KPI section to dashboard", meeting: "Q2 Review", date: "Jun 10" },
    { text: "Automate data refresh process (scheduled for Q3)", meeting: "Sprint 22 Planning", date: "Jun 3" },
  ],
  potential_questions: [
    "Why is revenue down 12% vs forecast?",
    "What caused the reporting delays this month?",
    "When will the missing KPI tiles be fixed?",
    "Is the data refresh automation on track for this quarter?",
  ],
  preparation: [
    { text: "Open latest Q3 dashboard", done: false },
    { text: "Review month-end report (attached)", done: true },
    { text: "Validate KPI calculations with finance team", done: false },
    { text: "Prepare revenue variance explanation", done: false },
  ],
};

export default function MeetingBriefPage() {
  const [checklist, setChecklist] = useState(BRIEF.preparation);
  const [meetingStarted, setMeetingStarted] = useState(false);
  const { toasts, showToast, removeToast } = useToast();
  const doneCount = checklist.filter(c => c.done).length;

  const toggle = (i: number) =>
    setChecklist(prev => prev.map((c, idx) => idx === i ? { ...c, done: !c.done } : c));

  const handleExport = () => {
    showToast("Brief exported as PDF — check your downloads folder.", "success");
  };

  const handleDownload = () => {
    // Simulate file download
    const blob = new Blob([
      `MEETING BRIEF\n\n${BRIEF.meeting}\n${BRIEF.time} | ${BRIEF.duration}\n${BRIEF.location}\n\nParticipants: ${BRIEF.participants.map(p => p.name).join(", ")}\n\nPurpose:\n${BRIEF.purpose}\n\nKey Topics:\n${BRIEF.important_topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\nPreparation Checklist:\n${checklist.map(c => `[${c.done ? "x" : " "}] ${c.text}`).join("\n")}`
    ], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Meeting-Brief-Q3-Dashboard-Review.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Brief downloaded successfully.", "success");
  };

  const handleShare = () => {
    const names = BRIEF.participants.map(p => p.name).join(", ");
    showToast(`Brief shared with ${names} via email.`, "success");
  };

  const handleStartMeeting = () => {
    setMeetingStarted(true);
  };

  return (
    <>
      <TopBar title="Meeting Brief" icon="description" />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Start Meeting Modal */}
      {meetingStarted && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "var(--surface)", borderRadius: 16, padding: 36,
            width: 440, textAlign: "center", boxShadow: "0 12px 48px rgba(0,0,0,0.25)",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%", background: "var(--primary)",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
            }}>
              <span className="material-symbols-outlined fill-icon" style={{ fontSize: 32, color: "#fff" }}>video_call</span>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--on-surface)", marginBottom: 8 }}>
              Starting Meeting...
            </h3>
            <p style={{ fontSize: 14, color: "var(--on-surface-variant)", marginBottom: 6 }}>
              {BRIEF.meeting}
            </p>
            <p style={{ fontSize: 13, color: "var(--on-surface-variant)", marginBottom: 24 }}>
              {BRIEF.location} · {BRIEF.participants.map(p => p.name).join(", ")}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                className="btn btn-ghost"
                onClick={() => setMeetingStarted(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setMeetingStarted(false);
                  showToast("Meeting started. Zoom link opened in new tab.", "success");
                  window.open("https://zoom.us", "_blank");
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                Open Zoom
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-content">
        <div className="page-body animate-in" style={{ maxWidth: 960 }}>

          {/* Hero Header */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{
              padding: "24px 24px 20px",
              borderBottom: "1px solid var(--outline-variant)",
              background: "var(--primary-fixed)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span className="badge badge-ai">
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>auto_awesome</span>
                      AI Generated Brief
                    </span>
                    <span className="badge badge-success">Brief Ready</span>
                  </div>
                  <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--on-surface)", lineHeight: 1.3 }}>
                    {BRIEF.meeting}
                  </h1>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" onClick={handleExport}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                    Export
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={handleStartMeeting}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_arrow</span>
                    Start Meeting
                  </button>
                </div>
              </div>

              {/* Metadata row */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
                <div className="info-row">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>schedule</span>
                  <span style={{ fontSize: 13, color: "var(--on-surface)" }}>{BRIEF.time} · {BRIEF.duration}</span>
                </div>
                <div className="info-row">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>location_on</span>
                  <span style={{ fontSize: 13, color: "var(--on-surface)" }}>{BRIEF.location}</span>
                </div>
                <div className="info-row">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>people</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div className="avatar-group">
                      {BRIEF.participants.map(p => (
                        <div key={p.name} style={{
                          width: 24, height: 24, borderRadius: "50%", background: "var(--secondary)",
                          color: "#fff", fontSize: 9, fontWeight: 700,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          border: "2px solid var(--primary-fixed)",
                          marginLeft: BRIEF.participants.indexOf(p) > 0 ? -6 : 0,
                        }} title={`${p.name} — ${p.role}`}>
                          {p.initials}
                        </div>
                      ))}
                    </div>
                    <span style={{ fontSize: 13, color: "var(--on-surface)" }}>
                      {BRIEF.participants.map(p => p.name).join(", ")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Purpose */}
            <div style={{ padding: "16px 24px" }}>
              <p style={{ fontSize: 14, color: "var(--on-surface)", lineHeight: 1.7 }}>
                <strong>Purpose:</strong> {BRIEF.purpose}
              </p>
              <p style={{ fontSize: 13, color: "var(--on-surface-variant)", lineHeight: 1.6, marginTop: 8 }}>
                <strong style={{ color: "var(--on-surface)" }}>Context:</strong> {BRIEF.context}
              </p>
            </div>
          </div>

          {/* Main grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

            {/* Topics */}
            <div className="card">
              <div className="card-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--secondary)" }}>topic</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--on-surface)" }}>Key Topics</span>
                </div>
                <span className="badge badge-neutral">{BRIEF.important_topics.length}</span>
              </div>
              <div className="card-body">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {BRIEF.important_topics.map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13 }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: "50%", background: "var(--surface-container)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 700, color: "var(--secondary)", flexShrink: 0, marginTop: 1,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ color: "var(--on-surface)", lineHeight: 1.5 }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Predicted Questions */}
            <div className="card">
              <div className="card-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--tertiary)" }}>psychology</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--on-surface)" }}>Predicted Questions</span>
                </div>
                <span className="badge badge-ai">AI</span>
              </div>
              <div className="card-body">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {BRIEF.potential_questions.map((q, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--on-surface)", lineHeight: 1.5 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--outline)", flexShrink: 0, marginTop: 2 }}>
                        help_outline
                      </span>
                      <span>{q}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Previous Decisions */}
            <div className="card">
              <div className="card-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--secondary)" }}>history</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--on-surface)" }}>Previous Decisions</span>
                </div>
              </div>
              <div className="card-body">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {BRIEF.previous_decisions.map((d, i) => (
                    <div key={i} style={{
                      padding: 12, background: "var(--surface-container-low)",
                      border: "1px solid var(--outline-variant)", borderRadius: 6,
                    }}>
                      <p style={{ fontSize: 13, color: "var(--on-surface)", marginBottom: 6, lineHeight: 1.4 }}>
                        {d.text}
                      </p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "var(--on-surface-variant)" }}>
                          From: <strong>{d.meeting}</strong>
                        </span>
                        <span style={{ fontSize: 11, color: "var(--on-surface-variant)" }}>·</span>
                        <span style={{ fontSize: 11, color: "var(--on-surface-variant)" }}>{d.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Preparation Checklist */}
            <div className="card">
              <div className="card-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--secondary)" }}>checklist</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--on-surface)" }}>Preparation Checklist</span>
                </div>
                <span style={{ fontSize: 12, color: "var(--on-surface-variant)" }}>
                  {doneCount}/{checklist.length} done
                </span>
              </div>
              <div className="card-body">
                <div style={{ marginBottom: 10 }}>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${(doneCount / checklist.length) * 100}%` }} />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {checklist.map((item, i) => (
                    <label key={i} style={{
                      display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                      padding: "6px 8px", borderRadius: 4, transition: "background 0.12s",
                    }}>
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggle(i)}
                        style={{ display: "none" }}
                      />
                      <span className="material-symbols-outlined" style={{
                        fontSize: 18, flexShrink: 0,
                        color: item.done ? "#137333" : "var(--outline)",
                      }}>
                        {item.done ? "check_circle" : "radio_button_unchecked"}
                      </span>
                      <span style={{
                        fontSize: 13, color: item.done ? "var(--on-surface-variant)" : "var(--on-surface)",
                        textDecoration: item.done ? "line-through" : "none",
                      }}>
                        {item.text}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div style={{
            display: "flex", gap: 10, padding: "16px 0",
            borderTop: "1px solid var(--outline-variant)", justifyContent: "flex-end",
          }}>
            <button className="btn btn-ghost" onClick={handleDownload}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
              Download Brief
            </button>
            <button className="btn btn-ghost" onClick={handleShare}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
              Share with Attendees
            </button>
            <button className="btn btn-primary" onClick={handleStartMeeting}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_arrow</span>
              Start Meeting
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
