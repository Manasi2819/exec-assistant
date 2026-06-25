"""
FAISS Memory Index
==================
Handles all vector embedding storage and retrieval.
Replaces Qdrant — FAISS only as per final project decisions.

Features:
  - Disk-persisted index (survives restarts)
  - Tenant-scoped retrieval via metadata filtering
  - Used by: Meeting Prep, Transcript dedup, RAG queries
"""
from __future__ import annotations
import json
import os
import uuid
from pathlib import Path
from typing import Any

import numpy as np

from app.core.config import get_settings
from app.core.llm_router import get_embedding_model

# Lazy FAISS import
try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    faiss = None


class FAISSMemoryIndex:
    """
    Tenant-aware FAISS index backed by disk persistence.
    Stores embeddings + metadata (tenant_id, source_type, source_id, text).
    """

    def __init__(self, index_path: str | None = None):
        settings = get_settings()
        self.index_path = Path(index_path or settings.faiss_index_path)
        self.index_path.mkdir(parents=True, exist_ok=True)

        self.index_file = self.index_path / "index.faiss"
        self.meta_file = self.index_path / "metadata.json"

        self._embedding_model = None
        self._index: Any = None
        self._metadata: list[dict[str, Any]] = []
        self._dimension: int = 1536  # text-embedding-3-large default; adjusted at first embed

        self._load_or_create()

    def _load_or_create(self) -> None:
        if not FAISS_AVAILABLE:
            return
        if self.index_file.exists() and self.meta_file.exists():
            self._index = faiss.read_index(str(self.index_file))
            with open(self.meta_file) as f:
                self._metadata = json.load(f)
        else:
            self._index = faiss.IndexFlatL2(self._dimension)
            self._metadata = []

    def _save(self) -> None:
        if not FAISS_AVAILABLE or self._index is None:
            return
        faiss.write_index(self._index, str(self.index_file))
        with open(self.meta_file, "w") as f:
            json.dump(self._metadata, f)

    async def _embed(self, texts: list[str]) -> list[list[float]]:
        if self._embedding_model is None:
            self._embedding_model = get_embedding_model()
        return await self._embedding_model.aembed_documents(texts)

    async def add_documents(
        self,
        texts: list[str],
        metadatas: list[dict[str, Any]],
    ) -> list[str]:
        """Embed and store documents. Returns list of assigned IDs."""
        if not FAISS_AVAILABLE:
            return [str(uuid.uuid4()) for _ in texts]

        embeddings = await self._embed(texts)
        vectors = np.array(embeddings, dtype=np.float32)

        # Reinitialize index if dimension changed
        if self._index.d != vectors.shape[1]:
            self._dimension = vectors.shape[1]
            self._index = faiss.IndexFlatL2(self._dimension)
            self._metadata = []

        doc_ids = []
        for i, (vec, meta) in enumerate(zip(vectors, metadatas)):
            doc_id = str(uuid.uuid4())
            self._index.add(vec.reshape(1, -1))
            self._metadata.append({"id": doc_id, "text": texts[i], **meta})
            doc_ids.append(doc_id)

        self._save()
        return doc_ids

    async def similarity_search(
        self,
        query: str,
        tenant_id: str,
        top_k: int = 5,
        source_type: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Search for similar documents, filtered by tenant_id.
        Returns list of {text, score, metadata} dicts.
        """
        if not FAISS_AVAILABLE or self._index is None or self._index.ntotal == 0:
            return []

        query_embedding = await self._embed([query])
        query_vec = np.array(query_embedding, dtype=np.float32)

        # Search with 2x top_k to allow post-filter by tenant
        search_k = min(top_k * 2, self._index.ntotal)
        distances, indices = self._index.search(query_vec, search_k)

        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < 0 or idx >= len(self._metadata):
                continue
            meta = self._metadata[idx]
            if meta.get("tenant_id") != tenant_id:
                continue
            if source_type and meta.get("source_type") != source_type:
                continue
            results.append({
                "text": meta.get("text", ""),
                "score": float(dist),
                "metadata": {k: v for k, v in meta.items() if k != "text"},
            })
            if len(results) >= top_k:
                break

        return results

    async def delete_by_source(self, source_id: str, tenant_id: str) -> int:
        """Remove all vectors for a given source_id + tenant_id (GDPR deletion)."""
        # FAISS FlatL2 doesn't support in-place deletion; rebuild the index
        if not FAISS_AVAILABLE or self._index is None:
            return 0

        keep_indices = [
            i for i, m in enumerate(self._metadata)
            if not (m.get("source_id") == source_id and m.get("tenant_id") == tenant_id)
        ]
        removed = len(self._metadata) - len(keep_indices)

        if removed > 0:
            kept_meta = [self._metadata[i] for i in keep_indices]
            kept_texts = [m.get("text", "") for m in kept_meta]

            self._metadata = []
            self._index = faiss.IndexFlatL2(self._dimension)

            if kept_texts:
                embeddings = await self._embed(kept_texts)
                vectors = np.array(embeddings, dtype=np.float32)
                self._index.add(vectors)
                self._metadata = kept_meta

            self._save()

        return removed


# ── Singleton instance ────────────────────────────────────────

_faiss_index: FAISSMemoryIndex | None = None


def get_faiss_index() -> FAISSMemoryIndex:
    global _faiss_index
    if _faiss_index is None:
        _faiss_index = FAISSMemoryIndex()
    return _faiss_index


async def store_meeting_brief(
    meeting_id: str,
    tenant_id: str,
    meeting_title: str,
    brief_text: str,
) -> str:
    """Convenience wrapper — stores a meeting brief in FAISS for RAG retrieval."""
    index = get_faiss_index()
    ids = await index.add_documents(
        texts=[brief_text],
        metadatas=[{
            "tenant_id": tenant_id,
            "source_type": "meeting_brief",
            "source_id": meeting_id,
            "meeting_title": meeting_title,
        }],
    )
    return ids[0]


async def store_mom(
    meeting_id: str,
    tenant_id: str,
    meeting_title: str,
    mom_text: str,
) -> str:
    """Convenience wrapper — stores a MoM in FAISS for future meeting prep retrieval."""
    index = get_faiss_index()
    ids = await index.add_documents(
        texts=[mom_text],
        metadatas=[{
            "tenant_id": tenant_id,
            "source_type": "mom",
            "source_id": meeting_id,
            "meeting_title": meeting_title,
        }],
    )
    return ids[0]


async def retrieve_context(
    query: str,
    tenant_id: str,
    top_k: int = 5,
    source_type: str | None = None,
) -> str:
    """
    Retrieves relevant context from FAISS and returns as formatted string.
    Used by Meeting Prep, Reply, and RAG query agents.
    """
    index = get_faiss_index()
    results = await index.similarity_search(
        query=query,
        tenant_id=tenant_id,
        top_k=top_k,
        source_type=source_type,
    )

    if not results:
        return "No relevant prior context found."

    context_parts = []
    for r in results:
        meta = r.get("metadata", {})
        source = meta.get("source_type", "document")
        title = meta.get("meeting_title", "")
        context_parts.append(f"[{source.upper()}] {title}\n{r['text']}")

    return "\n\n---\n\n".join(context_parts)
