# RAG Regression Analysis

Generated: 2026-06-06
Sample audit mode: code-path + synthetic checks + existing benchmark reports.

## Regression Drivers

1. **Transcript quality degradation**
   - Capture regressions produced partial/weak transcripts.
   - Retrieval quality is highly sensitive to STT transcript completeness.

2. **Strict retrieval filter default**
   - `MIN_SIMILARITY_SCORE` default was 0.5, suppressing otherwise useful candidates on noisy transcript variants.

3. **Context narrowing side-effect**
   - Final context limit at 3 increased miss risk under lexical drift.

## Corrective Tuning Applied

- `MIN_SIMILARITY_SCORE`: 0.5 -> 0.3
- `RAG_FINAL_CONTEXT_LIMIT`: 3 -> 5
- `FINAL_CONTEXT_CHUNKS` fallback aligned to 5

## 50-Query Regression Audit Framework

For each query, capture:

- original transcript
- normalized query
- embedding query
- retrieved candidates count
- reranked candidates count
- compressed/final chunks count
- final prompt context
- retrieval score

## Expected Recovery Pattern

- Fewer false fallbacks (`verified information nahi mili`).
- Improved average retrieval score due to reduced over-filtering.
- Better relevance consistency when STT transcript variance occurs.

## Remaining Risks

- Extremely noisy STT still degrades retrieval.
- Overly permissive similarity threshold may increase low-quality context ingress; monitor hallucination safeguards.
