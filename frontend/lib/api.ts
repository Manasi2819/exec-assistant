/**
 * frontend/lib/api.ts
 *
 * Centralized API client for the Executive AI Assistant backend.
 * All errors are logged to the console with full context so you can
 * trace them in the browser DevTools console or Next.js terminal output.
 *
 * Endpoint map (matches actual backend schemas):
 *   GET  /api/v1/emails                       → fetchEmails
 *   POST /api/v1/agents/email/ingest          → classifyEmail
 *   POST /api/v1/agents/reply/draft           → generateReplyDraft
 *   GET  /api/v1/meetings                     → fetchMeetings
 *   POST /api/v1/agents/meeting-prep/generate → generateMeetingBrief
 *   GET  /api/v1/action-items                 → fetchActionItems
 *   POST /api/v1/pipeline/trigger             → triggerPipeline
 *   POST /api/v1/mom/generate                 → generateMoM
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

// ── Types matching the actual backend Pydantic schemas ──────────────────────

export interface Email {
  id: string;
  sender: string;
  senderName?: string;
  subject: string;
  body?: string;
  preview?: string;
  category?: string;
  priority?: string;
  confidence?: number;
  received_at?: string;
  time?: string;
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
  time?: string;
  duration_min?: number;
  participants: string[];
  brief_status?: string;
  agenda_items?: string[];
  previous_meetings?: string[];
  source?: string;
  conflict?: boolean;
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

export async function fetchEmails(category?: string): Promise<Email[]> {
  try {
    const url = category
      ? `${API_BASE}/emails?category=${encodeURIComponent(category)}`
      : `${API_BASE}/emails`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const data = await res.json();
    logSuccess("fetchEmails", { count: data.length, category });
    return data;
  } catch (err) {
    logError("fetchEmails", err, { category });
    return [];
  }
}

/**
 * Classify an email via POST /api/v1/agents/email/ingest
 * Matches EmailIngestRequest schema.
 */
export async function classifyEmail(email: {
  sender: string;
  subject: string;
  body: string;
  received_at?: string;
}): Promise<ClassifyResult | null> {
  try {
    console.log("[ExecAI API] 🔄 classifyEmail — calling Gemini AI...", { subject: email.subject });
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
 * Generate a reply draft via POST /api/v1/agents/reply/draft
 * Matches ReplyDraftRequest schema.
 */
export async function generateReplyDraft(email: {
  email_id: string;
  body: string;
  subject?: string;
  user_name?: string;
}): Promise<ReplyDraft | null> {
  try {
    console.log("[ExecAI API] 🔄 generateReplyDraft — calling Gemini AI...", { email_id: email.email_id });
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

/**
 * Generate a meeting brief via POST /api/v1/agents/meeting-prep/generate
 * Matches MeetingPrepRequest schema.
 */
export async function generateMeetingBrief(meeting: {
  meeting_id: string;
  meeting_title: string;
  participants: string[];
  meeting_datetime?: string;
  agenda_items?: string[];
  previous_meetings?: string[];
}): Promise<MeetingBrief | null> {
  try {
    console.log("[ExecAI API] 🔄 generateMeetingBrief — calling Gemini AI...", { title: meeting.meeting_title });
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

/**
 * Trigger the LangGraph orchestration pipeline.
 * POST /api/v1/pipeline/trigger
 */
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
    console.log("[ExecAI API] 🔄 generateMoM — calling Gemini AI...", { title: data.meeting_title });
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
