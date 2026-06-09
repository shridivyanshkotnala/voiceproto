# RAG Optimization Benchmark Report

Generated: 2026-06-06T06:34:49.081Z
Sample Size: 100 queries

## Summary Metrics

- Average Context Size Before: 3153.7 chars
- Average Context Size After: 176.2 chars
- Average Prompt Size Before: 2389.1 tokens
- Average Prompt Size After: 1244.4 tokens
- Average OpenAI Latency Before: 4.99 s
- Average OpenAI Latency After: 1.96 s
- Compression Ratio: 0.056
- Token Savings %: 47.91%
- Estimated Cost Savings %: 44.08%

## Target Alignment

- Prompt size target (<2500 tokens): PASS
- Context target (<500 tokens): PASS
- Final chunks target (<=3): PASS (optimizer max 3)
- Latency target (1.5s - 2.5s): PASS
