# RAG Root Cause Analysis

Generated: 2026-06-08T19:36:33.469Z

## Root Causes

1. Retrieval score drops below 0.4 when domain and intent collapse to generic classes for operations/reporting phrasing.
2. NO_CONTEXT happens when weak lexical/STT-noisy queries miss formula and reports metadata anchors.
3. Formula questions fail when queries use shorthand (hisaab/rate) without explicit formula expansion.
4. Operational questions fail when classifier routes them to system/general instead of operations/troubleshooting.
5. Report queries fail when taxonomy lacks report-specific metadata and document tags.
6. Troubleshooting queries fail when symptom terms are not normalized into error/issue intents.
7. Hinglish degradation happens from transliterated terms and abbreviation noise (tts/stt/maal/hisaab).

## Lowest-confidence samples

| stage | ID | originalQuery | normalizedQuery | classifiedDomain | classifiedIntent | retrievalScore | noContext |
| --- | --- | --- | --- | --- | --- | --- | --- |
| before | q-1 | gold rate pricing kaise nikalta hai | gold rate pricing kaise nikalta hai | pricing | question | 0.294 | true |
| before | q-3 | qr miss ho to scan possible hai | qr miss ho to scan possible hai | scanner | question | 0.167 | true |
| before | q-4 | inventory scan sync issue | inventory scan sync issue | scanner | question | 0.392 | true |
| before | q-5 | operations summary report ka format | operations summary report ka format | reports | question | 0.24 | true |
| before | q-6 | tts delay kyu hai | tts delay kyu hai | troubleshooting | question | 0.1 | true |
| before | q-7 | pricing calculation error aa raha hai | pricing calculation error aa raha hai | troubleshooting | question | 0.178 | true |
| before | q-8 | maal ka report niklega kya | maal ka report niklega kya | inventory | question | 0.147 | true |
| before | q-9 | pricing rule for purity based item | pricing rule for purity based item | pricing | question | 0.256 | true |
| before | q-10 | mcx pricing formula kya hai | mcx pricing formula kya hai | pricing | question | 0.333 | true |
| before | q-11 | scanner barcode ke bina scan karega | scanner barcode ke bina scan karega | scanner | question | 0.256 | true |
| before | q-12 | maal stock reconciliation ka process | maal stock reconciliation ka process | inventory | question | 0.24 | true |
| before | q-13 | scanner report dashboard availability | scanner report dashboard availability | scanner | question | 0.333 | true |
| before | q-14 | system workflow stuck troubleshooting | system workflow stuck troubleshooting | system | question | 0.275 | true |
| before | q-15 | formula output wrong aa raha hai | formula output wrong aa raha hai | pricing | question | 0.217 | true |
| before | q-16 | 14k ka hisaab karega kya | 14k ka hisaab karega kya | pricing | question | 0.193 | true |
| before | q-17 | mcx live rate ke basis par valuation | mcx live rate ke basis par valuation | pricing | question | 0.3 | true |
| before | q-18 | making charges aur gst ka hisaab | making charges aur gst ka hisaab | system | question | 0.294 | true |
| before | q-20 | opening closing stock report | opening closing stock report | inventory | question | 0.217 | true |
| before | q-21 | audit report generation rules | audit report generation rules | reports | question | 0.217 | true |
| before | q-22 | stt transcript weak aa raha hai | stt transcript weak aa raha hai | system | question | 0.139 | true |
