# GPT Streaming Audit

Generated: 2026-06-08
Scope: Realtime pipeline GPT streaming behavior audit.

## Verdict

OpenAI token streaming is implemented correctly on the backend, but perceived latency is still elevated due to **pre-stream gating (STT + retrieval)** and **post-token gating (sentence segmentation + TTS first-byte + playback buffering)**.

---

## Investigation Checklist

1. Is OpenAI actually streaming tokens? **Yes**  
	`generateStreamingResponse()` uses `stream: true` and async token iteration.

2. Is backend buffering tokens? **Partially**  
	Tokens are forwarded immediately (`stream_token`), but TTS starts from sentence boundaries, so speech waits for sentence extraction.

3. Is backend waiting for full completion? **No (realtime path), Yes (non-realtime path)**  
	Realtime path streams tokens. Non-realtime `/response/generate` waits for full completion JSON.

4. Is sentence segmentation delaying output? **Yes**  
	Even with early flush, first TTS request still depends on first sentence/flush condition.

5. Is TTS waiting for GPT completion? **No (realtime path)**  
	TTS starts per sentence while GPT continues.

6. Is frontend waiting for complete TTS stream? **Partially**  
	Streaming playback path can begin early; fallback blob mode waits until `tts_end`.

7. Is WebRTC introducing buffering? **Yes, variable**  
	Queueing and channel readiness affect first-play latency.

8. Are streamed chunks accumulated before forwarding? **Audio path: yes (queue-backed), token path: minimal**

---

## Timing Waterfall (Observed)

Baseline source: repo benchmark artifacts + realtime load simulation.

| Metric | Before | Current | Notes |
| --- | ---: | ---: | --- |
| timeToFirstToken | 120.45ms | 35.25ms | From streaming benchmark harness.
| timeToFirstSentence | 241.05ms | 70.5ms | Early flush reduced wait.
| timeToFirstTTSRequest | 461.05ms | 200.5ms | Sentence-triggered TTS enqueue.
| timeToFirstAudioChunk | 961.05ms | 480.5ms | Server-side first audio chunk generation.
| timeToFirstPlayback | n/a | ~1660ms avg / ~2197ms P95 | End-to-end first audible audio in load sim.
| timeToFinalResponse | 602.2ms stream-only | 176.35ms stream-only | GPT stream duration only.
| fullRealtimeCompletion | ~11.7s legacy synthetic | ~6.1s avg / ~7.5s P95 | Includes STT+retrieval+TTS+transport.

## Why Perceived Latency Is Still High

1. GPT timer starts too late in user journey (after STT + retrieval).
2. Speech cannot start until first sentence boundary/flush event.
3. First sentence incurs a fresh TTS network request.
4. Playback path can enter fallback mode that defers playback start.
5. WebRTC/socket chunk transport variability adds additional delay.

## Root Causes (Ranked)

1. Upstream gating before GPT stream connect (STT + retrieval).
2. Sentence-to-speech coupling (no token-level prosody strategy).
3. Per-sentence TTS request startup overhead.
4. Playback fallback behavior in codec-incompatible situations.
5. Missing production-grade client/server stream tracing correlation IDs by segment.

## Instrumentation Gaps

Missing durable metrics for:
- GPT connect latency vs token latency separation in production.
- TTS first-byte and first-playable-byte timestamps.
- Client audio append queue depth over time.
- Fallback-mode rate and latency impact.

## Audit Conclusion

Streaming is real and functional. Remaining latency is primarily architectural sequencing and sentence/TTS/playback coupling, not a missing `stream: true` configuration.