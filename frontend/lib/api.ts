/**
 * frontend/lib/api.ts
 *
 * Centralized API client for the Executive AI Assistant backend.
 * All errors are logged to the console with full context.
 *
 * Endpoint map:
 *   GET  /api/v1/emails                          → fetchEmails
 *   GET  /api/v1/emails?section=urgent_high      → fetchEmailsBySection
 *   GET  /api/v1/emails/threads                  → fetchEmailThreads
 *   GET  /api/v1/emails/threads/:key             → fetchThreadDetail
 *   POST /api/v1/agents/email/ingest             → classifyEmail (legacy)
 *   POST /api/v1/agents/email/analyze            → analyzeEmail (full pipeline)
 *   POST /api/v1/agents/reply/draft              → generateReplyDraft
 *   GET  /api/v1/meetings                        → fetchMeetings
 *   POST /api/v1/agents/meeting-prep/generate    → generateMeetingBrief
 *   GET  /api/v1/action-items                    → fetchActionItems
 *   POST /api/v1/pipeline/trigger                → triggerPipeline
 */

const API_BASE = "http://localhost:8000/api/v1";

// ── Logging helpers ──────────────────────────────────────────────────────────

function logError(label: string, error: unknown, context?: Record<string, unknown>) {
  console.error(
    `[ExecAI API ERROR] ❌ ${label}`,
    "\n  Context:", context ?? {},
    "\n  Error:", error
  );
}

function logSuccess(label: string, data: unknown) {
  console.log(`[ExecAI API] ✅ ${label}`, data);
}

// ── Types matching the backend Pydantic schemas ───────────────────────────────

export type PriorityLevel = "urgent" | "high" | "medium" | "low" | "spam";
export type EmailType =
  | "meeting_request" | "follow_up" | "action_required" | "approval_request"
  | "escalation" | "client_query" | "internal_update" | "daily_project_update"
  | "weekly_report" | "fyi" | "reminder" | "invoice_finance" | "hr_communication"
  | "security_notification" | "system_alert" | "newsletter" | "marketing_email" | "spam";

export type OrgType = "internal" | "client" | "vendor" | "partner" | "recruiter" | "government" | "unknown" | "personal_email";
export type DomainTrust = "trusted" | "known_client" | "known_vendor" | "personal" | "unknown" | "suspicious";
export type RelationshipStrength =
  | "ceo" | "direct_manager" | "client" | "reporting_manager"
  | "frequent_collaborator" | "vendor" | "unknown" | "never_contacted";

export interface SenderProfile {
  orgType: OrgType;
  domain: string;
  domainTrust: DomainTrust;
  relationshipStrength: RelationshipStrength;
  isNewSender: boolean;
  interactionCount: number;
  lastInteractionDaysAgo?: number;
  newSenderCategory?: string;
  trustScore: number;
}

export interface ExtractedEntities {
  meetingDate?: string;
  meetingTime?: string;
  meetingLink?: string;
  agenda?: string;
  participants?: string[];
  location?: string;
  preparationRequired?: string[];
  documentsToReview?: string[];
  deadlines?: string[];
  actionItems?: string[];
  approvalsRequired?: string[];
  projectName?: string;
  clientName?: string;
  departmentsInvolved?: string[];
  riskLevel?: "low" | "medium" | "high" | "critical";
  // Attendee escalation
  attendeeRequested?: boolean;
  attendeeRequestedBy?: string;
  attendeeMeetingTime?: string;
  delegateSuggestions?: string[];
}

export interface Email {
  id: string;
  sender: string;
  senderName?: string;
  senderInitials?: string;
  subject: string;
  body?: string;
  preview?: string;
  category?: string;
  emailType?: EmailType;
  priority?: string;
  priorityLevel?: PriorityLevel;
  priorityScore?: number;
  confidence?: number;
  received_at?: string;
  time?: string;
  isThread?: boolean;
  threadId?: string;
  threadGroupKey?: string;
  senderProfile?: SenderProfile;
  entities?: ExtractedEntities;
  onLineSummary?: string;
  isSpam?: boolean;
  spamSignals?: string[];
  attendeeEscalation?: boolean;
}

export interface EmailThread {
  threadGroupKey: string;
  projectName: string;
  threadSubjectPattern: string;
  emailCount: number;
  lastUpdated: string;
  participantList: string[];
  overallStatus: "on_track" | "at_risk" | "blocked" | "completed";
  completedItems: string[];
  pendingItems: string[];
  blockers: string[];
  executiveSummary: string;
  hasAttendeeRequest: boolean;
  attendeeRequestDetails?: string;
  priorityLevel: PriorityLevel;
  emailIds: string[];
}

export interface ThreadDetail {
  summary: EmailThread;
  emails: Email[];
}

/** Matches EmailIngestResponse from schemas.py */
export interface ClassifyResult {
  email_id: string;
  category: string;
  priority: string;
  confidence: number;
  intent?: {
    type: string;
    meeting_time?: string;
    meeting_time_raw_text?: string;
    agenda?: string;
    participants: string[];
    deadlines: string[];
    action_items: string[];
    required_preparation: string[];
    priority: string;
  } | null;
}

/** Matches ReplyDraftResponse from schemas.py */
export interface ReplyDraft {
  draft_id: string;
  subject: string;
  body: string;
  confidence: number;
  approval_status: "pending" | "approved" | "rejected" | "edited";
}

export interface Meeting {
  id: string;
  title: string;
  start_time: string;
  date?: string;
  time?: string;
  duration_min?: number;
  participants: string[];
  optional_participants?: string[];
  brief_status?: string;
  agenda_items?: string[];
  previous_meetings?: string[];
  source?: string;
  conflict?: boolean;
  delegated?: boolean;
  delegated_to?: string | null;
  delegation_notes?: string;
  location?: string;
  meeting_link?: string;
  priority?: "low" | "medium" | "high" | "critical";
  description?: string;
  organizer_notes?: string;
  col?: number;
  row?: number;
  color?: string;
}

export interface CalendarSuggestion {
  id: string;
  meeting_id: string;
  type: "reschedule" | "move_earlier" | "move_later" | "delegate" | "shorten" | "extend"
    | "merge" | "conflict_resolve" | "add_attendee" | "remove_attendee" | "convert_online" | "brief_ready";
  title: string;
  rationale: string;
  impact: string;
  priority: "high" | "medium" | "low";
  params: Record<string, unknown>;
  status: "active" | "approved" | "dismissed";
  icon: string;
  badge_type: "conflict" | "success" | "info" | "warning";
}

export interface CalendarConflict {
  id: string;
  meeting_a_id: string;
  meeting_a_title: string;
  meeting_b_id: string;
  meeting_b_title: string;
  overlap_minutes: number;
  suggested_resolution: string;
  resolution_type: string;
}

export interface DelegateCandidate {
  id: string;
  name: string;
  role: string;
  department: string;
  availability: number;
  expertise: number;
  workload: number;
  reason: string;
}

export interface MeetingPatch {
  title?: string;
  date?: string;
  time?: string;
  duration_min?: number;
  description?: string;
  agenda_text?: string;
  location?: string;
  meeting_link?: string;
  participants?: string[];
  optional_participants?: string[];
  organizer_notes?: string;
  priority?: string;
}

export interface DelegateRequest {
  delegate_name: string;
  delegate_id?: string;
  delegation_notes?: string;
  transfer_ownership?: boolean;
}

export interface CreateMeetingRequest {
  title: string;
  date: string;
  time: string;
  duration_min?: number;
  participants?: string[];
  optional_participants?: string[];
  location?: string;
  meeting_link?: string;
  description?: string;
  agenda_items?: string[];
  priority?: string;
  organizer_notes?: string;
}


/** Matches MeetingBriefResponse from schemas.py */
export interface MeetingBrief {
  meeting_id: string;
  meeting_title: string;
  purpose: string;
  important_topics: string[];
  previous_decisions: Array<{
    decision_text: string;
    meeting_date?: string;
    meeting_title?: string;
  }>;
  potential_questions: string[];
  recommended_preparation: string[];
  participants: string[];
  generated_at: string;
}

export interface ActionItem {
  id: string;
  description: string;
  owner_name: string;
  due_date?: string;
  status: string;
  priority: string;
}

export interface PipelineResult {
  thread_id?: string;
  trigger_type?: string;
  email_category?: string;
  email_priority?: string;
  intent?: Record<string, unknown> | null;
  reply_draft?: ReplyDraft | null;
  meeting_brief?: MeetingBrief | null;
  requires_human_approval?: boolean;
  approval_status?: string;
  error?: string;
}

// ── Email Endpoints ─────────────────────────────────────────────────────────

export async function fetchEmails(options?: {
  section?: "urgent_high" | "medium" | "low" | "spam";
  category?: string;
  includeThreads?: boolean;
}): Promise<Email[]> {
  try {
    const params = new URLSearchParams();
    if (options?.section) params.set("section", options.section);
    if (options?.category) params.set("category", options.category);
    if (options?.includeThreads) params.set("include_threads", "true");

    const url = `${API_BASE}/emails${params.toString() ? "?" + params.toString() : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const data = await res.json();
    logSuccess("fetchEmails", { count: data.length, ...options });
    return data;
  } catch (err) {
    logError("fetchEmails", err, options);
    return [];
  }
}

export async function fetchEmailThreads(): Promise<EmailThread[]> {
  try {
    const res = await fetch(`${API_BASE}/emails/threads`);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const data = await res.json();
    logSuccess("fetchEmailThreads", { count: data.length });
    return data;
  } catch (err) {
    logError("fetchEmailThreads", err);
    return [];
  }
}

export async function fetchThreadDetail(threadGroupKey: string): Promise<ThreadDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/emails/threads/${threadGroupKey}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const data = await res.json();
    logSuccess("fetchThreadDetail", { threadGroupKey, emailCount: data.emails?.length });
    return data;
  } catch (err) {
    logError("fetchThreadDetail", err, { threadGroupKey });
    return null;
  }
}

/**
 * Classify an email via POST /api/v1/agents/email/ingest
 * Legacy endpoint — use analyzeEmail for the full 6-stage pipeline.
 */
export async function classifyEmail(email: {
  sender: string;
  subject: string;
  body: string;
  received_at?: string;
}): Promise<ClassifyResult | null> {
  try {
    console.log("[ExecAI API] 🔄 classifyEmail — calling AI...", { subject: email.subject });
    const payload = {
      message_id: `msg_${Date.now()}`,
      thread_id: `thread_${Date.now()}`,
      sender: email.sender,
      recipients: ["user@company.com"],
      subject: email.subject,
      body: email.body,
      received_at: email.received_at ?? new Date().toISOString(),
      source: "gmail",
    };
    const res = await fetch(`${API_BASE}/agents/email/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} — ${errText}`);
    }
    const data: ClassifyResult = await res.json();
    logSuccess("classifyEmail", data);
    return data;
  } catch (err) {
    logError("classifyEmail", err, { subject: email.subject });
    return null;
  }
}

/**
 * Full 6-stage Email Intelligence Pipeline.
 * POST /api/v1/agents/email/analyze
 */
export async function analyzeEmail(email: {
  sender: string;
  subject: string;
  body: string;
  thread_id?: string;
  received_at?: string;
}): Promise<ClassifyResult | null> {
  try {
    console.log("[ExecAI API] 🔄 analyzeEmail — running 6-stage intelligence pipeline...", { subject: email.subject });
    const payload = {
      message_id: `msg_${Date.now()}`,
      thread_id: email.thread_id ?? `thread_${Date.now()}`,
      sender: email.sender,
      recipients: ["user@company.com"],
      subject: email.subject,
      body: email.body,
      received_at: email.received_at ?? new Date().toISOString(),
      source: "gmail",
    };
    const res = await fetch(`${API_BASE}/agents/email/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} — ${errText}`);
    }
    const data = await res.json();
    logSuccess("analyzeEmail", data);
    return data;
  } catch (err) {
    logError("analyzeEmail", err, { subject: email.subject });
    return null;
  }
}

/**
 * Generate a reply draft via POST /api/v1/agents/reply/draft
 */
export async function generateReplyDraft(email: {
  email_id: string;
  body: string;
  subject?: string;
  user_name?: string;
}): Promise<ReplyDraft | null> {
  try {
    console.log("[ExecAI API] 🔄 generateReplyDraft — calling AI...", { email_id: email.email_id });
    const payload = {
      email_id: email.email_id,
      thread_context: [email.body],
      user_name: email.user_name ?? "Executive",
    };
    const res = await fetch(`${API_BASE}/agents/reply/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} — ${errText}`);
    }
    const data: ReplyDraft = await res.json();
    logSuccess("generateReplyDraft", data);
    return data;
  } catch (err) {
    logError("generateReplyDraft", err, { email_id: email.email_id });
    return null;
  }
}

// ── Meeting Endpoints ───────────────────────────────────────────────────────

export async function fetchMeetings(): Promise<Meeting[]> {
  try {
    const res = await fetch(`${API_BASE}/meetings`);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const data = await res.json();
    logSuccess("fetchMeetings", { count: data.length });
    return data;
  } catch (err) {
    logError("fetchMeetings", err);
    return [];
  }
}

export async function createMeeting(data: CreateMeetingRequest): Promise<Meeting | null> {
  try {
    const res = await fetch(`${API_BASE}/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result: Meeting = await res.json();
    logSuccess("createMeeting", result);
    return result;
  } catch (err) {
    logError("createMeeting", err, { title: data.title });
    return null;
  }
}

export async function updateMeeting(meetingId: string, patch: MeetingPatch): Promise<Meeting | null> {
  try {
    const res = await fetch(`${API_BASE}/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result: Meeting = await res.json();
    logSuccess("updateMeeting", result);
    return result;
  } catch (err) {
    logError("updateMeeting", err, { meetingId });
    return null;
  }
}

export async function rescheduleMeeting(meetingId: string, newDate: string, newTime: string, newCol?: number, newRow?: number): Promise<Meeting | null> {
  try {
    const res = await fetch(`${API_BASE}/meetings/${meetingId}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_date: newDate, new_time: newTime, new_col: newCol, new_row: newRow }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result: Meeting = await res.json();
    logSuccess("rescheduleMeeting", result);
    return result;
  } catch (err) {
    logError("rescheduleMeeting", err, { meetingId });
    return null;
  }
}

export async function delegateMeeting(meetingId: string, req: DelegateRequest): Promise<unknown> {
  try {
    const res = await fetch(`${API_BASE}/meetings/${meetingId}/delegate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    logSuccess("delegateMeeting", result);
    return result;
  } catch (err) {
    logError("delegateMeeting", err, { meetingId });
    return null;
  }
}

export async function fetchCalendarSuggestions(): Promise<CalendarSuggestion[]> {
  try {
    const res = await fetch(`${API_BASE}/meetings/suggestions/all`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: CalendarSuggestion[] = await res.json();
    logSuccess("fetchCalendarSuggestions", { count: data.length });
    return data;
  } catch (err) {
    logError("fetchCalendarSuggestions", err);
    return [];
  }
}

export async function approveSuggestion(meetingId: string, suggestionId: string, params?: Record<string, unknown>): Promise<unknown> {
  try {
    const res = await fetch(`${API_BASE}/meetings/${meetingId}/approve-suggestion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suggestion_id: suggestionId, params }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    logSuccess("approveSuggestion", result);
    return result;
  } catch (err) {
    logError("approveSuggestion", err, { meetingId, suggestionId });
    return null;
  }
}

export async function dismissSuggestion(suggestionId: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/meetings/suggestions/${suggestionId}/dismiss`, { method: "POST" });
  } catch (err) {
    logError("dismissSuggestion", err, { suggestionId });
  }
}

export async function fetchDelegateRecommendations(meetingId: string): Promise<DelegateCandidate[]> {
  try {
    const res = await fetch(`${API_BASE}/meetings/${meetingId}/delegates`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: DelegateCandidate[] = await res.json();
    logSuccess("fetchDelegateRecommendations", { meetingId, count: data.length });
    return data;
  } catch (err) {
    logError("fetchDelegateRecommendations", err, { meetingId });
    return [];
  }
}



export async function generateMeetingBrief(meeting: {
  meeting_id: string;
  meeting_title: string;
  participants: string[];
  meeting_datetime?: string;
  agenda_items?: string[];
  previous_meetings?: string[];
}): Promise<MeetingBrief | null> {
  try {
    console.log("[ExecAI API] 🔄 generateMeetingBrief — calling AI...", { title: meeting.meeting_title });
    const calendarDescription = meeting.agenda_items?.join("; ") ?? "";
    const emailContext = meeting.previous_meetings?.join("\n") ?? "";
    const payload = {
      meeting_id: meeting.meeting_id,
      meeting_title: meeting.meeting_title,
      participants: meeting.participants,
      meeting_datetime: meeting.meeting_datetime ?? new Date().toISOString(),
      calendar_description: calendarDescription,
      email_context: emailContext,
      tenant_id: "default",
    };
    const res = await fetch(`${API_BASE}/agents/meeting-prep/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} — ${errText}`);
    }
    const data: MeetingBrief = await res.json();
    logSuccess("generateMeetingBrief", data);
    return data;
  } catch (err) {
    logError("generateMeetingBrief", err, { meeting_title: meeting.meeting_title });
    return null;
  }
}

// ── Action Items ────────────────────────────────────────────────────────────

export async function fetchActionItems(): Promise<ActionItem[]> {
  try {
    const res = await fetch(`${API_BASE}/action-items`);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const data = await res.json();
    logSuccess("fetchActionItems", { count: data.length });
    return data;
  } catch (err) {
    logError("fetchActionItems", err);
    return [];
  }
}

// ── Pipeline Trigger ────────────────────────────────────────────────────────

export async function triggerPipeline(
  triggerType: string,
  payload: Record<string, unknown>
): Promise<PipelineResult | null> {
  try {
    console.log("[ExecAI API] 🔄 triggerPipeline — orchestrating agents...", { triggerType, payload });
    const res = await fetch(`${API_BASE}/pipeline/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trigger_type: triggerType,
        payload,
        thread_id: `ui_${Date.now()}`,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} — ${errText}`);
    }
    const data: PipelineResult = await res.json();
    logSuccess("triggerPipeline", data);
    return data;
  } catch (err) {
    logError("triggerPipeline", err, { triggerType });
    return null;
  }
}

// ── MoM ──────────────────────────────────────────────────────────────────────

export async function generateMoM(data: {
  meeting_id: string;
  meeting_title: string;
  meeting_date: string;
  attendees: string[];
  transcript_text: string;
  participants: string[];
  source: string;
}): Promise<unknown> {
  try {
    console.log("[ExecAI API] 🔄 generateMoM — calling AI...", { title: data.meeting_title });
    const res = await fetch(`${API_BASE}/mom/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} — ${errText}`);
    }
    const result = await res.json();
    logSuccess("generateMoM", result);
    return result;
  } catch (err) {
    logError("generateMoM", err, { meeting_title: data.meeting_title });
    return null;
  }
}
