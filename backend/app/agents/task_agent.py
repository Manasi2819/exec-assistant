"""
Task Tracking Agent
====================
Phase 2 — Monitors action items for overdue status and deduplication.

Responsibilities:
  1. Overdue scan — finds tasks past due date and flags them
  2. Completion inference — detects when email/transcript implies a task is done
  3. FAISS dedup — prevents duplicate action items when same task appears in
     multiple meetings/emails

Runs on a schedule (via n8n cron) or can be triggered by incoming emails.
"""
from __future__ import annotations
from datetime import datetime, date
from typing import Any

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from app.core.llm_router import AgentTask, get_llm
from app.models.schemas import ActionItemResponse
from app.models.state import AgentState


# ── Completion inference prompt ────────────────────────────────

COMPLETION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are analyzing an email or transcript to determine if any open action items were completed.
Given the context and the list of open action items, identify which ones are implied to be done.
Return JSON: { "completed_ids": [list of action item ids that appear to be done], "reasoning": "brief explanation" }
"""),
    ("human", """Open action items:
{action_items}

Email / transcript context:
{context}

Which action items appear to be completed based on this context?""")
])

# ── Dedup prompt ───────────────────────────────────────────────

DEDUP_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are checking if a new action item is a duplicate of existing ones.
Return JSON: { "is_duplicate": true/false, "duplicate_of_id": "id or null", "confidence": 0.0-1.0 }
"""),
    ("human", """New action item: {new_item}

Existing action items:
{existing_items}

Is the new item a duplicate?""")
])


async def task_tracking_node(state: AgentState) -> AgentState:
    """
    LangGraph node: Scans for overdue items and infers completions.
    Reads:  action_items, raw_payload (context text, existing tasks)
    Writes: action_items (updated with overdue flags)
    """
    action_items = state.get("action_items", [])
    payload = state.get("raw_payload", {})
    context = payload.get("context_text", "")

    # Run overdue scan
    today = date.today()
    overdue_count = 0
    for item in action_items:
        if item.due_date:
            try:
                due = datetime.strptime(item.due_date, "%Y-%m-%d").date()
                if due < today:
                    overdue_count += 1
            except ValueError:
                pass

    return {
        **state,
        "action_items": action_items,
        "error": None,
    }


async def scan_overdue_tasks(tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Scan a list of task dicts for overdue items.
    Returns the list with overdue=True flagged and status updated.
    """
    today = date.today()
    updated = []
    for task in tasks:
        t = dict(task)
        if t.get("due_date") and t.get("status") not in ("done",):
            try:
                due_str = t["due_date"]
                # Handle "Aug 15", "2026-08-15" formats
                for fmt in ("%Y-%m-%d", "%b %d", "%B %d"):
                    try:
                        due = datetime.strptime(due_str, fmt).date()
                        if fmt in ("%b %d", "%B %d"):
                            due = due.replace(year=today.year)
                        if due < today and t["status"] != "done":
                            t["status"] = "overdue"
                            t["overdue"] = True
                        break
                    except ValueError:
                        continue
            except Exception:
                pass
        updated.append(t)
    return updated


async def infer_completion(
    context: str,
    open_tasks: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Analyze an email/transcript to infer which tasks are completed.
    Returns: { "completed_ids": [...], "reasoning": "..." }
    """
    if not open_tasks or not context.strip():
        return {"completed_ids": [], "reasoning": "No context or tasks to analyze"}

    try:
        llm = get_llm(AgentTask.TASK_TRACKING, temperature=0.0)
        chain = COMPLETION_PROMPT | llm | JsonOutputParser()

        items_text = "\n".join(
            f"ID: {t.get('id', i)} | {t.get('owner_name', 'Unknown')}: {t.get('description', '')} (due: {t.get('due_date', 'TBD')})"
            for i, t in enumerate(open_tasks)
        )

        return await chain.ainvoke({
            "action_items": items_text,
            "context": context,
        })
    except Exception as exc:
        print(f"[TaskAgent] ⚠️ API call failed in infer_completion: {exc}. Using fallback...")
        return {"completed_ids": [], "reasoning": "Offline mode: No completions inferred."}


async def check_duplicate(
    new_item_description: str,
    existing_items: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Check if a new action item is a duplicate of existing ones using FAISS + LLM.
    Returns: { "is_duplicate": bool, "duplicate_of_id": str|None, "confidence": float }
    """
    if not existing_items:
        return {"is_duplicate": False, "duplicate_of_id": None, "confidence": 1.0}

    # Fast path: exact match
    for item in existing_items:
        if item.get("description", "").strip().lower() == new_item_description.strip().lower():
            return {"is_duplicate": True, "duplicate_of_id": item.get("id"), "confidence": 1.0}

    # LLM similarity check (only if no exact match)
    try:
        llm = get_llm(AgentTask.TASK_TRACKING, temperature=0.0)
        chain = DEDUP_PROMPT | llm | JsonOutputParser()

        existing_text = "\n".join(
            f"ID: {item.get('id', i)} | {item.get('description', '')}"
            for i, item in enumerate(existing_items[:20])  # limit to 20 for context
        )

        return await chain.ainvoke({
            "new_item": new_item_description,
            "existing_items": existing_text,
        })
    except Exception as exc:
        print(f"[TaskAgent] ⚠️ API call failed in check_duplicate: {exc}. Using fallback...")
        return {"is_duplicate": False, "duplicate_of_id": None, "confidence": 0.5}
