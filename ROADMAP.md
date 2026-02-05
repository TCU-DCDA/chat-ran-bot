# AddRan Advisor Roadmap

## UI Enhancements

### ✅ Completed
- [x] Avatar icons (CSS-based assistant & user avatars)
- [x] Animated typing dots (bouncing dots instead of "Thinking...")
- [x] Suggested prompts (clickable chips for common questions)
- [x] Send button icon (paper plane instead of "Send" text)
- [x] Gradient header (polished purple gradient)
- [x] Chat bubble styling (white assistant, gradient user)
- [x] Bold text and bullet list support
- [x] Smart scroll (keeps question visible when response arrives)
- [x] **TCU/AddRan logo** - SVG wordmark replacing emoji header
- [x] **Dark mode toggle** - CSS custom properties with theme persistence
- [x] **Feedback buttons** - Thumbs up/down on responses, logged to Firestore
- [x] **Fix horizontal drift on mobile** - Overflow containment, word-break, iOS zoom prevention
- [x] **Mobile polish** - Tighter spacing, larger touch targets, responsive font sizes
- [x] **Timestamp badges** - Hover-reveal time indicators on messages
- [x] **Header redesign** - Left-aligned app-bar layout (logo + actions top, title below)

### 💡 Future Ideas
- [ ] **Expandable program cards** - Interactive cards when listing majors
- [ ] **Advisor photos** - When suggesting "talk to an advisor"
- [ ] **Conversation export** - Save chat as PDF for reference
- [ ] **Voice input** - Microphone button for accessibility
- [ ] **Progress indicator** - Show when fetching program data
- [ ] **Conversation history** - Let returning students pick up where they left off

---

## Program Data

### ✅ Completed
- [x] 23 program detail JSON files extracted from Excel spreadsheets
- [x] Extraction pipeline (`scripts/extract_programs.py`) with verification
- [x] Program details wired into chatbot system prompt (~4,800 tokens)
- [x] DCDA dedicated data file with full course listings
- [x] Core Curriculum data (Fall 2025+) with rules and requirements
- [x] English Department hand-curated Spring 2026 highlights
- [x] Support resources CSV (career services, tutoring, etc.)

### 🔜 Next Up
- [ ] **Periodic re-extraction** - Update JSONs when Excel files change
- [ ] **Minor programs** - Add minor/certificate data if available

---

## Article Collection & Curation Pipeline

### ✅ Phase 1: Manual Curation
- [x] Firestore `articles` collection schema
- [x] Seed script for adding articles
- [x] Status field (`approved`, `pending`, `rejected`)
- [x] Tags for filtering by topic

### ✅ Phase 2: Streamlined Admin
- [x] **Admin dashboard** - Full CRUD for articles at `/admin.html`
  - URL input with auto-fetch title, source, date
  - Tag checkboxes (use case + soft skill tags)
  - Approve/reject/pending status
- [ ] **Article preview** - See how article will appear in responses
- [ ] **Bulk import** - CSV upload for multiple articles

### ✅ Phase 3: Semi-Automated Discovery (Partial)
- [x] **RSS feed monitoring** - Fast Company, Harvard Business Review, NYT
- [x] **OpenAlex academic search** - Finds relevant scholarly papers
- [x] **Scheduled RSS checking** - Cloud Function runs on schedule
- [ ] **Google Alerts integration** - "liberal arts career" / "humanities AI"
- [ ] **Weekly digest** - Email summary of new articles to review
- [x] **Auto-tagging** - Claude suggests tags when articles are ingested

### ✅ Phase 4: AI-Assisted Curation (Partial)
- [x] **Summary generation** - Claude auto-generates concise summaries for RSS/OpenAlex articles
- [x] **Auto-tagging** - Claude suggests relevant tags from predefined list
- [ ] **Relevance scoring** - Claude rates article fit (1-10)
- [ ] **Duplicate detection** - Flag similar articles
- [ ] **Freshness tracking** - Alert when articles get stale (>1 year)
- [ ] **Source credibility** - Weight established sources higher

### 💡 Phase 5: Full Automation (Future)
- [ ] **Scheduled scraping** - Daily check of target sources
- [ ] **Auto-approval threshold** - High-confidence articles go live
- [ ] **A/B testing** - Track which articles students engage with
- [ ] **Feedback loop** - Demote articles that get negative reactions

---

## Article Sources to Monitor

### Higher Education
- Chronicle of Higher Education
- Inside Higher Ed
- Times Higher Education
- AAC&U (Association of American Colleges & Universities)

### Career & Workforce
- World Economic Forum (Future of Jobs)
- LinkedIn Economic Graph
- NACE (National Association of Colleges and Employers)
- Bureau of Labor Statistics

### Business & Leadership
- Harvard Business Review ✅ (RSS active)
- Fast Company ✅ (RSS active)
- Forbes (Education section)
- McKinsey Insights

### News
- New York Times ✅ (RSS active)

### Academic
- OpenAlex ✅ (API active)

### Tech & AI
- MIT Technology Review
- Wired
- The Verge
- Ars Technica

---

## Priority Order

1. ~~Admin page for articles~~ ✅
2. ~~Dark mode~~ ✅
3. ~~RSS monitoring~~ ✅
4. ~~Feedback buttons~~ ✅
5. ~~Fix mobile horizontal drift~~ ✅
6. ~~Mobile polish~~ ✅
7. ~~AI-assisted curation~~ ✅
8. ~~Timestamp badges~~ ✅
9. ~~Header redesign~~ ✅
10. **Relevance scoring** - Claude rates article fit (1-10)
11. **Expandable program cards** - Interactive cards when listing majors
12. **Conversation export** - Save chat as PDF for reference

---

## Technical Notes

### Article Schema
```javascript
{
  title: "Article Title",
  source: "Publication Name",
  url: "https://...",
  date: Timestamp,
  summary: "2-3 sentence summary for context",
  tags: ["family-talking-points", "employer-data"],
  status: "approved" | "pending" | "rejected",
  created_at: Timestamp,
  reviewed_at: Timestamp,
  reviewed_by: "admin-email" // future
}
```

### Program Data Schema
```javascript
{
  name: "Anthropology",
  abbreviation: "ANTH",
  degree: "BA",
  totalHours: 30,
  url: "https://www.tcu.edu/academics/programs/anthropology.php",
  descriptions: ["paragraph 1", "paragraph 2"],
  requirements: {
    requiredCourses: { hours: 9, courses: ["ANTH 20613 - Intro...", ...] },
    electiveCourses: { hours: 21, description: "..." }
  },
  careerOptions: ["Non-profit Manager", ...],
  contacts: [{ role: "Department Chair", name: "...", email: "...", phone: "..." }],
  internship: { description: "..." }
}
```

### Active RSS Endpoints
- Fast Company: `https://www.fastcompany.com/latest/rss?truncated=true`
- Harvard Business Review: `https://feeds.hbr.org/harvardbusiness`
- New York Times (Education): `https://rss.nytimes.com/services/xml/rss/nyt/Education.xml`

### Potential RSS Endpoints
- WEF: `https://www.weforum.org/feed/`
- Chronicle: `https://www.chronicle.com/feed`
