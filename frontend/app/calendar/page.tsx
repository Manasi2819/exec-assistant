"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchMeetings, generateMeetingBrief, type Meeting, type MeetingBrief } from "@/lib/api";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useToast } from "@/hooks/useToast";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = ["8 AM","9 AM","10 AM","11 AM","12 PM","1 PM","2 PM","3 PM","4 PM","5 PM","6 PM"];

// Hardcoded calendar layout positions for the fetched meetings
const EVENT_LAYOUT: Record<string, { col: number; row: number; color: string }> = {
  m1: { col: 3, row: 7, color: "var(--primary)" },
  m2: { col: 4, row: 2, color: "var(--secondary)" },
  m3: { col: 5, row: 6, color: "#f57f17" },
};

const FALLBACK_EVENTS = [
  { id: "e1", title: "Q3 Dashboard Review", time: "3:00 PM", duration: 60, col: 3, row: 7, briefReady: true, participants: ["James","Ken","Utkarsh"], conflict: false, color: "var(--primary)" },
  { id: "e2", title: "Sprint Planning", time: "10:00 AM", duration: 90, col: 4, row: 2, briefReady: false, participants: ["Dev Team"], conflict: false, color: "var(--secondary)" },
  { id: "e3", title: "1:1 with Manager", time: "2:00 PM", duration: 30, col: 5, row: 6, briefReady: true, participants: ["Manager"], conflict: true, color: "#f57f17" },
];

const AI_SUGGESTIONS = [
  { icon: "auto_awesome", text: "Reschedule Sprint Planning to Thursday — avoids conflict with CFO call", action: "Reschedule", type: "info" },
  { icon: "schedule", text: "Q3 Dashboard Review brief is ready. 3 key prep items pending your review.", action: "View Brief", type: "success" },
  { icon: "warning", text: "1:1 with Manager conflicts with CFO Call on Friday. Review options.", action: "Resolve", type: "warning" },
];

const PENDING_REQUESTS = [
  { id: "r1", from: "Sarah Jenkins", subject: "Product sync", slots: ["Thu 2:00 PM", "Fri 10:00 AM"] },
];

type CalendarEvent = {
  id: string; title: string; time: string; duration: number;
  col: number; row: number; briefReady: boolean;
  participants: string[]; conflict: boolean; color: string;
};

export default function CalendarPage() {
  const router = useRouter();
  const { toasts, showToast, removeToast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>(FALLBACK_EVENTS);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(PENDING_REQUESTS);
  const [resolvedConflicts, setResolvedConflicts] = useState<Set<number>>(new Set());

  // Brief generation state
  const [briefLoading, setBriefLoading] = useState(false);
  const [brief, setBrief] = useState<MeetingBrief | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  // Raw meeting data (for passing to brief generator)
  const [meetingsMap, setMeetingsMap] = useState<Record<string, Meeting>>({});

  const today = new Date(2026, 5, 24);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + weekOffset * 7);

  const weekDates = DAYS.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const isToday = (d: Date) =>
    d.getDate() === today.getDate() && d.getMonth() === today.getMonth();

  useEffect(() => {
    async function load() {
      console.log("[ExecAI Calendar] 🔄 Fetching meetings from backend...");
      const meetings = await fetchMeetings();

      if (meetings.length > 0) {
        setBackendOnline(true);
        // Build meetings map for brief generation
        const map: Record<string, Meeting> = {};
        meetings.forEach(m => { map[m.id] = m; });
        setMeetingsMap(map);

        // Map meetings to calendar events
        const calEvents: CalendarEvent[] = meetings.map((m, i) => {
          const layout = EVENT_LAYOUT[m.id] ?? { col: i + 1, row: i * 2 + 1, color: "var(--primary)" };
          const dt = new Date(m.start_time);
          const timeStr = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          return {
            id: m.id,
            title: m.title,
            time: m.time ?? timeStr,
            duration: m.duration_min ?? 60,
            col: layout.col,
            row: layout.row,
            color: layout.color,
            briefReady: m.brief_status === "ready",
            participants: m.participants,
            conflict: (m as { conflict?: boolean }).conflict ?? false,
          };
        });
        setEvents(calEvents);
        console.log("[ExecAI Calendar] ✅ Loaded", calEvents.length, "meetings");
      } else {
        setBackendOnline(false);
        console.warn("[ExecAI Calendar] ⚠️  Backend unreachable — using fallback calendar events");
      }
    }
    load();
  }, []);

  const handleAiAction = (index: number, action: string) => {
    if (action === "Reschedule") {
      setEvents(prev => prev.map(e =>
        e.id === "e2" ? { ...e, col: 4, conflict: false, time: "10:00 AM" } : e
      ));
      showToast("Sprint Planning rescheduled to Thursday — conflict with CFO call avoided.", "success");
    } else if (action === "View Brief") {
      router.push("/meetings/m1/brief");
    } else if (action === "Resolve") {
      setResolvedConflicts(prev => new Set(prev).add(index));
      setEvents(prev => prev.map(e =>
        e.id === "e3" ? { ...e, conflict: false } : e
      ));
      showToast("Conflict resolved. 1:1 with Manager moved to Monday 3:00 PM.", "success");
    }
  };

  const handleAcceptSlot = (reqId: string, slot: string, from: string) => {
    setPendingRequests(prev => prev.filter(r => r.id !== reqId));
    showToast(`Meeting with ${from} confirmed for ${slot}. Invite sent.`, "success");
  };

  const handleDeclineAll = (reqId: string, from: string) => {
    setPendingRequests(prev => prev.filter(r => r.id !== reqId));
    showToast(`Meeting request from ${from} declined.`, "warning");
  };

  const handleNewEvent = () => {
    showToast("New event created for today at 4:00 PM.", "success");
  };

  const handleViewBrief = async (event: CalendarEvent) => {
    setBrief(null);
    setBriefError(null);
    setBriefLoading(true);
    const meeting = meetingsMap[event.id];

    if (!meeting) {
      console.warn("[ExecAI Calendar] ⚠️  No meeting data for id:", event.id, "— using event title only");
    }

    console.log("[ExecAI Calendar] 🔄 Generating meeting brief:", event.title);

    const result = await generateMeetingBrief({
      meeting_id: event.id,
      meeting_title: event.title,
      participants: meeting?.participants ?? event.participants,
      meeting_datetime: meeting?.start_time ?? new Date().toISOString(),
      agenda_items: meeting?.agenda_items ?? [],
      previous_meetings: meeting?.previous_meetings ?? [],
    });

    if (result) {
      setBrief(result);
      console.log("[ExecAI Calendar] ✅ Meeting brief generated:", result);
    } else {
      setBriefError("Failed to generate brief — backend may be offline.");
      console.error("[ExecAI Calendar] ❌ generateMeetingBrief returned null for:", event.title);
    }
    setBriefLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {/* Top Bar */}
      <header style={{
        height: 64, background: "var(--surface)", borderBottom: "1px solid var(--outline-variant)",
        display: "flex", alignItems: "center", padding: "0 32px", gap: 16, flexShrink: 0,
      }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          <span className="material-symbols-outlined" style={{ color: "var(--secondary)", fontSize: 20 }}>calendar_today</span>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--primary)" }}>Calendar</h1>
          <span style={{ fontSize: 13, color: "var(--on-surface-variant)", marginLeft: 4 }}>
            Week of {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
            {new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}, {today.getFullYear()}
          </span>
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
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w - 1)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(0)}>Today</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w + 1)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
          </button>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleNewEvent}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          New Event
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--on-surface-variant)" }}>
          <button className="icon-btn" title="Notifications">
            <span className="material-symbols-outlined">notifications</span>
            <span className="badge-dot" />
          </button>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", background: "var(--secondary)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, cursor: "pointer",
            border: "1px solid var(--outline-variant)", flexShrink: 0,
          }}>U</div>
        </div>
      </header>

      {/* Calendar + AI Panel */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Calendar Grid */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Day headers */}
          <div style={{
            display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)",
            borderBottom: "1px solid var(--outline-variant)",
            background: "var(--surface-container-lowest)", flexShrink: 0,
          }}>
            <div style={{ padding: "10px 8px" }} />
            {weekDates.map((d, i) => (
              <div key={i} style={{ padding: "10px 8px", textAlign: "center", borderLeft: "1px solid var(--outline-variant)" }}>
                <div style={{ fontSize: 11, color: "var(--on-surface-variant)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {DAYS[i]}
                </div>
                <div style={{
                  fontSize: 18, fontWeight: 600, marginTop: 2,
                  color: isToday(d) ? "#fff" : "var(--on-surface)",
                  background: isToday(d) ? "var(--primary)" : "transparent",
                  width: 32, height: 32, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center", margin: "2px auto 0",
                }}>
                  {d.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
            {HOURS.map((hour, hi) => (
              <div key={hi} style={{
                display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)",
                borderBottom: "1px solid var(--outline-variant)",
                minHeight: 56,
              }}>
                <div style={{
                  padding: "4px 8px", fontSize: 11, color: "var(--on-surface-variant)",
                  fontWeight: 500, textAlign: "right", paddingTop: 4, flexShrink: 0,
                }}>
                  {hour}
                </div>
                {weekDates.map((_, ci) => {
                  const event = events.find(e => e.row === hi && e.col === ci);
                  return (
                    <div key={ci} style={{
                      borderLeft: "1px solid var(--outline-variant)",
                      padding: 2, position: "relative",
                      background: ci === 3 && weekOffset === 0 ? "rgba(52,89,165,0.02)" : "transparent",
                    }}>
                      {event && (
                        <button
                          onClick={() => {
                            setSelectedEvent(event);
                            setBrief(null);
                            setBriefError(null);
                          }}
                          style={{
                            position: "absolute", top: 2, left: 2, right: 2, bottom: 2,
                            background: event.conflict ? "rgba(245,127,23,0.12)" : "rgba(52,89,165,0.12)",
                            border: `1px solid ${event.conflict ? "#f57f17" : "var(--primary)"}`,
                            borderLeft: `3px solid ${event.conflict ? "#f57f17" : event.color}`,
                            borderRadius: 4, padding: "4px 8px", textAlign: "left", cursor: "pointer",
                            transition: "opacity 0.15s",
                          }}
                        >
                          <div style={{
                            fontSize: 11, fontWeight: 600,
                            color: event.conflict ? "#f57f17" : "var(--primary)",
                            lineHeight: 1.3,
                          }} className="truncate">
                            {event.title}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--on-surface-variant)", marginTop: 1 }}>
                            {event.time}
                          </div>
                          {event.briefReady && (
                            <span style={{
                              fontSize: 9, fontWeight: 600, textTransform: "uppercase",
                              color: "#137333", background: "#e6f4ea",
                              padding: "1px 4px", borderRadius: 2, marginTop: 2, display: "inline-block",
                            }}>Brief Ready</span>
                          )}
                          {event.conflict && (
                            <span className="material-symbols-outlined" style={{ fontSize: 12, color: "#f57f17", display: "block", marginTop: 1 }}>
                              warning
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* AI Assistant Panel (right) */}
        <div style={{
          width: 300, flexShrink: 0, borderLeft: "1px solid var(--outline-variant)",
          background: "var(--surface-container-lowest)", display: "flex", flexDirection: "column", overflowY: "auto",
        }}>
          {/* Event detail (if selected) */}
          {selectedEvent && (
            <div style={{ padding: 16, borderBottom: "1px solid var(--outline-variant)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--on-surface)" }}>{selectedEvent.title}</h3>
                <button className="icon-btn" onClick={() => { setSelectedEvent(null); setBrief(null); setBriefError(null); }} style={{ width: 24, height: 24 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                <div className="info-row">
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>schedule</span>
                  {selectedEvent.time} · {selectedEvent.duration} min
                </div>
                <div className="info-row">
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>people</span>
                  {selectedEvent.participants.join(", ")}
                </div>
                {selectedEvent.conflict && (
                  <div className="info-row" style={{ color: "#f57f17" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: "#f57f17" }}>warning</span>
                    Conflict detected
                  </div>
                )}
                {selectedEvent.briefReady && (
                  <div className="info-row" style={{ color: "#137333" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: "#137333" }}>check_circle</span>
                    Meeting brief is ready
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ justifyContent: "center", gap: 6 }}
                  onClick={() => handleViewBrief(selectedEvent)}
                  disabled={briefLoading}
                >
                  {briefLoading ? (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: 15, animation: "spin 1s linear infinite" }}>sync</span>
                      Generating Brief...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>auto_awesome</span>
                      {brief ? "Regenerate Brief" : "Generate AI Brief"}
                    </>
                  )}
                </button>
                <button className="btn btn-ghost btn-sm" style={{ justifyContent: "center" }}>
                  Edit Event
                </button>
              </div>

              {/* AI Brief Result */}
              {briefError && (
                <div style={{
                  marginTop: 12, padding: 10, borderRadius: 4, fontSize: 12,
                  background: "var(--error-container)", color: "var(--error)",
                  border: "1px solid rgba(186,26,26,0.2)",
                }}>
                  {briefError}
                </div>
              )}
              {brief && (
                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--secondary)",
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
                    AI Meeting Brief
                  </div>

                  {brief.purpose && (
                    <div style={{
                      padding: 10, borderRadius: 4, fontSize: 12, lineHeight: 1.6,
                      background: "var(--surface-container-low)", border: "1px solid var(--outline-variant)",
                      color: "var(--on-surface)",
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--on-surface-variant)", display: "block", marginBottom: 4 }}>
                        Purpose
                      </span>
                      {brief.purpose}
                    </div>
                  )}

                  {brief.important_topics?.length > 0 && (
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--on-surface-variant)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Key Topics
                      </span>
                      {brief.important_topics.map((pt, i) => (
                        <div key={i} style={{
                          display: "flex", gap: 6, fontSize: 12, color: "var(--on-surface)",
                          marginBottom: 4, alignItems: "flex-start",
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 13, color: "var(--secondary)", flexShrink: 0, marginTop: 1 }}>chevron_right</span>
                          {pt}
                        </div>
                      ))}
                    </div>
                  )}

                  {brief.recommended_preparation?.length > 0 && (
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#137333", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Prep Checklist
                      </span>
                      {brief.recommended_preparation.map((prep, i) => (
                        <div key={i} style={{
                          display: "flex", gap: 6, fontSize: 12, color: "var(--on-surface)",
                          marginBottom: 4, alignItems: "flex-start",
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 13, color: "#137333", flexShrink: 0, marginTop: 1 }}>task_alt</span>
                          {prep}
                        </div>
                      ))}
                    </div>
                  )}

                  {brief.potential_questions?.length > 0 && (
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#3459a5", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Potential Questions
                      </span>
                      {brief.potential_questions.map((q, i) => (
                        <div key={i} style={{
                          display: "flex", gap: 6, fontSize: 12, color: "var(--on-surface)",
                          marginBottom: 4, alignItems: "flex-start",
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 13, color: "#3459a5", flexShrink: 0, marginTop: 1 }}>help_outline</span>
                          {q}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* AI Suggestions */}
          <div style={{ padding: "14px 14px 8px", borderBottom: "1px solid var(--outline-variant)" }}>
            <h3 style={{
              fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
              color: "var(--on-surface-variant)", display: "flex", alignItems: "center", gap: 6,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
              AI Suggestions
            </h3>
          </div>
          <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            {AI_SUGGESTIONS.map((s, i) => {
              if (resolvedConflicts.has(i)) return null;
              return (
                <div key={i} className="card-sm" style={{ padding: 12 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-start" }}>
                    <span className="material-symbols-outlined" style={{
                      fontSize: 16, flexShrink: 0,
                      color: s.type === "warning" ? "#f57f17" : s.type === "success" ? "#137333" : "var(--secondary)",
                    }}>{s.icon}</span>
                    <p style={{ fontSize: 12, color: "var(--on-surface)", lineHeight: 1.5 }}>{s.text}</p>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => handleAiAction(i, s.action)}
                  >
                    {s.action}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Pending Requests */}
          <div style={{ padding: "14px 14px 8px", borderTop: "1px solid var(--outline-variant)" }}>
            <h3 style={{
              fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
              color: "var(--on-surface-variant)", marginBottom: 8,
            }}>
              Pending Requests
            </h3>
            {pendingRequests.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--on-surface-variant)", padding: "8px 0", textAlign: "center" }}>
                No pending requests
              </p>
            ) : pendingRequests.map(req => (
              <div key={req.id} className="card-sm" style={{ padding: 12, marginBottom: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--on-surface)", marginBottom: 4 }}>
                  From: {req.from}
                </p>
                <p style={{ fontSize: 12, color: "var(--on-surface-variant)", marginBottom: 8 }}>
                  {req.subject}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {req.slots.map((slot, si) => (
                    <button
                      key={si}
                      className="btn btn-ghost btn-sm"
                      style={{ width: "100%", justifyContent: "center", fontSize: 11 }}
                      onClick={() => handleAcceptSlot(req.id, slot, req.from)}
                    >
                      Accept: {slot}
                    </button>
                  ))}
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  style={{ width: "100%", justifyContent: "center", marginTop: 6 }}
                  onClick={() => handleDeclineAll(req.id, req.from)}
                >
                  Decline All
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
