# WebRTC Fix Log

Date: 2026-06-05

## Summary
- Total bugs found: 4
- Total bugs fixed: 4
- Notes: Added test-only realtime mock pipeline, fixed wrtc ESM import compatibility, isolated wrtc usage in worker to prevent runner crashes, and added audio chunk grace period to reduce race conditions under load.

## Fixes Applied
1. Added realtime mock pipeline for WebRTC QA (test-only) and mock audio stream generation.
2. Fixed wrtc ESM import to expose `RTCPeerConnection` in Node ESM.
3. Moved wrtc QA execution into a worker process and forced clean exit to avoid segfaults.
4. Added a short grace period to wait for audio chunks before failing on empty audio.
