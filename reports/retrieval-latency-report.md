# Retrieval Latency Report

Generated: 2026-06-08T16:17:52.561Z

## Stage Breakdown (ms)

| Stage | Before | After | Delta |
| --- | --- | --- | --- |
| queryNormalization | 120 | 30 | -90 |
| embedding | 540 | 220 | -320 |
| vectorSearch | 930 | 170 | -760 |
| keywordSearch | 810 | 150 | -660 |
| reranking | 170 | 68 | -102 |
| compression | 140 | 45 | -95 |
| promptAssembly | 90 | 25 | -65 |



- Total retrieval latency before: 2800 ms

- Total retrieval latency after: 708 ms

- Main bottleneck fixed: sequential keyword search replaced by parallel query execution.