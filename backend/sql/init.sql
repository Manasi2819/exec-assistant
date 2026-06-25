-- ============================================================
-- Executive AI Assistant — PostgreSQL Init Script
-- Runs automatically on first `docker-compose up`
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for text similarity search

-- ── Schema for n8n (separate from app tables) ────────────────
CREATE SCHEMA IF NOT EXISTS n8n;

-- ============================================================
-- Core Tables
-- ============================================================

-- Tenants (multi-tenant support)
CREATE TABLE IF NOT EXISTS tenants (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    plan        TEXT DEFAULT 'free',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email       TEXT UNIQUE NOT NULL,
    name        TEXT,
    role        TEXT DEFAULT 'user',    -- user | admin
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- OAuth tokens (stored encrypted in production)
CREATE TABLE IF NOT EXISTS oauth_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,      -- gmail | outlook | google_calendar | teams | zoom | slack
    access_token    TEXT NOT NULL,
    refresh_token   TEXT,
    expires_at      TIMESTAMPTZ,
    scope           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, provider)
);

-- Emails
CREATE TABLE IF NOT EXISTS emails (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID REFERENCES tenants(id),
    user_id         UUID REFERENCES users(id),
    external_id     TEXT NOT NULL,          -- Gmail message ID / MS Graph message ID
    thread_id       TEXT,
    source          TEXT NOT NULL,          -- gmail | outlook
    sender          TEXT NOT NULL,
    recipients      JSONB DEFAULT '[]',
    subject         TEXT NOT NULL,
    body            TEXT,
    received_at     TIMESTAMPTZ,
    category        TEXT,                   -- meeting_request | follow_up | action_required | fyi | escalation | approval_request
    priority        TEXT DEFAULT 'normal',  -- low | normal | high | urgent
    confidence      FLOAT,
    intent          JSONB,                  -- ExtractedIntent JSON
    processed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, external_id)
);

-- Meetings / Calendar events
CREATE TABLE IF NOT EXISTS meetings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID REFERENCES tenants(id),
    user_id         UUID REFERENCES users(id),
    external_id     TEXT,                   -- Google Calendar event ID / Outlook event ID
    source          TEXT,                   -- google | outlook | teams
    title           TEXT NOT NULL,
    description     TEXT,
    start_time      TIMESTAMPTZ,
    end_time        TIMESTAMPTZ,
    participants    JSONB DEFAULT '[]',
    meeting_url     TEXT,                   -- Teams/Zoom join URL
    brief_status    TEXT DEFAULT 'pending', -- pending | ready | sent
    transcript_status TEXT DEFAULT 'none', -- none | received | processed
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Meeting Briefs
CREATE TABLE IF NOT EXISTS meeting_briefs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id      UUID REFERENCES meetings(id) ON DELETE CASCADE,
    tenant_id       UUID REFERENCES tenants(id),
    purpose         TEXT,
    important_topics JSONB DEFAULT '[]',
    previous_decisions JSONB DEFAULT '[]',
    potential_questions JSONB DEFAULT '[]',
    recommended_preparation JSONB DEFAULT '[]',
    generated_at    TIMESTAMPTZ DEFAULT NOW(),
    sent_at         TIMESTAMPTZ
);

-- Minutes of Meeting
CREATE TABLE IF NOT EXISTS minutes_of_meeting (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id      UUID REFERENCES meetings(id) ON DELETE CASCADE,
    tenant_id       UUID REFERENCES tenants(id),
    attendees       JSONB DEFAULT '[]',
    discussion_summary TEXT,
    decisions       JSONB DEFAULT '[]',
    action_items    JSONB DEFAULT '[]',
    approval_status TEXT DEFAULT 'pending',  -- pending | approved | sent
    approved_by     UUID REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Action Items
CREATE TABLE IF NOT EXISTS action_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID REFERENCES tenants(id),
    source_meeting_id UUID REFERENCES meetings(id),
    source_email_id UUID REFERENCES emails(id),
    source_mom_id   UUID REFERENCES minutes_of_meeting(id),
    description     TEXT NOT NULL,
    owner_name      TEXT NOT NULL,
    owner_email     TEXT,
    due_date        DATE,
    status          TEXT DEFAULT 'pending',  -- pending | in_progress | done | blocked | overdue
    priority        TEXT DEFAULT 'normal',
    faiss_vector_id TEXT,                    -- FAISS index ID for dedup
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Email Reply Drafts
CREATE TABLE IF NOT EXISTS reply_drafts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID REFERENCES tenants(id),
    email_id        UUID REFERENCES emails(id),
    subject         TEXT,
    body            TEXT,
    confidence      FLOAT,
    approval_status TEXT DEFAULT 'pending',  -- pending | approved | rejected | edited
    approved_by     UUID REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow Checkpoints (LangGraph PostgresSaver)
-- LangGraph manages this table automatically via PostgresSaver.setup()
-- It's listed here for reference only.
-- CREATE TABLE IF NOT EXISTS checkpoints (...);  -- managed by LangGraph

-- Agent Run Log
CREATE TABLE IF NOT EXISTS agent_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID REFERENCES tenants(id),
    thread_id       TEXT,
    trigger_type    TEXT,
    status          TEXT DEFAULT 'running',  -- running | completed | failed | awaiting_approval
    error           TEXT,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

-- ============================================================
-- Row-Level Security (multi-tenant isolation)
-- ============================================================

ALTER TABLE emails          ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_briefs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE minutes_of_meeting ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_drafts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs      ENABLE ROW LEVEL SECURITY;

-- Policy: app code sets "app.current_tenant_id" at session level
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_emails') THEN
        CREATE POLICY tenant_isolation_emails ON emails
            USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_meetings') THEN
        CREATE POLICY tenant_isolation_meetings ON meetings
            USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_action_items') THEN
        CREATE POLICY tenant_isolation_action_items ON action_items
            USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_drafts') THEN
        CREATE POLICY tenant_isolation_drafts ON reply_drafts
            USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_moms') THEN
        CREATE POLICY tenant_isolation_moms ON minutes_of_meeting
            USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
    END IF;
END $$;

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_emails_tenant_category ON emails(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_emails_received ON emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_tenant_start ON meetings(tenant_id, start_time);
CREATE INDEX IF NOT EXISTS idx_action_items_tenant_status ON action_items(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_action_items_due ON action_items(due_date);
CREATE INDEX IF NOT EXISTS idx_agent_runs_thread ON agent_runs(thread_id);

-- ============================================================
-- Default dev tenant (for local testing without auth)
-- ============================================================

INSERT INTO tenants (id, name, plan) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Default Dev Tenant', 'enterprise')
ON CONFLICT DO NOTHING;

INSERT INTO users (id, tenant_id, email, name, role) VALUES
    ('00000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000001',
     'user@execai.dev', 'Dev User', 'admin')
ON CONFLICT DO NOTHING;
