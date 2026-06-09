# TTS Analysis

Generated: 2026-06-08
Scope: Sentence enqueue → provider stream start → chunk relay → client playback.

## Measured/Derived Timeline

| Marker | Value | Notes |
| --- | ---: | --- |
| `ttsRequestStart` | Sentence-dependent | Triggered when first sentence emitted.
| `ttsFirstByte` | Not directly instrumented | Missing provider first-byte telemetry.
| `ttsFirstChunk` | Included in first audio event | First chunk relayed to client.
| `ttsFirstPlayableAudio` | ~480.5ms (server stream benchmark) / ~1660ms end-to-end first audio | Includes upstream stages in full path.
| `ttsComplete` | `totalTTSTime` tracked | After queue drain and stream end.

Reference latency metric (post-fix synthetic): TTS latency improved from 2180ms → 1240ms.

## Implementation Characteristics

- TTS is invoked per sentence via a queue manager.
- Each sentence creates a separate provider request.
- First audio event marks start of speaking state.
- Audio transported over WebRTC data channel or socket fallback.

## Codec Compatibility Findings

Compatibility matrix from audits:

- **Opus/WebM (`audio/webm; codecs=opus`)**: best realtime browser compatibility.
- MP3 (`audio/mpeg; codecs=mp3`): usable, but MSE beFindings

Compatibility matrix from audits:havior can vary by browser path.
- WAV: reliable fallback, larger payload.
- Raw PCM: avoid for direct browser playback.

## Streaming Implementation Bottlenecks

1. Sentence-level request fanout adds startup overhead for each sentence.
2. No first-byte metric from provider response headers/events.
3. Playback path may switch to fallback blob mode and lose true progressive experience.
4. Queue serialization can delay later sentences when first sentence is long.

## Browser Decoder / Playback Constraints

- MSE source buffer append queue can stall under unsupported codec/container combinations.
- Fallback mode accumulates chunks and may defer playback until end event.
- Payload normalization for Buffer-like chunks is necessary for socket fallback robustness.

## Best Format For Realtime Playback

Primary: **Opus/WebM** (`audio/webm; codecs=opus`)  
Fallback: **WAV** for compatibility-first scenarios.

## Summary

TTS is streaming-capable but still a major latency stage due to sentence-triggered request startup, codec path variance, and client buffering behavior.
