# Executive AI Assistant

AI-powered executive assistant — email intelligence, calendar, meeting prep, transcripts, and more.

## Quickstart (Local — runs entirely on your laptop)

### 1. Copy and fill in your API key

```bash
copy .env.example .env
```

Open `.env` and set **at least one** of:
- `OPENAI_API_KEY=sk-...` (paid, highest accuracy)
- `GOOGLE_API_KEY=AIza...` (free via [Google AI Studio](https://aistudio.google.com/app/apikey))

### 2. Start everything with Docker

```bash
docker-compose up --build
```

| Service | URL |
|---|---|
| **Frontend** (Next.js) | http://localhost:3000 |
| **Backend API** (FastAPI) | http://localhost:8000 |
| **API Docs** (Swagger) | http://localhost:8000/api/v1/docs |
| **n8n Workflows** | http://localhost:5678 (admin / admin123) |

### 3. Test the agents directly

**Email Intelligence + Entity Extraction:**
```bash
curl -X POST http://localhost:8000/api/v1/agents/email/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "message_id": "test-001",
    "thread_id": "thread-001",
    "sender": "james@company.com",
    "recipients": ["utkarsh@company.com"],
    "subject": "Q3 Dashboard Review",
    "body": "Can we discuss the Q3 performance dashboard tomorrow at 3 PM? Please review the attached metrics before the meeting.",
    "received_at": "2026-06-24T09:00:00Z",
    "source": "gmail"
  }'
```

**Meeting Preparation Brief:**
```bash
curl -X POST http://localhost:8000/api/v1/agents/meeting-prep/generate \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_title": "Q3 Dashboard Review",
    "participants": ["James", "Ken", "Utkarsh"],
    "meeting_datetime": "2026-06-25T15:00:00Z",
    "calendar_description": "Quarterly performance review"
  }'
```

**Transcript Extraction:**
```bash
curl -X POST http://localhost:8000/api/v1/agents/transcript/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id": "m1",
    "transcript_text": "James: We need to fix the revenue KPI by next week. Utkarsh: I will update the dashboard. Due August 15th. Ken: I will validate the metrics. Due August 12th.",
    "source": "teams",
    "participants": ["James", "Ken", "Utkarsh"]
  }'
```

## Architecture

```
Gmail / Outlook Webhook
        ↓
   Email Agent (classify)
        ↓
  Intent Agent (extract)
        ↓
 ┌──────┬──────┬──────┐
Calendar Reply  Task
 Agent   Agent  Agent
        ↓
 Meeting Prep Agent (FAISS RAG)
        ↓
  Transcript Agent (Teams/Zoom/Meet)
        ↓
    MoM Agent → Follow-Up Agent
```

## Tech Stack

- **Frontend**: React + Next.js 14 + Tailwind CSS
- **Backend**: FastAPI + Python 3.11
- **Agents**: LangGraph + LangChain
- **LLMs**: OpenAI GPT-5/GPT-4.1 (paid) or Google Gemini 2.5 Pro/Flash (free)
- **Memory**: PostgreSQL + Redis + FAISS (vector)
- **Workflows**: n8n
- **Integrations**: Gmail, Outlook, Google Calendar, Teams, Slack, Zoom
- **Deployment**: Docker + Docker Compose (local laptop)

## Project Structure

```
exec-assistant/
├── frontend/          # Next.js 14 app (6 screens)
├── backend/           # FastAPI + LangGraph agents
│   └── app/
│       ├── agents/    # 5 Phase 1 priority agents
│       ├── memory/    # FAISS vector index
│       ├── api/v1/    # All REST endpoints
│       └── core/      # Config, LLM router, security
├── docker-compose.yml
└── .env.example
```
