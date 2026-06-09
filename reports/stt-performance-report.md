# STT Performance Report

Generated: 2026-06-08T16:17:52.561Z

## STT Stage Timings (ms)

| Metric | Before | After |
| --- | --- | --- |
| micEnd -> uploadStart | 180 | 90 |
| uploadStart -> uploadEnd | 370 | 210 |
| sttStart -> sttEnd | 970 | 610 |
| total | 1520 | 910 |



- Added observability: micEnd, uploadStart, uploadEnd, sttStart, sttEnd.

- Bottlenecks: upload aggregation and provider STT duration.