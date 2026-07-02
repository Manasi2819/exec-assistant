"""
Email Intelligence API — Rich mock dataset for demonstration.
Covers all 4 inbox sections, 3 project update thread groups,
attendee escalation detection, and spam examples.
"""
from fastapi import APIRouter
from datetime import datetime

router = APIRouter()

# ─────────────────────────────────────────────────────────────
# Rich mock email dataset
# Each email includes full intelligence pipeline output
# ─────────────────────────────────────────────────────────────

MOCK_EMAILS = [
    # ════════════════════════════════════════
    # SECTION 1 — URGENT
    # ════════════════════════════════════════
    {
        "id": "e001",
        "sender": "ceo@company.com",
        "senderName": "Michael Chen — CEO",
        "senderInitials": "MC",
        "subject": "URGENT: Board wants emergency session — Q4 Pivot Decision",
        "preview": "The board has called an emergency session for tomorrow at 9 AM. This requires your immediate attendance and sign-off on the Q4 strategy pivot.",
        "body": "Team,\n\nThe board has called an emergency session for tomorrow at 9 AM regarding the Q4 strategy pivot following the market shift. Your attendance is mandatory.\n\nAgenda:\n1. Review Q4 revised projections\n2. Approve headcount reduction plan (15%)\n3. Decision on the new product roadmap pivot\n\nPlease review the attached deck before the meeting. This is a boardroom decision that requires your formal sign-off.\n\nMichael Chen\nCEO",
        "category": "escalation",
        "emailType": "escalation",
        "priority": "urgent",
        "priorityScore": 95,
        "priorityLevel": "urgent",
        "confidence": 0.98,
        "time": "8:14 AM",
        "received_at": "2026-06-26T08:14:00Z",
        "senderProfile": {
            "orgType": "internal",
            "domain": "company.com",
            "domainTrust": "trusted",
            "relationshipStrength": "ceo",
            "isNewSender": False,
            "interactionCount": 47,
            "trustScore": 0.97,
        },
        "entities": {
            "meetingDate": "Tomorrow",
            "meetingTime": "9:00 AM",
            "agenda": "Q4 strategy pivot — emergency board decision",
            "participants": ["Board Members", "Executive Team"],
            "preparationRequired": ["Review Q4 revised projections deck", "Prepare headcount reduction position"],
            "approvalsRequired": ["Q4 strategy pivot sign-off", "Headcount reduction approval"],
            "riskLevel": "critical",
            "attendeeRequested": False,
        },
        "onLineSummary": "CEO is calling an emergency board session tomorrow at 9 AM requiring your formal sign-off on Q4 strategy pivot.",
        "isThread": False,
        "threadId": "thread_e001",
    },
    {
        "id": "e002",
        "sender": "sarah@company.com",
        "senderName": "Sarah Jenkins — Legal",
        "senderInitials": "SJ",
        "subject": "URGENT: NDA breach — Client Acme threatening legal action",
        "preview": "Acme Corp's legal team contacted us this morning alleging a potential NDA breach from last quarter's data sharing. They want a response within 24 hours.",
        "body": "Hi,\n\nI've just received a letter from Acme Corp's legal counsel alleging that our Q3 partner data sharing may have constituted an NDA breach.\n\nThey've given us 24 hours to respond formally before they escalate.\n\nAction Required:\n1. Your immediate approval to engage external counsel (Hartley & Webb)\n2. Sign off on the holding response letter (attached)\n3. Decision on whether to disclose internally\n\nThis is time-critical. Please review and respond by 3 PM today.\n\nSarah Jenkins\nLegal",
        "category": "escalation",
        "emailType": "escalation",
        "priority": "urgent",
        "priorityScore": 93,
        "priorityLevel": "urgent",
        "confidence": 0.97,
        "time": "9:02 AM",
        "received_at": "2026-06-26T09:02:00Z",
        "senderProfile": {
            "orgType": "internal",
            "domain": "company.com",
            "domainTrust": "trusted",
            "relationshipStrength": "frequent_collaborator",
            "isNewSender": False,
            "interactionCount": 22,
            "trustScore": 0.88,
        },
        "entities": {
            "deadlines": ["3 PM today — formal legal response deadline"],
            "actionItems": [
                "Approve engagement of external counsel",
                "Sign holding response letter",
                "Decision on internal disclosure",
            ],
            "approvalsRequired": ["External counsel engagement", "Formal response letter"],
            "riskLevel": "critical",
            "attendeeRequested": False,
        },
        "onLineSummary": "Acme Corp is threatening legal action over an alleged NDA breach — requires your approval and response by 3 PM today.",
        "isThread": False,
        "threadId": "thread_e002",
    },
    {
        "id": "e003",
        "sender": "cto@company.com",
        "senderName": "Alex Torres — CTO",
        "senderInitials": "AT",
        "subject": "Production outage — 23% of users affected, revenue impact $18K/hr",
        "preview": "Critical production incident. The payment gateway is down affecting 23% of active users. Engineering is working but need your call on emergency vendor escalation.",
        "body": "Hi,\n\nWe have a critical production incident.\n\nStatus:\n- Payment gateway down since 8:47 AM\n- 23% of active users affected\n- Revenue impact: approximately $18,000/hour\n- ETA to fix: unknown (vendor dependency)\n\nI need your authorization to:\n1. Escalate to Stripe's emergency SLA team (costs $5K for expedited support)\n2. Notify affected enterprise customers proactively\n3. Post public status update\n\nPlease respond ASAP.\n\nAlex Torres\nCTO",
        "category": "escalation",
        "emailType": "escalation",
        "priority": "urgent",
        "priorityScore": 96,
        "priorityLevel": "urgent",
        "confidence": 0.99,
        "time": "9:15 AM",
        "received_at": "2026-06-26T09:15:00Z",
        "senderProfile": {
            "orgType": "internal",
            "domain": "company.com",
            "domainTrust": "trusted",
            "relationshipStrength": "direct_manager",
            "isNewSender": False,
            "interactionCount": 34,
            "trustScore": 0.95,
        },
        "entities": {
            "actionItems": [
                "Authorize Stripe emergency SLA escalation ($5K)",
                "Approve proactive customer notification",
                "Approve public status update",
            ],
            "approvalsRequired": ["Emergency vendor escalation", "Customer communication"],
            "riskLevel": "critical",
            "attendeeRequested": False,
        },
        "onLineSummary": "Critical production outage affecting 23% of users at $18K/hr revenue impact — needs your authorization for emergency vendor escalation.",
        "isThread": False,
        "threadId": "thread_e003",
    },

    # ════════════════════════════════════════
    # SECTION 1 — HIGH PRIORITY
    # ════════════════════════════════════════
    {
        "id": "e004",
        "sender": "sarah@company.com",
        "senderName": "Sarah Jenkins — Legal",
        "senderInitials": "SJ",
        "subject": "Q4 Budget Reallocation — Approval Needed Before Friday Board",
        "preview": "I need your formal approval to shift $50K from T&E to Digital Ad Spend before the Friday board meeting. 3x ROI projected.",
        "body": "Hi,\n\nWe've completed our Q4 planning review and identified an opportunity to reallocate $50K from Travel & Entertainment to Digital Ad Spend, which our data shows will yield a 3x ROI.\n\nI need your formal approval before we submit the updated budget to the board on Friday. No major risks flagged — the T&E reduction is offset by lower conference attendance this quarter.\n\nPlease confirm at your earliest convenience.\n\nBest,\nSarah Jenkins\nLegal & Finance",
        "category": "approval_request",
        "emailType": "approval_request",
        "priority": "high",
        "priorityScore": 78,
        "priorityLevel": "high",
        "confidence": 0.97,
        "time": "10:42 AM",
        "received_at": "2026-06-26T10:42:00Z",
        "senderProfile": {
            "orgType": "internal",
            "domain": "company.com",
            "domainTrust": "trusted",
            "relationshipStrength": "frequent_collaborator",
            "isNewSender": False,
            "interactionCount": 22,
            "trustScore": 0.88,
        },
        "entities": {
            "deadlines": ["Friday — board submission deadline"],
            "approvalsRequired": ["$50K budget reallocation from T&E to Digital Ad Spend"],
            "riskLevel": "low",
            "attendeeRequested": False,
        },
        "onLineSummary": "Approval needed to reallocate $50K to Digital Ad Spend before Friday's board meeting.",
        "isThread": False,
        "threadId": "thread_e004",
    },
    {
        "id": "e005",
        "sender": "john.smith@acmecorp.com",
        "senderName": "John Smith — Acme Corp",
        "senderInitials": "JS",
        "subject": "Integration Review — Client wants YOUR presence in Friday's sync",
        "preview": "Acme Corp's technical team has requested that you personally join the integration review meeting on Friday. They have escalated concerns about API performance.",
        "body": "Hi,\n\nI wanted to give you a heads-up before the Friday integration review.\n\nAcme's CTO, David Park, has specifically requested that you be present at the meeting. He mentioned he wants to discuss the API performance issues directly with leadership and is not comfortable proceeding without your involvement.\n\nMeeting: Friday, June 27 at 2:00 PM\nZoom: https://zoom.us/j/98765432\nDuration: 90 minutes\n\nThe client has escalated this — if you cannot attend, please let me know who can represent you (David Chen or Alex Torres would be appropriate).\n\nBest,\nJohn Smith\nAcme Corp Partnership",
        "category": "meeting_request",
        "emailType": "meeting_request",
        "priority": "high",
        "priorityScore": 85,
        "priorityLevel": "high",
        "confidence": 0.96,
        "time": "11:30 AM",
        "received_at": "2026-06-26T11:30:00Z",
        "senderProfile": {
            "orgType": "client",
            "domain": "acmecorp.com",
            "domainTrust": "known_client",
            "relationshipStrength": "client",
            "isNewSender": False,
            "interactionCount": 19,
            "trustScore": 0.83,
        },
        "entities": {
            "meetingDate": "Friday, June 27",
            "meetingTime": "2:00 PM",
            "meetingLink": "https://zoom.us/j/98765432",
            "agenda": "API integration performance review with Acme Corp leadership",
            "participants": ["David Park (Acme CTO)", "John Smith", "Executive"],
            "clientName": "Acme Corp",
            "riskLevel": "high",
            "attendeeRequested": True,
            "attendeeRequestedBy": "David Park — Acme Corp CTO",
            "attendeeMeetingTime": "Friday, June 27 at 2:00 PM",
            "delegateSuggestions": ["David Chen", "Alex Torres"],
        },
        "onLineSummary": "⚠️ Acme Corp's CTO specifically requested your presence at Friday's integration review — you can attend or delegate.",
        "isThread": False,
        "threadId": "thread_e005",
        "attendeeEscalation": True,
    },
    {
        "id": "e006",
        "sender": "cto@company.com",
        "senderName": "Alex Torres — CTO",
        "senderInitials": "AT",
        "subject": "Board Meeting — Please Confirm Attendance (Friday 2 PM)",
        "preview": "Please confirm your attendance for the board meeting on Friday at 2 PM. Pre-read deck requires your sign-off on slides 4–7.",
        "body": "Hi,\n\nPlease confirm your attendance for the board meeting on Friday at 2 PM. We need to discuss Q3 results, the new product roadmap, and the proposed headcount changes.\n\nA pre-read deck will be circulated by Wednesday. Please review slides 4–7 which require your sign-off.\n\nRegards,\nCTO Office",
        "category": "meeting_request",
        "emailType": "meeting_request",
        "priority": "high",
        "priorityScore": 72,
        "priorityLevel": "high",
        "confidence": 0.95,
        "time": "Yesterday",
        "received_at": "2026-06-25T15:00:00Z",
        "senderProfile": {
            "orgType": "internal",
            "domain": "company.com",
            "domainTrust": "trusted",
            "relationshipStrength": "direct_manager",
            "isNewSender": False,
            "interactionCount": 34,
            "trustScore": 0.95,
        },
        "entities": {
            "meetingDate": "Friday",
            "meetingTime": "2:00 PM",
            "agenda": "Q3 results, product roadmap, headcount changes",
            "participants": ["Board Members", "Executive Team", "CTO"],
            "preparationRequired": ["Review slides 4-7 in pre-read deck"],
            "approvalsRequired": ["Slides 4-7 sign-off"],
            "riskLevel": "medium",
            "attendeeRequested": False,
        },
        "onLineSummary": "Board meeting Friday 2 PM — confirm attendance and sign off on pre-read deck slides 4–7.",
        "isThread": False,
        "threadId": "thread_e006",
    },
    {
        "id": "e007",
        "sender": "finance@company.com",
        "senderName": "Finance Department",
        "senderInitials": "FD",
        "subject": "Q3 Invoice from Salesforce — $245,000 — Approval Required",
        "preview": "The annual Salesforce renewal invoice of $245,000 is due by July 1st. Finance requires your approval to process payment.",
        "body": "Hi,\n\nThe annual Salesforce CRM renewal invoice has arrived. Details:\n\nVendor: Salesforce Inc.\nAmount: $245,000\nDue Date: July 1, 2026\nContract Term: 12 months\nLicenses: 350 seats\n\nThis is within our approved budget for Q3. Please approve so we can process the wire transfer before the due date.\n\nFinance Team",
        "category": "approval_request",
        "emailType": "invoice_finance",
        "priority": "high",
        "priorityScore": 68,
        "priorityLevel": "high",
        "confidence": 0.94,
        "time": "2:00 PM",
        "received_at": "2026-06-26T14:00:00Z",
        "senderProfile": {
            "orgType": "internal",
            "domain": "company.com",
            "domainTrust": "trusted",
            "relationshipStrength": "frequent_collaborator",
            "isNewSender": False,
            "interactionCount": 12,
            "trustScore": 0.82,
        },
        "entities": {
            "deadlines": ["July 1, 2026 — payment due date"],
            "approvalsRequired": ["$245,000 Salesforce renewal invoice payment"],
            "riskLevel": "medium",
            "attendeeRequested": False,
        },
        "onLineSummary": "Salesforce annual renewal invoice for $245K needs your approval before July 1st.",
        "isThread": False,
        "threadId": "thread_e007",
    },

    # ════════════════════════════════════════
    # SECTION 2 — MEDIUM PRIORITY
    # ════════════════════════════════════════
    {
        "id": "e008",
        "sender": "pm@company.com",
        "senderName": "Priya Mehta — Product",
        "senderInitials": "PM",
        "subject": "Feature Request Follow-up — Acme Corp Feedback",
        "preview": "Following up on the feature request discussion from last week's sync. Acme Corp wants a timeline commitment by end of this week.",
        "body": "Hi,\n\nFollowing up on the feature request discussion from last week's sync with Acme Corp.\n\nThey've asked for a concrete timeline on the custom reporting module. The engineering estimate is 6 weeks. Acme wants to know:\n\n1. Can we commit to the Q3 delivery?\n2. Will there be a beta preview they can test first?\n\nI need your go-ahead to communicate the Q3 commitment to the client.\n\nThanks,\nPriya",
        "category": "follow_up",
        "emailType": "follow_up",
        "priority": "medium",
        "priorityScore": 52,
        "priorityLevel": "medium",
        "confidence": 0.89,
        "time": "Yesterday",
        "received_at": "2026-06-25T11:00:00Z",
        "senderProfile": {
            "orgType": "internal",
            "domain": "company.com",
            "domainTrust": "trusted",
            "relationshipStrength": "reporting_manager",
            "isNewSender": False,
            "interactionCount": 31,
            "trustScore": 0.88,
        },
        "entities": {
            "deadlines": ["End of this week — Acme Corp timeline commitment"],
            "actionItems": ["Approve Q3 commitment to Acme Corp for custom reporting module"],
            "clientName": "Acme Corp",
            "projectName": "Custom Reporting Module",
            "riskLevel": "medium",
            "attendeeRequested": False,
        },
        "onLineSummary": "Acme Corp wants a Q3 delivery commitment on the custom reporting module — needs your go-ahead by end of week.",
        "isThread": False,
        "threadId": "thread_e008",
    },
    {
        "id": "e009",
        "sender": "hr@company.com",
        "senderName": "HR Department",
        "senderInitials": "HR",
        "subject": "Q3 Performance Review Cycle Begins July 1 — Manager Actions Required",
        "preview": "The Q3 performance review cycle begins July 1. As a manager, you have 3 direct report reviews to complete by July 15.",
        "body": "Hi Team,\n\nThe Q3 performance review cycle begins July 1, 2026.\n\nAs a people manager, you have the following actions to complete:\n\n1. Complete 3 direct report reviews in Workday (due July 15)\n2. Schedule 1-on-1 review conversations before July 18\n3. Submit calibration nominations by July 20\n\nWorkday link: https://workday.company.com/reviews\n\nHR Team",
        "category": "action_required",
        "emailType": "hr_communication",
        "priority": "medium",
        "priorityScore": 44,
        "priorityLevel": "medium",
        "confidence": 0.91,
        "time": "2 days ago",
        "received_at": "2026-06-24T09:00:00Z",
        "senderProfile": {
            "orgType": "internal",
            "domain": "company.com",
            "domainTrust": "trusted",
            "relationshipStrength": "frequent_collaborator",
            "isNewSender": False,
            "interactionCount": 18,
            "trustScore": 0.82,
        },
        "entities": {
            "deadlines": ["July 15 — complete direct report reviews", "July 18 — 1-on-1s", "July 20 — calibration nominations"],
            "actionItems": ["Complete 3 direct report reviews in Workday", "Schedule review 1-on-1s", "Submit calibration nominations"],
            "departmentsInvolved": ["HR"],
            "attendeeRequested": False,
        },
        "onLineSummary": "Q3 performance reviews start July 1 — you have 3 direct reports to review in Workday by July 15.",
        "isThread": False,
        "threadId": "thread_e009",
    },

    # ════════════════════════════════════════
    # SECTION 3 — LOW PRIORITY
    # ════════════════════════════════════════
    {
        "id": "e010",
        "sender": "hr@company.com",
        "senderName": "HR Department",
        "senderInitials": "HR",
        "subject": "Updated Holiday Schedule & Policy Changes 2026",
        "preview": "Please review the updated corporate holiday schedule and revised remote work policy for the upcoming quarter.",
        "body": "Hi Team,\n\nPlease review the updated corporate holiday schedule for Q3/Q4 2026. Key changes:\n- August 15 now a company-wide holiday\n- Remote work policy updated: max 3 days/week from home\n- Mental health days: 2 additional paid days added\n\nNo action required unless you have scheduling conflicts to flag.\n\nHR Team",
        "category": "fyi",
        "emailType": "hr_communication",
        "priority": "low",
        "priorityScore": 22,
        "priorityLevel": "low",
        "confidence": 0.98,
        "time": "2 days ago",
        "received_at": "2026-06-24T09:00:00Z",
        "senderProfile": {
            "orgType": "internal",
            "domain": "company.com",
            "domainTrust": "trusted",
            "relationshipStrength": "frequent_collaborator",
            "isNewSender": False,
            "interactionCount": 18,
            "trustScore": 0.82,
        },
        "entities": {
            "actionItems": [],
            "attendeeRequested": False,
        },
        "onLineSummary": "HR updated the holiday schedule — August 15 is now a company-wide holiday, no action required.",
        "isThread": False,
        "threadId": "thread_e010",
    },
    {
        "id": "e011",
        "sender": "noreply@zoom.us",
        "senderName": "Zoom",
        "senderInitials": "ZM",
        "subject": "Your Zoom recording is now available",
        "preview": "Your Zoom meeting recording 'Product Sync — June 25' is now available and ready to share.",
        "body": "Your Zoom meeting recording is ready.\n\nMeeting: Product Sync — June 25\nDuration: 47 minutes\nParticipants: 8\n\nWatch recording: https://zoom.us/recording/xyz123\n\nZoom Team",
        "category": "fyi",
        "emailType": "system_alert",
        "priority": "low",
        "priorityScore": 18,
        "priorityLevel": "low",
        "confidence": 0.95,
        "time": "Yesterday",
        "received_at": "2026-06-25T17:30:00Z",
        "senderProfile": {
            "orgType": "vendor",
            "domain": "zoom.us",
            "domainTrust": "known_vendor",
            "relationshipStrength": "vendor",
            "isNewSender": False,
            "interactionCount": 55,
            "trustScore": 0.65,
        },
        "entities": {
            "attendeeRequested": False,
        },
        "onLineSummary": "Zoom recording for 'Product Sync — June 25' is available (47 mins, 8 participants).",
        "isThread": False,
        "threadId": "thread_e011",
    },

    # ════════════════════════════════════════
    # SECTION 4 — SPAM
    # ════════════════════════════════════════
    {
        "id": "e012",
        "sender": "offers@big-deals-now.xyz",
        "senderName": "Big Deals Now",
        "senderInitials": "BD",
        "subject": "🎁 You've been selected! Claim your $5,000 Amazon Gift Card NOW",
        "preview": "Congratulations! You have been randomly selected to receive a $5,000 Amazon gift card. Click here to claim your prize before midnight.",
        "body": "CONGRATULATIONS!\n\nYou have been randomly selected from 1,000,000 participants to receive a $5,000 Amazon Gift Card!\n\nCLICK HERE TO CLAIM YOUR PRIZE: http://big-deals-now.xyz/claim?id=abc123\n\nOffer expires midnight tonight. Act now!\n\nBig Deals Now Team",
        "category": "spam",
        "emailType": "spam",
        "priority": "spam",
        "priorityScore": 0,
        "priorityLevel": "spam",
        "confidence": 0.99,
        "time": "3 days ago",
        "received_at": "2026-06-23T03:00:00Z",
        "senderProfile": {
            "orgType": "unknown",
            "domain": "big-deals-now.xyz",
            "domainTrust": "suspicious",
            "relationshipStrength": "never_contacted",
            "isNewSender": True,
            "interactionCount": 0,
            "trustScore": 0.05,
        },
        "isSpam": True,
        "spamSignals": ["suspicious_domain", "spam_keyword:you've won", "spam_keyword:act now"],
        "entities": {"attendeeRequested": False},
        "onLineSummary": "Spam: Prize scam email from suspicious domain.",
        "isThread": False,
        "threadId": "thread_e012",
    },
    {
        "id": "e013",
        "sender": "newsletter@marketingtools.io",
        "senderName": "MarketingTools Weekly",
        "senderInitials": "MT",
        "subject": "This week in marketing: 47 tips to boost your ROI",
        "preview": "MarketingTools weekly newsletter — 47 expert tips to boost your marketing ROI. Unsubscribe at any time.",
        "body": "MarketingTools Weekly Newsletter\n\n47 Tips to Boost Your Marketing ROI\n\nThis week we cover:\n- Email open rate optimization\n- A/B testing best practices\n- Social media automation tools\n\nUnsubscribe: https://marketingtools.io/unsubscribe\n\nMarketingTools Inc.",
        "category": "spam",
        "emailType": "newsletter",
        "priority": "spam",
        "priorityScore": 3,
        "priorityLevel": "spam",
        "confidence": 0.94,
        "time": "4 days ago",
        "received_at": "2026-06-22T09:00:00Z",
        "senderProfile": {
            "orgType": "unknown",
            "domain": "marketingtools.io",
            "domainTrust": "unknown",
            "relationshipStrength": "never_contacted",
            "isNewSender": True,
            "interactionCount": 0,
            "trustScore": 0.2,
        },
        "isSpam": True,
        "spamSignals": ["unknown_low_trust_sender", "marketing_template"],
        "entities": {"attendeeRequested": False},
        "onLineSummary": "Unsolicited marketing newsletter — filtered to spam.",
        "isThread": False,
        "threadId": "thread_e013",
    },
]

# ─────────────────────────────────────────────────────────────
# Thread groups — 3 active projects with daily update threads
# Each project thread has individual emails + an executive summary
# ─────────────────────────────────────────────────────────────

THREAD_EMAILS = {
    # ── Project Phoenix (API Redesign) ─────────────────────
    "thread_phoenix": [
        {
            "id": "tp001",
            "sender": "dev@company.com",
            "senderName": "Dev Team — Raj Kumar",
            "senderInitials": "RK",
            "subject": "Project Phoenix — Daily Update #18",
            "preview": "Day 18: Backend APIs complete. Auth module live. Frontend integration 60% done. DB permissions blocker persists.",
            "body": "Hi,\n\nProject Phoenix — Daily Update #18\nDate: June 26, 2026\n\n✅ COMPLETED TODAY:\n- Backend API layer fully implemented (32 endpoints)\n- Authentication module deployed to staging\n- API documentation updated\n\n🔄 IN PROGRESS:\n- Frontend integration (60% complete)\n- Unit test coverage (target: 80%)\n\n⚠️ BLOCKERS:\n- Database permissions issue blocking staging deployment\n  → Awaiting DevOps resolution (ETA: tomorrow)\n  → Client feedback on UI mockups (pending since Day 15)\n\n📊 Overall Status: ON TRACK\nMilestone target: June 30 ✅\n\nRaj Kumar\nLead Engineer",
            "category": "daily_project_update",
            "emailType": "daily_project_update",
            "priority": "medium",
            "priorityScore": 45,
            "priorityLevel": "medium",
            "confidence": 0.93,
            "time": "8:00 AM",
            "received_at": "2026-06-26T08:00:00Z",
            "senderProfile": {"orgType": "internal", "domain": "company.com", "domainTrust": "trusted", "relationshipStrength": "reporting_manager", "isNewSender": False, "interactionCount": 28, "trustScore": 0.85},
            "entities": {
                "projectName": "Project Phoenix",
                "participants": ["Raj Kumar", "Dev Team", "DevOps"],
                "actionItems": ["Resolve DB permissions", "Get client feedback on UI mockups"],
                "blockers": ["Database permissions issue", "Client UI feedback pending"],
                "attendeeRequested": False,
            },
            "threadGroupKey": "thread_phoenix",
        },
        {
            "id": "tp002",
            "sender": "dev@company.com",
            "senderName": "Dev Team — Raj Kumar",
            "senderInitials": "RK",
            "subject": "Project Phoenix — Daily Update #17",
            "preview": "Day 17: 28 of 32 backend APIs done. Auth module in testing. DB permissions still blocked.",
            "body": "Project Phoenix — Daily Update #17\n\n✅ COMPLETED:\n- 28/32 backend APIs complete\n- Auth module entering testing phase\n\n🔄 IN PROGRESS:\n- Final 4 backend APIs\n- Frontend component library\n\n⚠️ BLOCKER: DB permissions still unresolved — escalated to DevOps lead\n\nStatus: ON TRACK\n\nRaj Kumar",
            "category": "daily_project_update", "emailType": "daily_project_update",
            "priority": "medium", "priorityScore": 43, "priorityLevel": "medium",
            "confidence": 0.92, "time": "Yesterday",
            "received_at": "2026-06-25T08:00:00Z",
            "senderProfile": {"orgType": "internal", "domain": "company.com", "domainTrust": "trusted", "relationshipStrength": "reporting_manager", "isNewSender": False, "interactionCount": 28, "trustScore": 0.85},
            "entities": {"projectName": "Project Phoenix", "attendeeRequested": False},
            "threadGroupKey": "thread_phoenix",
        },
        {
            "id": "tp003",
            "sender": "dev@company.com",
            "senderName": "Dev Team — Raj Kumar",
            "senderInitials": "RK",
            "subject": "Project Phoenix — Daily Update #16 + CLIENT REQUEST",
            "preview": "Day 16 update + IMPORTANT: Acme Corp has specifically requested your presence at tomorrow's demo. They want to meet leadership directly.",
            "body": "Project Phoenix — Daily Update #16\n\n✅ COMPLETED:\n- Initial API skeleton complete\n- Database schema finalized\n\n⚠️ IMPORTANT — CLIENT REQUEST:\nAcme Corp's CTO David Park has specifically requested that you attend tomorrow's demo at 3 PM. He mentioned the board wants to see leadership commitment to this project and is not comfortable proceeding to the next phase without meeting you directly.\n\nMeeting: Tomorrow, June 27 at 3:00 PM\nZoom: https://zoom.us/j/11223344\n\nIf you cannot attend, David Chen or Alex Torres could represent you.\n\n📊 Status: ON TRACK\n\nRaj Kumar",
            "category": "daily_project_update", "emailType": "daily_project_update",
            "priority": "high", "priorityScore": 85, "priorityLevel": "high",
            "confidence": 0.96, "time": "2 days ago",
            "received_at": "2026-06-24T08:00:00Z",
            "senderProfile": {"orgType": "internal", "domain": "company.com", "domainTrust": "trusted", "relationshipStrength": "reporting_manager", "isNewSender": False, "interactionCount": 28, "trustScore": 0.85},
            "entities": {
                "projectName": "Project Phoenix",
                "meetingDate": "Tomorrow, June 27",
                "meetingTime": "3:00 PM",
                "meetingLink": "https://zoom.us/j/11223344",
                "clientName": "Acme Corp",
                "attendeeRequested": True,
                "attendeeRequestedBy": "David Park — Acme Corp CTO",
                "attendeeMeetingTime": "Tomorrow, June 27 at 3:00 PM",
                "delegateSuggestions": ["David Chen", "Alex Torres"],
            },
            "threadGroupKey": "thread_phoenix",
            "attendeeEscalation": True,
        },
    ],

    # ── Project Atlas (Mobile App) ──────────────────────────
    "thread_atlas": [
        {
            "id": "ta001",
            "sender": "pm@company.com",
            "senderName": "Priya Mehta — Product",
            "senderInitials": "PM",
            "subject": "Project Atlas — Daily Update #9",
            "preview": "Day 9: UI design approved. iOS build in progress. Android pending design handoff. Sprint 2 on track for June 28.",
            "body": "Project Atlas — Daily Update #9\nDate: June 26, 2026\n\n✅ COMPLETED:\n- UI/UX design approved by stakeholders\n- iOS build started (Sprint 2)\n- Component library 80% complete\n\n🔄 IN PROGRESS:\n- Android development (waiting for design handoff)\n- Backend API integration (2 endpoints remaining)\n\n⚠️ RISK:\n- Android timeline may slip by 2 days if design handoff not completed today\n\n📊 Status: AT RISK (Android track)\nSprint 2 target: June 28\n\nPriya Mehta",
            "category": "daily_project_update", "emailType": "daily_project_update",
            "priority": "medium", "priorityScore": 48, "priorityLevel": "medium",
            "confidence": 0.91, "time": "9:00 AM",
            "received_at": "2026-06-26T09:00:00Z",
            "senderProfile": {"orgType": "internal", "domain": "company.com", "domainTrust": "trusted", "relationshipStrength": "reporting_manager", "isNewSender": False, "interactionCount": 31, "trustScore": 0.88},
            "entities": {
                "projectName": "Project Atlas",
                "actionItems": ["Complete design handoff to Android team today"],
                "riskLevel": "medium",
                "attendeeRequested": False,
            },
            "threadGroupKey": "thread_atlas",
        },
        {
            "id": "ta002",
            "sender": "pm@company.com",
            "senderName": "Priya Mehta — Product",
            "senderInitials": "PM",
            "subject": "Project Atlas — Daily Update #8",
            "preview": "Day 8: UI review complete, 3 revisions requested by client. iOS sprint started. Android kickoff today.",
            "body": "Project Atlas — Daily Update #8\n\n✅ COMPLETED:\n- UI review with client complete\n- iOS development sprint started\n- Android team kickoff done\n\n🔄 IN PROGRESS:\n- 3 UI revisions requested by client Lisa (Acme)\n- Setting up CI/CD pipeline\n\n📊 Status: ON TRACK\n\nPriya",
            "category": "daily_project_update", "emailType": "daily_project_update",
            "priority": "medium", "priorityScore": 44, "priorityLevel": "medium",
            "confidence": 0.9, "time": "Yesterday",
            "received_at": "2026-06-25T09:00:00Z",
            "senderProfile": {"orgType": "internal", "domain": "company.com", "domainTrust": "trusted", "relationshipStrength": "reporting_manager", "isNewSender": False, "interactionCount": 31, "trustScore": 0.88},
            "entities": {"projectName": "Project Atlas", "attendeeRequested": False},
            "threadGroupKey": "thread_atlas",
        },
        {
            "id": "ta003",
            "sender": "pm@company.com",
            "senderName": "Priya Mehta — Product",
            "senderInitials": "PM",
            "subject": "Project Atlas — Daily Update #7",
            "preview": "Day 7: Architecture review done. Design sprint complete. Dev kickoff Monday.",
            "body": "Project Atlas — Daily Update #7\n\n✅ COMPLETED:\n- Technical architecture review\n- Design sprint completed\n- Resource allocation confirmed\n\n📊 Status: ON TRACK — Dev kickoff Monday\n\nPriya",
            "category": "daily_project_update", "emailType": "daily_project_update",
            "priority": "medium", "priorityScore": 42, "priorityLevel": "medium",
            "confidence": 0.9, "time": "2 days ago",
            "received_at": "2026-06-24T09:00:00Z",
            "senderProfile": {"orgType": "internal", "domain": "company.com", "domainTrust": "trusted", "relationshipStrength": "reporting_manager", "isNewSender": False, "interactionCount": 31, "trustScore": 0.88},
            "entities": {"projectName": "Project Atlas", "attendeeRequested": False},
            "threadGroupKey": "thread_atlas",
        },
    ],

    # ── Project Nova (AI Integration) ──────────────────────
    "thread_nova": [
        {
            "id": "tn001",
            "sender": "qa@company.com",
            "senderName": "QA Team — Mei Lin",
            "senderInitials": "ML",
            "subject": "Project Nova — Daily Update #5",
            "preview": "Day 5: AI model integration tested. 94% accuracy achieved. Deployment blocked — awaiting security clearance.",
            "body": "Project Nova — Daily Update #5\nDate: June 26, 2026\n\n✅ COMPLETED:\n- AI model integration complete\n- Initial accuracy testing: 94% (target: 92%)\n- Load testing passed (500 concurrent users)\n\n🔄 IN PROGRESS:\n- Security audit (Day 2/3)\n- Documentation for compliance team\n\n⚠️ BLOCKER:\n- Deployment blocked pending security clearance from compliance\n  → Compliance team reviewing AI decision-making transparency docs\n  → Estimated clearance: June 28\n\n📊 Status: AT RISK (deployment timeline)\n\nMei Lin\nQA Lead",
            "category": "daily_project_update", "emailType": "daily_project_update",
            "priority": "medium", "priorityScore": 47, "priorityLevel": "medium",
            "confidence": 0.92, "time": "10:00 AM",
            "received_at": "2026-06-26T10:00:00Z",
            "senderProfile": {"orgType": "internal", "domain": "company.com", "domainTrust": "trusted", "relationshipStrength": "reporting_manager", "isNewSender": False, "interactionCount": 15, "trustScore": 0.82},
            "entities": {
                "projectName": "Project Nova",
                "actionItems": ["Follow up on security clearance from compliance team"],
                "riskLevel": "medium",
                "attendeeRequested": False,
            },
            "threadGroupKey": "thread_nova",
        },
        {
            "id": "tn002",
            "sender": "qa@company.com",
            "senderName": "QA Team — Mei Lin",
            "senderInitials": "ML",
            "subject": "Project Nova — Daily Update #4",
            "preview": "Day 4: AI model trained on 50K samples. 91% accuracy in dev. Security audit started.",
            "body": "Project Nova — Daily Update #4\n\n✅ COMPLETED:\n- AI model trained on 50,000 samples\n- Accuracy in dev environment: 91%\n- Security audit initiated\n\n🔄 IN PROGRESS:\n- Integration testing with existing systems\n- Security audit Day 1/3\n\n📊 Status: ON TRACK\n\nMei Lin",
            "category": "daily_project_update", "emailType": "daily_project_update",
            "priority": "medium", "priorityScore": 44, "priorityLevel": "medium",
            "confidence": 0.9, "time": "Yesterday",
            "received_at": "2026-06-25T10:00:00Z",
            "senderProfile": {"orgType": "internal", "domain": "company.com", "domainTrust": "trusted", "relationshipStrength": "reporting_manager", "isNewSender": False, "interactionCount": 15, "trustScore": 0.82},
            "entities": {"projectName": "Project Nova", "attendeeRequested": False},
            "threadGroupKey": "thread_nova",
        },
        {
            "id": "tn003",
            "sender": "qa@company.com",
            "senderName": "QA Team — Mei Lin",
            "senderInitials": "ML",
            "subject": "Project Nova — Daily Update #3",
            "preview": "Day 3: Dataset prep complete (50K samples). Model training begins today. ETA: 48hrs.",
            "body": "Project Nova — Daily Update #3\n\n✅ COMPLETED:\n- Dataset preparation (50,000 labeled samples)\n- Data pipeline validated\n\n🔄 IN PROGRESS:\n- Model training started (ETA: 48 hours)\n- Parallel environment setup\n\n📊 Status: ON TRACK\n\nMei Lin",
            "category": "daily_project_update", "emailType": "daily_project_update",
            "priority": "medium", "priorityScore": 41, "priorityLevel": "medium",
            "confidence": 0.9, "time": "2 days ago",
            "received_at": "2026-06-24T10:00:00Z",
            "senderProfile": {"orgType": "internal", "domain": "company.com", "domainTrust": "trusted", "relationshipStrength": "reporting_manager", "isNewSender": False, "interactionCount": 15, "trustScore": 0.82},
            "entities": {"projectName": "Project Nova", "attendeeRequested": False},
            "threadGroupKey": "thread_nova",
        },
    ],
}

# Thread summaries (executive view — what the AI would produce from all emails in a thread)
THREAD_SUMMARIES = {
    "thread_phoenix": {
        "threadGroupKey": "thread_phoenix",
        "projectName": "Project Phoenix",
        "threadSubjectPattern": "Project Phoenix — Daily Update",
        "emailCount": 3,
        "lastUpdated": "2026-06-26T08:00:00Z",
        "participantList": ["Raj Kumar", "Dev Team", "Priya Mehta", "DevOps"],
        "overallStatus": "on_track",
        "completedItems": [
            "Backend API layer fully implemented (32 endpoints)",
            "Authentication module deployed to staging",
            "API documentation updated",
            "Database schema finalized",
        ],
        "pendingItems": [
            "Frontend integration (60% complete)",
            "Unit test coverage (80% target)",
            "Staging deployment",
        ],
        "blockers": [
            "Database permissions issue — awaiting DevOps (ETA: tomorrow)",
            "Client UI feedback pending since Day 15",
        ],
        "executiveSummary": "Project Phoenix is on track for the June 30 milestone. Backend is complete, frontend integration is at 60%. A database permissions issue is blocking staging deployment — DevOps expects resolution tomorrow. ⚠️ Acme Corp CTO specifically requested your presence at tomorrow's demo at 3 PM.",
        "hasAttendeeRequest": True,
        "attendeeRequestDetails": "Acme Corp CTO David Park specifically requested executive attendance at the demo on June 27 at 3:00 PM (Zoom: zoom.us/j/11223344). Delegates: David Chen or Alex Torres.",
        "priorityLevel": "high",
        "emailIds": ["tp001", "tp002", "tp003"],
    },
    "thread_atlas": {
        "threadGroupKey": "thread_atlas",
        "projectName": "Project Atlas",
        "threadSubjectPattern": "Project Atlas — Daily Update",
        "emailCount": 3,
        "lastUpdated": "2026-06-26T09:00:00Z",
        "participantList": ["Priya Mehta", "iOS Team", "Android Team", "Acme Corp"],
        "overallStatus": "at_risk",
        "completedItems": [
            "UI/UX design approved by stakeholders",
            "iOS development sprint started",
            "Technical architecture review complete",
            "Component library 80% complete",
        ],
        "pendingItems": [
            "Android development (waiting for design handoff)",
            "Backend API integration (2 endpoints remaining)",
            "3 UI revisions requested by client",
        ],
        "blockers": [
            "Android timeline may slip 2 days if design handoff not completed today",
        ],
        "executiveSummary": "Project Atlas is at risk on the Android track. iOS is progressing well. Android needs design handoff today to avoid a 2-day delay to the June 28 Sprint 2 target. Client has requested 3 UI revisions.",
        "hasAttendeeRequest": False,
        "attendeeRequestDetails": None,
        "priorityLevel": "medium",
        "emailIds": ["ta001", "ta002", "ta003"],
    },
    "thread_nova": {
        "threadGroupKey": "thread_nova",
        "projectName": "Project Nova",
        "threadSubjectPattern": "Project Nova — Daily Update",
        "emailCount": 3,
        "lastUpdated": "2026-06-26T10:00:00Z",
        "participantList": ["Mei Lin", "QA Team", "Compliance", "Security"],
        "overallStatus": "at_risk",
        "completedItems": [
            "AI model integration complete",
            "Accuracy testing: 94% (above 92% target)",
            "Load testing passed (500 concurrent users)",
            "Model trained on 50,000 samples",
        ],
        "pendingItems": [
            "Security audit (Day 2/3)",
            "Compliance documentation",
            "Final deployment approval",
        ],
        "blockers": [
            "Deployment blocked pending security clearance — compliance team reviewing AI transparency docs (ETA: June 28)",
        ],
        "executiveSummary": "Project Nova exceeded accuracy targets (94% vs 92% goal) and passed load testing. Deployment is blocked by compliance's security clearance process — expected June 28. No action needed from you unless the deadline needs to move.",
        "hasAttendeeRequest": False,
        "attendeeRequestDetails": None,
        "priorityLevel": "medium",
        "emailIds": ["tn001", "tn002", "tn003"],
    },
}

# All thread emails flattened for list queries
ALL_THREAD_EMAILS = [
    email
    for thread_emails in THREAD_EMAILS.values()
    for email in thread_emails
]


@router.get("")
async def list_emails(
    priority: str | None = None,
    category: str | None = None,
    section: str | None = None,  # urgent_high | medium | low | spam
    include_threads: bool = False,
):
    """
    Return pre-processed emails sorted by priority score.
    Thread group emails are collapsed unless include_threads=True.
    """
    emails = list(MOCK_EMAILS)

    # Add only the most-recent update from each thread to the main list
    # (threads are browsed separately via /threads endpoint)
    if include_threads:
        emails = emails + ALL_THREAD_EMAILS

    # Filter by priority level
    if priority:
        emails = [e for e in emails if e.get("priorityLevel") == priority]

    # Filter by category/emailType
    if category:
        emails = [e for e in emails if e.get("category") == category or e.get("emailType") == category]

    # Filter by inbox section
    if section == "urgent_high":
        emails = [e for e in emails if e.get("priorityLevel") in ("urgent", "high")]
    elif section == "medium":
        emails = [e for e in emails if e.get("priorityLevel") == "medium"]
    elif section == "low":
        emails = [e for e in emails if e.get("priorityLevel") == "low"]
    elif section == "spam":
        emails = [e for e in emails if e.get("priorityLevel") == "spam"]

    # Sort by priority score descending
    emails.sort(key=lambda e: e.get("priorityScore", 0), reverse=True)
    return emails


@router.get("/threads")
async def list_threads():
    """Return all project update thread summaries (executive grouped view)."""
    return list(THREAD_SUMMARIES.values())


@router.get("/threads/{thread_group_key}")
async def get_thread(thread_group_key: str):
    """Return thread summary + all individual emails in a project thread."""
    if thread_group_key not in THREAD_SUMMARIES:
        return {"error": "Thread not found"}
    summary = THREAD_SUMMARIES[thread_group_key]
    emails = THREAD_EMAILS.get(thread_group_key, [])
    return {
        "summary": summary,
        "emails": emails,
    }


@router.get("/{email_id}")
async def get_email(email_id: str):
    """Return a single email by ID (checks both regular and thread emails)."""
    all_emails = MOCK_EMAILS + ALL_THREAD_EMAILS
    for e in all_emails:
        if e["id"] == email_id:
            return e
    return {"error": "Not found"}
