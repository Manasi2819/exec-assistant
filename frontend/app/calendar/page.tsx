"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  fetchMeetings, fetchCalendarSuggestions, approveSuggestion, dismissSuggestion,
  updateMeeting, delegateMeeting, fetchDelegateRecommendations, createMeeting,
  generateMeetingBrief,
  type Meeting, type CalendarSuggestion, type DelegateCandidate,
  type MeetingPatch, type MeetingBrief,
} from "@/lib/api";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useToast } from "@/hooks/useToast";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = ["8 AM","9 AM","10 AM","11 AM","12 PM","1 PM","2 PM","3 PM","4 PM","5 PM","6 PM"];

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ba1a1a", high: "#f57f17", medium: "var(--primary)", low: "var(--secondary)",
};
const PRIORITY_BG: Record<string, string> = {
  critical: "#fce8e6", high: "#fff8e1", medium: "rgba(52,89,165,0.08)", low: "rgba(82,94,125,0.08)",
};
const SUGGESTION_COLORS = {
  conflict: { border: "#f57f17", bg: "rgba(245,127,23,0.06)", icon: "#f57f17", badge: "#fff8e1", badgeText: "#5c3c00" },
  success:  { border: "#137333", bg: "rgba(19,115,51,0.06)",  icon: "#137333", badge: "#e6f4ea", badgeText: "#0a4a1f" },
  info:     { border: "var(--primary)", bg: "rgba(52,89,165,0.06)", icon: "var(--primary)", badge: "var(--primary-fixed)", badgeText: "var(--on-surface)" },
  warning:  { border: "#f57f17", bg: "rgba(245,127,23,0.06)", icon: "#f57f17", badge: "#fff8e1", badgeText: "#5c3c00" },
};
const BADGE_LABELS: Record<string, string> = {
  conflict: "Conflict", success: "Brief Ready", info: "Optimization", warning: "Action Needed",
};
const SUGGESTION_TYPE_ICON: Record<string, string> = {
  reschedule: "schedule", move_earlier: "arrow_upward", move_later: "arrow_downward",
  delegate: "person_add", shorten: "timer", extend: "more_time", merge: "merge", brief_ready: "auto_awesome",
  conflict_resolve: "warning", add_attendee: "group_add", remove_attendee: "person_remove",
  convert_online: "videocam",
};

const TODAY = new Date(2026, 5, 24); // June 24 2026

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type PanelMode = "detail" | "edit" | "delegate" | "new_event";

type PendingRequest = {
  id: string; from: string; subject: string;
  slots: { label: string; date: string; time: string; col: number; row: number }[];
};

const INITIAL_PENDING: PendingRequest[] = [
  {
    id: "r1", from: "Sarah Jenkins", subject: "Product Strategy Sync",
    slots: [
      { label: "Thu 2:00 PM", date: "2026-06-25", time: "2:00 PM", col: 4, row: 6 },
      { label: "Fri 10:00 AM", date: "2026-06-27", time: "10:00 AM", col: 6, row: 2 },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Shimmer Skeleton
// ─────────────────────────────────────────────────────────────
function BriefSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
      <div style={{ height: 12, borderRadius: 6, background: "linear-gradient(90deg,var(--surface-container) 25%,var(--surface-container-high) 50%,var(--surface-container) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
      <div style={{ height: 12, width: "80%", borderRadius: 6, background: "linear-gradient(90deg,var(--surface-container) 25%,var(--surface-container-high) 50%,var(--surface-container) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite 0.1s" }} />
      <div style={{ height: 12, width: "60%", borderRadius: 6, background: "linear-gradient(90deg,var(--surface-container) 25%,var(--surface-container-high) 50%,var(--surface-container) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite 0.2s" }} />
      <div style={{ height: 12, borderRadius: 6, marginTop: 6, background: "linear-gradient(90deg,var(--surface-container) 25%,var(--surface-container-high) 50%,var(--surface-container) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite 0.3s" }} />
      <div style={{ height: 12, width: "70%", borderRadius: 6, background: "linear-gradient(90deg,var(--surface-container) 25%,var(--surface-container-high) 50%,var(--surface-container) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite 0.4s" }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { toasts, showToast, removeToast } = useToast();

  // Data state
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [suggestions, setSuggestions] = useState<CalendarSuggestion[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>(INITIAL_PENDING);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  // UI state
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("detail");
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Brief state (cache by meeting id)
  const briefCache = useRef<Record<string, MeetingBrief>>({});
  const [briefData, setBriefData] = useState<MeetingBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  // Delegate state
  const [delegates, setDelegates] = useState<DelegateCandidate[]>([]);
  const [delegatesLoading, setDelegatesLoading] = useState(false);
  const [selectedDelegate, setSelectedDelegate] = useState<DelegateCandidate | null>(null);
  const [delegationNotes, setDelegationNotes] = useState("");
  const [transferOwnership, setTransferOwnership] = useState(false);
  const [submittingDelegate, setSubmittingDelegate] = useState(false);

  // Edit state
  const [editForm, setEditForm] = useState<MeetingPatch>({});
  const [savingEdit, setSavingEdit] = useState(false);

  // New event state
  const [newEventForm, setNewEventForm] = useState({
    title: "", date: "2026-06-24", time: "10:00 AM", duration_min: 60,
    participants: "", optional_participants: "", location: "",
    meeting_link: "", description: "", agenda_items: "", priority: "medium", organizer_notes: "",
  });
  const [savingNewEvent, setSavingNewEvent] = useState(false);

  // Week dates
  const weekStart = new Date(TODAY);
  weekStart.setDate(TODAY.getDate() - TODAY.getDay() + weekOffset * 7);
  const weekDates = DAYS.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const isToday = (d: Date) => d.getDate() === TODAY.getDate() && d.getMonth() === TODAY.getMonth();

  // ── Load data ──────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [mtgs, suggs] = await Promise.all([fetchMeetings(), fetchCalendarSuggestions()]);
      if (mtgs.length > 0) {
        setMeetings(mtgs);
        setBackendOnline(true);
      } else {
        setBackendOnline(false);
      }
      setSuggestions(suggs);
    }
    load();
  }, []);

  // ── Auto-generate brief when meeting selected ──────────────
  const triggerBriefGeneration = useCallback(async (meeting: Meeting) => {
    if (briefCache.current[meeting.id]) {
      setBriefData(briefCache.current[meeting.id]);
      return;
    }
    setBriefLoading(true);
    setBriefData(null);
    const result = await generateMeetingBrief({
      meeting_id: meeting.id,
      meeting_title: meeting.title,
      participants: meeting.participants,
      meeting_datetime: meeting.start_time,
      agenda_items: meeting.agenda_items ?? [],
      previous_meetings: meeting.previous_meetings ?? [],
    });
    if (result) {
      briefCache.current[meeting.id] = result;
      setBriefData(result);
    }
    setBriefLoading(false);
  }, []);

  const openDetail = useCallback((meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setPanelMode("detail");
    setEditForm({});
    setSelectedDelegate(null);
    setDelegationNotes("");
    triggerBriefGeneration(meeting);
  }, [triggerBriefGeneration]);

  const openEdit = useCallback((meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setPanelMode("edit");
    setEditForm({
      title: meeting.title,
      date: meeting.date ?? "",
      time: meeting.time ?? "",
      duration_min: meeting.duration_min ?? 60,
      description: meeting.description ?? "",
      agenda_text: (meeting.agenda_items ?? []).join("\n"),
      location: meeting.location ?? "",
      meeting_link: meeting.meeting_link ?? "",
      participants: [...(meeting.participants ?? [])],
      optional_participants: [...(meeting.optional_participants ?? [])],
      organizer_notes: meeting.organizer_notes ?? "",
      priority: meeting.priority ?? "medium",
    });
  }, []);

  const openDelegate = useCallback(async (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setPanelMode("delegate");
    setSelectedDelegate(null);
    setDelegationNotes("");
    setTransferOwnership(false);
    setDelegatesLoading(true);
    const recs = await fetchDelegateRecommendations(meeting.id);
    setDelegates(recs);
    setDelegatesLoading(false);
  }, []);

  // ── Approve suggestion ────────────────────────────────────
  const handleApproveSuggestion = async (s: CalendarSuggestion) => {
    if (approvingId) return;
    setApprovingId(s.id);

    // Optimistic local state update
    if (s.type === "reschedule" || s.type === "move_earlier" || s.type === "move_later") {
      const params = s.params as { new_col?: number; new_row?: number; new_time?: string; new_date?: string };
      setMeetings(prev => prev.map(m => {
        if (m.id !== s.meeting_id) return m;
        return {
          ...m,
          col: params.new_col ?? m.col,
          row: params.new_row ?? m.row,
          time: params.new_time ?? m.time,
          date: params.new_date ?? m.date,
          conflict: false,
        };
      }));
      // Remove conflicts from other meetings that were paired
      setMeetings(prev => prev.map(m => ({
        ...m,
        conflict: m.id === s.meeting_id ? false : m.conflict,
      })));
    } else if (s.type === "shorten") {
      const params = s.params as { new_duration?: number };
      setMeetings(prev => prev.map(m =>
        m.id === s.meeting_id ? { ...m, duration_min: params.new_duration ?? m.duration_min } : m
      ));
    } else if (s.type === "delegate") {
      const params = s.params as { suggested_delegate?: string };
      setMeetings(prev => prev.map(m =>
        m.id === s.meeting_id ? { ...m, delegated: true, delegated_to: params.suggested_delegate ?? "Delegate", conflict: false } : m
      ));
    }

    // Remove the suggestion instantly
    setSuggestions(prev => prev.filter(x => x.id !== s.id));

    // Fire background API call
    approveSuggestion(s.meeting_id, s.id, s.params);

    // Show toast
    showToast(`✓ ${s.title}`, "success");

    // If selected meeting is affected, refresh its data
    if (selectedMeeting?.id === s.meeting_id) {
      setSelectedMeeting(prev => {
        if (!prev) return prev;
        const params = s.params as Record<string, unknown>;
        return {
          ...prev,
          col: (params.new_col as number) ?? prev.col,
          row: (params.new_row as number) ?? prev.row,
          time: (params.new_time as string) ?? prev.time,
          conflict: false,
          delegated: s.type === "delegate" ? true : prev.delegated,
          delegated_to: s.type === "delegate" ? (params.suggested_delegate as string) : prev.delegated_to,
          duration_min: s.type === "shorten" ? (params.new_duration as number) ?? prev.duration_min : prev.duration_min,
        };
      });
    }
    setApprovingId(null);
  };

  // ── Dismiss suggestion ────────────────────────────────────
  const handleDismiss = (s: CalendarSuggestion) => {
    setSuggestions(prev => prev.filter(x => x.id !== s.id));
    dismissSuggestion(s.id);
    showToast("Suggestion dismissed.", "info");
  };

  // ── Save meeting edit ──────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!selectedMeeting) return;
    setSavingEdit(true);
    // Optimistic update
    const patchedLocally: Meeting = {
      ...selectedMeeting,
      ...editForm,
      priority: (editForm.priority as Meeting["priority"]) ?? selectedMeeting.priority,
      participants: editForm.participants ?? selectedMeeting.participants,
      agenda_items: editForm.agenda_text
        ? editForm.agenda_text.split("\n").filter(Boolean)
        : selectedMeeting.agenda_items,
    };
    setMeetings(prev => prev.map(m => m.id === selectedMeeting.id ? patchedLocally : m));
    setSelectedMeeting(patchedLocally);
    // Invalidate brief cache
    delete briefCache.current[selectedMeeting.id];
    setBriefData(null);
    // Background API
    await updateMeeting(selectedMeeting.id, editForm);
    setSavingEdit(false);
    setPanelMode("detail");
    showToast(`Meeting updated: ${patchedLocally.title}`, "success");
    triggerBriefGeneration(patchedLocally);
  };

  // ── Submit delegation ─────────────────────────────────────
  const handleSubmitDelegate = async () => {
    if (!selectedMeeting || !selectedDelegate) return;
    setSubmittingDelegate(true);
    const req = { delegate_name: selectedDelegate.name, delegate_id: selectedDelegate.id, delegation_notes: delegationNotes, transfer_ownership: transferOwnership };
    // Optimistic update
    const updated: Meeting = { ...selectedMeeting, delegated: true, delegated_to: selectedDelegate.name, conflict: false };
    setMeetings(prev => prev.map(m => m.id === selectedMeeting.id ? updated : m));
    setSelectedMeeting(updated);
    setSuggestions(prev => prev.filter(s => !(s.meeting_id === selectedMeeting.id && s.type === "delegate")));
    await delegateMeeting(selectedMeeting.id, req);
    setSubmittingDelegate(false);
    setPanelMode("detail");
    showToast(`Meeting delegated to ${selectedDelegate.name}. Organizer and delegate have been notified.`, "success");
  };

  // ── Accept pending request ────────────────────────────────
  const handleAcceptSlot = (req: PendingRequest, slot: PendingRequest["slots"][0]) => {
    const newMeeting: Meeting = {
      id: `m_req_${Date.now()}`,
      title: req.subject,
      start_time: `${slot.date}T${slot.time}:00Z`,
      date: slot.date,
      time: slot.time,
      duration_min: 60,
      participants: [req.from, "Utkarsh"],
      col: slot.col,
      row: slot.row,
      conflict: false,
      delegated: false,
      brief_status: "pending",
      source: "manual",
      priority: "medium",
      color: "var(--tertiary)",
    };
    setMeetings(prev => [...prev, newMeeting]);
    setPendingRequests(prev => prev.filter(r => r.id !== req.id));
    showToast(`Meeting with ${req.from} confirmed for ${slot.label}. Invite sent.`, "success");
  };

  const handleDeclineAll = (req: PendingRequest) => {
    setPendingRequests(prev => prev.filter(r => r.id !== req.id));
    showToast(`Meeting request from ${req.from} declined.`, "warning");
  };

  // ── Create new event ──────────────────────────────────────
  const handleCreateEvent = async () => {
    if (!newEventForm.title.trim()) { showToast("Title is required.", "error"); return; }
    setSavingNewEvent(true);
    const participants = newEventForm.participants.split(",").map(s => s.trim()).filter(Boolean);
    const optionals = newEventForm.optional_participants.split(",").map(s => s.trim()).filter(Boolean);
    const agendaItems = newEventForm.agenda_items.split("\n").map(s => s.trim()).filter(Boolean);

    // Optimistic: compute grid position locally
    const colMap: Record<string, number> = { "2026-06-21": 0, "2026-06-22": 1, "2026-06-23": 2, "2026-06-24": 3, "2026-06-25": 4, "2026-06-26": 5, "2026-06-27": 6 };
    const rowMap: Record<string, number> = { "8 AM": 0, "9 AM": 1, "10 AM": 2, "10:00 AM": 2, "11 AM": 3, "12 PM": 4, "1 PM": 5, "2 PM": 6, "3 PM": 7, "4 PM": 8, "5 PM": 9, "6 PM": 10 };
    const col = colMap[newEventForm.date] ?? 3;
    const row = rowMap[newEventForm.time] ?? 2;

    const tempId = `m_new_${Date.now()}`;
    const optimisticMeeting: Meeting = {
      id: tempId,
      title: newEventForm.title,
      start_time: `${newEventForm.date}T${newEventForm.time}:00Z`,
      date: newEventForm.date,
      time: newEventForm.time,
      duration_min: newEventForm.duration_min,
      participants, optional_participants: optionals,
      agenda_items: agendaItems,
      location: newEventForm.location,
      meeting_link: newEventForm.meeting_link,
      description: newEventForm.description,
      organizer_notes: newEventForm.organizer_notes,
      priority: newEventForm.priority as Meeting["priority"],
      brief_status: "pending",
      conflict: false, delegated: false,
      source: "manual", col, row,
    };
    setMeetings(prev => [...prev, optimisticMeeting]);
    setPanelMode("detail");
    setSelectedMeeting(optimisticMeeting);
    showToast(`Meeting "${newEventForm.title}" created successfully.`, "success");

    // Background API create
    const created = await createMeeting({
      title: newEventForm.title, date: newEventForm.date, time: newEventForm.time,
      duration_min: newEventForm.duration_min, participants, optional_participants: optionals,
      location: newEventForm.location, meeting_link: newEventForm.meeting_link,
      description: newEventForm.description, agenda_items: agendaItems,
      priority: newEventForm.priority, organizer_notes: newEventForm.organizer_notes,
    });
    if (created) {
      setMeetings(prev => prev.map(m => m.id === tempId ? created : m));
    }
    setSavingNewEvent(false);
    setNewEventForm({ title: "", date: "2026-06-24", time: "10:00 AM", duration_min: 60, participants: "", optional_participants: "", location: "", meeting_link: "", description: "", agenda_items: "", priority: "medium", organizer_notes: "" });
  };

  // ── Render ────────────────────────────────────────────────
  const conflictCount = meetings.filter(m => m.conflict).length;
  const highPriorityCount = suggestions.filter(s => s.priority === "high").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", fontFamily: "var(--font-sans)" }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Top Bar ─────────────────────────────────────────── */}
      <header style={{
        height: 64, background: "var(--surface)", borderBottom: "1px solid var(--outline-variant)",
        display: "flex", alignItems: "center", padding: "0 24px", gap: 14, flexShrink: 0,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: 22 }}>calendar_today</span>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "var(--on-surface)" }}>Calendar Intelligence</h1>
          <span style={{ fontSize: 12, color: "var(--on-surface-variant)", marginLeft: 2 }}>
            {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
            {new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}, {TODAY.getFullYear()}
          </span>
          {backendOnline !== null && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 99, background: backendOnline ? "#e6f4ea" : "#fff8e1", color: backendOnline ? "#137333" : "#f57f17" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", display: "inline-block", background: backendOnline ? "#137333" : "#f57f17" }} />
              {backendOnline ? "Live" : "Demo"}
            </span>
          )}
          {conflictCount > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "#fce8e6", color: "#ba1a1a" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>warning</span>
              {conflictCount} Conflict{conflictCount > 1 ? "s" : ""}
            </span>
          )}
          {highPriorityCount > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "#fff8e1", color: "#f57f17" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>auto_awesome</span>
              {highPriorityCount} AI Action{highPriorityCount > 1 ? "s" : ""}
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
        <button className="btn btn-primary btn-sm" onClick={() => { setSelectedMeeting(null); setPanelMode("new_event"); }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          New Event
        </button>
      </header>

      {/* ── Main Content ─────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Calendar Grid ─────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)", borderBottom: "1px solid var(--outline-variant)", background: "var(--surface-container-lowest)", flexShrink: 0 }}>
            <div style={{ padding: "10px 6px" }} />
            {weekDates.map((d, i) => (
              <div key={i} style={{ padding: "10px 6px", textAlign: "center", borderLeft: "1px solid var(--outline-variant)" }}>
                <div style={{ fontSize: 10, color: "var(--on-surface-variant)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{DAYS[i]}</div>
                <div style={{
                  fontSize: 17, fontWeight: 700, marginTop: 2,
                  color: isToday(d) ? "#fff" : "var(--on-surface)",
                  background: isToday(d) ? "var(--primary)" : "transparent",
                  width: 30, height: 30, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center", margin: "2px auto 0",
                  transition: "background 0.2s",
                }}>
                  {d.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
            {HOURS.map((hour, hi) => (
              <div key={hi} style={{ display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)", borderBottom: "1px solid var(--outline-variant)", minHeight: 60 }}>
                <div style={{ padding: "4px 6px", fontSize: 10, color: "var(--on-surface-variant)", fontWeight: 500, textAlign: "right", paddingTop: 5 }}>
                  {hour}
                </div>
                {weekDates.map((_, ci) => {
                  const cellMeetings = meetings.filter(e => e.row === hi && e.col === ci);
                  return (
                    <div key={ci} style={{ borderLeft: "1px solid var(--outline-variant)", padding: 2, position: "relative", background: ci === 3 && weekOffset === 0 ? "rgba(52,89,165,0.015)" : "transparent" }}>
                      {cellMeetings.map((event, ei) => {
                        const isSelected = selectedMeeting?.id === event.id;
                        const pColor = PRIORITY_COLORS[event.priority ?? "medium"];
                        const isConflict = event.conflict;
                        const isDelegated = event.delegated;
                        return (
                          <button
                            key={event.id}
                            onClick={() => openDetail(event)}
                            style={{
                              position: "absolute",
                              top: 2 + ei * 4,
                              left: 2 + ei * 2,
                              right: 2 - ei * 2,
                              bottom: 2,
                              background: isConflict
                                ? "rgba(186,26,26,0.07)"
                                : isDelegated
                                  ? "rgba(134,69,138,0.08)"
                                  : "rgba(52,89,165,0.07)",
                              border: `1px solid ${isConflict ? "#ba1a1a" : isDelegated ? "#86458a" : isSelected ? "var(--primary)" : "rgba(52,89,165,0.25)"}`,
                              borderLeft: `3px solid ${isConflict ? "#ba1a1a" : isDelegated ? "#86458a" : pColor}`,
                              borderRadius: 4,
                              padding: "3px 6px",
                              textAlign: "left",
                              cursor: "pointer",
                              boxShadow: isSelected ? "0 0 0 2px var(--primary-fixed)" : isConflict ? "0 0 0 1px rgba(186,26,26,0.3)" : "none",
                              transition: "all 0.15s ease",
                              zIndex: ei + 1,
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 700, color: isConflict ? "#ba1a1a" : isDelegated ? "#86458a" : "var(--on-surface)", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {event.title}
                            </div>
                            <div style={{ fontSize: 10, color: "var(--on-surface-variant)", marginTop: 1 }}>
                              {event.time}{event.duration_min ? ` · ${event.duration_min}m` : ""}
                            </div>
                            {isDelegated && (
                              <span style={{ fontSize: 9, fontWeight: 700, color: "#86458a", background: "#ffd6fb", padding: "1px 4px", borderRadius: 2, marginTop: 1, display: "inline-block" }}>
                                DELEGATED
                              </span>
                            )}
                            {isConflict && !isDelegated && (
                              <span className="material-symbols-outlined" style={{ fontSize: 11, color: "#ba1a1a", display: "block", marginTop: 1 }}>warning</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* ── Right Panel ───────────────────────────────────── */}
        <div style={{ width: 340, flexShrink: 0, borderLeft: "1px solid var(--outline-variant)", background: "var(--surface-container-lowest)", display: "flex", flexDirection: "column", overflowY: "auto" }}>

          {/* ── New Event Form ─────────────────────────── */}
          {panelMode === "new_event" && (
            <div style={{ padding: 16, borderBottom: "1px solid var(--outline-variant)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--primary)" }}>add_circle</span>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--on-surface)" }}>New Event</h3>
                </div>
                <button className="icon-btn" onClick={() => setPanelMode("detail")} style={{ width: 24, height: 24 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <FormField label="Title *">
                  <input className="form-input" placeholder="Meeting title" value={newEventForm.title} onChange={e => setNewEventForm(p => ({ ...p, title: e.target.value }))} />
                </FormField>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <FormField label="Date">
                    <select className="form-input" value={newEventForm.date} onChange={e => setNewEventForm(p => ({ ...p, date: e.target.value }))}>
                      {["2026-06-21","2026-06-22","2026-06-23","2026-06-24","2026-06-25","2026-06-26","2026-06-27"].map(d => (
                        <option key={d} value={d}>{new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Time">
                    <select className="form-input" value={newEventForm.time} onChange={e => setNewEventForm(p => ({ ...p, time: e.target.value }))}>
                      {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </FormField>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <FormField label="Duration (min)">
                    <input className="form-input" type="number" min={15} step={15} value={newEventForm.duration_min} onChange={e => setNewEventForm(p => ({ ...p, duration_min: parseInt(e.target.value) || 60 }))} />
                  </FormField>
                  <FormField label="Priority">
                    <select className="form-input" value={newEventForm.priority} onChange={e => setNewEventForm(p => ({ ...p, priority: e.target.value }))}>
                      {["low","medium","high","critical"].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                    </select>
                  </FormField>
                </div>
                <FormField label="Required Attendees (comma-separated)">
                  <input className="form-input" placeholder="e.g. John, Sarah, Dev Team" value={newEventForm.participants} onChange={e => setNewEventForm(p => ({ ...p, participants: e.target.value }))} />
                </FormField>
                <FormField label="Optional Attendees">
                  <input className="form-input" placeholder="Optional members" value={newEventForm.optional_participants} onChange={e => setNewEventForm(p => ({ ...p, optional_participants: e.target.value }))} />
                </FormField>
                <FormField label="Location">
                  <input className="form-input" placeholder="Room or address" value={newEventForm.location} onChange={e => setNewEventForm(p => ({ ...p, location: e.target.value }))} />
                </FormField>
                <FormField label="Meeting Link">
                  <input className="form-input" placeholder="https://meet.google.com/..." value={newEventForm.meeting_link} onChange={e => setNewEventForm(p => ({ ...p, meeting_link: e.target.value }))} />
                </FormField>
                <FormField label="Description">
                  <textarea className="form-input" rows={2} placeholder="Brief description" value={newEventForm.description} onChange={e => setNewEventForm(p => ({ ...p, description: e.target.value }))} style={{ resize: "vertical" }} />
                </FormField>
                <FormField label="Agenda (one item per line)">
                  <textarea className="form-input" rows={3} placeholder={"Topic 1\nTopic 2\nTopic 3"} value={newEventForm.agenda_items} onChange={e => setNewEventForm(p => ({ ...p, agenda_items: e.target.value }))} style={{ resize: "vertical" }} />
                </FormField>
                <FormField label="Organizer Notes">
                  <textarea className="form-input" rows={2} placeholder="Private notes for yourself" value={newEventForm.organizer_notes} onChange={e => setNewEventForm(p => ({ ...p, organizer_notes: e.target.value }))} style={{ resize: "vertical" }} />
                </FormField>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={handleCreateEvent} disabled={savingNewEvent}>
                    {savingNewEvent ? <><span className="material-symbols-outlined" style={{ fontSize: 14, animation: "spin 1s linear infinite" }}>sync</span> Creating...</> : <><span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span> Create Event</>}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPanelMode("detail")}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Delegate Dialog ──────────────────────────── */}
          {panelMode === "delegate" && selectedMeeting && (
            <div style={{ padding: 16, borderBottom: "1px solid var(--outline-variant)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#86458a" }}>person_add</span>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--on-surface)" }}>Delegate Meeting</h3>
                </div>
                <button className="icon-btn" onClick={() => openDetail(selectedMeeting)} style={{ width: 24, height: 24 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              </div>
              <p style={{ fontSize: 12, color: "var(--on-surface-variant)", marginBottom: 12, lineHeight: 1.5 }}>
                Delegating: <strong style={{ color: "var(--on-surface)" }}>{selectedMeeting.title}</strong>
              </p>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--on-surface-variant)", marginBottom: 8 }}>
                AI-Recommended Delegates
              </div>
              {delegatesLoading ? (
                <BriefSkeleton />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                  {delegates.map((d, i) => {
                    const isSelected = selectedDelegate?.id === d.id;
                    const score = Math.round(d.availability * 0.4 + d.expertise * 0.35 + (100 - d.workload) * 0.25);
                    return (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDelegate(d)}
                        style={{
                          padding: "10px 12px", borderRadius: 6, textAlign: "left", cursor: "pointer",
                          border: `1px solid ${isSelected ? "#86458a" : "var(--outline-variant)"}`,
                          background: isSelected ? "rgba(134,69,138,0.07)" : "var(--surface-container-low)",
                          boxShadow: isSelected ? "0 0 0 2px rgba(134,69,138,0.2)" : "none",
                          transition: "all 0.15s ease",
                          position: "relative",
                        }}
                      >
                        {i === 0 && (
                          <span style={{ position: "absolute", top: 6, right: 8, fontSize: 9, fontWeight: 700, color: "#137333", background: "#e6f4ea", padding: "1px 5px", borderRadius: 3 }}>TOP MATCH</span>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--secondary-container)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--secondary)", flexShrink: 0 }}>
                            {d.name.split(" ").map(n => n[0]).join("")}
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--on-surface)" }}>{d.name}</div>
                            <div style={{ fontSize: 10, color: "var(--on-surface-variant)" }}>{d.role} · {d.department}</div>
                          </div>
                          <div style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "#86458a" }}>{score}%</div>
                        </div>
                        <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                          <ScorePill label="Availability" value={d.availability} color="#137333" />
                          <ScorePill label="Expertise" value={d.expertise} color="var(--primary)" />
                          <ScorePill label="Workload" value={100 - d.workload} color={d.workload > 70 ? "#ba1a1a" : "#f57f17"} />
                        </div>
                        <div style={{ fontSize: 10, color: "var(--on-surface-variant)", lineHeight: 1.4 }}>{d.reason}</div>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedDelegate && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  <FormField label="Delegation Notes">
                    <textarea className="form-input" rows={2} placeholder="Instructions or context for the delegate..." value={delegationNotes} onChange={e => setDelegationNotes(e.target.value)} style={{ resize: "vertical" }} />
                  </FormField>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--on-surface)", cursor: "pointer" }}>
                    <input type="checkbox" checked={transferOwnership} onChange={e => setTransferOwnership(e.target.checked)} />
                    Transfer meeting ownership
                  </label>
                </div>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1, justifyContent: "center", background: "#86458a", borderColor: "#86458a" }}
                  onClick={handleSubmitDelegate}
                  disabled={!selectedDelegate || submittingDelegate}
                >
                  {submittingDelegate ? <><span className="material-symbols-outlined" style={{ fontSize: 14, animation: "spin 1s linear infinite" }}>sync</span> Delegating...</> : <><span className="material-symbols-outlined" style={{ fontSize: 14 }}>person_add</span> Confirm Delegation</>}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => openDetail(selectedMeeting)}>Cancel</button>
              </div>
            </div>
          )}

          {/* ── Edit Meeting Form ────────────────────────── */}
          {panelMode === "edit" && selectedMeeting && (
            <div style={{ padding: 16, borderBottom: "1px solid var(--outline-variant)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--primary)" }}>edit</span>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--on-surface)" }}>Edit Meeting</h3>
                </div>
                <button className="icon-btn" onClick={() => openDetail(selectedMeeting)} style={{ width: 24, height: 24 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <FormField label="Title">
                  <input className="form-input" value={editForm.title ?? ""} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
                </FormField>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <FormField label="Date">
                    <select className="form-input" value={editForm.date ?? ""} onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))}>
                      {["2026-06-21","2026-06-22","2026-06-23","2026-06-24","2026-06-25","2026-06-26","2026-06-27"].map(d => (
                        <option key={d} value={d}>{new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Time">
                    <select className="form-input" value={editForm.time ?? ""} onChange={e => setEditForm(p => ({ ...p, time: e.target.value }))}>
                      {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </FormField>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <FormField label="Duration (min)">
                    <input className="form-input" type="number" min={15} step={15} value={editForm.duration_min ?? 60} onChange={e => setEditForm(p => ({ ...p, duration_min: parseInt(e.target.value) || 60 }))} />
                  </FormField>
                  <FormField label="Priority">
                    <select className="form-input" value={editForm.priority ?? "medium"} onChange={e => setEditForm(p => ({ ...p, priority: e.target.value }))}>
                      {["low","medium","high","critical"].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                    </select>
                  </FormField>
                </div>
                <FormField label="Description">
                  <textarea className="form-input" rows={2} value={editForm.description ?? ""} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} style={{ resize: "vertical" }} />
                </FormField>
                <FormField label="Agenda (one item per line)">
                  <textarea className="form-input" rows={3} value={editForm.agenda_text ?? ""} onChange={e => setEditForm(p => ({ ...p, agenda_text: e.target.value }))} style={{ resize: "vertical" }} />
                </FormField>
                <FormField label="Location">
                  <input className="form-input" value={editForm.location ?? ""} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))} />
                </FormField>
                <FormField label="Meeting Link">
                  <input className="form-input" value={editForm.meeting_link ?? ""} onChange={e => setEditForm(p => ({ ...p, meeting_link: e.target.value }))} />
                </FormField>
                <FormField label="Required Attendees">
                  <input className="form-input" value={(editForm.participants ?? []).join(", ")} onChange={e => setEditForm(p => ({ ...p, participants: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))} />
                </FormField>
                <FormField label="Optional Attendees">
                  <input className="form-input" value={(editForm.optional_participants ?? []).join(", ")} onChange={e => setEditForm(p => ({ ...p, optional_participants: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))} />
                </FormField>
                <FormField label="Organizer Notes (private)">
                  <textarea className="form-input" rows={2} value={editForm.organizer_notes ?? ""} onChange={e => setEditForm(p => ({ ...p, organizer_notes: e.target.value }))} style={{ resize: "vertical" }} />
                </FormField>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={handleSaveEdit} disabled={savingEdit}>
                    {savingEdit ? <><span className="material-symbols-outlined" style={{ fontSize: 14, animation: "spin 1s linear infinite" }}>sync</span> Saving...</> : <><span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span> Save Changes</>}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => openDetail(selectedMeeting)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Meeting Detail ───────────────────────────── */}
          {panelMode === "detail" && selectedMeeting && (
            <div style={{ borderBottom: "1px solid var(--outline-variant)" }}>
              {/* Header */}
              <div style={{ padding: "14px 16px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ flex: 1, marginRight: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                        padding: "2px 6px", borderRadius: 3,
                        background: PRIORITY_BG[selectedMeeting.priority ?? "medium"],
                        color: PRIORITY_COLORS[selectedMeeting.priority ?? "medium"],
                      }}>
                        {(selectedMeeting.priority ?? "medium").toUpperCase()}
                      </span>
                      {selectedMeeting.delegated && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: "#86458a", background: "#ffd6fb", padding: "2px 6px", borderRadius: 3 }}>
                          DELEGATED → {selectedMeeting.delegated_to}
                        </span>
                      )}
                      {selectedMeeting.conflict && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: "#ba1a1a", background: "#fce8e6", padding: "2px 6px", borderRadius: 3, display: "flex", alignItems: "center", gap: 3 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 10 }}>warning</span> CONFLICT
                        </span>
                      )}
                    </div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--on-surface)", lineHeight: 1.3 }}>{selectedMeeting.title}</h3>
                  </div>
                  <button className="icon-btn" onClick={() => setSelectedMeeting(null)} style={{ width: 24, height: 24, flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                  </button>
                </div>

                {/* Meta rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12, fontSize: 12 }}>
                  <div className="info-row">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                    {selectedMeeting.time} · {selectedMeeting.duration_min} min · {selectedMeeting.date}
                  </div>
                  {selectedMeeting.location && (
                    <div className="info-row">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>location_on</span>
                      {selectedMeeting.location}
                    </div>
                  )}
                  {selectedMeeting.meeting_link && (
                    <div className="info-row">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>videocam</span>
                      <a href={selectedMeeting.meeting_link} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", textDecoration: "none", fontSize: 11 }}>Join Online</a>
                    </div>
                  )}
                  <div className="info-row">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>people</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {selectedMeeting.participants.map((p, i) => (
                        <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 3, background: "var(--secondary-container)", color: "var(--on-secondary-container)" }}>{p}</span>
                      ))}
                      {(selectedMeeting.optional_participants ?? []).map((p, i) => (
                        <span key={`o${i}`} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: "var(--surface-container)", color: "var(--on-surface-variant)" }}>{p} (opt)</span>
                      ))}
                    </div>
                  </div>
                  {selectedMeeting.source && (
                    <div className="info-row">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>integration_instructions</span>
                      {selectedMeeting.source.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                  )}
                </div>

                {/* Agenda */}
                {(selectedMeeting.agenda_items ?? []).length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--on-surface-variant)", marginBottom: 5 }}>Agenda</div>
                    {(selectedMeeting.agenda_items ?? []).map((item, i) => (
                      <div key={i} style={{ display: "flex", gap: 6, fontSize: 12, color: "var(--on-surface)", marginBottom: 3, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)", minWidth: 16 }}>{i + 1}.</span>
                        {item}
                      </div>
                    ))}
                  </div>
                )}

                {/* Action bar */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" style={{ justifyContent: "center", fontSize: 11 }} onClick={() => openEdit(selectedMeeting)}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span> Edit
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ justifyContent: "center", fontSize: 11, color: "#86458a", borderColor: "rgba(134,69,138,0.3)" }} onClick={() => openDelegate(selectedMeeting)}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>person_add</span> Delegate
                    </button>
                  </div>
                  {selectedMeeting.conflict && (
                    <button
                      className="btn btn-sm"
                      style={{ justifyContent: "center", fontSize: 11, background: "#fce8e6", color: "#ba1a1a", border: "1px solid rgba(186,26,26,0.3)" }}
                      onClick={() => {
                        const conflictSuggestion = suggestions.find(s => s.meeting_id === selectedMeeting.id && (s.type === "reschedule" || s.type === "conflict_resolve" || s.type === "move_earlier"));
                        if (conflictSuggestion) handleApproveSuggestion(conflictSuggestion);
                        else showToast("Conflict logged. AI is analyzing resolution options.", "info");
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_fix_high</span>
                      Resolve Conflict
                    </button>
                  )}
                </div>
              </div>

              {/* AI Brief Section */}
              <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--outline-variant)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 0 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--secondary)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>auto_awesome</span>
                  AI Meeting Brief
                  {briefLoading && <span style={{ fontSize: 10, fontWeight: 500, color: "var(--on-surface-variant)", marginLeft: 4 }}>Generating...</span>}
                </div>

                {briefLoading && <BriefSkeleton />}

                {briefData && !briefLoading && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {briefData.purpose && (
                      <div style={{ padding: 10, borderRadius: 6, fontSize: 12, lineHeight: 1.6, background: "var(--surface-container-low)", border: "1px solid var(--outline-variant)", color: "var(--on-surface)" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--on-surface-variant)", display: "block", marginBottom: 3, textTransform: "uppercase" }}>Purpose</span>
                        {briefData.purpose}
                      </div>
                    )}
                    {briefData.important_topics?.length > 0 && (
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--on-surface-variant)", display: "block", marginBottom: 5, textTransform: "uppercase" }}>Key Topics</span>
                        {briefData.important_topics.map((pt, i) => (
                          <div key={i} style={{ display: "flex", gap: 6, fontSize: 12, color: "var(--on-surface)", marginBottom: 3, alignItems: "flex-start" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 12, color: "var(--secondary)", flexShrink: 0, marginTop: 1 }}>chevron_right</span>
                            {pt}
                          </div>
                        ))}
                      </div>
                    )}
                    {briefData.recommended_preparation?.length > 0 && (
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#137333", display: "block", marginBottom: 5, textTransform: "uppercase" }}>Prep Checklist</span>
                        {briefData.recommended_preparation.map((prep, i) => (
                          <div key={i} style={{ display: "flex", gap: 6, fontSize: 12, color: "var(--on-surface)", marginBottom: 3, alignItems: "flex-start" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 12, color: "#137333", flexShrink: 0, marginTop: 1 }}>task_alt</span>
                            {prep}
                          </div>
                        ))}
                      </div>
                    )}
                    {briefData.potential_questions?.length > 0 && (
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)", display: "block", marginBottom: 5, textTransform: "uppercase" }}>Likely Questions</span>
                        {briefData.potential_questions.map((q, i) => (
                          <div key={i} style={{ display: "flex", gap: 6, fontSize: 12, color: "var(--on-surface)", marginBottom: 3, alignItems: "flex-start" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 12, color: "var(--primary)", flexShrink: 0, marginTop: 1 }}>help_outline</span>
                            {q}
                          </div>
                        ))}
                      </div>
                    )}
                    {briefData.previous_decisions?.length > 0 && (
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--on-surface-variant)", display: "block", marginBottom: 5, textTransform: "uppercase" }}>Previous Decisions</span>
                        {briefData.previous_decisions.map((d, i) => (
                          <div key={i} style={{ display: "flex", gap: 6, fontSize: 12, color: "var(--on-surface)", marginBottom: 3, alignItems: "flex-start" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 12, color: "var(--outline)", flexShrink: 0, marginTop: 1 }}>history</span>
                            {d.decision_text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!briefLoading && !briefData && (
                  <div style={{ fontSize: 12, color: "var(--on-surface-variant)", padding: "8px 0", textAlign: "center" }}>
                    Brief unavailable — backend may be offline.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── AI Suggestions Section ─────────────────── */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid var(--outline-variant)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--on-surface-variant)", display: "flex", alignItems: "center", gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
                AI Suggestions
                {suggestions.length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: "var(--primary)", color: "#fff" }}>{suggestions.length}</span>
                )}
              </h3>
            </div>
            <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 7 }}>
              {suggestions.length === 0 ? (
                <div style={{ padding: "12px 8px", textAlign: "center", fontSize: 12, color: "var(--on-surface-variant)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 28, display: "block", marginBottom: 6, color: "#137333" }}>check_circle</span>
                  All suggestions resolved
                </div>
              ) : suggestions.map(s => {
                const colors = SUGGESTION_COLORS[s.badge_type];
                const icon = SUGGESTION_TYPE_ICON[s.type] ?? s.icon;
                const isApproving = approvingId === s.id;
                return (
                  <div key={s.id} style={{
                    padding: "11px 12px", borderRadius: 7, border: `1px solid ${colors.border}`,
                    background: colors.bg, borderLeft: `3px solid ${colors.border}`,
                    transition: "opacity 0.2s ease", opacity: isApproving ? 0.7 : 1,
                  }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, flexShrink: 0, color: colors.icon, marginTop: 1 }}>{icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: colors.badge, color: colors.badgeText }}>
                            {BADGE_LABELS[s.badge_type]}
                          </span>
                          {s.priority === "high" && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "#fce8e6", color: "#ba1a1a" }}>HIGH PRIORITY</span>
                          )}
                        </div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--on-surface)", lineHeight: 1.4, marginBottom: 3 }}>{s.title}</p>
                        <p style={{ fontSize: 11, color: "var(--on-surface-variant)", lineHeight: 1.45, marginBottom: 4 }}>{s.rationale}</p>
                        <p style={{ fontSize: 10, fontWeight: 600, color: colors.icon }}>{s.impact}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button
                        className="btn btn-sm"
                        style={{ flex: 1, justifyContent: "center", fontSize: 11, background: colors.icon, color: "#fff", border: `1px solid ${colors.border}`, gap: 4 }}
                        onClick={() => handleApproveSuggestion(s)}
                        disabled={isApproving}
                      >
                        {isApproving ? <span className="material-symbols-outlined" style={{ fontSize: 13, animation: "spin 1s linear infinite" }}>sync</span> : <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check</span>}
                        Approve
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, padding: "0 8px" }}
                        onClick={() => {
                          const meeting = meetings.find(m => m.id === s.meeting_id);
                          if (meeting) openDetail(meeting);
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>info</span>
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, padding: "0 8px", color: "var(--on-surface-variant)" }}
                        onClick={() => handleDismiss(s)}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Pending Requests ───────────────────────── */}
          <div style={{ flexShrink: 0, borderTop: "1px solid var(--outline-variant)" }}>
            <div style={{ padding: "12px 14px 8px" }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--on-surface-variant)", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>mark_email_unread</span>
                Pending Requests
                {pendingRequests.length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: "#f57f17", color: "#fff" }}>{pendingRequests.length}</span>
                )}
              </h3>
              {pendingRequests.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--on-surface-variant)", padding: "4px 0 8px", textAlign: "center" }}>No pending requests</p>
              ) : pendingRequests.map(req => (
                <div key={req.id} className="card-sm" style={{ padding: "10px 12px", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--secondary-container)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--secondary)", flexShrink: 0 }}>
                      {req.from.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--on-surface)" }}>{req.from}</div>
                      <div style={{ fontSize: 11, color: "var(--on-surface-variant)" }}>{req.subject}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
                    {req.slots.map((slot, si) => (
                      <button key={si} className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center", fontSize: 11, gap: 5 }} onClick={() => handleAcceptSlot(req, slot)}>
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check</span>
                        Accept: {slot.label}
                      </button>
                    ))}
                  </div>
                  <button className="btn btn-sm" style={{ width: "100%", justifyContent: "center", fontSize: 11, background: "#fce8e6", color: "#ba1a1a", border: "1px solid rgba(186,26,26,0.2)" }} onClick={() => handleDeclineAll(req)}>
                    Decline All
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .form-input {
          width: 100%; padding: 7px 9px; border-radius: 5px;
          border: 1px solid var(--outline-variant); background: var(--surface-container-lowest);
          color: var(--on-surface); font-size: 12px; font-family: var(--font-sans);
          outline: none; transition: border-color 0.15s ease; box-sizing: border-box;
        }
        .form-input:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(52,89,165,0.1); }
        .form-input option { background: var(--surface); color: var(--on-surface); }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--on-surface-variant)", display: "block", marginBottom: 4, letterSpacing: "0.02em" }}>{label}</label>
      {children}
    </div>
  );
}

function ScorePill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontSize: 9, color: "var(--on-surface-variant)", marginBottom: 2 }}>{label}</div>
      <div style={{ height: 4, borderRadius: 2, background: "var(--outline-variant)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 2, transition: "width 0.5s ease" }} />
      </div>
      <div style={{ fontSize: 9, fontWeight: 600, color, marginTop: 1 }}>{value}%</div>
    </div>
  );
}
