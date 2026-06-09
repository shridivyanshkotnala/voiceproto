# TTS Stream Debug Report

Generated: 2026-06-06

## Server Output Format Trace

- TTS synthesis service output content type: **audio/mpeg**.
- Stream transport: Node stream chunks over WebRTC data channel; socket fallback emits chunk payloads.
- Effective codec expectation: **MP3**.

## Client Playback Format Trace

- Streaming path uses `MediaSource` + `SourceBuffer`.
- MIME normalization: `audio/mpeg` -> `audio/mpeg; codecs="mp3"`.
- Prior regression path failed hard when `MediaSource.isTypeSupported(...)` returned false.

## Compatibility Findings

- Browser-specific MSE support for MP3 can vary.
- Socket fallback payload shape may arrive as Buffer-like object and requires explicit normalization.

## Failure Root Causes

1. MSE-only playback strategy without robust fallback.
2. Incomplete chunk normalization for Buffer-like payloads.

## Fixes Applied

- Switched active UI player to resilient component with fallback mode.
- Added Buffer-like and base64-aware chunk normalization.
- Preserved autoplay behavior where browser policy allows.

## Validation Checklist

- [x] Detect server format (`audio/mpeg`).
- [x] Normalize client MIME for MP3 codec string.
- [x] Handle binary transport variants (`ArrayBuffer`, typed arrays, Buffer-like objects).
- [x] Keep chunk ordering queue intact.
- [x] Avoid hard-fail on unsupported MSE path.

## Remaining Risk

- Browsers that disallow MSE MP3 and require stricter codec/container support may still need provider-side configurable output (`webm/opus` or `aac`) for fully streaming fallback parity.
