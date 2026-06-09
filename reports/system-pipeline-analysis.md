# System Pipeline Analysis

Generated: 2026-06-08
Scope: Full static trace + existing benchmark artifacts + local synthetic audit scripts in repository.

## Executive Summary

The realtime path is architecturally streaming-capable, but perceived latency remains high because the pipeline is still **serially gated by STT + retrieval + first complete sentence detection + per-sentence TTS generation** before first playable audio. The largest structural latency contributors are:

1. STT roundtrip and file I/O staging.
2. Retrieval stack (embedding + vector + keyword + rerank + compression).
3. TTS first-byte/first-chunk delay on first sentence.
4. Playback buffering and codec compatibility fallback behavior.

## End-to-End Trace (Realtime Voice Path)

User Speech
↓
Voice Recorder (`MediaRecorder` 120ms chunks, silence detection)
↓
WebRTC DataChannel (`audio`) or Socket fallback (`realtime:audio`)
↓
Server audio chunk buffer (`session.audioChunks[]`)
↓
Audio end event (`audio_end`) triggers processing
↓
Temporary file write (`fs.writeFile`) → temp file read (`fs.readFile`)
↓
STT provider API (`POST /v1/speech-to-text`)
↓
Query analysis/classification (`analyzeQueryIntelligence`)
↓
Embedding API (`OpenAI embeddings.create`)
↓
Vector search (`$vectorSearch`) + keyword search (`$text`) in parallel
↓
Reranking
↓
Compression/context optimizer
↓
Prompt assembly (streaming prompt)
↓
GPT streaming API (`chat.completions.create stream=true`)
↓
Sentence segmentation (`ResponseStreamingService.extractSentences`)
↓
TTS streaming per sentence (`POST /v1/text-to-speech/{voiceId}/stream`)
↓
Audio transport (WebRTC `audio` channel/socket fallback)
↓
Client MSE append queue / fallback blob mode
↓
Client playback

---

## Phase 1 Deliverables

### 1) Every API Call

Internal/API ingress:
- `GET /api/v1/realtime/config`
- `POST /api/v1/response/generate` (non-realtime path)
- `POST /api/v1/retrieval/search` (debug/standalone path)
- `POST /api/v1/voice/transcribe` (multipart STT path)
- `POST /api/v1/voice/synthesize` (non-realtime TTS)

Signaling APIs/events:
- Socket events: `realtime:join`, `realtime:offer`, `realtime:answer`, `realtime:ice`, `realtime:control`, `realtime:audio`

External provider APIs:
- OpenAI embeddings: `openai.embeddings.create`
- OpenAI chat completion (non-stream): `openai.chat.completions.create`
- OpenAI chat completion (stream): `openai.chat.completions.create stream=true`
- ElevenLabs STT: `POST /v1/speech-to-text`
- ElevenLabs TTS stream: `POST /v1/text-to-speech/{voiceId}/stream`

Database boundaries:
- MongoDB profile lookup/upsert (`ConversationProfile`)
- MongoDB vector and text retrieval (`KnowledgeChunk.aggregate`)
- Usage tracking persistence (`saveUsageRecord`)

### 2) Every Async Operation (Critical Path)

- `navigator.mediaDevices.getUserMedia`
- `MediaRecorder.start(120)` periodic chunking
- `chunk.arrayBuffer()` per recorder chunk
- WebRTC `DataChannel.send`
- Server `fs.writeFile(tempFile, Buffer.concat(audioChunks))`
- STT `fetch` + provider response parse
- Embedding call
- Vector + keyword search (`Promise.all`)
- GPT stream connect + token async iteration
- Sentence queue enqueue/dequeue loop
- Per sentence TTS stream request and chunk relay
- Client `SourceBuffer.appendBuffer` queue drain

### 3) Every Queue

- Client recorder chunk cadence queue (implicit by event loop).
- Client transport queues:
  - `controlQueue` max 50
  - `audioQueue` max 200
- Server ingestion queue: `session.audioChunks[]` until `audio_end`.
- Server sentence queue: `SentenceQueueService.queue` for per-sentence TTS.
- Client playback queue: `queueRef.current` for MSE `SourceBuffer` append.

### 4) Every Blocking Point

- Silence detection gate before stop.
- Wait for `audio_end` before STT starts.
- Full buffer concat + disk write before STT request.
- Retrieval waits for embedding result first.
- GPT stream starts only after retrieval completes.
- First TTS request waits for first sentence boundary/early flush.
- Client playback may wait for MSE source open and append scheduling.

### 5) Retry Mechanisms

- OpenAI client retries configurable (`OPENAI_MAX_RETRIES`, default 0).
- Embedding retries configurable (`OPENAI_EMBEDDING_MAX_RETRIES`, default 0).
- Vector search automatic fallback: retry without filter when Atlas filter-index mismatch is detected.
- No STT/TTS exponential retry loop in current pipeline (timeout + fail only).

### 6) Serialization / Deserialization Steps

- JSON encode/decode on control channel payloads.
- Binary conversion chain:
  - Browser `Blob` chunk → `ArrayBuffer`.
  - Server converts inbound chunk to `Buffer`.
  - `Buffer.concat` to monolithic buffer.
  - Disk file write/read.
  - `Blob` + `FormData` for STT provider.
- GPT stream chunk to token string extraction.
- Audio chunk normalization client-side (`ArrayBuffer` / typed array / Buffer-like / base64).

### 7) Network Boundaries

- Browser ↔ Backend HTTP (`/realtime/config`, non-realtime routes).
- Browser ↔ Backend WebSocket + WebRTC data channels.
- Backend ↔ OpenAI.
- Backend ↔ ElevenLabs.
- Backend ↔ MongoDB Atlas.

---

## Non-Realtime Path Trace (Text Chat + TTS)

1. Client `generateResponse` (`/api/v1/response/generate`).
2. Server retrieval pipeline executes.
3. Server unified non-stream OpenAI completion returns full JSON response.
4. Client then calls `/api/v1/voice/synthesize` separately.
5. Server streams TTS; client requests full blob before playback URL creation.

Key issue: This path is functionally non-streamed for user experience (LLM completes first, then TTS request, then blob playback).

---

## Confirmed Bottleneck Signatures From Existing Evidence

- STT total (after): ~910ms average.
- Retrieval total (after): ~708ms average.
- GPT first token (synthetic benchmark): ~35ms after stream connect.
- GPT to first sentence (synthetic): ~70.5ms.
- GPT to first audio-ready in streaming simulation: ~480.5ms.
- Realtime first audio end-to-end (load simulation): ~1660ms avg, ~2197ms P95.
- Realtime completion: ~6076ms avg, ~7488ms P95.

## Architectural Weaknesses (Trace-Level)

1. STT requires disk staging; avoidable memory copy and I/O.
2. GPT streaming is downstream of full retrieval; no overlap.
3. TTS starts at sentence granularity and remains serial in a queue.
4. Transport supports WebRTC/socket fallback but lacks deep telemetry (jitter/loss/RTT histograms in production reports).
5. Non-realtime frontend path still waits for full text completion before any TTS request.

## Confidence / Data Quality

- High confidence: call graph, queueing model, async boundaries (from code).
- Medium confidence: latency values tied to synthetic harness and mock/local runs.
- Low confidence: production packet loss/jitter and live TURN behavior (not instrumented in captured artifacts).
