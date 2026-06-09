# Classification Audit

Generated: 2026-06-08T16:17:52.561Z

## Misclassification Analysis

- Sample size: 100

- Before accuracy: 80.0%

- After accuracy: 97.0%

- Misclassification rate (after): 3.0%



## Example Failure Check

- Query: "18 carat aur 14 carat gold ki calculation karega?"

- Before domain: formula

- After domain: pricing



## Classification Matrix (sample)

| ID | Category | Expected | Before Domain | After Domain | Before Intent | After Intent |
| --- | --- | --- | --- | --- | --- | --- |
| gold calculation-1 | gold calculation | pricing | formula | pricing | formula | pricing |
| gold calculation-2 | gold calculation | pricing | pricing | pricing | pricing | pricing |
| gold calculation-3 | gold calculation | pricing | inventory | inventory | inventory | pricing |
| gold calculation-4 | gold calculation | pricing | formula | pricing | formula | pricing |
| gold calculation-5 | gold calculation | pricing | general | pricing | general | pricing |
| gold calculation-6 | gold calculation | pricing | scanner | scanner | formula | pricing |
| gold calculation-7 | gold calculation | pricing | pricing | pricing | formula | pricing |
| gold calculation-8 | gold calculation | pricing | pricing | pricing | formula | pricing |
| gold calculation-9 | gold calculation | pricing | formula | pricing | formula | pricing |
| gold calculation-10 | gold calculation | pricing | formula | pricing | formula | pricing |
| 14k-1 | 14k | pricing | formula | pricing | formula | pricing |
| 14k-2 | 14k | pricing | scanner | scanner | formula | pricing |
| 14k-3 | 14k | pricing | general | pricing | general | pricing |
| 14k-4 | 14k | pricing | pricing | pricing | pricing | pricing |
| 14k-5 | 14k | pricing | general | pricing | general | pricing |
| 14k-6 | 14k | pricing | general | pricing | general | pricing |
| 14k-7 | 14k | pricing | scanner | scanner | scanner | pricing |
| 14k-8 | 14k | pricing | general | pricing | general | pricing |
| 14k-9 | 14k | pricing | general | pricing | general | pricing |
| 14k-10 | 14k | pricing | formula | pricing | formula | pricing |
| 18k-1 | 18k | pricing | pricing | pricing | formula | pricing |
| 18k-2 | 18k | pricing | scanner | scanner | scanner | pricing |
| 18k-3 | 18k | pricing | general | pricing | general | pricing |
| 18k-4 | 18k | pricing | pricing | pricing | pricing | pricing |
| 18k-5 | 18k | pricing | general | pricing | general | pricing |