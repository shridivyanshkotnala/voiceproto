# Final Regression Fix Report

Generated: 2026-06-06

## Summary
Post-streaming regressions were traced to playback compatibility, binary normalization, Redux serialization misuse, premature processing transitions, and strict retrieval defaults under degraded transcripts.

## Fixes Applied

1. Playback compatibility
   - Active UI player switched to resilient playback component.
   - Buffer-like/base64 chunk normalization added.

2. Redux serialization
   - Removed raw chunk storage from Redux state.
   - Replaced with numeric progress counters.

3. Voice capture flow
   - Server state on `audio_start`: `PROCESSING` -> `LISTENING`.
   - Client prevents no-speech `audio_end` submission.

4. STT observability
   - Added file-write and STT start/end timing markers.

5. RAG recovery tuning
   - Lowered similarity cutoff (0.3).
   - Expanded final context capacity (5 chunks).

## Before / After (Regression Scope)

- Unsupported format error: **Present -> Mitigated**
- Chunk playback drops: **Present -> Mitigated**
- Redux non-serializable warning: **Present -> Removed by state design**
- Premature processing transition: **Present -> Fixed**
- RAG false fallback frequency: **Elevated -> Reduced risk via threshold/context tuning**

## Validation

- Client lint: pass
- Realtime tests: pass
- Server test suite: pass (post-fix)

## Remaining Risks

- Browser MSE codec matrix variance for MP3 streaming still requires provider/config flexibility for best cross-browser behavior.
- Retrieval precision/recall trade-off after threshold relaxation should be tracked in production telemetry.

## Next Optimizations

1. Make TTS output codec selectable (`mp3` / `opus`) by client capability handshake.
2. Add live STT stage histogram dashboards from new timing markers.
3. Add transcript confidence-aware retrieval strategy (dynamic threshold).
4. Add deterministic RAG regression batch run (50+ curated real transcripts).
