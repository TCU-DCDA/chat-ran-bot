# AddRan Advising Chatbot - Project Brief

## Overview

An interactive chatbot for students considering majors in AddRan College of Liberal Arts at TCU (https://addran.tcu.edu/). The bot should be warm, conversational, encouraging, and knowledgeable about liberal arts education.

## POC Goals

- Provide up-to-date lists of AddRan majors, minors, and undergraduate certificates
- Share program requirements (or link to them)
- Offer thoughtful encouragement about liberal arts education
- Provide talking points for students whose family/friends are skeptical of liberal arts
- Cite current articles about liberal arts relevance in business, professional life, and the AI age
- Suggest creative major/minor combinations aligned with career goals
- Gracefully redirect off-topic questions to appropriate resources

## Timeline

- **Start:** January 6, 2026
- **POC Deadline:** April 30, 2026
- **Testing Group:** AddRan faculty, staff, and students

## Technology Stack

| Component | Choice | Notes |
|-----------|--------|-------|
| AI Model | Claude API (Sonnet) | Good balance of capability and cost |
| Frontend | Firebase Hosting | Mobile-friendly web chat interface |
| Backend | Firebase Functions | Handles API calls, keeps keys secure |
| Database | Firestore | Stores program data, articles, logs |
| Budget | ~$50/month | Should cover thousands of conversations |

## Architecture

```
User (mobile/desktop browser)
        ↓
Firebase Hosting (chat UI)
        ↓
Firebase Functions
   ├── Retrieves program data from Firestore
   ├── Calls Claude API with system prompt + context
   └── Returns response
        ↓
Claude API (Sonnet)
   ├── System prompt defines personality & scope
   └── Web search for articles (if needed)
```

## Content Status

### ✅ Have

**Program Data** (see `/data/programs.csv`):
- 37 programs total
- ~20 majors (BA/BS)
- ~10 minors
- Several certificates
- Graduate programs (MA, PhD, MLA)
- Includes URLs and images for each program

**Redirect URLs:**
| Topic | URL |
|-------|-----|
| Financial Aid | https://www.financialaid.tcu.edu/ |
| Registrar | https://registrar.tcu.edu/index.php |
| Housing | https://housing.tcu.edu/ |

### ❓ Still Needed

- Talking points for skeptical family members (requested, waiting)
- Advisor contact information
- Career pathway examples (major + minor → career)
- Additional redirect topics as needed

## Chatbot Personality Guidelines

**Tone:** Warm and conversational (not formal/academic, not over-the-top enthusiastic)

**Should:**
- Be encouraging about liberal arts education
- Stay focused on AddRan programs and liberal arts broadly
- Provide specific, accurate program information
- Offer to connect students with human advisors
- Cite sources when discussing articles/research

**Should NOT:**
- Answer questions outside its scope (redirect gracefully instead)
- Handle sensitive topics directly (academic probation, mental health, financial hardship) — redirect with care
- Make up information about programs or requirements

**Redirect Pattern:**
When asked about off-topic subjects, acknowledge the question, explain it's outside the bot's focus, and provide the appropriate resource link.

## Key Decisions Made

1. **AI Provider:** Claude API (not Azure OpenAI)
2. **Model:** Sonnet (not Opus) — better cost efficiency for POC
3. **Language:** English only for POC (Spanish in future version)
4. **Human handoff:** Provide contact info (no live routing for POC)
5. **Article sourcing:** Web search for POC (curated list in future)
6. **Access control:** TBD (open link vs. password vs. TCU login)

## File Structure (Suggested)

```
addran-advisor/
├── CLAUDE.md              # This file
├── data/
│   └── programs.csv       # Program data from TCU
├── functions/
│   └── index.js           # Firebase Functions (API calls)
├── public/
│   ├── index.html         # Chat interface
│   ├── style.css
│   └── app.js
├── prompts/
│   └── system-prompt.md   # System prompt for Claude
├── firebase.json
└── package.json
```

## Next Steps

1. Set up Claude API account at console.anthropic.com
2. Initialize Firebase project
3. Create basic chat UI
4. Draft system prompt
5. Implement conversation flow
6. Add program data to Firestore
7. Test and iterate

## Resources

- AddRan College: https://addran.tcu.edu/
- Claude API Docs: https://docs.anthropic.com/
- Firebase Docs: https://firebase.google.com/docs
