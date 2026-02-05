# AddRan Advising Chatbot

**Live Site:** https://addran-advisor-9125e.web.app

An interactive chatbot for students considering majors in AddRan College of Liberal Arts at TCU (https://addran.tcu.edu/). The bot is warm, conversational, encouraging, and knowledgeable about liberal arts education.

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

## Local Development

```bash
# Install dependencies
cd functions && npm install && cd ..

# Start emulators (requires Java)
firebase emulators:start
```

The app runs at http://127.0.0.1:5002

**API Key:** Create `functions/.secret.local` with:
```
ANTHROPIC_API_KEY=your-key-here
```

Or retrieve from Firebase: `firebase functions:secrets:access ANTHROPIC_API_KEY`

## Deployment

```bash
firebase deploy
```

## Project Structure

```
├── firebase.json          # Firebase configuration
├── firestore.rules        # Firestore security rules
├── functions/
│   ├── index.js           # Cloud Function (API endpoint)
│   ├── programs.csv       # Program data
│   ├── dcda-data.json     # DCDA program details
│   ├── core-curriculum.json
│   └── support-resources.csv
├── public/
│   ├── index.html         # Chat UI
│   ├── app.js             # Frontend JavaScript
│   └── style.css
└── files/
    └── CLAUDE.md          # AI assistant reference
```

## Content Status

### ✅ Have

- 37 programs (majors, minors, certificates)
- Program URLs and images
- DCDA and English department details
- Core Curriculum requirements
- Support resource redirects

### ❓ Still Needed

- Talking points for skeptical family members
- Advisor contact information
- Career pathway examples (major + minor → career)

## Chatbot Personality

**Tone:** Warm and conversational (not formal/academic, not over-the-top enthusiastic)

**Should:**
- Be encouraging about liberal arts education
- Stay focused on AddRan programs and liberal arts broadly
- Provide specific, accurate program information
- Offer to connect students with human advisors

**Should NOT:**
- Answer questions outside its scope (redirect gracefully instead)
- Handle sensitive topics directly — redirect with care
- Make up information about programs or requirements