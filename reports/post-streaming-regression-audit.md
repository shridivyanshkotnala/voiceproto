# Post-Streaming Regression Audit

Generated: 2026-06-06

## Scope
Pipeline audited: Microphone -> Recorder -> Realtime transport -> STT -> Retrieval -> GPT stream -> Sentence queue -> TTS stream -> Client playback.

## Confirmed Regressions

1. **Playback format regression**
   - Symptom: `Unsupported audio stream format`.
   - Root cause: new player path required `MediaSource` + `audio/mpeg` codec support and removed runtime fallback path used previously.
   - Impact: chunks received but no audible output in unsupported browser/codec combinations.

2. **Chunk decoding regression**
   - Symptom: chunks visible in network but no playback.
   - Root cause: client chunk normalizer did not robustly decode Buffer-like payloads (`{ type: 'Buffer', data: [...] }`) and dropped unsupported chunk shapes.
   - Impact: silent drops, especially on socket fallback payloads.

3. **Redux serialization regression**
   - Symptom: non-serializable warnings for `voiceStreaming.currentAudioChunk`.
   - Root cause: raw audio binary objects were placed in Redux state.
   - Impact: noisy warnings, devtools instability risk.

4. **Voice capture state regression**
   - Symptom: idle -> processing jump before user speech.
   - Root cause: server moved to `PROCESSING` on `audio_start` event instead of `LISTENING`.
   - Impact: perceived STT/RAG latency inflation and false pipeline starts.

5. **STT latency inflation**
   - Symptom: increased end-to-end voice response start latency.
   - Root causes:
     - premature processing trigger before speech capture,
     - no-speech recordings still sent to STT,
     - insufficient stage timing visibility for bottleneck localization.

6. **RAG relevance drop / fallback spikes**
   - Symptom: fallback answer frequency increased, retrieval scores ~0.24-0.31.
   - Root causes:
     - low-quality/partial transcripts caused by capture regression,
     - strict retrieval cutoff default (`MIN_SIMILARITY_SCORE=0.5`) filtering candidates too aggressively,
     - reduced final context width from optimizer defaults.

## Architecture Bottlenecks

- Recorder stop path can trigger `audio_end` without reliable speech detection.
- Playback depended on a single MSE strategy without resilient codec fallback.
- Binary payload shape variance across WebRTC/socket transports was not normalized defensively.
- Retrieval threshold and context limits were tuned for clean transcripts; regress under noisy partial STT.

## Before vs After (Regression Window)

- **Before streaming rollout**
  - Voice capture state transitions were aligned with user speech cycle.
  - Playback path tolerated broader browser compatibility.
  - Redux kept mostly serializable UI state.

- **After streaming rollout (pre-fix)**
  - Premature processing transitions.
  - MSE-only playback path introduced compatibility breaks.
  - Raw audio in Redux introduced serialization warnings.

## Memory/CPU Observations

- Storing binary chunks in Redux increased memory churn and devtools overhead.
- Queue/event architecture itself is not the primary CPU hotspot; payload normalization and playback compatibility were the larger regression vectors.

## Remediation Applied

- Restored resilient player integration path.
- Added robust chunk normalization for Buffer-like/base64 payloads.
- Removed raw binary storage from Redux; replaced with serializable progress counters.
- Corrected server state transition to `LISTENING` on `audio_start`.
- Added no-speech guard before dispatching `audio_end`.
- Added STT stage timestamps (`fileWrite`, `sttStart`, `sttEnd`).
- Relaxed retrieval defaults (`MIN_SIMILARITY_SCORE` 0.5 -> 0.3; context limit 3 -> 5).
