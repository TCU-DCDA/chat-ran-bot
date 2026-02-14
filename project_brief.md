# AddRan Advising Chatbot — Project Brief

## Context

This brief captures planning from a conversation about TCU's Chancellor's Innovation Prize and enhancements to the AddRan Advising Chatbot. Use this as context when working in the `addran-advisor-chat` repo.

## The Project

**Repo:** https://github.com/TCU-DCDA/addran-advisor-chat
**Live:** https://addran-advisor-9125e.web.app
**Stack:** Firebase Hosting + Functions + Firestore, Claude API (Sonnet)
**What it does:** AI-powered chatbot for students considering majors in AddRan College of Liberal Arts at TCU. Covers 37 programs with requirements, URLs, and program details.

## Chancellor's Innovation Prize

Dr. Rode is planning to submit this project to TCU's inaugural Chancellor's Innovation Prize (faculty category, $5,000 award). The competition focuses on **Operational AI** — using AI to improve university operations and student success.

**CFP page:** https://www.tcu.edu/ai/innovation-prize.php

**Key dates:**
- Submissions open: March 2
- Submissions close: March 30
- Finalist presentations: April 16-17
- Winners announced: April 22

**Deliverables:**
- 3-page whitepaper (problem, solution, feasibility, outcomes)
- 5-slide deck

**Proposal narrative:** Faculty advisors in small programs are the single point of failure for routine advising questions. This doesn't scale, and students who can't get timely answers make avoidable mistakes. The chatbot handles routine advising queries using public program data — no FERPA exposure — and can scale across departments.

**Three AI components in the proposal:**
1. Conversational advising interface (Claude API chatbot) — already built
2. Automated article discovery and curation pipeline — to be built
3. Advising knowledge base (program data, career pathways, requirements) — partially built

## New Feature: Article Curation Pipeline

### Purpose

The chatbot needs a current library of articles arguing for the value of liberal arts education. These are used when students ask "why should I major in English?" or need talking points for skeptical family members. This is listed in the README under "Still Needed" and aligns with the chatbot's stated goals.

### Design

**Automated pipeline with human-in-the-loop review:**

1. **Discovery** — scheduled process searches for new articles about liberal arts value, careers, AI-era skills
2. **Ingestion** — AI reads each article, generates a draft 2-3 sentence summary, and suggests tags
3. **Review** — Dr. Rode sees the article, draft summary, and tags in a review interface. He approves, edits, or rejects.
4. **Publication** — approved articles become available to the chatbot

### Proposed Firestore Data Structure for Articles

Each article record should include:
- `title` (string)
- `source` (string) — e.g., "US News", "World Economic Forum"
- `url` (string)
- `date` (timestamp) — article publication date
- `summary` (string) — AI-drafted, human-reviewed 2-3 sentence summary
- `tags` (array of strings) — e.g., "employer-data", "AI-era-skills", "career-outcomes", "family-talking-points"
- `status` (string) — "pending" | "approved" | "rejected"
- `created_at` (timestamp) — when the pipeline ingested it
- `reviewed_at` (timestamp) — when Dr. Rode reviewed it

**Important:** The chatbot should ONLY use approved articles. It should cite articles by title, source, and link — not synthesize claims across articles on its own. The human-reviewed summary is what the chatbot draws on, not its own reading of the article.

### Seed Articles Found

These were identified as strong candidates during planning:

1. **Craig Mundie interview (ex-Microsoft)** — argues for "liberal education in technology" combining liberal arts + STEM
   - Source: Business Insider, Feb 2026
   - URL: https://www.businessinsider.com/ex-microsoft-exec-ai-expert-says-colleges-need-new-curriculum-2026-2
   - Tags: AI-era-skills, curriculum-reform

2. **"Why AI Makes a Liberal Arts Education Even More Invaluable"** — Ithaka S+R study on economic value; AAC&U/Morning Consult data showing 93% of employers value communication, critical thinking, ethical judgment
   - Source: US News Opinion, Jan 23, 2026
   - URL: https://www.usnews.com/opinion/articles/2026-01-20/college-ai-education-career-liberal-arts-opinion
   - Tags: employer-data, career-outcomes, research

3. **"In the age of AI, human skills are the new advantage"** — liberal arts as foundation for agency and self-governance; experience-based learning model
   - Source: World Economic Forum, Jan 2026
   - URL: https://www.weforum.org/stories/2026/01/ai-and-human-skills/
   - Tags: AI-era-skills, career-outcomes

4. **"Why liberal arts matter — even in the age of AI"** — tech exec with philosophy degree; Apple recruiting humanities grads; AAC&U employer survey data
   - Source: Community College Daily, Sept 2025
   - URL: https://www.ccdaily.com/2025/09/why-liberal-arts-matter-even-in-the-age-of-ai/
   - Tags: employer-data, career-outcomes, family-talking-points

## Existing Repo Structure

```
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── functions/
│   ├── index.js           # Cloud Function (API endpoint)
│   ├── programs.csv
│   ├── dcda-data.json
│   ├── core-curriculum.json
│   └── support-resources.csv
├── public/
│   ├── index.html         # Chat UI
│   ├── app.js             # Frontend JavaScript
│   └── style.css
├── prompts/               # System prompts for Claude
└── files/
    └── CLAUDE.md          # AI assistant reference
```

## First Steps in Code

1. Review existing Firestore structure and data files to understand how the chatbot currently accesses data
2. Review `functions/index.js` for the live system prompt (prompts/ is a reference copy)
3. Propose where and how the articles collection fits into the existing architecture
4. **Do not make code changes without permission** — propose changes first

## Other Related Projects

- **English Advising Wizard:** https://github.com/TCU-DCDA/english-advising-wizard (React/Vite/Tailwind, requirements tracking for English department)
- **DCDA Advising Chat:** https://dcda-advisor-chat.web.app/ (separate tool, DCDA-specific)
- **CDEx Inventory Management:** https://inventory.digitcu.org/

## Notes

- Potential collaborator: Sean (Geography faculty, strong tech skills) — not yet confirmed
- At least one workshop must be attended before submitting (first: Feb 9, 5-6pm, Rees-Jones Hall 101)
- The chatbot's POC deadline is April 30, 2026 — aligns well with the competition timeline