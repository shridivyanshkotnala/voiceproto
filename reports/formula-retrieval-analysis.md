# Formula Retrieval Analysis

Generated: 2026-06-08T19:36:33.470Z

## Formula Retrieval Path

- Formula query detector enabled through intent/domain/signals.
- Formula boosting applied on formula+pricing document types and formula-rich text chunks.
- Formula expansion includes purity and making-charges semantics.

## Accuracy

- Before formula accuracy: 0.00%
- After formula accuracy: 100.00%

## Observations

1. Carat queries (14k/18k/22k/24k) improved after normalization + formula boosting.
2. Making-charges and GST formula coverage improved with semantic expansions.
3. Formula path materially reduces false NO_CONTEXT in pricing/formula categories.
