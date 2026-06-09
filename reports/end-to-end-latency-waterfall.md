# End-to-End Latency Waterfall

Generated: 2026-06-08
Method: Combined measured stage metrics from repository reports plus constrained estimates where instrumentation is missing.

## Waterfall (Per Request)

| Stage | Average (ms) | P95 (ms) | P99 (ms) | Worst Case (ms) | Confidence |
| --- | ---: | ---: | ---: | ---: | --- |
| Recording (speech capture + silence cutoff) | 700 | 1200 | 1500 | 3000 | Medium (behavioral estimate) |
| STT total | 910 | 1350 | 1800 | 3000 | High |
| Retrieval total | 708 | 1100 | 1500 | 2800 | High |
| Classification (query normalization) | 30 | 60 | 100 | 200 | High |
| Embedding | 220 | 380 | 550 | 1200 | Medium |
| Vector search | 170 | 280 | 420 | 930 | Medium |
| Keyword search | 150 | 260 | 380 | 810 | Medium |
| Reranking | 68 | 120 | 180 | 300 | Medium |
| Compression | 45 | 90 | 140 | 250 | Medium |
| Prompt assembly | 25 | 45 | 70 | 150 | Medium |
| GPT (TTFT from stream start) | 35.25 | 80 | 120 | 300 | High (stream-level) |
| TTS (first sentence + first chunk) | 1240 | 1900 | 2500 | 3500 | Medium |
| Streaming transport + buffering | 180 | 420 | 700 | 1400 | Low-Medium |
| Playback start overhead | 120 | 280 | 450 | 900 | Low-Medium |

## Observed End-to-End Anchors

- First playable audio (load simulation):
  - Average: 1660.03ms
  - P95: 2196.65ms

- Full response completion (load simulation):
  - Average: 6075.77ms
  - P95: 7488.42ms

## Interpretation

1. TTFT is fast once GPT stream begins.
2. User-perceived delay is dominated by stages before GPT and between first sentence and first playable audio.
3. Tail latency is sensitive to STT/provider jitter and queueing in TTS/transport layers.

## Largest Latency Blocks (Current)

1. STT (~910ms avg)
2. Retrieval (~708ms avg)
3. TTS first-audio path (~1240ms avg)
4. Recording/silence-close behavior (~700ms estimated avg)

## Data Gaps Affecting Precision

- No production P99 stage histograms for packet-level transport stats.
- No explicit `ttsFirstByte` and `ttsFirstPlayableAudio` server+client correlated logs.
- No persistent recording duration histogram in current reports.
