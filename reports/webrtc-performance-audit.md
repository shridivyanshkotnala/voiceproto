# WebRTC Performance Audit

Generated: 2026-06-08
Scope: Signaling + DataChannel transport + realtime audio streaming path.

## Key Findings

1. Connection reliability is strong in local/mock runs (100% connection success in QA report).
2. First-audio latency under 100-conversation load remains non-trivial.
3. No direct jitter/packet-loss telemetry is currently persisted for production diagnostics.

## Measured Metrics

| Metric | Average | P95 | Source |
| --- | ---: | ---: | --- |
| connectionSetupLatency | 227ms | 305ms | WebRTC reliability report.
| audioTransportLatency (first audio end-to-end) | 311ms (QA) / 1660ms (load full pipeline) | 318ms (QA) / 2196.65ms (load) | QA + load simulation.
| packetDelay | Not directly instrumented | Not directly instrumented | Gap.
| jitter | Not directly instrumented | Not directly instrumented | Gap.
| bufferingDelay | Indirectly observed via playback lag | Indirect | Queue/fallback behavior.

## ICE / STUN / TURN Audit

- Default ICE config uses public Google STUN servers.
- TURN usage is configuration-dependent; no report evidence confirms active TURN relay in measured runs.
- ICE candidate timing breakdown (gathering vs connectivity checks) is not separately recorded.

## Reconnection and Stability

- Reconnect success: 100% (mock QA report).
- Barge-in success: 100% (mock QA report).
- Streaming playback success: 100% in QA, but load simulation reports dropped chunks/sentences.

## Load Profile (100 Conversations Simulation)

- Average first audio: 1660.03ms
- P95 first audio: 2196.65ms
- Average completion: 6075.77ms
- P95 completion: 7488.42ms
- Dropped sentences: 4
- Dropped audio chunks: 10
- WebRTC stability: 95%
- Queue health: 93%

## Bottlenecks

1. DataChannel readiness and queue drain under load.
2. Fallback transport path payload normalization overhead.
3. Lack of adaptive queue backpressure feedback to client recorder.
4. Missing network QoS telemetry (RTT/jitter/loss) for dynamic tuning.

## Root Causes

- Transport path is functional but blind: no continuous low-level RTC stats pipeline.
- Audio is chunked at fixed recorder cadence; no adaptive chunk sizing based on channel pressure.
- Playback buffering and fallback mode can hide transport-level gains.

## Audit Conclusion

WebRTC is not the primary root cause of total latency, but it contributes materially to first-play delay variability, especially under load and codec/fallback transitions.
