# Bottleneck Ranking

Generated: 2026-06-08
Goal: Rank bottlenecks by user-perceived latency and answer quality impact.

## Ranked Bottlenecks

### #1 TTS First-Audio Path
- Current latency: ~1240ms (avg)
- Expected latency: ~700ms
- Savings: ~540ms
- Root cause: sentence-triggered request startup + provider/network variance + playback buffering
- Fix complexity: Medium
- Expected gain: High

### #2 STT Segment
- Current latency: ~910ms (avg)
- Expected latency: ~550ms
- Savings: ~360ms
- Root cause: full-utterance batching, disk staging, conversion overhead
- Fix complexity: Medium-High
- Expected gain: High

### #3 Retrieval Stack
- Current latency: ~708ms (avg)
- Expected latency: ~450ms
- Savings: ~258ms
- Root cause: embedding dependency + multi-stage retrieval/rerank/compress pipeline
- Fix complexity: Medium
- Expected gain: High

### #4 Recording/Silence Gating
- Current latency: ~700ms (avg estimated)
- Expected latency: ~350ms
- Savings: ~350ms
- Root cause: conservative silence cutoff and minimum speech-frame policy
- Fix complexity: Medium
- Expected gain: Medium-High

### #5 WebRTC/Playback Buffering Variability
- Current latency: ~180–420ms overhead band
- Expected latency: ~80–180ms
- Savings: ~120ms typical
- Root cause: queue pressure, codec fallback mode, missing adaptive transport tuning
- Fix complexity: Medium
- Expected gain: Medium

### #6 GPT Sentence Segmentation Coupling
- Current latency: ~70.5ms to first sentence (stream-level), larger impact downstream
- Expected latency: ~40ms equivalent boundary latency
- Savings: ~30ms direct (+indirect TTS kickoff benefit)
- Root cause: punctuation/flush dependency and sentence chunking boundaries
- Fix complexity: Low-Medium
- Expected gain: Medium (indirect)

### #7 RAG Long-Tail Quality Gaps
- Current quality impact: hallucination rate 20%, formula accuracy 50%
- Expected: hallucination <8%, formula >80%
- Root cause: taxonomy/classification misses in operations/reporting domains
- Fix complexity: Medium
- Expected gain: Very High quality uplift

## Consolidated Opportunity Table

| Bottleneck | Current | Expected | Gain | Complexity |
| --- | ---: | ---: | ---: | --- |
| TTS | 1240ms | 700ms | 540ms | Medium |
| STT | 910ms | 550ms | 360ms | Med-High |
| Retrieval | 708ms | 450ms | 258ms | Medium |
| Recording gate | 700ms | 350ms | 350ms | Medium |
| Transport/buffer | 300ms band | 130ms band | 120–170ms | Medium |
| Segmentation | 70.5ms | 40ms | 30ms | Low-Medium |

## Highest-Leverage Combined Outcome

Applying top 4 latency bottleneck reductions yields estimated first-audio improvement around 1.5s (aggregate, non-linear), with substantial quality benefit if retrieval/classification weaknesses are addressed in parallel.
