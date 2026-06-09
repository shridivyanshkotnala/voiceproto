# STT Latency Root Cause Analysis

Generated: 2026-06-06

## Measured Stages (instrumented)

- `micStartTime`
- `audioUploadTime`
- `fileWriteStartTime`
- `fileWriteEndTime`
- `sttStartTime`
- `sttEndTime`

## Root Causes of Latency Increase

1. **Premature processing transition**
   - Server entered processing flow on `audio_start` before meaningful speech capture completed.

2. **No-speech uploads still forwarded**
   - Recorder stop path could send `audio_end` for weak/empty speech samples.
   - This wasted STT calls and inflated perceived latency.

3. **Lack of stage granularity**
   - Without explicit file-write/STT stage markers, delays were attributed broadly to STT.

## Fixes Applied

- `audio_start` now keeps session in `LISTENING`.
- Client blocks `audio_end` submission when no clear speech is detected.
- Added explicit write/STT timestamps for precise bottleneck identification.

## Expected Outcome

- Lower unnecessary STT invocation count.
- Improved mean perceived time-to-response-start.
- Better observability for ongoing optimization toward <2s average STT segment target.
