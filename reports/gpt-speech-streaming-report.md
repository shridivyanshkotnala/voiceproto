# GPT Speech Streaming Report

- Generated At: 2026-06-09T03:58:39.024Z
- Conversations: 100

## Latency Metrics

| Metric | Avg (ms) | P95 (ms) |
|---|---:|---:|
| Time To First Token | 37.02 | 52 |
| Time To First Sentence | 194.3 | 252 |
| Time To First Audio | 230.26 | 285 |

## Speech Quality Metrics

| Metric | Value |
|---|---:|
| Romanized Hindi Leakage Rate | 0 |
| Business Terminology Preservation | 1 |
| Average Devanagari Ratio | 0.3 |

## Notes

- GPT stream text is used directly as TTS input.
- No pronunciation post-processing layer is used.
- No transliteration or normalization is applied before TTS.
