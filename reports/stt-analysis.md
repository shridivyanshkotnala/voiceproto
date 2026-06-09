# STT Analysis

Generated: 2026-06-08
Scope: Mic capture → upload → server staging → provider transcription.

## Measured Timeline

| Stage | Before | Current |
| --- | ---: | ---: |
| `micEnd` → `uploadStart` | 180ms | 90ms |
| `uploadStart` → `uploadEnd` | 370ms | 210ms |
| `sttRequestStart` → `sttRequestEnd` | 970ms | 610ms |
| Total STT segment | 1520ms | 910ms |

## Trace Mapping

- `micStart` captured on `audio_start`.
- Recorder sends chunks every 120ms.
- `audio_end` triggers processing.
- Server concatenates chunks and writes temp file.
- STT service reads same file back into memory.
- STT provider request sent with `FormData` blob.
- Transcript returned and normalized.

## Unnecessary Buffering / Conversion Overhead

1. Browser blob → ArrayBuffer per chunk.
2. Server chunk array accumulation until end-of-recording.
3. `Buffer.concat` of full recording.
4. Disk write (`fs.writeFile`) then disk read (`fs.readFile`) for same payload.
5. Buffer → Blob → FormData conversion.

This creates avoidable CPU + I/O overhead and increases tail latency.

## Duplicate/Expensive Operations

- Full-file write-read cycle before STT.
- No streaming STT chunk upload path.
- No incremental partial transcript return.

## Upload Delay Contributors

- Fixed recorder interval and silence timeout behavior.
- Queueing and network transport variability.
- Server waits for full utterance end before STT begins.

## Root Causes

1. Batch STT architecture instead of streaming STT.
2. Disk-based staging in hot path.
3. Silence gating tuned for safety over speed.
4. No confidence-aware early cut/submit logic.

## Summary

STT remains the first major latency gate. Current ~910ms average is improved but still dominates first-response budget when combined with retrieval.
