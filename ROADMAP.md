# AddRan Advisor Roadmap

## UI Enhancements

### ✅ Completed
- [x] Avatar icons (🎓 for assistant, 👤 for user)
- [x] Animated typing dots (bouncing dots instead of "Thinking...")
- [x] Suggested prompts (clickable chips for common questions)
- [x] Send button icon (paper plane instead of "Send" text)
- [x] Gradient header (polished purple gradient)
- [x] Chat bubble styling (white assistant, gradient user)
- [x] Bold text and bullet list support
- [x] Smart scroll (keeps question visible when response arrives)

### 🔜 Next Up
- [ ] **TCU/AddRan logo** - Replace 🎓 emoji with official branding
- [ ] **Timestamp badges** - Subtle time indicators on messages
- [ ] **Dark mode toggle** - Students love this
- [ ] **Feedback buttons** - 👍/👎 on responses for improvement data
- [ ] **Mobile polish** - Larger touch targets, better keyboard handling

### 💡 Future Ideas
- [ ] **Expandable program cards** - Interactive cards when listing majors
- [ ] **Advisor photos** - When suggesting "talk to an advisor"
- [ ] **Conversation export** - Save chat as PDF for reference
- [ ] **Voice input** - Microphone button for accessibility
- [ ] **Progress indicator** - Show when fetching program data

---

## Article Collection & Curation Pipeline

### Current State
- **4 verified articles** in Firestore with working URLs
- Articles tagged with: `family-talking-points`, `employer-data`, `AI-era-skills`, `career-outcomes`, `research`
- Chatbot includes articles in context for relevant queries

### Phase 1: Manual Curation (Current)
- [x] Firestore `articles` collection schema
- [x] Seed script for adding articles
- [x] Status field (`approved`, `pending`, `rejected`)
- [x] Tags for filtering by topic

### Phase 2: Streamlined Admin
- [ ] **Simple admin page** - Form to add articles without code
  - URL input → auto-fetch title, source, date
  - Tag checkboxes
  - Approve/reject buttons
- [ ] **Article preview** - See how article will appear in responses
- [ ] **Bulk import** - CSV upload for multiple articles

### Phase 3: Semi-Automated Discovery
- [ ] **RSS feed monitoring** - Track sources like:
  - Chronicle of Higher Education
  - Inside Higher Ed
  - World Economic Forum
  - Fast Company (work/education)
  - Harvard Business Review
- [ ] **Google Alerts integration** - "liberal arts career" / "humanities AI"
- [ ] **Weekly digest** - Email summary of new articles to review
- [ ] **Auto-tagging** - Suggest tags based on content keywords

### Phase 4: AI-Assisted Curation
- [ ] **Relevance scoring** - Claude rates article fit (1-10)
- [ ] **Summary generation** - Auto-generate article summaries
- [ ] **Duplicate detection** - Flag similar articles
- [ ] **Freshness tracking** - Alert when articles get stale (>1 year)
- [ ] **Source credibility** - Weight established sources higher

### Phase 5: Full Automation (Future)
- [ ] **Scheduled scraping** - Daily check of target sources
- [ ] **Auto-approval threshold** - High-confidence articles go live
- [ ] **A/B testing** - Track which articles students engage with
- [ ] **Feedback loop** - Demote articles that get 👎 reactions

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
- Harvard Business Review
- Fast Company
- Forbes (Education section)
- McKinsey Insights

### Tech & AI
- MIT Technology Review
- Wired
- The Verge
- Ars Technica

---

## Priority Order

1. **Admin page for articles** - Reduce friction for adding content
2. **Dark mode** - Quick win, high student appeal
3. **RSS monitoring** - Passive article discovery
4. **Feedback buttons** - Data for improvement
5. **AI-assisted curation** - Scale the pipeline

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

### Potential RSS Endpoints
- WEF: `https://www.weforum.org/feed/`
- Fast Company: `https://www.fastcompany.com/rss`
- Chronicle: `https://www.chronicle.com/feed`
