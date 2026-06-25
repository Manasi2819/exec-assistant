"""Action Items, Emails, Meetings, RAG stub routes."""
from fastapi import APIRouter
from app.models.schemas import ActionItemCreate, ActionItemResponse, RAGQueryRequest, RAGQueryResponse
from app.memory.faiss_index import retrieve_context
import uuid
from datetime import datetime

# ── Action Items ───────────────────────────────────────────────
router = APIRouter()

_action_items: dict[str, dict] = {}

@router.get("", response_model=list[ActionItemResponse])
async def list_action_items(status: str | None = None, owner: str | None = None):
    items = list(_action_items.values())
    if status:
        items = [i for i in items if i["status"] == status]
    if owner:
        items = [i for i in items if owner.lower() in i["owner_name"].lower()]
    return items

@router.post("", response_model=ActionItemResponse)
async def create_action_item(body: ActionItemCreate):
    item_id = str(uuid.uuid4())
    item = ActionItemResponse(
        id=item_id,
        description=body.description,
        owner_name=body.owner_name,
        due_date=body.due_date,
        status="pending",
        priority=body.priority,
        source_meeting_id=body.source_meeting_id,
        source_email_id=body.source_email_id,
        created_at=datetime.utcnow(),
    )
    _action_items[item_id] = item.model_dump()
    return item

@router.get("/overdue", response_model=list[ActionItemResponse])
async def get_overdue():
    return [i for i in _action_items.values() if i["status"] == "overdue"]
