# AI Assistant Reference - AddRan Advisor

> This file provides context for AI coding assistants (GitHub Copilot, Claude, etc.) working on this project.

**Live Site:** https://addran-advisor-9125e.web.app

## Project Overview

A Firebase-based chatbot helping students explore majors, minors, and certificates in TCU's AddRan College of Liberal Arts. Uses Claude API (Sonnet) for conversational AI.

## Key Files to Know

| File | Purpose |
|------|---------|
| `functions/index.js` | Main API endpoint — handles chat requests, builds context, calls Claude |
| `public/app.js` | Frontend JavaScript — chat UI logic, message handling |
| `public/index.html` | Chat interface HTML |
| `functions/programs.csv` | Program data (majors, minors, certificates with URLs) |
| `functions/dcda-data.json` | Detailed DCDA program requirements |
| `functions/core-curriculum.json` | TCU Core Curriculum requirements |
| `functions/support-resources.csv` | Redirect URLs for off-topic questions |

## System Prompt Location

The chatbot's personality and rules are defined in `functions/index.js` in the `SYSTEM_PROMPT` constant (~line 108). Key behaviors:

- Persona: "Sandra" — friendly AddRan advisor
- Keep responses under 75 words
- No markdown formatting (plain text only)
- Only use provided data — never make up locations/phone numbers
- Redirect off-topic questions with appropriate URLs

## Data Flow

1. User sends message → `POST /api`
2. Function loads: programs.csv, dcda-data.json, core-curriculum.json, support-resources.csv
3. Fetches abbreviations from Firestore (`config/abbreviations`)
4. Builds context string with all program data
5. Calls Claude with system prompt + context + conversation history
6. Logs conversation to Firestore (`conversations` collection)
7. Returns response + updated conversation history

## When Modifying

- **Adding programs:** Update `functions/programs.csv`
- **Changing personality:** Edit `SYSTEM_PROMPT` in `functions/index.js`
- **Adding redirect topics:** Update `functions/support-resources.csv`
- **Detailed program info:** Edit JSON files in `functions/`

## Sensitive Topics to Redirect

- Academic probation
- Mental health concerns
- Financial hardship
- Any non-AddRan academic questions

## Local Development

```bash
cd functions && npm install && cd ..
firebase emulators:start
```

Requires `functions/.secret.local` with `ANTHROPIC_API_KEY=...`
