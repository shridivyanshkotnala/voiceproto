export const RETRIEVAL_CONFIG = {
  MIN_SIMILARITY_SCORE: Number(process.env.MIN_SIMILARITY_SCORE || 0.3),
  RAG_TOP_K: Number(process.env.RAG_TOP_K || 30),
  RAG_RERANK_LIMIT: Number(process.env.RAG_RERANK_LIMIT || 5),
  RAG_FINAL_CONTEXT_LIMIT: Number(process.env.RAG_FINAL_CONTEXT_LIMIT || 5),
  TOP_K_RESULTS: Number(process.env.RETRIEVAL_TOP_K_RESULTS || process.env.RAG_TOP_K || 30),
  FINAL_CONTEXT_CHUNKS: Number(
    process.env.RETRIEVAL_FINAL_CONTEXT_CHUNKS || process.env.RAG_FINAL_CONTEXT_LIMIT || 5,
  ),
  HYBRID_VECTOR_TOP_K: Number(process.env.RETRIEVAL_HYBRID_VECTOR_TOP_K || process.env.RAG_TOP_K || 30),
  HYBRID_KEYWORD_TOP_K: Number(process.env.RETRIEVAL_HYBRID_KEYWORD_TOP_K || process.env.RAG_TOP_K || 30),
  HYBRID_CANDIDATE_POOL: Number(
    process.env.RETRIEVAL_HYBRID_CANDIDATE_POOL || process.env.RAG_TOP_K || 30,
  ),
  RERANK_KEEP_TOP: Number(process.env.RETRIEVAL_RERANK_KEEP_TOP || process.env.RAG_RERANK_LIMIT || 5),
  CONTEXT_MAX_SENTENCES: Number(process.env.RETRIEVAL_CONTEXT_MAX_SENTENCES || 18),
  CONTEXT_MAX_CHARS: Number(process.env.RETRIEVAL_CONTEXT_MAX_CHARS || 5000),
  CONTEXT_MAX_TOKENS: Number(process.env.RETRIEVAL_CONTEXT_MAX_TOKENS || 500),
  TOKEN_BUDGET: {
    total: Number(process.env.RAG_TOTAL_TOKEN_BUDGET || 2500),
    systemPrompt: Number(process.env.RAG_SYSTEM_PROMPT_BUDGET || 500),
    userQuery: Number(process.env.RAG_USER_QUERY_BUDGET || 150),
    response: Number(process.env.RAG_RESPONSE_BUDGET || 350),
    maxContext: Number(process.env.RAG_MAX_CONTEXT_BUDGET || 500),
  },
  CONTEXT_RANK_WEIGHTS: {
    vector: 0.5,
    rerank: 0.3,
    keyword: 0.2,
  },
  OPTIMIZER: {
    MAX_SENTENCES_PER_CHUNK: Number(process.env.RETRIEVAL_MAX_SENTENCES_PER_CHUNK || 4),
  },
  RERANK_WEIGHTS: {
    semantic: Number(process.env.RETRIEVAL_WEIGHT_SEMANTIC || 0.55),
    keyword: Number(process.env.RETRIEVAL_WEIGHT_KEYWORD || 0.25),
    domain: Number(process.env.RETRIEVAL_WEIGHT_DOMAIN || 0.2),
  },
}
