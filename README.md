# AddRan Advising Chatbot

**Live Site:** https://sandra.digitcu.org

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
- **Chancellor's Innovation Prize Submission:** March 30, 2026
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
│   ├── programs.csv       # Program list (37 programs)
│   ├── dcda-data.json     # DCDA program details
│   ├── core-curriculum.json
│   ├── support-resources.csv
│   └── program-data/      # 60 JSON files (auto-loaded at startup)
│       ├── anthropology.json
│       ├── english.json
│       ├── ...
│       └── writing-and-rhetoric-minor.json
├── public/
│   ├── index.html         # Chat UI
│   ├── admin.html         # Admin dashboard
│   ├── app.js             # Chat frontend JavaScript
│   ├── admin.js           # Admin dashboard JavaScript
│   ├── style.css          # Chat styles
│   └── admin.css          # Admin styles
└── other_programs/        # Source Excel spreadsheets (25 files)
```

## Content Status

### ✅ Have

- 60 program detail JSON files covering all 37 AddRan programs (BA, BS, Minor, Interdisciplinary Minor, Military Commission variants)
- Program URLs, descriptions, requirements, career options, and contacts
- DCDA and English department details
- Core Curriculum requirements (Fall 2025+)
- Support resource redirects
- Article curation pipeline (RSS feeds, OpenAlex, admin dashboard)
- Admin dashboard with article management, conversation analytics, feedback tracking, and CSV export
- AI disclaimers (accuracy warning + data freshness notice)

### ❓ Still Needed

- Career pathway examples (major + minor → career)
- Data accuracy audit against source Excel spreadsheets

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