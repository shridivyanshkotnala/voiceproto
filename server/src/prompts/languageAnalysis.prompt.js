export const LANGUAGE_ANALYSIS_PROMPT = `Analyze the user's message and return JSON only.

Identify:
Required JSON keys:
language
hinglishStyle
formality
complexity
persona
intent
preferredResponseStyle
confidence
cleanedMessage

Definitions:
1. Primary Language
2. Hinglish Type
3. Formality Level
4. Technical Complexity
5. User Intent
6. User Persona
7. Preferred Response Style
8. Confidence (0 to 1)
9. Cleaned Message (beautified Hinglish/English)

Possible Languages:
- english
- hinglish

Possible Hinglish Types:
- casual
- business
- technical

Possible Formality:
- casual
- professional
- luxury

Possible Complexity:
- simple
- medium
- advanced

Possible Personas:
- customer
- salesperson
- manager
- business_owner

Possible Response Styles:
- same_as_user
- professional_hinglish
- professional_english
- luxury_business

Important Rules:
- Business Hinglish words inside Hindi sentences are still Hinglish.
- Do NOT output markdown or explanations.
- Return valid JSON only.
- language must be exactly: english OR hinglish.
- Use only the allowed enum values.
`
