# Response Generation Audit

Generated: 2026-06-08
Scope: Prompt assembly, context utilization, token economics, and output quality coupling.

## Architecture Snapshot

- Generation model: `gpt-4o-mini` (default) or `REALTIME_OPENAI_MODEL` override.
- Non-realtime path: JSON-formatted full completion.
- Realtime path: streamed text tokens.
- Prompt includes query, last 5 turns, language profile, retrieved context, retrieval metadata.

## Measured Prompt/Context Signals

From optimization benchmark artifacts:

| Metric | Before | Current |
| --- | ---: | ---: |
| averagePromptTokens | 2389.1 | 1244.4 |
| averageContextTokens | high (pre-optimization) | below 500 target (PASS) |
| averageOutputTokens | not explicitly logged in benchmark artifacts | instrumentation gap |

Additional context reduction:
- Average context chars: 869 → 629 (27.62% reduction)
- Compression benchmark profile: context compression ratio 0.056 in synthetic optimization test.

## Prompt Assembly Latency

Reported stage (retrieval latency report):
- prompt assembly: 90ms → 25ms

## Chunk Utilization

- Final context chunks expanded to 5 in regression recovery tune.
- Rerank + optimize pipeline improves relevance but still allows low-signal context in long-tail ops/report queries.

## Identified Waste Sources

1. Metadata verbosity in prompt payload (`Retrieval Metadata` JSON and profile JSON) even when low utility.
2. History payload fixed at last 5 turns, regardless of query complexity.
3. `NO_CONTEXT` path still sends large prompt scaffolding with little grounding.
4. Non-realtime path delays TTS until full model output available.

## Response Quality Weaknesses

1. Hallucination rate remains elevated (20%).
2. Formula and operations domains have lower grounded accuracy.
3. Weak retrieval contexts propagate directly to generation quality.

## Token Usage Assessment

- Prompt token usage improved significantly.
- Output token averages are not consistently persisted in existing benchmark artifacts.
- Cost tracking exists via usage records, but no centralized quality-cost efficiency dashbo
## Identified Waste Sources

1. Metadata verbosity in prompt payload (`Retrieval Metadata` JSON and profile JSON) even when low utility.
2. History payload fixed at last 5 turns, regardless of query complexity.
3. `NO_CONTEXT` path still sends large prompt scaffolding with little grounding.
4. Non-realtime path delays TTS until full model output available.ard is present in current reports.

## Conclusion

Response generation is substantially leaner than prior versions, but quality is still constrained by upstream retrieval misses and unnecessary prompt scaffolding under low-context scenarios.
