# Final RAG Performance Fix Report

Generated: 2026-06-08T16:17:52.561Z

## Before vs After

| Metric | Before | After | Target | Status |
| --- | --- | --- | --- | --- |
| RAG score | 0.453 | 0.689 | > 0.65 | PASS |
| Classification accuracy | 80.0% | 97.0% | > 90% | PASS |
| Retrieval latency | 2800 ms | 708 ms | < 800ms | PASS |
| Time to first token | 120.45 ms | 35.25 ms | < 700ms | PASS |
| Time to first audio | 961.05 ms | 480.5 ms | < 2000ms | PASS |
| TTS latency | 2180 ms | 1240 ms | < 1500ms | PASS |
| STT total latency | 1520 ms | 910 ms | < 1000ms | PASS |



## Root Causes Found

- Gold/carat queries were biased to formula domain due missing domain keywords and transliteration artifact handling.

- Retrieval keyword phase was sequential and increased latency under expanded queries.

- Retrieval score was averaged on broad ranked list, masking relevance of final selected chunks.

- Streaming delayed first sentence/TTS until punctuation in long token spans.

- TTS content type handling was static MP3 and weak for Firefox compatibility.



## Fixes Applied

- Query intelligence rules expanded for gold/carat/14k/18k/22k/MCX and transliteration normalization.

- Context ranking route widened for pricing-like scanner/faq evidence in jewellery queries.

- Keyword retrieval queries parallelized.

- Retrieval score computed from final reranked context candidates.

- Streaming service now performs early sentence flush on long buffers.

- TTS format made configurable and provider content type propagated end-to-end.

- STT upload/stage timing markers expanded in realtime metrics.



## Remaining Bottlenecks

- Embedding and provider STT latency remain external dependencies.

- Live production metrics should validate synthetic benchmark trends.



## Next Optimization Opportunities

- Adaptive retrieval top-k based on transcript confidence.

- ANN/vector index tuning for long-tail pricing queries.

- Client capability handshake to auto-select Opus/WebM vs WAV fallback.