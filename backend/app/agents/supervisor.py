"""
LangGraph Supervisor
=====================
Central orchestration graph for all agents.

Graph topology:
  START
    → supervisor_router         (decide which pipeline to run)
    → [email_classification]    (if trigger=email)
    → [intent_extraction]
    → [calendar_processing]     (if meeting_request)
    → [meeting_prep]            (if meeting event upcoming)
    → [reply_draft]             (if email needs response)
    → [transcript_extraction]   (if transcript_ready)
    → [mom_generation]          (after transcript)
    → [followup_generation]     (after MoM approved)
    → [task_tracking]           (runs on schedule)
    → [notification]            (always last)
    → human_approval_gate       (interrupt_before — pauses for human input)
    → END

State is checkpointed to PostgreSQL after every node via PostgresSaver,
enabling multi-day paused workflows (e.g., draft awaiting approval).
"""
from __future__ import annotations
from typing import Literal

from langgraph.graph import StateGraph, END, START

from app.models.state import AgentState
from app.agents.email_agent import email_classification_node
from app.agents.intent_agent import intent_extraction_node
from app.agents.calendar_agent import calendar_processing_node
from app.agents.meeting_prep_agent import meeting_prep_node
from app.agents.reply_agent import reply_draft_node
from app.agents.transcript_agent import transcript_extraction_node
from app.agents.mom_agent import mom_generation_node
from app.agents.followup_agent import followup_generation_node
from app.agents.task_agent import task_tracking_node
from app.agents.notification_agent import notification_node
from app.core.config import get_settings
from app.core.llm_router import AgentTask, get_llm
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser


# ─────────────────────────────────────────────────────────────
# Router node — decides which path(s) to execute
# ─────────────────────────────────────────────────────────────

def supervisor_router(state: AgentState) -> Literal[
    "email_classification", "transcript_extraction", "task_tracking", "rag_query", "notification"
]:
    """Route based on trigger_type in state."""
    trigger = state.get("trigger_type", "email")

    if trigger == "email":
        return "email_classification"
    elif trigger == "transcript_ready":
        return "transcript_extraction"
    elif trigger == "scheduled_reminder":
        return "task_tracking"
    elif trigger == "user_query":
        return "rag_query"
    else:
        return "notification"


def post_email_router(state: AgentState) -> Literal[
    "intent_extraction", "notification"
]:
    """After email classification, decide if we need intent extraction."""
    if state.get("error"):
        return "notification"
    category = state.get("email_category", "fyi")
    if category in ("meeting_request", "action_required", "follow_up", "approval_request"):
        return "intent_extraction"
    return "notification"


def post_intent_router(state: AgentState) -> Literal[
    "calendar_processing", "reply_draft_agent", "notification"
]:
    """After intent extraction, route to calendar or reply."""
    if state.get("error"):
        return "notification"
    intent = state.get("intent")
    if intent and intent.type == "meeting_request":
        return "calendar_processing"
    return "reply_draft_agent"


def post_calendar_router(state: AgentState) -> Literal[
    "reply_draft_agent", "notification"
]:
    """After calendar, always also draft a reply confirming the meeting."""
    if state.get("error"):
        return "notification"
    return "reply_draft_agent"


def post_transcript_router(state: AgentState) -> Literal[
    "mom_generation", "notification"
]:
    if state.get("error"):
        return "notification"
    return "mom_generation"


def post_mom_router(state: AgentState) -> Literal[
    "human_approval_gate", "notification"
]:
    """MoM always goes to human approval gate before follow-up."""
    if state.get("error"):
        return "notification"
    return "human_approval_gate"


def post_approval_router(state: AgentState) -> Literal[
    "followup_generation", "notification"
]:
    """After human approves MoM, generate follow-up."""
    if state.get("approval_status") == "approved":
        return "followup_generation"
    return "notification"


async def human_approval_gate(state: AgentState) -> AgentState:
    """
    Pause node — LangGraph will interrupt BEFORE this node
    when configured with interrupt_before=["human_approval_gate"].
    The graph resumes when the API calls graph.update_state() with
    the human's decision (approve/edit/reject).
    """
    return state  # Pass-through; interruption is handled by LangGraph runtime


# ── RAG / user_query node ─────────────────────────────────────

RAG_QUERY_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "You are an AI Executive Assistant. Answer the question concisely and helpfully. "
               "If you have no specific context, provide a general helpful response."),
    ("human", "{query}")
])


async def rag_query_node(state: AgentState) -> AgentState:
    """
    LangGraph node: Handles user_query trigger.
    Runs the query through Gemini and stores reply in reply_draft.
    """
    payload = state.get("raw_payload", {})
    query = payload.get("query", "")

    try:
        # Try FAISS retrieval first
        rag_context = ""
        try:
            from app.memory.faiss_index import retrieve_context
            rag_context = await retrieve_context(
                query=query,
                tenant_id=state.get("tenant_id", "default"),
                top_k=3,
            )
        except Exception:
            pass  # No FAISS data yet — proceed without context

        from app.models.schemas import ReplyDraftResponse
        import uuid as _uuid
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import StrOutputParser

        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an AI Executive Assistant. Answer the question concisely and helpfully."
                       "\n\nContext from knowledge base:\n{context}"),
            ("human", "{query}")
        ])

        try:
            llm = get_llm(AgentTask.RAG_SYNTHESIS, temperature=0.1)
            chain = prompt | llm | StrOutputParser()
            answer = await chain.ainvoke({
                "query": query,
                "context": rag_context or "No prior context available.",
            })
            confidence = 0.85
        except Exception as exc:
            print(f"[SupervisorAgent Node] ⚠️ API call failed: {exc}. Using fallback...")
            answer = (
                f"Note: API limit reached. Direct search result:\n\n"
                f"{rag_context or 'No direct matches found in offline index for: ' + query}"
            )
            confidence = 0.5

        draft = ReplyDraftResponse(
            draft_id=str(_uuid.uuid4()),
            subject=f"Re: {query[:60]}",
            body=answer.strip(),
            confidence=confidence,
            approval_status="pending",
        )

        return {**state, "reply_draft": draft, "rag_context": rag_context, "error": None}

    except Exception as exc:
        print(f"[SupervisorAgent Node] ⚠️ Outer error: {exc}")
        return {**state, "error": f"RAG query failed: {exc}"}


# ─────────────────────────────────────────────────────────────
# Build the graph
# ─────────────────────────────────────────────────────────────

def build_supervisor_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    # Add all nodes
    graph.add_node("email_classification", email_classification_node)
    graph.add_node("intent_extraction", intent_extraction_node)
    graph.add_node("calendar_processing", calendar_processing_node)
    graph.add_node("meeting_prep", meeting_prep_node)
    graph.add_node("reply_draft_agent", reply_draft_node)   # renamed: avoids clash with state key
    graph.add_node("transcript_extraction", transcript_extraction_node)
    graph.add_node("mom_generation", mom_generation_node)
    graph.add_node("human_approval_gate", human_approval_gate)
    graph.add_node("followup_generation", followup_generation_node)
    graph.add_node("task_tracking", task_tracking_node)
    graph.add_node("notification", notification_node)
    graph.add_node("rag_query", rag_query_node)

    # Entry — supervisor_router is a conditional-edge function, NOT a node
    graph.add_conditional_edges(START, supervisor_router)

    # Routing edges
    graph.add_conditional_edges("email_classification", post_email_router)
    graph.add_conditional_edges("intent_extraction", post_intent_router)
    graph.add_conditional_edges("calendar_processing", post_calendar_router)
    graph.add_conditional_edges("transcript_extraction", post_transcript_router)
    graph.add_conditional_edges("mom_generation", post_mom_router)
    graph.add_conditional_edges("human_approval_gate", post_approval_router)

    # Linear edges
    graph.add_edge("reply_draft_agent", "notification")
    graph.add_edge("meeting_prep", "notification")
    graph.add_edge("followup_generation", "notification")
    graph.add_edge("task_tracking", "notification")
    graph.add_edge("rag_query", "notification")
    graph.add_edge("notification", END)

    return graph


# ─────────────────────────────────────────────────────────────
# Compiled graph singleton — initialized at startup
# ─────────────────────────────────────────────────────────────

_compiled_graph = None


async def get_compiled_graph():
    """
    Returns the compiled LangGraph with PostgresSaver checkpointing.
    Human-in-the-loop pauses are configured via interrupt_before.
    """
    global _compiled_graph
    if _compiled_graph is not None:
        return _compiled_graph

    settings = get_settings()
    graph = build_supervisor_graph()

    try:
        # Phase 2: real PostgreSQL checkpointing
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
        saver = await AsyncPostgresSaver.from_conn_string(
            settings.database_url_sync
        )
        await saver.setup()
        _compiled_graph = graph.compile(
            checkpointer=saver,
            interrupt_before=["human_approval_gate"],
        )
    except Exception:
        # Fallback: in-memory checkpointing (dev mode without DB)
        from langgraph.checkpoint.memory import MemorySaver
        _compiled_graph = graph.compile(
            checkpointer=MemorySaver(),
            interrupt_before=["human_approval_gate"],
        )

    return _compiled_graph


async def run_pipeline(trigger_type: str, payload: dict, thread_id: str | None = None) -> AgentState:
    """
    Run the full agent pipeline for a given trigger.
    Returns the final state after all nodes complete.

    thread_id: Unique conversation/workflow ID for checkpointing.
                Same thread_id resumes a paused workflow.
    """
    import uuid as _uuid
    graph = await get_compiled_graph()

    initial_state: AgentState = {
        "trigger_type": trigger_type,
        "raw_payload": payload,
        "trace_id": str(_uuid.uuid4()),
        "tenant_id": payload.get("tenant_id", "default"),
        "user_id": payload.get("user_id", ""),
        "action_items": [],
        "requires_human_approval": False,
        "retry_count": 0,
    }

    config = {"configurable": {"thread_id": thread_id or str(_uuid.uuid4())}}

    final_state = await graph.ainvoke(initial_state, config=config)
    return final_state


async def resume_pipeline(thread_id: str, human_decision: dict) -> AgentState:
    """
    Resume a paused pipeline after human approval/rejection.
    human_decision: {"approval_status": "approved"|"rejected"|"edited", "edited_body": "..."}
    """
    graph = await get_compiled_graph()
    config = {"configurable": {"thread_id": thread_id}}

    # Update state with human's decision
    await graph.update_state(
        config,
        {"approval_status": human_decision.get("approval_status", "approved"),
         "reply_draft": human_decision.get("reply_draft_update")},
    )

    # Resume execution
    final_state = await graph.ainvoke(None, config=config)
    return final_state
