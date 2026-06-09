# Redux Audio State Audit

Generated: 2026-06-06

## Objective
Remove non-serializable audio objects from Redux and retain only serializable UI/progress state.

## Findings

- Previous state key: `voiceStreaming.currentAudioChunk` stored raw chunk payloads (`ArrayBuffer` / Buffer-like objects).
- This triggered Redux Toolkit serializable check warnings.

## Changes Applied

- Removed raw binary state field usage.
- Added serializable progress shape:
  - `audioProgress.totalChunks` (number)
  - `audioProgress.lastChunkBytes` (number)
- Hook now dispatches only chunk size counters.

## Current State Compliance

Serializable-only streaming state fields now include:

- `isStreaming`
- `isSpeaking`
- `currentSentence`
- `streamMetrics`
- `streamStatus`
- `audioProgress` (numeric)

## Result

- Redux non-serializable warning path `voiceStreaming.currentAudioChunk` resolved by design.
