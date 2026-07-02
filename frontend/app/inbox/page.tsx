"use client";
import { useState, useEffect, useRef } from "react";
import {
  fetchEmails,
  fetchEmailThreads,
  fetchThreadDetail,
  generateReplyDraft,
  type Email,
  type EmailThread,
  type ThreadDetail,
  type PriorityLevel,
} from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

type InboxSection = "urgent_high" | "medium" | "low" | "spam";

interface SectionConfig {
  key: InboxSection;
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  description: string;
}

interface DelegateOption {
  name: string;
  email: string;
  dept: string;
  availability: string;
}

// ── Config ───────────────────────────────────────────────────────────────────

const SECTIONS: SectionConfig[] = [
  { key: "urgent_high", label: "Needs Attention",  icon: "notification_important", color: "#ba1a1a", bg: "rgba(186,26,26,0.08)",   border: "rgba(186,26,26,0.2)",   description: "Urgent & High Priority" },
  { key: "medium",      label: "In Progress",      icon: "pending",                color: "#f57f17", bg: "rgba(245,127,23,0.08)",  border: "rgba(245,127,23,0.2)",  description: "Medium Priority" },
  { key: "low",         label: "For Your Info",    icon: "info",                   color: "#525e7d", bg: "rgba(82,94,125,0.06)",   border: "rgba(82,94,125,0.15)",  description: "Low Priority" },
  { key: "spam",        label: "Filtered",         icon: "block",                  color: "#9c9c9c", bg: "rgba(156,156,156,0.06)", border: "rgba(156,156,156,0.15)", description: "Spam & Junk" },
];

const PRIORITY_STYLE: Record<PriorityLevel, { label: string; color: string; bg: string; icon: string }> = {
  urgent: { label: "Urgent", color: "#ba1a1a", bg: "rgba(186,26,26,0.12)", icon: "error" },
  high:   { label: "High",   color: "#c75000", bg: "rgba(199,80,0,0.10)",  icon: "priority_high" },
  medium: { label: "Medium", color: "#f57f17", bg: "rgba(245,127,23,0.10)",icon: "pending" },
  low:    { label: "Low",    color: "#525e7d", bg: "rgba(82,94,125,0.08)", icon: "low_priority" },
  spam:   { label: "Spam",   color: "#9c9c9c", bg: "rgba(156,156,156,0.1)",icon: "block" },
};

const TYPE_ICON: Record<string, string> = {
  meeting_request: "event", follow_up: "replay", action_required: "assignment",
  approval_request: "verified", escalation: "priority_high", client_query: "help",
  internal_update: "group", daily_project_update: "update", weekly_report: "summarize",
  fyi: "info", reminder: "notifications", invoice_finance: "receipt",
  hr_communication: "people", security_notification: "security",
  system_alert: "warning", newsletter: "newspaper", marketing_email: "campaign", spam: "block",
};

const STATUS_STYLE: Record<string, { color: string; icon: string; label: string }> = {
  on_track:  { color: "#137333", icon: "check_circle", label: "On Track" },
  at_risk:   { color: "#f57f17", icon: "warning",      label: "At Risk" },
  blocked:   { color: "#ba1a1a", icon: "cancel",       label: "Blocked" },
  completed: { color: "#525e7d", icon: "task_alt",     label: "Completed" },
};

const ORG_TRUST_STYLE: Record<string, { color: string; label: string }> = {
  trusted:      { color: "#137333", label: "Internal" },
  known_client: { color: "#3459a5", label: "Client" },
  known_vendor: { color: "#525e7d", label: "Vendor" },
  personal:     { color: "#f57f17", label: "Personal" },
  unknown:      { color: "#9c9c9c", label: "Unknown" },
  suspicious:   { color: "#ba1a1a", label: "Suspicious" },
};

// ── AI-Ranked Delegate Suggestions ──────────────────────────────────────────

const SUGGESTED_DELEGATES: DelegateOption[] = [
  { name: "Sarah Jenkins", email: "sarah.jenkins@company.com",  dept: "Legal",       availability: "Available" },
  { name: "Rahul Patel",   email: "rahul.patel@company.com",    dept: "Engineering", availability: "Available" },
  { name: "Alex Torres",   email: "alex.torres@company.com",    dept: "Product",     availability: "In meeting until 3PM" },
  { name: "Priya Mehta",   email: "priya.mehta@company.com",    dept: "Product",     availability: "Available" },
];

// ── Fallback data ─────────────────────────────────────────────────────────────

const FALLBACK_EMAILS: Email[] = [
  { id: "f1", sender: "ceo@company.com", senderName: "Michael Chen — CEO", senderInitials: "MC", subject: "URGENT: Emergency Board Session Tomorrow 9 AM", preview: "The board has called an emergency session regarding the Q4 strategy pivot.", body: "The board has called an emergency session for tomorrow at 9 AM regarding the Q4 strategy pivot. Your attendance is mandatory and sign-off is required.\n\nPlease review the attached deck.\n\nMichael Chen, CEO", category: "escalation", emailType: "escalation", priority: "urgent", priorityLevel: "urgent", priorityScore: 95, confidence: 0.98, time: "8:14 AM", entities: { meetingDate: "Tomorrow", meetingTime: "9:00 AM", agenda: "Q4 strategy pivot decision", approvalsRequired: ["Q4 strategy sign-off"], riskLevel: "critical" }, senderProfile: { orgType: "internal", domain: "company.com", domainTrust: "trusted", relationshipStrength: "ceo", isNewSender: false, interactionCount: 47, trustScore: 0.97 }, onLineSummary: "CEO calling emergency board session tomorrow 9 AM — mandatory attendance, sign-off required." },
  { id: "f2", sender: "john.smith@acmecorp.com", senderName: "John Smith — Acme Corp", senderInitials: "JS", subject: "Integration Review — Client wants your presence in Friday's sync", preview: "Acme Corp's CTO David Park specifically requested executive attendance at Friday's sync.", body: "Acme's CTO David Park has specifically requested that you be present at Friday's integration review meeting.\n\nMeeting: Friday at 2:00 PM\nZoom: https://zoom.us/j/98765432\n\nIf you cannot attend, David Chen or Alex Torres could represent you.\n\nJohn Smith\nAcme Corp", category: "meeting_request", emailType: "meeting_request", priority: "urgent", priorityLevel: "urgent", priorityScore: 95, confidence: 0.96, time: "11:30 AM", entities: { meetingDate: "Friday", meetingTime: "2:00 PM", meetingLink: "https://zoom.us/j/98765432", clientName: "Acme Corp", attendeeRequested: true, attendeeRequestedBy: "David Park — Acme Corp CTO", attendeeMeetingTime: "Friday at 2:00 PM", delegateSuggestions: ["David Chen", "Alex Torres"] }, senderProfile: { orgType: "client", domain: "acmecorp.com", domainTrust: "known_client", relationshipStrength: "client", isNewSender: false, interactionCount: 19, trustScore: 0.83 }, onLineSummary: "Executive attendance required — Acme Corp CTO specifically requested your presence at Friday's sync.", attendeeEscalation: true },
  { id: "f3", sender: "sarah@company.com", senderName: "Sarah Jenkins — Legal", senderInitials: "SJ", subject: "Q4 Budget Reallocation — Approval Needed", preview: "Need your formal approval to shift $50K from T&E to Digital Ad Spend before Friday.", body: "Hi,\n\nWe've completed our Q4 planning review and identified an opportunity to reallocate $50K from T&E to Digital Ad Spend — projected 3x ROI.\n\nPlease confirm approval before Friday's board meeting.\n\nSarah Jenkins", category: "approval_request", emailType: "approval_request", priority: "high", priorityLevel: "high", priorityScore: 78, confidence: 0.97, time: "10:42 AM", entities: { deadlines: ["Friday — board submission"], approvalsRequired: ["$50K budget reallocation"] }, senderProfile: { orgType: "internal", domain: "company.com", domainTrust: "trusted", relationshipStrength: "frequent_collaborator", isNewSender: false, interactionCount: 22, trustScore: 0.88 }, onLineSummary: "Approval needed to reallocate $50K to Digital Ad Spend before Friday's board meeting." },
  { id: "f4", sender: "pm@company.com", senderName: "Priya Mehta — Product", senderInitials: "PM", subject: "Feature Request Follow-up — Acme Corp Timeline", preview: "Acme Corp wants a Q3 delivery commitment on the custom reporting module.", body: "Following up on the Acme Corp feature request.\n\nThey've asked for a concrete timeline on the custom reporting module. Engineering estimate is 6 weeks.\n\nI need your go-ahead to commit to Q3 delivery.\n\nPriya", category: "follow_up", emailType: "follow_up", priority: "medium", priorityLevel: "medium", priorityScore: 52, confidence: 0.89, time: "Yesterday", entities: { deadlines: ["End of week — client timeline commitment"], clientName: "Acme Corp" }, senderProfile: { orgType: "internal", domain: "company.com", domainTrust: "trusted", relationshipStrength: "reporting_manager", isNewSender: false, interactionCount: 31, trustScore: 0.88 }, onLineSummary: "Acme Corp wants a Q3 commitment on the custom reporting module — needs your approval." },
  { id: "f5", sender: "hr@company.com", senderName: "HR Department", senderInitials: "HR", subject: "Updated Holiday Schedule 2026", preview: "Updated corporate holiday schedule. No action required.", body: "Hi Team,\n\nPlease review the updated holiday schedule. August 15 is now a company-wide holiday. Remote work: max 3 days/week.\n\nNo action required.\n\nHR Team", category: "fyi", emailType: "hr_communication", priority: "low", priorityLevel: "low", priorityScore: 22, confidence: 0.98, time: "2 days ago", entities: {}, senderProfile: { orgType: "internal", domain: "company.com", domainTrust: "trusted", relationshipStrength: "frequent_collaborator", isNewSender: false, interactionCount: 18, trustScore: 0.82 }, onLineSummary: "HR updated holiday schedule — August 15 is a new company-wide holiday." },
];

const FALLBACK_THREADS: EmailThread[] = [
  { threadGroupKey: "thread_phoenix", projectName: "Project Phoenix", threadSubjectPattern: "Project Phoenix — Daily Update", emailCount: 3, lastUpdated: "2026-06-26T08:00:00Z", participantList: ["Raj Kumar", "Dev Team", "Priya Mehta"], overallStatus: "on_track", completedItems: ["Backend API layer complete (32 endpoints)", "Auth module deployed to staging"], pendingItems: ["Frontend integration (60%)", "Unit test coverage"], blockers: ["Database permissions issue — awaiting DevOps"], executiveSummary: "Project Phoenix is on track for June 30. Backend complete, frontend at 60%. DB permissions issue being resolved by DevOps tomorrow. ⚠️ Acme CTO requests your presence at demo June 27 at 3 PM.", hasAttendeeRequest: true, attendeeRequestDetails: "Acme Corp CTO David Park specifically requested executive attendance at the demo on June 27 at 3:00 PM.", priorityLevel: "urgent", emailIds: ["tp001", "tp002", "tp003"] },
  { threadGroupKey: "thread_atlas", projectName: "Project Atlas", threadSubjectPattern: "Project Atlas — Daily Update", emailCount: 3, lastUpdated: "2026-06-26T09:00:00Z", participantList: ["Priya Mehta", "iOS Team", "Android Team"], overallStatus: "at_risk", completedItems: ["UI/UX design approved", "iOS development sprint started"], pendingItems: ["Android development", "3 UI revisions for client"], blockers: ["Android timeline may slip 2 days if design handoff not completed today"], executiveSummary: "Project Atlas is at risk on the Android track. iOS is progressing well. Design handoff needed today to avoid 2-day slip on the June 28 Sprint 2 target.", hasAttendeeRequest: false, priorityLevel: "medium", emailIds: ["ta001", "ta002", "ta003"] },
  { threadGroupKey: "thread_nova", projectName: "Project Nova", threadSubjectPattern: "Project Nova — Daily Update", emailCount: 3, lastUpdated: "2026-06-26T10:00:00Z", participantList: ["Mei Lin", "QA Team", "Compliance"], overallStatus: "at_risk", completedItems: ["AI model integration complete", "Accuracy: 94% (target: 92%)", "Load testing passed"], pendingItems: ["Security audit", "Compliance documentation"], blockers: ["Deployment blocked — awaiting compliance security clearance (ETA: June 28)"], executiveSummary: "Project Nova exceeded accuracy targets. Deployment is blocked by compliance's security clearance process — expected June 28. No action needed from you unless the deadline needs to change.", hasAttendeeRequest: false, priorityLevel: "medium", emailIds: ["tn001", "tn002", "tn003"] },
];

// ── AI Meeting Acceptance Engine ─────────────────────────────────────────────

const AUTO_ACCEPT_TRIGGERS = [
  "board meeting", "ceo", "executive review", "strategic planning",
  "budget approval", "production incident", "client demo", "security incident",
  "steering committee", "acme corp cto", "executive steering", "mandatory",
  "specifically requested your presence", "cto specifically requested",
  "specifically requested that you", "critical customer demo",
];

function shouldAutoAccept(email: Email): boolean {
  const text = `${email.subject} ${email.body ?? ""} ${email.preview ?? ""}`.toLowerCase();
  const isMeeting = email.emailType === "meeting_request" || email.category === "meeting_request";
  const isExecutiveRequested = !!email.entities?.attendeeRequested || !!email.attendeeEscalation;
  const isClientOrImportant =
    email.senderProfile?.domainTrust === "known_client" ||
    email.senderProfile?.relationshipStrength === "ceo" ||
    (email.senderProfile?.trustScore ?? 0) >= 0.9;
  const hasKeyword = AUTO_ACCEPT_TRIGGERS.some(kw => text.includes(kw));
  return isMeeting && isExecutiveRequested && (isClientOrImportant || hasKeyword);
}

function isValidDelegateEmail(emailAddr: string, organizerEmail: string): boolean {
  if (!emailAddr || !emailAddr.includes("@") || !emailAddr.includes(".")) return false;
  if (emailAddr === organizerEmail) return false;
  const parts = emailAddr.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1].includes(".")) return false;
  return true;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const [emails, setEmails] = useState<Email[]>(FALLBACK_EMAILS);
  const [threads, setThreads] = useState<EmailThread[]>(FALLBACK_THREADS);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const [expandedSections, setExpandedSections] = useState<Set<InboxSection>>(new Set(["urgent_high", "medium"]));

  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [threadDetail, setThreadDetail] = useState<ThreadDetail | null>(null);
  const [expandedThreadEmail, setExpandedThreadEmail] = useState<string | null>(null);

  const [draftText, setDraftText] = useState<string>("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [tempDraftText, setTempDraftText] = useState("");
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [declined, setDeclined] = useState<Record<string, boolean>>({});

  const [autoAccepted, setAutoAccepted] = useState<Record<string, boolean>>({});

  const [delegateMode, setDelegateMode] = useState(false);
  const [delegateName, setDelegateName] = useState("");
  const [delegateNote, setDelegateNote] = useState("");
  const [delegateSent, setDelegateSent] = useState<Record<string, boolean>>({});
  const [delegateSearch, setDelegateSearch] = useState("");
  const [selectedDelegate, setSelectedDelegate] = useState<DelegateOption | null>(null);
  const [delegateEmail, setDelegateEmail] = useState("");

  const [query, setQuery] = useState("");
  const autoDraftRef = useRef<Record<string, boolean>>({});

  // ── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoadingEmails(true);
      try {
        const [emailData, threadData] = await Promise.all([fetchEmails(), fetchEmailThreads()]);
        if (emailData.length > 0) { setEmails(emailData); setBackendOnline(true); }
        else { setBackendOnline(false); }
        if (threadData.length > 0) setThreads(threadData);
      } catch { setBackendOnline(false); }
      setLoadingEmails(false);
    }
    load();
  }, []);

  // AI Auto-Acceptance Engine
  useEffect(() => {
    const toAccept: Record<string, boolean> = {};
    emails.forEach(email => { if (shouldAutoAccept(email)) toAccept[email.id] = true; });
    if (Object.keys(toAccept).length > 0) setAutoAccepted(prev => ({ ...prev, ...toAccept }));
  }, [emails]);

  // Auto-generate reply draft on email selection
  useEffect(() => {
    if (!selectedEmail || autoDraftRef.current[selectedEmail.id]) return;
    if (approved[selectedEmail.id] || declined[selectedEmail.id]) return;
    autoDraftRef.current[selectedEmail.id] = true;
    setDraftText(""); setDraftReady(false); setDraftLoading(true);
    generateReplyDraft({ email_id: selectedEmail.id, body: selectedEmail.body ?? selectedEmail.preview ?? "", subject: selectedEmail.subject, user_name: "Executive" })
      .then(result => { if (result?.body) { setDraftText(result.body); setDraftReady(true); } setDraftLoading(false); })
      .catch(() => {
        const subj = selectedEmail.subject.toLowerCase();
        const body = selectedEmail.body?.toLowerCase() ?? "";
        let draft = "";
        if (subj.includes("urgent") || subj.includes("escalat") || body.includes("critical")) draft = `Hi,\n\nThank you for flagging this. I've reviewed the situation and will prioritize this immediately.\n\nBest regards,\nExecutive`;
        else if (subj.includes("approval") || subj.includes("approve")) draft = `Hi,\n\nThank you for the submission. I've reviewed the details and approve this request.\n\nBest regards,\nExecutive`;
        else if (subj.includes("meeting") || subj.includes("attendance") || body.includes("presence")) draft = `Hi,\n\nThank you for the invitation. I've reviewed the meeting details and will confirm my attendance.\n\nBest regards,\nExecutive`;
        else draft = `Hi,\n\nThank you for your email. I've received and reviewed your message. I'll follow up shortly.\n\nBest regards,\nExecutive`;
        setDraftText(draft); setDraftReady(true); setDraftLoading(false);
      });
  }, [selectedEmail?.id]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const toggleSection = (key: InboxSection) => {
    setExpandedSections(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  };

  const resetDelegateState = () => {
    setDelegateMode(false); setDelegateName(""); setDelegateNote("");
    setDelegateSearch(""); setSelectedDelegate(null); setDelegateEmail("");
  };

  const selectEmail = (email: Email) => {
    setSelectedEmail(email); setSelectedThread(null); setThreadDetail(null); resetDelegateState();
  };

  const selectThread = async (thread: EmailThread) => {
    setSelectedThread(thread); setSelectedEmail(null); setDelegateMode(false);
    const detail = await fetchThreadDetail(thread.threadGroupKey);
    if (detail) setThreadDetail(detail);
  };

  const getEmailsForSection = (section: InboxSection): Email[] => {
    let filtered = emails;
    if (section === "urgent_high") filtered = emails.filter(e => e.priorityLevel === "urgent" || e.priorityLevel === "high");
    else if (section === "medium") filtered = emails.filter(e => e.priorityLevel === "medium");
    else if (section === "low") filtered = emails.filter(e => e.priorityLevel === "low");
    else filtered = emails.filter(e => e.priorityLevel === "spam");

    if (query) {
      filtered = filtered.filter(e =>
        e.subject?.toLowerCase().includes(query.toLowerCase()) ||
        e.senderName?.toLowerCase().includes(query.toLowerCase()) ||
        e.onLineSummary?.toLowerCase().includes(query.toLowerCase())
      );
    }
    return filtered.sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
  };

  const getThreadsForSection = (section: InboxSection): EmailThread[] => {
    let filtered = threads;
    if (section === "urgent_high") filtered = threads.filter(t => t.priorityLevel === "urgent" || t.priorityLevel === "high");
    else if (section === "medium") filtered = threads.filter(t => t.priorityLevel === "medium");
    else return [];

    if (query) {
      filtered = filtered.filter(t =>
        t.projectName.toLowerCase().includes(query.toLowerCase()) ||
        t.executiveSummary.toLowerCase().includes(query.toLowerCase())
      );
    }
    return filtered;
  };

  const renderPriorityChip = (level: PriorityLevel) => {
    const s = PRIORITY_STYLE[level];
    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 10,
        fontWeight: 700,
        padding: "1px 5px",
        borderRadius: 3,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.color}25`
      }}>
        {level === "urgent" || level === "high" ? "! " : ""}
        {s.label}
      </span>
    );
  };

  // ── AI Activity counts ────────────────────────────────────────────────────

  const meetingEmails = emails.filter(e => e.emailType === "meeting_request" || e.category === "meeting_request");
  const autoAcceptedCount = meetingEmails.filter(e => autoAccepted[e.id]).length;
  const awaitingDecisionCount = meetingEmails.filter(e => !autoAccepted[e.id] && !approved[e.id] && !delegateSent[e.id]).length;
  const pendingApprovals = emails.filter(e => (e.emailType === "approval_request" || e.emailType === "escalation") && !approved[e.id]).length;

  // ══════════════════════════════════════════════════════════════════════════
  // ── REUSABLE CENTER INBOX ITEM CARD (COMPACT AND FLAT) ───────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const renderInboxThreadCard = (item: Email | EmailThread) => {
    const isThread = "threadGroupKey" in item;
    let isSelected = false;
    let onClick = () => {};

    if (isThread) {
      const thread = item as EmailThread;
      isSelected = selectedThread?.threadGroupKey === thread.threadGroupKey;
      onClick = () => selectThread(thread);
      const statusStyle = STATUS_STYLE[thread.overallStatus] || STATUS_STYLE.on_track;
      const pl = thread.priorityLevel;

      return (
        <div
          key={thread.threadGroupKey}
          onClick={onClick}
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            cursor: "pointer",
            border: isSelected ? `2px solid var(--secondary)` : `1px solid var(--outline-variant)`,
            background: isSelected ? "var(--surface)" : "var(--surface-container-lowest)",
            boxShadow: isSelected ? "0 2px 8px rgba(52,89,165,0.12)" : "none",
            transition: "all 0.12s",
            marginBottom: 8,
            position: "relative",
          }}
        >
          {isSelected && (
            <div style={{
              position: "absolute", top: 0, left: 0, bottom: 0, width: 3.5,
              background: "var(--secondary)", borderRadius: "8px 0 0 8px",
            }} />
          )}

          {/* Line 1: [ Project Name ] | Status | Priority | Time */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--on-surface)" }}>
                [ {thread.projectName} ]
              </span>
              <span style={{
                fontSize: 9.5, fontWeight: 600, padding: "1px 5px", borderRadius: 3,
                background: `${statusStyle.color}15`, color: statusStyle.color,
                display: "inline-flex", alignItems: "center", gap: 3
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 10 }}>{statusStyle.icon}</span>
                {statusStyle.label}
              </span>
              {thread.emailCount > 1 && (
                <span style={{ fontSize: 10, color: "var(--on-surface-variant)" }}>
                  ({thread.emailCount} updates)
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {renderPriorityChip(pl)}
              <span style={{ fontSize: 10, color: "var(--on-surface-variant)" }}>
                {new Date(thread.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
          </div>

          {/* Line 2: Title */}
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--on-surface)", marginBottom: 4, lineHeight: 1.4 }}>
            {thread.projectName} — Daily Status Update
          </div>

          {/* Line 3: Snippet */}
          <p style={{
            fontSize: 11.5, color: "var(--on-surface-variant)", lineHeight: 1.5, marginBottom: 8,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {thread.executiveSummary}
          </p>

          {/* Line 4: Yellow Alert Banner (if presence requested) */}
          {thread.hasAttendeeRequest && (
            <div style={{
              display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600,
              color: "#c75000", padding: "4px 8px", borderRadius: 4,
              background: "rgba(199,80,0,0.08)", border: "1px solid rgba(199,80,0,0.2)",
              marginBottom: 8,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>person_alert</span>
              Your presence requested in this thread
            </div>
          )}

          {/* Line 5: Context Tag & Progress Indicators */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 500,
              padding: "2px 6px", borderRadius: 3, background: "var(--surface-container)",
              color: "var(--on-surface-variant)", border: "1px solid var(--outline-variant)",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>folder</span>
              Project
            </span>
            <div style={{ display: "flex", gap: 8, fontSize: 10, color: "var(--on-surface-variant)" }}>
              <span style={{ color: "#137333", display: "inline-flex", alignItems: "center", gap: 2 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check_circle</span>
                {thread.completedItems.length} completed
              </span>
              <span style={{ color: "#f57f17", display: "inline-flex", alignItems: "center", gap: 2 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>pending</span>
                {thread.pendingItems.length} pending
              </span>
              {thread.blockers.length > 0 && (
                <span style={{ color: "#ba1a1a", display: "inline-flex", alignItems: "center", gap: 2 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>cancel</span>
                  {thread.blockers.length} blocked
                </span>
              )}
            </div>
          </div>
        </div>
      );
    } else {
      const email = item as Email;
      isSelected = selectedEmail?.id === email.id;
      onClick = () => selectEmail(email);
      const pl = email.priorityLevel ?? "medium";
      const profile = email.senderProfile;
      const trustStyle = ORG_TRUST_STYLE[profile?.domainTrust ?? "unknown"] || ORG_TRUST_STYLE.unknown;
      const typeIcon = TYPE_ICON[email.emailType ?? email.category ?? "fyi"] ?? "mail";
      const typeName = (email.emailType ?? email.category ?? "fyi").replace(/_/g, " ");
      const isAuto = autoAccepted[email.id];

      return (
        <div
          key={email.id}
          onClick={onClick}
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            cursor: "pointer",
            border: isSelected
              ? (isAuto ? `2px solid #137333` : `2px solid var(--secondary)`)
              : (isAuto ? `1px solid rgba(19, 115, 51, 0.3)` : `1px solid var(--outline-variant)`),
            background: isSelected
              ? (isAuto ? `var(--color-success-bg)` : "var(--surface)")
              : (isAuto ? "rgba(19, 115, 51, 0.04)" : "var(--surface-container-lowest)"),
            boxShadow: isSelected ? "0 2px 8px rgba(52,89,165,0.12)" : "none",
            transition: "all 0.12s",
            marginBottom: 8,
            position: "relative",
          }}
        >
          {isSelected && (
            <div style={{
              position: "absolute", top: 0, left: 0, bottom: 0, width: 3.5,
              background: isAuto ? "#137333" : "var(--secondary)", borderRadius: "8px 0 0 8px",
            }} />
          )}

          {/* Line 1: Sender Name | Status Badge | Priority | Time */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--on-surface)" }}>
                {email.senderName ?? email.sender}
              </span>
              <span style={{
                fontSize: 9.5, fontWeight: 600, padding: "1px 5px", borderRadius: 3,
                background: `${trustStyle.color}15`, color: trustStyle.color,
                border: `1px solid ${trustStyle.color}30`
              }}>
                {trustStyle.label}
              </span>
              {profile && profile.interactionCount > 0 && (
                <span style={{ fontSize: 10, color: "var(--on-surface-variant)" }}>
                  {profile.interactionCount} interactions
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {renderPriorityChip(pl)}
              <span style={{ fontSize: 10, color: "var(--on-surface-variant)" }}>
                {email.time ?? "—"}
              </span>
            </div>
          </div>

          {/* Line 2: Title */}
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--on-surface)", marginBottom: 4, lineHeight: 1.4 }}>
            {email.subject}
          </div>

          {/* Line 3: Snippet */}
          <div style={{
            fontSize: 11.5, color: "var(--on-surface-variant)", lineHeight: 1.5, marginBottom: 8,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {isAuto ? (
              <span>
                <strong style={{ color: "#137333" }}>Executive attendance required</strong> — Acme Corp CTO specifically requests your presence at Friday&apos;s sync.
              </span>
            ) : (
              email.onLineSummary ?? email.preview ?? email.body?.slice(0, 120)
            )}
          </div>

          {/* Line 4: Green/Yellow Alert Banner (if presence requested in meeting) */}
          {(email.attendeeEscalation || email.entities?.attendeeRequested) && (
            <div style={{
              display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600,
              color: isAuto ? "#137333" : "#c75000", padding: "4px 8px", borderRadius: 4,
              background: isAuto ? "rgba(19,115,51,0.08)" : "rgba(199,80,0,0.08)",
              border: isAuto ? "1px solid rgba(19,115,51,0.2)" : "1px solid rgba(199,80,0,0.2)",
              marginBottom: 8,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>person_alert</span>
              {isAuto ? "Executive attendance required" : "Your presence requested"}
            </div>
          )}

          {/* Line 5: Context Tag & AI Confidence */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {isAuto ? (
                <>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9.5, fontWeight: 700,
                    padding: "1px 5px", borderRadius: 3, background: "rgba(19,115,51,0.12)", color: "#137333",
                    border: "1px solid rgba(19,115,51,0.2)"
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 11 }}>smart_toy</span>
                    AI Auto Accepted
                  </span>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9.5, fontWeight: 700,
                    padding: "1px 5px", borderRadius: 3, background: "rgba(19,115,51,0.12)", color: "#137333",
                    border: "1px solid rgba(19,115,51,0.2)"
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 11 }}>calendar_today</span>
                    Calendar Added
                  </span>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9.5, fontWeight: 700,
                    padding: "1px 5px", borderRadius: 3, background: "rgba(19,115,51,0.12)", color: "#137333",
                    border: "1px solid rgba(19,115,51,0.2)"
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 11 }}>summarize</span>
                    Meeting Brief Generated
                  </span>
                </>
              ) : (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 500,
                  padding: "2px 6px", borderRadius: 3, background: "var(--surface-container)",
                  color: "var(--on-surface-variant)", border: "1px solid var(--outline-variant)",
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{typeIcon}</span>
                  {typeName}
                </span>
              )}
            </div>
            <span style={{ fontSize: 10, color: isAuto ? "#137333" : "var(--secondary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>bolt</span>
              AI Confidence: {Math.round((email.confidence ?? 0.85) * 100)}%
            </span>
          </div>
        </div>
      );
    }
  };

  // ── Render Section containing both consolidated project threads and emails ─

  const renderSection = (section: SectionConfig) => {
    const isExpanded = expandedSections.has(section.key);
    const sectionThreads = getThreadsForSection(section.key);
    const sectionEmails = getEmailsForSection(section.key);
    const totalCount = sectionEmails.length + sectionThreads.length;

    let combinedItems: (Email | EmailThread)[] = [];
    if (section.key === "urgent_high") {
      // Find the specific emails/threads by ID or key attributes (supports both online/offline modes)
      const johnSmith = sectionEmails.find(e => e.id === "f2" || e.id === "e005" || e.sender.includes("john.smith") || e.senderName?.includes("John Smith"));
      const ceoChen = sectionEmails.find(e => e.id === "f1" || e.id === "e001" || e.sender.includes("ceo@") || e.senderName?.includes("Michael Chen"));
      const sarahJenkins = sectionEmails.find(e => e.id === "e002" || e.id === "f3" || e.id === "e004" || e.subject.includes("NDA breach") || e.subject.includes("Budget Reallocation"));
      const phoenix = sectionThreads.find(t => t.threadGroupKey === "thread_phoenix");

      // Pushing in exact requested order
      if (johnSmith) combinedItems.push(johnSmith);
      if (ceoChen) combinedItems.push(ceoChen);
      if (sarahJenkins) combinedItems.push(sarahJenkins);
      if (phoenix) combinedItems.push(phoenix);

      // Add any other threads that were not placed above
      sectionThreads.forEach(t => {
        if (!combinedItems.includes(t)) combinedItems.push(t);
      });
      // Add any other emails that were not placed above
      sectionEmails.forEach(e => {
        if (!combinedItems.includes(e)) combinedItems.push(e);
      });
    } else {
      // Default ordering for other sections
      combinedItems = [...sectionThreads, ...sectionEmails];
    }

    return (
      <div key={section.key} style={{ marginBottom: 6 }}>
        <button
          onClick={() => toggleSection(section.key)}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", border: "none", borderRadius: 6, cursor: "pointer",
            background: isExpanded ? section.bg : "transparent",
            transition: "background 0.12s",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: section.color }}>{section.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: section.color, flex: 1, textAlign: "left" }}>{section.label}</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: section.bg, color: section.color, border: `1px solid ${section.border}`, minWidth: 22, textAlign: "center" }}>
            {totalCount}
          </span>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: section.color, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>expand_more</span>
        </button>

        {isExpanded && (
          <div style={{ padding: "6px 0 0" }}>
            {combinedItems.map(item => renderInboxThreadCard(item))}
            {totalCount === 0 && (
              <div style={{ padding: "12px 14px", textAlign: "center", fontSize: 12, color: "var(--on-surface-variant)", opacity: 0.6 }}>
                No items in this section
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ── AI DECISION CARD (RIGHT PANEL) ───────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const renderAIDecisionCard = (item: Email | EmailThread) => {
    const isThread = "threadGroupKey" in item;
    const isMeeting = isThread
      ? (item as EmailThread).hasAttendeeRequest
      : ((item as Email).emailType === "meeting_request" || (item as Email).category === "meeting_request" || (item as Email).attendeeEscalation || (item as Email).entities?.attendeeRequested);

    const isEscalationOrApproval = !isThread && ((item as Email).emailType === "escalation" || (item as Email).emailType === "approval_request");

    if (!isMeeting && !isEscalationOrApproval) return null;

    const emailId = isThread ? "thread_ phoenix" : (item as Email).id;
    const isAuto = !isThread && autoAccepted[emailId];
    const isAppr = approved[emailId];
    const isDecl = declined[emailId];
    const isDel = delegateSent[emailId];
    const confidence = isThread ? 0.95 : ((item as Email).confidence ?? 0.96);
    const entities = isThread ? null : (item as Email).entities;

    let statusText = "Awaiting Action";
    let statusColor = "#f57f17";
    let statusBg = "rgba(245,127,23,0.06)";
    let statusBorder = "rgba(245,127,23,0.2)";
    let statusIcon = "pending";

    if (isAuto) {
      statusText = "AI Automatically Accepted";
      statusColor = "#137333";
      statusBg = "rgba(19,115,51,0.06)";
      statusBorder = "rgba(19,115,51,0.2)";
      statusIcon = "smart_toy";
    } else if (isAppr) {
      statusText = "Approved / Confirmed";
      statusColor = "#137333";
      statusBg = "rgba(19,115,51,0.06)";
      statusBorder = "rgba(19,115,51,0.2)";
      statusIcon = "check_circle";
    } else if (isDecl) {
      statusText = "Declined";
      statusColor = "#ba1a1a";
      statusBg = "rgba(186,26,26,0.06)";
      statusBorder = "rgba(186,26,26,0.2)";
      statusIcon = "block";
    } else if (isDel) {
      statusText = `Delegated to ${delegateName || "Sarah Jenkins"}`;
      statusColor = "#3459a5";
      statusBg = "rgba(52,89,165,0.06)";
      statusBorder = "rgba(52,89,165,0.2)";
      statusIcon = "person_replace";
    }

    const rows = [];
    if (isMeeting) {
      rows.push({
        label: "Reason",
        value: isThread ? "Executive attendance required for project demo" : (entities?.attendeeRequestedBy ? `Executive presence requested by ${entities.attendeeRequestedBy}` : "Executive presence required")
      });

      if (isAuto || isAppr) {
        rows.push({
          label: "Calendar",
          value: `Meeting added · ${isThread ? "Friday, June 27 at 3:00 PM" : (entities?.attendeeMeetingTime || "Time slot blocked")}`
        });
      } else if (isDel) {
        rows.push({
          label: "Calendar",
          value: "Invitation forwarded to delegate"
        });
      } else {
        rows.push({
          label: "Calendar",
          value: `Slot tentative · ${isThread ? "Friday, June 27 at 3:00 PM" : (entities?.attendeeMeetingTime || "Time slot requested")}`
        });
      }

      rows.push({
        label: "Meeting Brief",
        value: isAuto || isAppr ? "Generating summary brief" : "Awaiting acceptance"
      });

      rows.push({
        label: "Organizer",
        value: isAuto ? "Confirmation prepared for send-off" : (isAppr ? "Confirmation sent" : isDel ? "Delegation notification sent" : "Awaiting response")
      });
    } else if (isEscalationOrApproval) {
      const email = item as Email;
      rows.push({
        label: "Reason",
        value: email.emailType === "escalation" ? "Immediate operational response required" : "Approval authorization needed"
      });

      if (entities?.approvalsRequired && entities.approvalsRequired.length > 0) {
        rows.push({
          label: "Item",
          value: entities.approvalsRequired.join(" · ")
        });
      }

      if (entities?.deadlines && entities.deadlines.length > 0) {
        rows.push({
          label: "Deadline",
          value: entities.deadlines[0]
        });
      }

      if (entities?.riskLevel) {
        rows.push({
          label: "Risk Level",
          value: entities.riskLevel.toUpperCase()
        });
      }
    }

    return (
      <div style={{
        border: `1.5px solid ${statusBorder}`,
        borderRadius: 8,
        overflow: "hidden",
        background: statusBg,
        marginBottom: 14,
      }}>
        {/* Title Bar */}
        <div style={{
          padding: "10px 14px",
          background: statusBg,
          borderBottom: `1px solid ${statusBorder}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: statusColor }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{statusIcon}</span>
            {statusText}
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: statusColor }}>
            AI Confidence: {Math.round((confidence || 0.9) * 100)}%
          </span>
        </div>

        {/* Grid of Details */}
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((row, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: "var(--on-surface)", minWidth: 100, display: "inline-block" }}>
                {row.label}:
              </span>
              <span style={{ color: "var(--on-surface-variant)", flex: 1 }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ── REDESIGNED ACTION BUTTONS (SAME HEIGHT, WIDTH, MODERN TYPOGRAPHY) ────
  // ══════════════════════════════════════════════════════════════════════════

  const renderActionButtons = (item: Email | EmailThread) => {
    const isThread = "threadGroupKey" in item;
    const emailId = isThread ? "thread_phoenix" : (item as Email).id;
    const isMeeting = isThread
      ? (item as EmailThread).hasAttendeeRequest
      : ((item as Email).emailType === "meeting_request" || (item as Email).category === "meeting_request" || (item as Email).attendeeEscalation || (item as Email).entities?.attendeeRequested);

    const isAppr = approved[emailId];
    const isDecl = declined[emailId];
    const isDel = delegateSent[emailId];
    const isAuto = !isThread && autoAccepted[emailId];

    // If already confirmed or delegated or declined, don't show the main awaiting action buttons
    if (isAppr || isDecl || isDel || isAuto) return null;

    if (isMeeting) {
      return (
        <div style={{ display: "flex", gap: 12, width: "100%", margin: "14px 0" }}>
          <button
            onClick={() => {
              setApproved(prev => ({ ...prev, [emailId]: true }));
            }}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 6,
              border: "none",
              background: "linear-gradient(135deg, #137333, #1a9347)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 1px 3px rgba(19,115,51,0.2)",
              transition: "all 0.15s",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
            Accept — I&apos;ll Attend
          </button>
          <button
            onClick={() => setDelegateMode(true)}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 6,
              border: "1.5px solid rgba(199,80,0,0.4)",
              background: "#fff",
              color: "#c75000",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.15s",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_replace</span>
            Send Someone Else
          </button>
        </div>
      );
    }

    if (isThread) return null;

    const email = item as Email;
    const isEscalation = email.emailType === "escalation";
    const isApprovalOrDraft = email.emailType === "approval_request" || email.emailType === "follow_up" || email.category === "approval_request" || email.category === "follow_up";
    const isInfoOnly = email.emailType === "hr_communication" || email.emailType === "fyi" || email.category === "fyi" || email.emailType === "system_alert";

    if (isEscalation) {
      return (
        <div style={{ display: "flex", gap: 12, width: "100%", margin: "14px 0" }}>
          <button
            onClick={() => {
              setApproved(prev => ({ ...prev, [emailId]: true }));
            }}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 6,
              border: "none",
              background: "linear-gradient(135deg, #137333, #1a9347)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 1px 3px rgba(19,115,51,0.2)",
              transition: "all 0.15s",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>thumb_up</span>
            Approve Response
          </button>
          <button
            onClick={() => {
              setTempDraftText(draftText);
              setIsEditingDraft(true);
            }}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 6,
              border: "1.5px solid var(--outline-variant)",
              background: "#fff",
              color: "var(--on-surface-variant)",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.15s",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
            Edit Draft Response
          </button>
        </div>
      );
    }

    if (isApprovalOrDraft) {
      return (
        <div style={{ display: "flex", gap: 12, width: "100%", margin: "14px 0" }}>
          <button
            onClick={() => {
              setApproved(prev => ({ ...prev, [emailId]: true }));
            }}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 6,
              border: "none",
              background: "linear-gradient(135deg, #137333, #1a9347)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 1px 3px rgba(19,115,51,0.2)",
              transition: "all 0.15s",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>thumb_up</span>
            Approve &amp; Send
          </button>
          <button
            onClick={() => {
              setTempDraftText(draftText);
              setIsEditingDraft(true);
            }}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 6,
              border: "1.5px solid var(--outline-variant)",
              background: "#fff",
              color: "var(--on-surface-variant)",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.15s",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
            Edit Draft Response
          </button>
        </div>
      );
    }

    if (isInfoOnly) {
      return null;
    }

    return (
      <div style={{ display: "flex", gap: 12, width: "100%", margin: "14px 0" }}>
        <button
          onClick={() => {
            setApproved(prev => ({ ...prev, [emailId]: true }));
          }}
          style={{
            flex: 1,
            height: 42,
            borderRadius: 6,
            border: "none",
            background: "linear-gradient(135deg, #137333, #1a9347)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 1px 3px rgba(19,115,51,0.2)",
            transition: "all 0.15s",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>thumb_up</span>
          Approve &amp; Send
        </button>
        <button
          onClick={() => {
            setTempDraftText(draftText);
            setIsEditingDraft(true);
          }}
          style={{
            flex: 1,
            height: 42,
            borderRadius: 6,
            border: "1.5px solid var(--outline-variant)",
            background: "#fff",
            color: "var(--on-surface-variant)",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.15s",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
          Edit Draft Response
        </button>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ── DETAIL PANE: Email ────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const renderEmailDetail = () => {
    if (!selectedEmail) return null;
    const email = selectedEmail;
    const profile = email.senderProfile;
    const trustStyle = ORG_TRUST_STYLE[profile?.domainTrust ?? "unknown"] || ORG_TRUST_STYLE.unknown;
    const isApproved = approved[email.id];
    const isDeclined = declined[email.id];
    const isDelegated = delegateSent[email.id];
    const isAuto = autoAccepted[email.id];

    const isMeeting = email.emailType === "meeting_request" || email.category === "meeting_request" || email.attendeeEscalation || email.entities?.attendeeRequested;
    const isEscalation = email.emailType === "escalation";
    const isInfoOnly = email.emailType === "hr_communication" || email.emailType === "fyi" || email.category === "fyi" || email.emailType === "system_alert";

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--outline-variant)",
          position: "sticky", top: 0,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(8px)",
          zIndex: 10
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="material-symbols-outlined" style={{ color: "var(--secondary)", fontSize: 20 }}>person</span>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--on-surface)", margin: 0 }}>
              {email.senderName ?? email.sender}
            </h2>
            <span style={{
              fontSize: 9.5, fontWeight: 600, padding: "1px 5px", borderRadius: 3,
              background: `${trustStyle.color}15`, color: trustStyle.color,
              border: `1px solid ${trustStyle.color}30`
            }}>
              {trustStyle.label}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 11, color: "var(--on-surface-variant)" }}>
            <span>{email.sender}</span>
            <span>•</span>
            <span>Received: {email.time}</span>
          </div>
        </div>

        {/* Content Body Pane */}
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Delegation Modal in Right Panel */}
          {delegateMode ? (
            <div style={{ border: "1.5px solid rgba(52,89,165,0.3)", borderRadius: 8, overflow: "hidden", background: "rgba(52,89,165,0.03)" }}>
              <div style={{ padding: "10px 14px", background: "rgba(52,89,165,0.08)", borderBottom: "1px solid rgba(52,89,165,0.15)", display: "flex", alignItems: "center", gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: "#3459a5", fontSize: 18 }}>person_replace</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#3459a5" }}>Delegate Meeting To</div>
                  <div style={{ fontSize: 11, color: "#3459a5", opacity: 0.8 }}>AI-ranked by availability &amp; project involvement</div>
                </div>
              </div>
              <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ position: "relative" }}>
                  <span className="material-symbols-outlined" style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 15, color: "var(--on-surface-variant)", pointerEvents: "none" }}>search</span>
                  <input className="input" placeholder="Search employee name or email..." value={delegateSearch} onChange={e => setDelegateSearch(e.target.value)} style={{ fontSize: 12, paddingLeft: 30 }} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center", gap: 4 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>auto_awesome</span>AI Recommendations
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {SUGGESTED_DELEGATES.filter(d => !delegateSearch || d.name.toLowerCase().includes(delegateSearch.toLowerCase()) || d.email.toLowerCase().includes(delegateSearch.toLowerCase())).map(d => (
                    <button key={d.email} onClick={() => { setSelectedDelegate(d); setDelegateName(d.name); setDelegateEmail(d.email); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 6, width: "100%", cursor: "pointer", textAlign: "left", border: selectedDelegate?.email === d.email ? "1.5px solid #3459a5" : "1px solid var(--outline-variant)", background: selectedDelegate?.email === d.email ? "rgba(52,89,165,0.06)" : "var(--surface)" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #3459a5, #525e7d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
                        {d.name.split(" ").map((n: string) => n[0]).join("")}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--on-surface)" }}>{d.name}</div>
                        <div style={{ fontSize: 10, color: "var(--on-surface-variant)" }}>{d.email} · {d.dept}</div>
                      </div>
                      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 3, background: d.availability === "Available" ? "rgba(19,115,51,0.1)" : "rgba(245,127,23,0.1)", color: d.availability === "Available" ? "#137333" : "#f57f17" }}>{d.availability}</span>
                        {selectedDelegate?.email === d.email && <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#3459a5" }}>check_circle</span>}
                      </div>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Or enter email manually</div>
                <input className="input" placeholder="colleague@company.com" value={selectedDelegate ? selectedDelegate.email : delegateEmail} onChange={e => { setDelegateEmail(e.target.value); setSelectedDelegate(null); setDelegateName(""); }} readOnly={!!selectedDelegate} style={{ fontSize: 12, background: selectedDelegate ? "var(--surface-container-low)" : "var(--surface)" }} />
                {!selectedDelegate && delegateEmail && !isValidDelegateEmail(delegateEmail, email.sender) && (
                  <div style={{ fontSize: 11, color: "#ba1a1a", display: "flex", alignItems: "center", gap: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>error</span>
                    {delegateEmail === email.sender ? "Cannot delegate to organizer" : "Enter a valid corporate email"}
                  </div>
                )}
                <textarea className="input" placeholder={`Optional note: "Please represent me and share the outcomes."`} value={delegateNote} onChange={e => setDelegateNote(e.target.value)} style={{ fontSize: 12, resize: "none", height: 64 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button disabled={!selectedDelegate && !isValidDelegateEmail(delegateEmail, email.sender)}
                    onClick={() => {
                      const name = selectedDelegate?.name ?? delegateEmail.split("@")[0];
                      setDelegateName(name);
                      setDelegateSent(prev => ({ ...prev, [email.id]: true }));
                      setDelegateMode(false);
                      setDraftText(`Hi,\n\nThank you for the invitation. I'll be unable to attend this meeting personally, but I've arranged for ${name} to represent me.\n\n${delegateNote.trim() ? delegateNote.trim() + "\n\n" : ""}They have been fully briefed.\n\nBest regards,\nExecutive`);
                      setDraftReady(true);
                    }}
                    style={{ flex: 1, padding: "9px 14px", borderRadius: 6, border: "none", background: (selectedDelegate || isValidDelegateEmail(delegateEmail, email.sender)) ? "#3459a5" : "var(--surface-container)", color: (selectedDelegate || isValidDelegateEmail(delegateEmail, email.sender)) ? "#fff" : "var(--on-surface-variant)", fontSize: 12, fontWeight: 600, cursor: (selectedDelegate || isValidDelegateEmail(delegateEmail, email.sender)) ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 40 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>person_add</span>Delegate Meeting
                  </button>
                  <button onClick={() => { setDelegateMode(false); setSelectedDelegate(null); }}
                    style={{ padding: "9px 14px", borderRadius: 6, border: "1px solid var(--outline-variant)", background: "transparent", color: "var(--on-surface-variant)", fontSize: 12, cursor: "pointer", minHeight: 40 }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* AI Decision Card */
            renderAIDecisionCard(email)
          )}

          {/* Manually confirmed / Auto accepted notification cards in Right Panel */}
          {isApproved && (
            <div style={{ padding: 12, background: "#e6f4ea", border: "1px solid #c3e6cb", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: "#137333", fontSize: 18 }}>check_circle</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#137333" }}>✓ Attendance Confirmed</div>
                <div style={{ fontSize: 11, color: "#137333" }}>A reply has been drafted and is ready to send below.</div>
              </div>
            </div>
          )}

          {isDelegated && (
            <div style={{ border: "1.5px solid rgba(52,89,165,0.3)", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", background: "rgba(52,89,165,0.08)", borderBottom: "1px solid rgba(52,89,165,0.15)", display: "flex", alignItems: "center", gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: "#3459a5", fontSize: 18 }}>person_replace</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#3459a5" }}>✓ Meeting Delegated to {delegateName}</div>
              </div>
              <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                {["Calendar invitation", "Meeting agenda", "AI Meeting Brief", "Supporting documents"].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#3459a5" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check</span>{item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {renderActionButtons(email)}

          {/* Email / Thread Body Section */}
          <div style={{ border: "1px solid var(--outline-variant)", borderRadius: 8, padding: 14, background: "var(--surface-bright)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--on-surface)", marginBottom: 8 }}>
              {email.subject}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--on-surface)", lineHeight: 1.7, whiteSpace: "pre-line" }}>
              {email.body ?? email.preview}
            </div>
          </div>

          {/* Sender Intelligence Section */}
          {profile && (
            <div>
              <h3 style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--on-surface-variant)", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>verified_user</span>Sender Intelligence
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "var(--surface-container-low)", borderRadius: 6, padding: 10, border: "1px solid var(--outline-variant)" }}>
                {[{ label: "Organization", value: profile.orgType.replace(/_/g, " ") }, { label: "Domain Trust", value: profile.domainTrust.replace(/_/g, " ") }, { label: "Relationship", value: profile.relationshipStrength.replace(/_/g, " ") }, { label: "Interactions", value: profile.isNewSender ? "New Contact" : `${profile.interactionCount} messages` }].map((item, i) => (
                  <div key={i}><div style={{ fontSize: 10, color: "var(--on-surface-variant)", marginBottom: 1, textTransform: "capitalize" }}>{item.label}</div><div style={{ fontSize: 12, fontWeight: 600, color: "var(--on-surface)", textTransform: "capitalize" }}>{item.value}</div></div>
                ))}
                <div style={{ gridColumn: "1/-1" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: "var(--on-surface-variant)" }}>Trust Score</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--secondary)" }}>{Math.round(profile.trustScore * 100)}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 99, background: "var(--outline-variant)" }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${profile.trustScore * 100}%`, background: profile.trustScore > 0.7 ? "#137333" : profile.trustScore > 0.4 ? "#f57f17" : "#ba1a1a", transition: "width 0.4s" }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Extracted Intelligence Section */}
          {email.entities && Object.keys(email.entities).some(k => { const v = (email.entities as Record<string, unknown>)[k]; return v && (Array.isArray(v) ? v.length > 0 : true) && !["attendeeRequested", "attendeeRequestedBy", "attendeeMeetingTime", "delegateSuggestions"].includes(k); }) && (
            <div>
              <h3 style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--on-surface-variant)", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>auto_awesome</span>AI Extracted Intelligence
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--surface-container-low)", borderRadius: 6, padding: 10, border: "1px solid var(--outline-variant)" }}>
                {email.entities.meetingDate && <div style={{ display: "flex", gap: 8, fontSize: 12 }}><span className="material-symbols-outlined" style={{ fontSize: 13, color: "#3459a5", marginTop: 1 }}>event</span><span><strong>Meeting:</strong> {email.entities.meetingDate} {email.entities.meetingTime ?? ""}</span></div>}
                {email.entities.agenda && <div style={{ display: "flex", gap: 8, fontSize: 12 }}><span className="material-symbols-outlined" style={{ fontSize: 13, color: "#525e7d", marginTop: 1 }}>notes</span><span><strong>Agenda:</strong> {email.entities.agenda}</span></div>}
                {email.entities.deadlines && email.entities.deadlines.length > 0 && <div style={{ display: "flex", gap: 8, fontSize: 12 }}><span className="material-symbols-outlined" style={{ fontSize: 13, color: "#f57f17", marginTop: 1 }}>schedule</span><span><strong>Deadlines:</strong> {email.entities.deadlines.join(", ")}</span></div>}
                {email.entities.approvalsRequired && email.entities.approvalsRequired.length > 0 && <div style={{ display: "flex", gap: 8, fontSize: 12 }}><span className="material-symbols-outlined" style={{ fontSize: 13, color: "#059669", marginTop: 1 }}>verified</span><span><strong>Approvals:</strong> {email.entities.approvalsRequired.join("; ")}</span></div>}
                {email.entities.riskLevel && <div style={{ display: "flex", gap: 8, fontSize: 12 }}><span className="material-symbols-outlined" style={{ fontSize: 13, color: email.entities.riskLevel === "critical" ? "#ba1a1a" : "#f57f17", marginTop: 1 }}>warning</span><span><strong>Risk Level:</strong> <span style={{ textTransform: "capitalize" }}>{email.entities.riskLevel}</span></span></div>}
              </div>
            </div>
          )}

          {/* AI Reply Draft Section */}
          {!isDeclined && !isApproved && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <h3 style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--secondary)", display: "flex", alignItems: "center", gap: 5 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>auto_awesome</span>AI Reply Draft
                </h3>
                {draftReady && <span style={{ fontSize: 10, color: "#137333" }}>✓ Ready to send</span>}
              </div>
              {draftLoading ? (
                <div style={{ border: "1px dashed var(--outline-variant)", borderRadius: 6, padding: 14, display: "flex", alignItems: "center", gap: 10, background: "var(--surface-container-low)", color: "var(--on-surface-variant)", fontSize: 12 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, animation: "spin 1s linear infinite" }}>sync</span>AI is analyzing email and drafting reply...
                </div>
              ) : (
                <div style={{ border: `1px solid ${draftReady ? "rgba(82,94,125,0.3)" : "var(--outline-variant)"}`, borderRadius: 6, padding: 12, background: "var(--surface)", boxShadow: draftReady ? "0 0 0 1px rgba(82,94,125,0.08)" : "none" }}>
                  <textarea value={draftText} onChange={e => setDraftText(e.target.value)} style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 12.5, color: "var(--on-surface)", resize: "none", height: 120, fontFamily: "var(--font-sans)", lineHeight: 1.65 }} placeholder="AI is preparing your draft reply..." />
                  {draftReady && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6, borderTop: "1px solid var(--outline-variant)", marginTop: 4 }}><span style={{ fontSize: 10, color: "#137333" }}>✓ AI Generated</span><span style={{ fontSize: 10, color: "var(--on-surface-variant)" }}>Edit above if needed</span></div>}
                </div>
              )}
            </div>
          )}

          {isApproved && <div style={{ padding: 12, background: "#e6f4ea", border: "1px solid #c3e6cb", borderRadius: 8, textAlign: "center", color: "#137333", fontWeight: 700, fontSize: 13 }}><span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: "middle", marginRight: 5 }}>send</span>Reply Sent Successfully</div>}
          {isDeclined && <div style={{ padding: 12, background: "var(--error-container)", border: "1px solid rgba(186,26,26,0.2)", borderRadius: 8, textAlign: "center", color: "var(--error)", fontWeight: 700, fontSize: 13 }}>Email Declined</div>}
        </div>

        {/* Footer Actions (Only if not approved/declined) */}
        {!isApproved && !isDeclined && !isInfoOnly && (
          <div style={{ marginTop: "auto", padding: "12px 16px", borderTop: "1px solid var(--outline-variant)", background: "var(--surface-container-lowest)", position: "sticky", bottom: 0, display: "flex", gap: 8 }}>
            {isMeeting ? (
              <>
                <button
                  className="btn btn-approve"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => { setApproved(prev => ({ ...prev, [email.id]: true })); }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15, marginRight: 5 }}>check_circle</span>
                  Accept — I&apos;ll Attend
                </button>
                <button
                  className="btn"
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    border: "1.5px solid rgba(199,80,0,0.4)",
                    background: "#fff",
                    color: "#c75000",
                  }}
                  onClick={() => setDelegateMode(true)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15, marginRight: 5 }}>person_replace</span>
                  Send Someone Else
                </button>
              </>
            ) : isEscalation ? (
              <>
                <button
                  className="btn btn-approve"
                  style={{ flex: 1, justifyContent: "center" }}
                  disabled={!draftReady || draftLoading}
                  onClick={() => { setApproved(prev => ({ ...prev, [email.id]: true })); }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15, marginRight: 5 }}>send</span>
                  {draftLoading ? "Preparing..." : "Approve Response"}
                </button>
                <button
                  className="btn"
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    border: "1px solid var(--outline-variant)",
                    background: "#fff",
                    color: "var(--on-surface-variant)",
                  }}
                  onClick={() => {
                    setTempDraftText(draftText);
                    setIsEditingDraft(true);
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15, marginRight: 5 }}>edit</span>
                  Edit Draft Response
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn btn-approve"
                  style={{ flex: 1, justifyContent: "center" }}
                  disabled={!draftReady || draftLoading}
                  onClick={() => { setApproved(prev => ({ ...prev, [email.id]: true })); }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15, marginRight: 5 }}>send</span>
                  {draftLoading ? "Preparing..." : "Approve & Send"}
                </button>
                <button
                  className="btn"
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    border: "1px solid var(--outline-variant)",
                    background: "#fff",
                    color: "var(--on-surface-variant)",
                  }}
                  onClick={() => {
                    setTempDraftText(draftText);
                    setIsEditingDraft(true);
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15, marginRight: 5 }}>edit</span>
                  Edit Draft Response
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Detail pane — Thread ──────────────────────────────────────────────────

  const renderThreadDetail = () => {
    if (!selectedThread) return null;
    const thread = selectedThread;
    const statusStyle = STATUS_STYLE[thread.overallStatus] || STATUS_STYLE.on_track;

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--outline-variant)",
          position: "sticky", top: 0,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(8px)",
          zIndex: 10
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="material-symbols-outlined" style={{ color: "#3459a5", fontSize: 20 }}>folder_special</span>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--on-surface)", margin: 0 }}>
              {thread.projectName}
            </h2>
            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 3, background: `${statusStyle.color}15`, color: statusStyle.color }}>
              <span className="material-symbols-outlined" style={{ fontSize: 11, verticalAlign: "middle" }}>{statusStyle.icon}</span> {statusStyle.label}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 11, color: "var(--on-surface-variant)" }}>
            <span>{thread.emailCount} Updates</span>
            <span>•</span>
            <span>Last: {new Date(thread.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            <span>•</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
              {thread.participantList.join(", ")}
            </span>
          </div>
        </div>

        {/* Content Body Pane */}
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>

          {/* AI Decision Card (shows Auto-Accept status card if presence requested) */}
          {renderAIDecisionCard(thread)}

          {/* Action Buttons (same equal size, side-by-side Accept / Delegate) */}
          {renderActionButtons(thread)}

          {/* Executive Summary Card */}
          <div style={{ border: "1px solid var(--outline-variant)", borderRadius: 8, padding: 14, background: "var(--surface-bright)" }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--on-surface-variant)", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>auto_awesome</span>Executive Summary
            </h3>
            <p style={{ fontSize: 13, color: "var(--on-surface)", lineHeight: 1.7 }}>{thread.executiveSummary}</p>
          </div>

          {/* Completed / Pending columns */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ border: "1px solid rgba(19,115,51,0.2)", borderRadius: 6, padding: 10, background: "rgba(19,115,51,0.04)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#137333", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>✓ Completed ({thread.completedItems.length})</div>
              {thread.completedItems.map((item, i) => <div key={i} style={{ fontSize: 11.5, color: "#137333", lineHeight: 1.5, padding: "2px 0" }}>• {item}</div>)}
            </div>
            <div style={{ border: "1px solid rgba(245,127,23,0.2)", borderRadius: 6, padding: 10, background: "rgba(245,127,23,0.04)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#f57f17", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>○ Pending ({thread.pendingItems.length})</div>
              {thread.pendingItems.map((item, i) => <div key={i} style={{ fontSize: 11.5, color: "#f57f17", lineHeight: 1.5, padding: "2px 0" }}>• {item}</div>)}
            </div>
          </div>

          {/* Blockers */}
          {thread.blockers.length > 0 && (
            <div style={{ border: "1px solid rgba(186,26,26,0.2)", borderRadius: 6, padding: 10, background: "rgba(186,26,26,0.04)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#ba1a1a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>⊗ Blockers ({thread.blockers.length})</div>
              {thread.blockers.map((b, i) => <div key={i} style={{ fontSize: 11.5, color: "#ba1a1a", lineHeight: 1.5, padding: "2px 0" }}>• {b}</div>)}
            </div>
          )}

          {/* Full Thread list */}
          <div>
            <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--on-surface-variant)", display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>forum</span>Full Thread ({threadDetail?.emails.length ?? thread.emailCount} Updates)
            </h3>
            {(threadDetail?.emails ?? []).map(email => (
              <div key={email.id} style={{ marginBottom: 6 }}>
                <button onClick={() => setExpandedThreadEmail(expandedThreadEmail === email.id ? null : email.id)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 5, border: "1px solid var(--outline-variant)", background: expandedThreadEmail === email.id ? "var(--surface)" : "var(--surface-container-lowest)", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ display: "flex", flex: 1, minWidth: 0, alignItems: "center", gap: 8 }}>
                    {email.attendeeEscalation && <span className="material-symbols-outlined" style={{ fontSize: 14, color: "#c75000", flexShrink: 0 }}>person_alert</span>}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--on-surface)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email.subject}</div>
                      <div style={{ fontSize: 10, color: "var(--on-surface-variant)" }}>{email.time}</div>
                    </div>
                  </div>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--on-surface-variant)", flexShrink: 0, transform: expandedThreadEmail === email.id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>expand_more</span>
                </button>
                {expandedThreadEmail === email.id && <div style={{ border: "1px solid var(--outline-variant)", borderTop: "none", borderRadius: "0 0 5px 5px", padding: 12, background: "var(--surface-bright)", fontSize: 12.5, color: "var(--on-surface)", lineHeight: 1.65, whiteSpace: "pre-line" }}>{email.body ?? email.preview}</div>}
              </div>
            ))}
            {!threadDetail && <div style={{ textAlign: "center", padding: 16, color: "var(--on-surface-variant)", fontSize: 12 }}><span className="material-symbols-outlined" style={{ fontSize: 20, display: "block", marginBottom: 6, opacity: 0.4 }}>sync</span>Loading thread history...</div>}
          </div>
        </div>
      </div>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────

  const urgentHighCount = emails.filter(e => e.priorityLevel === "urgent" || e.priorityLevel === "high").length + threads.filter(t => t.priorityLevel === "urgent" || t.priorityLevel === "high").length;
  const mediumCount = emails.filter(e => e.priorityLevel === "medium").length + threads.filter(t => t.priorityLevel === "medium").length;
  const lowCount = emails.filter(e => e.priorityLevel === "low").length;
  const spamCount = emails.filter(e => e.priorityLevel === "spam").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* Top Bar */}
      <header style={{ height: 64, background: "var(--surface)", borderBottom: "1px solid var(--outline-variant)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, flexShrink: 0 }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <span className="material-symbols-outlined" style={{ position: "absolute", left: 10, color: "var(--on-surface-variant)", fontSize: 18, pointerEvents: "none" }}>search</span>
          <input className="input" style={{ paddingLeft: 36, width: 280, fontSize: 13 }} placeholder="Search Email Intelligence..." value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {backendOnline !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: backendOnline ? "#137333" : "#f57f17" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: backendOnline ? "#137333" : "#f57f17", display: "inline-block" }} />
            {backendOnline ? "AI Pipeline Connected" : "Offline Mode — Rich Demo Data"}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {[{ label: "Urgent/High", count: urgentHighCount, color: "#ba1a1a" }, { label: "Medium", count: mediumCount, color: "#f57f17" }, { label: "Low", count: lowCount, color: "#525e7d" }].map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
              <span style={{ fontWeight: 700, color: s.color, fontSize: 14 }}>{s.count}</span>
              <span style={{ color: "var(--on-surface-variant)" }}>{s.label}</span>
            </div>
          ))}
        </div>
        <div style={{ width: 1, height: 24, background: "var(--outline-variant)" }} />
        <button className="icon-btn" title="Notifications">
          <span className="material-symbols-outlined">notifications</span>
          {urgentHighCount > 0 && <span className="badge-dot" />}
        </button>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--secondary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>U</div>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Pane 1: Left Nav ── */}
        <div style={{ width: 260, flexShrink: 0, borderRight: "1px solid var(--outline-variant)", background: "var(--surface-container-lowest)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--outline-variant)" }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--on-surface)" }}>Email Intelligence</h2>
            <p style={{ fontSize: 12, color: "var(--on-surface-variant)", marginTop: 2 }}>AI-processed • Auto-triaged</p>
          </div>

          {/* AI Activity Widget */}
          <div style={{ margin: "10px 12px", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(52,89,165,0.2)", background: "linear-gradient(135deg, rgba(52,89,165,0.06), rgba(82,94,125,0.04))" }}>
            <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(52,89,165,0.15)", display: "flex", alignItems: "center", gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--secondary)" }}>smart_toy</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: "var(--secondary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>AI Activity Today</span>
            </div>
            <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
              {autoAcceptedCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 13, color: "#137333" }}>check_circle</span>
                  <span style={{ color: "#137333", fontWeight: 600 }}>{autoAcceptedCount} meeting{autoAcceptedCount !== 1 ? "s" : ""} auto-accepted</span>
                </div>
              )}
              {awaitingDecisionCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 13, color: "#f57f17" }}>pending</span>
                  <span style={{ color: "#f57f17", fontWeight: 600 }}>{awaitingDecisionCount} awaiting decision</span>
                </div>
              )}
              {pendingApprovals > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 13, color: "#ba1a1a" }}>assignment</span>
                  <span style={{ color: "#ba1a1a", fontWeight: 600 }}>{pendingApprovals} approval{pendingApprovals !== 1 ? "s" : ""} pending</span>
                </div>
              )}
              {autoAcceptedCount === 0 && awaitingDecisionCount === 0 && pendingApprovals === 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#137333" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>task_alt</span>
                  <span>All clear — no pending actions</span>
                </div>
              )}
            </div>
          </div>

          {/* Section nav */}
          <div style={{ padding: "4px 8px", overflowY: "auto", flex: 1 }}>
            {SECTIONS.map(section => {
              const count = section.key === "urgent_high" ? urgentHighCount : section.key === "medium" ? mediumCount : section.key === "low" ? lowCount : spamCount;
              const isExpanded = expandedSections.has(section.key);
              return (
                <div key={section.key}>
                  <button onClick={() => toggleSection(section.key)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 4, cursor: "pointer", border: "none", background: isExpanded ? section.bg : "transparent", color: isExpanded ? section.color : "var(--on-surface)", fontWeight: isExpanded ? 600 : 400, transition: "background 0.12s", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 17, color: isExpanded ? section.color : "var(--on-surface-variant)" }}>{section.icon}</span>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: 13 }}>{section.label}</div>
                        <div style={{ fontSize: 10, color: isExpanded ? section.color : "var(--on-surface-variant)", opacity: 0.8 }}>{section.description}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, minWidth: 20, textAlign: "center", padding: "1px 6px", borderRadius: 99, background: section.key === "urgent_high" && count > 0 ? section.bg : "var(--surface-container)", color: section.key === "urgent_high" && count > 0 ? section.color : "var(--on-surface-variant)", border: `1px solid ${section.border}` }}>
                      {count}
                    </span>
                  </button>
                </div>
              );
            })}

            <div style={{ margin: "12px 4px 6px", fontSize: 10, fontWeight: 600, color: "var(--on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 5 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>folder_special</span>
              Project Threads ({threads.length})
            </div>

            {threads.map(thread => {
              const statusStyle = STATUS_STYLE[thread.overallStatus];
              const isSelected = selectedThread?.threadGroupKey === thread.threadGroupKey;
              return (
                <button key={thread.threadGroupKey} onClick={() => selectThread(thread)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 4, cursor: "pointer", border: "none", background: isSelected ? "rgba(52,89,165,0.08)" : "transparent", transition: "background 0.12s", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: isSelected ? "#3459a5" : "var(--on-surface-variant)", flexShrink: 0 }}>folder</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: isSelected ? 600 : 400, color: isSelected ? "#3459a5" : "var(--on-surface)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{thread.projectName}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 9, color: statusStyle.color }}>{statusStyle.label}</span>
                        <span style={{ fontSize: 9, color: "var(--on-surface-variant)" }}>• {thread.emailCount} updates</span>
                      </div>
                    </div>
                  </div>
                  {thread.hasAttendeeRequest && <span className="material-symbols-outlined" style={{ fontSize: 14, color: "#c75000", flexShrink: 0 }}>person_alert</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Pane 2: Executive Intelligence Feed ── */}
        <div style={{ flex: 1, borderRight: "1px solid var(--outline-variant)", background: "var(--surface-container-lowest)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Inbox header */}
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--outline-variant)", background: "var(--surface-container-lowest)", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--on-surface)" }}>Inbox</h2>
                <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: "rgba(52,89,165,0.08)", color: "var(--secondary)", border: "1px solid rgba(52,89,165,0.15)" }}>
                  AI Sorted
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--on-surface-variant)", display: "flex", alignItems: "center", gap: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>auto_awesome</span>
                Auto-triaged by AI
              </div>
            </div>
          </div>

          {loadingEmails ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--on-surface-variant)", gap: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, opacity: 0.4, animation: "spin 1.5s linear infinite" }}>sync</span>
              <span style={{ fontSize: 13 }}>AI is processing your inbox...</span>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px" }}>
              {/* Priority Sections */}
              {SECTIONS.map(section => renderSection(section))}
            </div>
          )}
        </div>

        {/* ── Pane 3: Detail View ── */}
        <div style={{ width: 440, flexShrink: 0, background: "var(--surface-container-lowest)", display: "flex", flexDirection: "column", overflow: "hidden", borderLeft: "1px solid var(--outline-variant)", boxShadow: "-4px 0 16px rgba(15,23,42,0.03)" }}>
          {selectedEmail && renderEmailDetail()}
          {selectedThread && !selectedEmail && renderThreadDetail()}
          {!selectedEmail && !selectedThread && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--on-surface-variant)", gap: 12, padding: 24, textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(52,89,165,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: "var(--secondary)", opacity: 0.6 }}>smart_toy</span>
              </div>
              <div style={{ opacity: 0.7 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--on-surface)" }}>AI Executive Intelligence</div>
                <div style={{ fontSize: 12, marginTop: 6, color: "var(--on-surface-variant)", lineHeight: 1.6 }}>
                  Select any item to view<br />full AI analysis and take action
                </div>
              </div>
              {autoAcceptedCount > 0 && (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(19,115,51,0.06)", border: "1px solid rgba(19,115,51,0.2)", fontSize: 12, color: "#137333", display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>smart_toy</span>
                  AI has already handled {autoAcceptedCount} meeting{autoAcceptedCount !== 1 ? "s" : ""} for you
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isEditingDraft && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: "var(--surface-container-lowest)",
            borderRadius: 12,
            width: 500,
            maxWidth: "90%",
            padding: 24,
            border: "1px solid var(--outline-variant)",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--on-surface)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: "var(--secondary)" }}>edit_note</span>
                Edit Draft Response
              </h3>
              <button
                onClick={() => setIsEditingDraft(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--on-surface-variant)", display: "flex", alignItems: "center" }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                AI Generated Response
              </label>
              <textarea
                value={tempDraftText}
                onChange={e => setTempDraftText(e.target.value)}
                style={{
                  width: "100%",
                  height: 220,
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid var(--outline)",
                  outline: "none",
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "var(--on-surface)",
                  backgroundColor: "var(--surface)",
                  fontFamily: "var(--font-sans)",
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
              <button
                onClick={() => setIsEditingDraft(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid var(--outline-variant)",
                  background: "transparent",
                  color: "var(--on-surface-variant)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setDraftText(tempDraftText);
                  setIsEditingDraft(false);
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "var(--primary)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Save Draft
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
