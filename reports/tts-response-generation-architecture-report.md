# TTS Response-Generation Architecture Audit (Pronunciation Focus)

**Date:** 2026-06-09  
**Scope:** Response generation → `answer`/`ttsText` production → TTS synthesis input path  
**Out of scope:** Latency optimization

---

## 1) Executive Summary

Current architecture is designed to produce **two outputs in one unified OpenAI response**:
- `displayText` for chat UI
- `ttsText` for speech synthesis

However, pronunciation quality still degrades in Hindi/Hinglish cases because the live TTS path often receives **Romanized Hinglish** instead of reliably Devanagari-normalized Hindi-origin tokens.

### Core conclusion
Yes — the primary root cause is that the system behavior still effectively depends on model compliance for Devanagari conversion, while deterministic Hindi-script enforcement in the active synthesis path is incomplete. As a result, ElevenLabs receives mixed-script/Romanized text and pronounces many Hindi-origin words unnaturally.

---

## 2) What the current response generator actually generates

### 2.1 Unified generation contract
`generateUnifiedResponse()` expects one model call to return JSON with:
- `displayText`
- `ttsText`
- `languageProfile`
- `retrievalInfo`

(Defined by unified prompt and parsed in response orchestrator.)

### 2.2 Controller response payload returned to client
`generateResponseController` sends:
- `answer = unified.displayText`
- `ttsText = unified.ttsText`
- `languageProfile`, retrieval metadata, grounding, usage, etc.

So backend explicitly supports dual text channels (chat text vs speech text).

### 2.3 Chat UI text shown to user
Frontend `useChat()` displays only:
- `answer` as assistant chat message (`content: answer`)

So UI intentionally shows conversational Hinglish output and does **not** show TTS-optimized content.

---

## 3) What TTS actually perceives

### 3.1 TTS input source
Frontend sends this to `/voice/synthesize`:
- `text: ttsOptimizedAnswer`
- where `ttsOptimizedAnswer = result.data.ttsText || answer`

Meaning:
- If `ttsText` exists, speech uses it.
- If missing/weak, it falls back to visible chat `answer` (often Roman Hinglish).

### 3.2 Voice synthesis layer behavior
`voice.service.js` passes text through as-is to ElevenLabs streaming API. There is no additional linguistic rewriting at this stage.

### 3.3 Active post-processing behavior
Current `postProcessTtsText()` transforms:
- carat notation (`14K → 14 Carat`)
- operators (`x, /, =`, etc.)
- digits to English words

But this active post-processor does **not** perform robust Hindi-origin token transliteration to Devanagari in the current live file.

---

## 4) Why Hindi words are being mispronounced

## Primary bottlenecks

### Bottleneck A: Devanagari conversion is prompt-guided, not guaranteed
The unified prompt asks model to convert Hindi-origin Latin words into Devanagari for `ttsText`, but runtime lacks strict deterministic enforcement when model output stays Romanized or partially compliant.

**Impact:** TTS receives ambiguous Romanized Hinglish (e.g., `karna`, `samajhna`, `hota`) and produces inconsistent phonetics.

---

### Bottleneck B: Fallback path can feed Romanized chat text to TTS
Frontend fallback uses `answer` when `ttsText` is absent:
- `ttsOptimizedAnswer = ttsText || answer`

If generation returns weak/missing `ttsText`, TTS synthesizes raw chat text, which is typically Hinglish Roman script.

**Impact:** Natural Hindi pronunciation quality drops significantly.

---

### Bottleneck C: Pronunciation subsystem exists but is not in active main path
There is a richer pronunciation service (`optimizePronunciation`) with deterministic token optimization and Hindi word maps, but:
- route controller currently returns passthrough text (mock-like behavior)
- main response→TTS path does not invoke that service

**Impact:** the strongest normalization logic is effectively disconnected from the production synthesis flow.

---

### Bottleneck D: Mixed-script linguistic ambiguity for multilingual TTS
Even with multilingual models, mixed content like:
- Romanized Hindi + business English terms + symbolic math conversions
can produce unstable grapheme-to-phoneme choices.

Without reliable script normalization for Hindi-origin tokens, pronunciation remains inconsistent.

---

## 5) Is the root cause “system only generates Hinglish, so TTS struggles”?

**Mostly yes, with nuance:**

- Architecture intent is correct: generate separate `displayText` and `ttsText`.
- Practical failure is that `ttsText` is not always strongly Devanagari-normalized end-to-end.
- Therefore TTS often receives Hinglish Roman text (directly or through fallback), which is the major reason for poor Hindi pronunciation naturalness.

So the problem is not absence of a dual-output design; it is **insufficient enforcement quality of the TTS text channel**.

---

## 6) Evidence snapshot from current code behavior

1. Response controller returns distinct `answer` and `ttsText` fields.  
2. Frontend chat renders `answer` only.  
3. Frontend TTS request sends `ttsText` with fallback to `answer`.  
4. Voice service streams provider audio using provided text without extra linguistic correction.  
5. Active TTS post-processing currently focuses on numbers/operators/carat normalization, not full Hindi-script conversion.  
6. Pronunciation-specific service exists but is not wired into the main response synthesis pipeline.

---

## 7) Final diagnosis

Current mispronunciation is primarily caused by **Romanized Hinglish leakage into the final TTS input** due to incomplete deterministic Devanagari normalization in the active path and fallback behavior that can use display text for speech.

If natural Hindi pronunciation is required consistently, the TTS pipeline must ensure Hindi-origin words are script-normalized before synthesis, independent of model variability.
