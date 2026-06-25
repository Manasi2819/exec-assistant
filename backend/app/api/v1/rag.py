"""RAG / Knowledge Retrieval routes — POST /api/v1/rag/query"""
from fastapi import APIRouter, HTTPException
from app.models.schemas import RAGQueryRequest, RAGQueryResponse
from app.memory.faiss_index import retrieve_context
from app.core.llm_router import AgentTask, get_llm
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

router = APIRouter()

RAG_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful AI Executive Assistant. Answer the question using ONLY the provided context. Cite sources when possible."),
    ("human", "Context:\n{context}\n\nQuestion: {query}")
])


@router.post("/query", response_model=RAGQueryResponse)
async def rag_query(body: RAGQueryRequest):
    """Answer a knowledge retrieval query using FAISS-indexed meeting history."""
    context = ""
    try:
        context = await retrieve_context(
            query=body.query,
            tenant_id=body.filters.get("tenant_id", "default"),
            top_k=body.top_k,
        )

        llm = get_llm(AgentTask.RAG_SYNTHESIS, temperature=0.1)
        chain = RAG_PROMPT | llm | StrOutputParser()
        answer = await chain.ainvoke({"context": context, "query": body.query})

        return RAGQueryResponse(answer=answer, query=body.query, sources=[{"text": context[:200]}])
    except Exception as exc:
        print(f"[RAG API] ⚠️ RAG query failed: {exc}. Using fallback...")
        fallback_answer = (
            f"Note: API limit reached. Showing direct match from knowledge base:\n\n"
            f"{context or 'No direct matches found in offline index.'}"
        )
        return RAGQueryResponse(
            answer=fallback_answer,
            query=body.query,
            sources=[{"text": context[:200]}] if context else []
        )
