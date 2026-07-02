"""
Email Intelligence Agent — Full 6-Stage Pipeline
=================================================
Stage 1 — Email Parsing          (extracts all fields from raw payload)
Stage 2 — Email Type Classification (18 types)
Stage 3 — Intelligent Information Extraction
Stage 4 — Sender Trust & Relationship Analysis (mock relationship store)
Stage 5 — Spam Detection (multi-signal)
Stage 6 — Priority Scoring (0-100 → Urgent/High/Medium/Low/Spam)

Special: Detects attendee_requested signals in daily project update threads
         and auto-escalates to HIGH priority when client requests executive
         attendance in a meeting.
"""
from __future__ import annotations
import json
import re
from typing import Any

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from app.core.llm_router import AgentTask, get_llm
from app.models.schemas import (
    EmailIntelligenceResult, SenderProfile, ExtractedEntities,
    EmailType, PriorityLevel, OrgType, DomainTrust, RelationshipStrength,
)


# ─────────────────────────────────────────────────────────────
# Mock Relationship / Contact Store
# Simulates historical interaction data with key contacts
# ─────────────────────────────────────────────────────────────

MOCK_CONTACT_STORE: dict[str, dict] = {
    "ceo@company.com":         {"relationship": "ceo",                  "org_type": "internal",  "interactions": 47, "last_days": 2},
    "cto@company.com":         {"relationship": "direct_manager",        "org_type": "internal",  "interactions": 34, "last_days": 1},
    "sarah@company.com":       {"relationship": "frequent_collaborator", "org_type": "internal",  "interactions": 22, "last_days": 5},
    "hr@company.com":          {"relationship": "frequent_collaborator", "org_type": "internal",  "interactions": 18, "last_days": 7},
    "finance@company.com":     {"relationship": "frequent_collaborator", "org_type": "internal",  "interactions": 12, "last_days": 3},
    "legal@company.com":       {"relationship": "frequent_collaborator", "org_type": "internal",  "interactions": 8,  "last_days": 14},
    "pm@company.com":          {"relationship": "reporting_manager",     "org_type": "internal",  "interactions": 31, "last_days": 1},
    "dev@company.com":         {"relationship": "reporting_manager",     "org_type": "internal",  "interactions": 28, "last_days": 1},
    "qa@company.com":          {"relationship": "reporting_manager",     "org_type": "internal",  "interactions": 15, "last_days": 2},
    "john.smith@acmecorp.com": {"relationship": "client",               "org_type": "client",    "interactions": 19, "last_days": 4},
    "lisa@acmecorp.com":       {"relationship": "client",               "org_type": "client",    "interactions": 14, "last_days": 6},
    "vendor@techsupply.com":   {"relationship": "vendor",               "org_type": "vendor",    "interactions": 7,  "last_days": 30},
    "aws-alerts@amazon.com":   {"relationship": "vendor",               "org_type": "vendor",    "interactions": 99, "last_days": 0},
    "noreply@zoom.us":         {"relationship": "vendor",               "org_type": "vendor",    "interactions": 55, "last_days": 1},
}

# Domain → trust classification
DOMAIN_TRUST_MAP: dict[str, DomainTrust] = {
    "company.com":      "trusted",
    "acmecorp.com":     "known_client",
    "techsupply.com":   "known_vendor",
    "amazon.com":       "known_vendor",
    "zoom.us":          "known_vendor",
    "google.com":       "known_vendor",
    "microsoft.com":    "known_vendor",
    "gmail.com":        "personal",
    "yahoo.com":        "personal",
    "hotmail.com":      "personal",
    "outlook.com":      "personal",
}

SUSPICIOUS_TLD_PATTERNS = [".xyz", ".tk", ".ml", ".ga", ".cf", "-secure.", "login-", "verify-", "account-"]


# Regex to extract clean email address from sender field (e.g., 'John Doe <john@example.com>')
SENDER_EMAIL_REGEX = re.compile(r'[\w.+\-]+@[\w\-]+(?:\.[\w\-]+)+')


def extract_sender_email(sender: str) -> str:
    """Extract the clean email address from a sender string."""
    match = SENDER_EMAIL_REGEX.search(sender)
    return match.group(0).lower().strip() if match else sender.lower().strip()


def _get_domain(email: str) -> str:
    """Extract domain from email address."""
    return email.split("@")[-1].lower() if "@" in email else email.lower()


def _classify_domain(domain: str) -> DomainTrust:
    if domain in DOMAIN_TRUST_MAP:
        return DOMAIN_TRUST_MAP[domain]
    for pattern in SUSPICIOUS_TLD_PATTERNS:
        if pattern in domain:
            return "suspicious"
    return "unknown"


def analyze_sender(sender_email: str) -> SenderProfile:
    """Stage 4: Build sender profile from mock contact store + domain analysis."""
    sender_clean = extract_sender_email(sender_email)
    domain = _get_domain(sender_clean)
    domain_trust = _classify_domain(domain)

    contact = MOCK_CONTACT_STORE.get(sender_clean)

    if contact:
        return SenderProfile(
            org_type=contact["org_type"],
            domain=domain,
            domain_trust=domain_trust,
            relationship_strength=contact["relationship"],
            is_new_sender=False,
            interaction_count=contact["interactions"],
            last_interaction_days_ago=contact["last_days"],
            new_sender_category=None,
            trust_score=_compute_trust_score(contact, domain_trust),
        )

    # New sender — analyze domain to guess category
    is_personal = domain_trust == "personal"
    is_suspicious = domain_trust == "suspicious"
    is_known = domain_trust in ("known_client", "known_vendor", "trusted")

    if is_suspicious:
        new_cat = "spam"
        trust = 0.1
    elif is_personal:
        new_cat = "unknown_but_important"
        trust = 0.3
    elif is_known:
        new_cat = "potential_client"
        trust = 0.6
    else:
        new_cat = "unknown_but_important"
        trust = 0.4

    return SenderProfile(
        org_type="unknown",
        domain=domain,
        domain_trust=domain_trust,
        relationship_strength="never_contacted",
        is_new_sender=True,
        interaction_count=0,
        last_interaction_days_ago=999,
        new_sender_category=new_cat,
        trust_score=trust,
    )


def _compute_trust_score(contact: dict, domain_trust: DomainTrust) -> float:
    """Compute normalized trust score 0-1 from contact history."""
    base = 0.5
    rel = contact.get("relationship", "unknown")
    rel_bonus = {
        "ceo": 0.45, "direct_manager": 0.40, "client": 0.35,
        "reporting_manager": 0.35, "frequent_collaborator": 0.30,
        "vendor": 0.20, "unknown": 0.05, "never_contacted": 0.0,
    }.get(rel, 0.10)
    interactions = min(contact.get("interactions", 0), 50) / 50 * 0.10
    recency = max(0, (30 - contact.get("last_days", 30)) / 30) * 0.05
    domain_bonus = {"trusted": 0.10, "known_client": 0.08, "known_vendor": 0.05}.get(domain_trust, 0.0)
    return min(1.0, base + rel_bonus + interactions + recency + domain_bonus)


# ─────────────────────────────────────────────────────────────
# Stage 5 — Spam Detection (multi-signal)
# ─────────────────────────────────────────────────────────────

SPAM_KEYWORDS = [
    "unsubscribe", "click here", "you've won", "free offer", "limited time",
    "act now", "earn money", "make money fast", "crypto investment", "wire transfer",
    "verify your account", "confirm your credentials", "your account has been",
    "dear customer", "dear user", "nigerian prince", "lottery winner",
]

MARKETING_SIGNALS = ["newsletter", "subscribe", "promo", "discount", "offer expires", "sale"]


def detect_spam_signals(sender_email: str, subject: str, body: str,
                         sender_profile: SenderProfile) -> tuple[bool, list[str]]:
    """Stage 5: Multi-signal spam detection. Returns (is_spam, signals)."""
    signals: list[str] = []
    text = f"{subject} {body}".lower()

    if sender_profile.domain_trust == "suspicious":
        signals.append("suspicious_domain")

    if sender_profile.is_new_sender and sender_profile.trust_score < 0.3:
        signals.append("unknown_low_trust_sender")

    for kw in SPAM_KEYWORDS:
        if kw in text:
            signals.append(f"spam_keyword:{kw}")
            break

    marketing_hits = sum(1 for s in MARKETING_SIGNALS if s in text)
    if marketing_hits >= 2:
        signals.append("marketing_template")

    if re.search(r"https?://\S+", body) and len(re.findall(r"https?://\S+", body)) > 5:
        signals.append("excessive_urls")

    noreply_pattern = re.match(r"(noreply|no-reply|donotreply|mailer-daemon)@", sender_email.lower())
    if noreply_pattern and sender_profile.is_new_sender:
        signals.append("noreply_unknown_sender")

    is_spam = len([s for s in signals if "domain" in s or "spam_keyword" in s]) >= 1 \
              or len(signals) >= 3

    return is_spam, signals


# ─────────────────────────────────────────────────────────────
# AI Prompt — Full intelligence analysis
# ─────────────────────────────────────────────────────────────

INTELLIGENCE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an AI Email Intelligence Engine for an executive assistant.
Analyze the email and return a detailed JSON object.

CLASSIFICATION — pick exactly one email_type from:
  meeting_request, follow_up, action_required, approval_request, escalation,
  client_query, internal_update, daily_project_update, weekly_report, fyi,
  reminder, invoice_finance, hr_communication, security_notification,
  system_alert, newsletter, marketing_email, spam

ENTITY EXTRACTION — extract all available:
  meeting_date, meeting_time, meeting_link, agenda, participants, location,
  preparation_required (list), documents_to_review (list), deadlines (list),
  action_items (list), approvals_required (list), project_name, client_name,
  departments_involved (list), risk_level (low/medium/high/critical)

ATTENDEE ESCALATION — CRITICAL:
  Check if the email (especially daily project updates) mentions that:
  - A client, stakeholder, or senior person SPECIFICALLY REQUESTS the executive's presence
  - Phrases like "client wants you", "they need you specifically", "your presence is required",
    "the client has requested you join", "please attend", "you are needed in the meeting"
  If detected: set attendee_requested=true, attendee_requested_by=who requested,
  attendee_meeting_time=when the meeting is, delegate_suggestions=[names who could attend instead]

ONE LINE SUMMARY — a crisp 1-sentence summary of what this email needs.

Return ONLY valid JSON with these exact keys:
{{
  "email_type": "...",
  "meeting_date": null,
  "meeting_time": null,
  "meeting_link": null,
  "agenda": null,
  "participants": [],
  "location": null,
  "preparation_required": [],
  "documents_to_review": [],
  "deadlines": [],
  "action_items": [],
  "approvals_required": [],
  "project_name": null,
  "client_name": null,
  "departments_involved": [],
  "risk_level": null,
  "attendee_requested": false,
  "attendee_requested_by": null,
  "attendee_meeting_time": null,
  "delegate_suggestions": [],
  "one_line_summary": "..."
}}"""),
    ("human", """Sender: {sender}
Subject: {subject}
Timestamp: {timestamp}
CC: {cc}

Email Body:
{body}

Thread History (if any):
{thread_history}

Analyze this email and return the JSON.""")
])


# ─────────────────────────────────────────────────────────────
# Stage 6 — Priority Scoring
# ─────────────────────────────────────────────────────────────

def compute_priority(
    email_type: str,
    sender_profile: SenderProfile,
    entities: ExtractedEntities,
    is_spam: bool,
) -> tuple[PriorityLevel, float, str]:
    """Stage 6: Compute priority level, score (0-100), and reasoning."""
    if is_spam:
        return "spam", 0.0, "Detected as spam via multi-signal analysis."

    score = 0.0
    reasons: list[str] = []

    # Attendee requested — immediate HIGH escalation
    if entities.attendee_requested:
        score = 85.0
        reasons.append(f"Client/stakeholder explicitly requested your attendance in a meeting ({entities.attendee_meeting_time or 'time TBD'})")
        return "high", score, "; ".join(reasons)

    # Email type weights
    type_scores: dict[str, float] = {
        "escalation": 90, "approval_request": 80, "meeting_request": 70,
        "action_required": 75, "client_query": 65, "follow_up": 50,
        "daily_project_update": 45, "weekly_report": 40, "internal_update": 35,
        "invoice_finance": 55, "security_notification": 85, "system_alert": 80,
        "hr_communication": 30, "reminder": 35, "fyi": 25,
        "newsletter": 10, "marketing_email": 5, "spam": 0, "weekly_report": 40,
    }
    score += type_scores.get(email_type, 30)
    reasons.append(f"Email type: {email_type.replace('_', ' ')}")

    # Sender trust bonus
    score += sender_profile.trust_score * 15
    reasons.append(f"Sender trust: {sender_profile.relationship_strength.replace('_', ' ')} ({sender_profile.trust_score:.0%})")

    # Relationship bonus
    rel_bonus = {
        "ceo": 15, "direct_manager": 12, "client": 10, "reporting_manager": 8,
        "frequent_collaborator": 5, "vendor": 2, "unknown": 0, "never_contacted": 0,
    }.get(sender_profile.relationship_strength, 0)
    score += rel_bonus

    # Risk level
    risk_bonus = {"critical": 15, "high": 10, "medium": 5, "low": 0}.get(entities.risk_level or "low", 0)
    if risk_bonus:
        score += risk_bonus
        reasons.append(f"Risk level: {entities.risk_level}")

    # Has deadline
    if entities.deadlines:
        score += 8
        reasons.append("Contains deadlines")

    # Has approvals
    if entities.approvals_required:
        score += 10
        reasons.append("Approval required")

    # Clamp
    score = min(score, 100.0)

    if score >= 80:
        level: PriorityLevel = "urgent"
    elif score >= 60:
        level = "high"
    elif score >= 35:
        level = "medium"
    else:
        level = "low"

    return level, score, "; ".join(reasons)


# ─────────────────────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────────────────────

async def analyze_email_intelligence(
    message_id: str,
    thread_id: str,
    sender: str,
    subject: str,
    body: str,
    timestamp: str = "",
    cc: list[str] | None = None,
    thread_history: str = "",
    thread_group_key: str | None = None,
) -> EmailIntelligenceResult:
    """
    Full 6-stage email intelligence pipeline.
    Returns a complete EmailIntelligenceResult.
    """
    # Clean sender email address
    sender_clean = extract_sender_email(sender)

    # Stage 4 — Sender analysis (deterministic, no LLM)
    sender_profile = analyze_sender(sender_clean)

    # Stage 5 — Spam detection (deterministic, no LLM)
    is_spam, spam_signals = detect_spam_signals(sender_clean, subject, body, sender_profile)

    # If clearly spam, skip the expensive LLM call
    if is_spam and sender_profile.trust_score < 0.2:
        entities = ExtractedEntities()
        priority_level, priority_score, priority_reasoning = compute_priority(
            "spam", sender_profile, entities, is_spam=True
        )
        return EmailIntelligenceResult(
            email_id=message_id,
            email_type="spam",
            sender_profile=sender_profile,
            entities=entities,
            is_spam=True,
            spam_signals=spam_signals,
            priority_level="spam",
            priority_score=0.0,
            priority_reasoning="Auto-detected as spam.",
            one_line_summary="Spam email detected and filtered.",
            confidence=0.9,
            thread_id=thread_id,
            thread_group_key=thread_group_key,
        )

    # Stage 2 + 3 — LLM-based classification + entity extraction
    try:
        llm = get_llm(AgentTask.EMAIL_INTELLIGENCE, temperature=0.0)
        chain = INTELLIGENCE_PROMPT | llm | JsonOutputParser()
        result: dict[str, Any] = await chain.ainvoke({
            "sender": sender,
            "subject": subject,
            "timestamp": timestamp,
            "cc": ", ".join(cc or []) or "None",
            "body": body,
            "thread_history": thread_history or "No prior thread history.",
        })

        email_type: EmailType = result.get("email_type", "fyi")

        entities = ExtractedEntities(
            meeting_date=result.get("meeting_date"),
            meeting_time=result.get("meeting_time"),
            meeting_link=result.get("meeting_link"),
            agenda=result.get("agenda"),
            participants=result.get("participants", []),
            location=result.get("location"),
            preparation_required=result.get("preparation_required", []),
            documents_to_review=result.get("documents_to_review", []),
            deadlines=result.get("deadlines", []),
            action_items=result.get("action_items", []),
            approvals_required=result.get("approvals_required", []),
            project_name=result.get("project_name"),
            client_name=result.get("client_name"),
            departments_involved=result.get("departments_involved", []),
            risk_level=result.get("risk_level"),
            attendee_requested=result.get("attendee_requested", False),
            attendee_requested_by=result.get("attendee_requested_by"),
            attendee_meeting_time=result.get("attendee_meeting_time"),
            delegate_suggestions=result.get("delegate_suggestions", []),
        )

        one_line_summary = result.get("one_line_summary", "")

    except Exception as exc:
        print(f"[EmailIntelligenceAgent] ⚠️ LLM call failed: {exc}. Using fallback extraction...")
        email_type, entities, one_line_summary = _fallback_extraction(subject, body)

    # Stage 6 — Priority scoring
    priority_level, priority_score, priority_reasoning = compute_priority(
        email_type, sender_profile, entities, is_spam
    )

    return EmailIntelligenceResult(
        email_id=message_id,
        email_type=email_type,
        sender_profile=sender_profile,
        entities=entities,
        is_spam=is_spam,
        spam_signals=spam_signals,
        priority_level=priority_level,
        priority_score=priority_score,
        priority_reasoning=priority_reasoning,
        one_line_summary=one_line_summary,
        confidence=0.88,
        thread_id=thread_id,
        thread_group_key=thread_group_key,
    )


def _fallback_extraction(subject: str, body: str) -> tuple[str, ExtractedEntities, str]:
    """Offline fallback when LLM is unavailable."""
    text = f"{subject} {body}".lower()

    if any(w in text for w in ["meet", "schedule", "zoom", "calendar", "invite", "attendance"]):
        email_type = "meeting_request"
    elif any(w in text for w in ["daily update", "status update", "project update", "eod update"]):
        email_type = "daily_project_update"
    elif any(w in text for w in ["approve", "approval", "sign-off", "review and approve"]):
        email_type = "approval_request"
    elif any(w in text for w in ["urgent", "critical", "asap", "escalation", "immediate"]):
        email_type = "escalation"
    elif any(w in text for w in ["action required", "please do", "need you to"]):
        email_type = "action_required"
    elif any(w in text for w in ["following up", "checking in", "any updates"]):
        email_type = "follow_up"
    elif any(w in text for w in ["newsletter", "unsubscribe", "promotion"]):
        email_type = "newsletter"
    else:
        email_type = "fyi"

    # Detect attendee request in fallback
    attendee_requested = any(p in text for p in [
        "your presence is required", "client wants you", "they need you",
        "you are needed", "please attend", "client has requested you",
        "your attendance is required", "specifically requested you",
    ])

    entities = ExtractedEntities(
        agenda=subject.replace("Re:", "").replace("Fwd:", "").strip(),
        attendee_requested=attendee_requested,
    )

    summary = f"Requires attention: {subject}"
    return email_type, entities, summary
