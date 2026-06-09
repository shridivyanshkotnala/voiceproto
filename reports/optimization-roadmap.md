# Architecture Optimization Roadmap (Proposed Only)

Generated: 2026-06-08
Constraint: No implementation in this phase.

## Quick Wins (1–2 Days)

1. Add missing telemetry markers (`ttsFirstByte`, `firstPlayableAudio`, queue depths, fallback-mode rate).
2. Tighten sentence flush policy for earlier first TTS request on long clauses.
3. Add stage-level correlation IDs from client mic start to playback start.
4. Improve codec negotiation defaults toward Opus/WebM with explicit fallback policy.

Estimated impact:
- Latency reduction: 100–250ms perceived
- Answer quality: neutral
- Infrastructure impact: low
- Dev effort: low

## Medium Wins (1 Week)

1. Eliminate disk roundtrip in STT path (in-memory provider upload path).
2. Adaptive retrieval budget by query type/confidence (dynamic top-k/context width).
3. Add long-tail domain routing improvements for reports/operations/troubleshooting intents.
4. Add transport adaptive backpressure signals between server queue and client recorder cadence.

Estimated impact:
- Latency reduction: 500–900ms perceived
- Answer quality improvement: +8% to +15% accuracy in weak domains
- Infrastructure impact: low-medium
- Dev effort: medium

## Major Wins (2–4 Weeks)

1. Streaming STT (partial transcripts) with overlap to retrieval prefetch.
2. Overlapped orchestration: retrieval warmup as transcript confidence rises.
3. Incremental grounding strategy for GPT + early TTS chunk planning.
4. Full production observability stack: P95/P99 per stage, QoS metrics, drift dashboards.

Estimated impact:
- Latency reduction: 1200–2200ms perceived
- Answer quality improvement: +15% to +25% on benchmark quality targets
- Infrastructure impact: medium-high
- Dev effort: high

## Aggregate Projection (If Full Roadmap Executed)

- First playable audio: ~1660ms avg → ~900–1100ms avg
- Full completion: ~6076ms avg → ~3200–4200ms avg
- Hallucination rate: 20% → 8–12%
- Retrieval accuracy: 70% → 82–88%

## Risk Notes

- Latency gains are non-linear and workload-dependent.
- Quality gains require benchmark and taxonomy maintenance.
- Infrastructure costs may rise slightly with richer telemetry and overlapping inference paths.
