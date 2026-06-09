# RAG Root Cause Report

Generated: 2026-06-08T16:17:52.536Z

## Summary

- Queries audited: 100

- Average retrieval score before fix: 0.453

- Average retrieval score after fix: 0.689

- Main root causes: STT transliteration artifacts (e.g., `kaireta`), gold/carat domain misclassification, strict type routing, sequential keyword retrieval latency.



## Per-query Pipeline Logs (sample of lowest scores)

### reports-9
- originalTranscript: audit report generation rules
- normalizedQuery: audit report generation rules
- classifiedIntent: general
- classifiedDomain: general
- retrievedChunks: scanner:0.28, pricing:0.28, formula:0.28, pricing:0.28, inventory:0.28
- rerankedChunks: none
- finalChunks: none
- retrievalScore: 0.22
- finalPrompt: Current User Query: audit report generation rules | Normalized Query: audit report generation rules | Intent: general | Domain: general | Retrieved Context: NO_CONTEXT

### operations-4
- originalTranscript: processing delay root cause kaise dekhe?
- normalizedQuery: processing delay root cause kaise dekhe
- classifiedIntent: general
- classifiedDomain: general
- retrievedChunks: scanner:0.28, pricing:0.28, formula:0.28, pricing:0.28, inventory:0.28
- rerankedChunks: none
- finalChunks: none
- retrievalScore: 0.22
- finalPrompt: Current User Query: processing delay root cause kaise dekhe? | Normalized Query: processing delay root cause kaise dekhe | Intent: general | Domain: general | Retrieved Context: NO_CONTEXT

### operations-6
- originalTranscript: response streaming late aa raha hai
- normalizedQuery: response streaming late aa raha hai
- classifiedIntent: general
- classifiedDomain: general
- retrievedChunks: scanner:0.28, pricing:0.28, formula:0.28, pricing:0.28, inventory:0.28
- rerankedChunks: none
- finalChunks: none
- retrievalScore: 0.22
- finalPrompt: Current User Query: response streaming late aa raha hai | Normalized Query: response streaming late aa raha hai | Intent: general | Domain: general | Retrieved Context: NO_CONTEXT

### operations-7
- originalTranscript: tts start delay kyu hai
- normalizedQuery: tts start delay kyu hai
- classifiedIntent: general
- classifiedDomain: general
- retrievedChunks: scanner:0.28, pricing:0.28, formula:0.28, pricing:0.28, inventory:0.28
- rerankedChunks: none
- finalChunks: none
- retrievalScore: 0.22
- finalPrompt: Current User Query: tts start delay kyu hai | Normalized Query: tts start delay kyu hai | Intent: general | Domain: general | Retrieved Context: NO_CONTEXT

### operations-8
- originalTranscript: stt transcript weak aa raha hai
- normalizedQuery: stt transcript weak aa raha hai
- classifiedIntent: general
- classifiedDomain: general
- retrievedChunks: scanner:0.28, pricing:0.28, formula:0.28, pricing:0.28, inventory:0.28
- rerankedChunks: none
- finalChunks: none
- retrievalScore: 0.22
- finalPrompt: Current User Query: stt transcript weak aa raha hai | Normalized Query: stt transcript weak aa raha hai | Intent: general | Domain: general | Retrieved Context: NO_CONTEXT

### operations-9
- originalTranscript: retrieval score low aa raha hai
- normalizedQuery: retrieval score low aa raha hai
- classifiedIntent: general
- classifiedDomain: general
- retrievedChunks: scanner:0.28, pricing:0.28, formula:0.28, pricing:0.28, inventory:0.28
- rerankedChunks: none
- finalChunks: none
- retrievalScore: 0.22
- finalPrompt: Current User Query: retrieval score low aa raha hai | Normalized Query: retrieval score low aa raha hai | Intent: general | Domain: general | Retrieved Context: NO_CONTEXT

### operations-10
- originalTranscript: end to end voice flow health check
- normalizedQuery: end to end voice flow health check
- classifiedIntent: general
- classifiedDomain: general
- retrievedChunks: scanner:0.28, pricing:0.28, formula:0.28, pricing:0.28, inventory:0.28
- rerankedChunks: none
- finalChunks: none
- retrievalScore: 0.22
- finalPrompt: Current User Query: end to end voice flow health check | Normalized Query: end to end voice flow health check | Intent: general | Domain: general | Retrieved Context: NO_CONTEXT