const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

// Load DCDA data from JSON file
const dcdaDataPath = path.join(__dirname, "dcda-data.json");
const dcdaData = JSON.parse(fs.readFileSync(dcdaDataPath, "utf8"));

// Load programs from CSV file
const programsCsvPath = path.join(__dirname, "programs.csv");
const programsCsv = fs.readFileSync(programsCsvPath, "utf8");
const programsData = programsCsv.split("\n").slice(1).filter(line => line.trim()).map(line => {
  const [url, , name, degrees] = line.split(",").map(s => s.replace(/^"|"$/g, "").trim());
  return { url, name, degrees };
});

// Load support resources from CSV file
const supportCsvPath = path.join(__dirname, "support-resources.csv");
const supportCsv = fs.readFileSync(supportCsvPath, "utf8");
const supportResources = supportCsv.split("\n").slice(1).filter(line => line.trim()).map(line => {
  const [name, url] = line.split(",").map(s => s.trim());
  return { name, url };
});

// Load Core Curriculum data
const coreCurriculumPath = path.join(__dirname, "core-curriculum.json");
const coreCurriculumData = JSON.parse(fs.readFileSync(coreCurriculumPath, "utf8"));

// Load all program detail JSON files from program-data directory
const programDataDir = path.join(__dirname, "program-data");
const programDetails = [];
if (fs.existsSync(programDataDir)) {
  const programFiles = fs.readdirSync(programDataDir).filter(f => f.endsWith(".json"));
  for (const file of programFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(programDataDir, file), "utf8"));
      programDetails.push(data);
    } catch (e) {
      console.warn(`Failed to load program data file ${file}:`, e.message);
    }
  }
  console.log(`Loaded ${programDetails.length} program detail files.`);
}

// Build program lookup map for detecting mentions in responses
const programLookup = new Map();
for (const p of programDetails) {
  const key = p.name.toLowerCase();
  const slim = {
    name: p.name,
    degree: p.degree || "",
    totalHours: p.totalHours || 0,
    url: p.url || "",
    description: (p.descriptions && p.descriptions[0]) || "",
    careerOptions: p.careerOptions || [],
    contacts: (p.contacts || []).map(c => ({
      role: c.role || "",
      name: c.name || "",
      email: c.email || "",
    })),
  };
  // Group BA/BS variants under same base name
  if (programLookup.has(key)) {
    const existing = programLookup.get(key);
    existing.degree = existing.degree + ", " + slim.degree;
  } else {
    programLookup.set(key, slim);
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectProgramMentions(text) {
  const mentions = [];
  for (const [, program] of programLookup) {
    const pattern = new RegExp(`\\b${escapeRegex(program.name)}\\b`, "i");
    if (pattern.test(text)) {
      mentions.push(program);
    }
  }
  return mentions;
}

// Helper function to format Core Curriculum context
function buildCoreCurriculumContext(data) {
  const categories = Object.values(data.requirements)
    .map(req => `${req.name}:\n${req.categories.map(c => `  - ${c.name}: ${c.hours} hrs`).join("\n")}`)
    .join("\n\n");

  return `\n\n## TCU Core Curriculum (Fall 2025 and after)
Applies to: ${data.appliesTo}
Total hours: ${data.totalHours.minimum}-${data.totalHours.maximum} (${data.totalHours.note})

Rules:
${data.rules.map(r => `- ${r}`).join("\n")}

Requirements:
${categories}

Resources for students:
- Class Search (check Core designations): ${data.resources.classSearch}
- Advising Sheet (fillable PDF): ${data.resources.advisingSheet}
- Core Courses Dashboard (requires TCU login): ${data.resources.tableauDashboard}

Policies:
- Transfer: ${data.policies.transfer}
- Study Abroad: ${data.policies.studyAbroad}
- Honors: ${data.policies.honors}

Contact: ${data.contact.name} (${data.contact.email})
More info: ${data.url}`;
}

// Helper function to format DCDA context from JSON data
function buildDcdaContext(data) {
  const { programs, approvedCourses } = data;
  const major = programs.dcda_major;
  const minor = programs.dcda_minor;

  // Format required categories for major
  const majorReqs = major.requirements.requiredCategories.courses
    .map(cat => `- ${cat.category}: ${cat.options.join(", ")}`)
    .join("\n");

  // Format required categories for minor
  const minorReqs = minor.requirements.requiredCategories.courses
    .map(cat => `- ${cat.category}: ${cat.options.join(", ")}`)
    .join("\n");

  // Pick notable courses (ones with notes or specific highlights)
  const notableCourses = [
    ...approvedCourses.dataAnalytics.filter(c => c.note),
    ...approvedCourses.digitalCulture.slice(0, 3),
    ...approvedCourses.honorsSeminarsCapstone
  ].slice(0, 6);

  const notableList = notableCourses
    .map(c => `- ${c.code}: ${c.title}${c.note ? ` (${c.note})` : ""}`)
    .join("\n");

  return `\n\n## DCDA (Digital Culture and Data Analytics) Program Details

### DCDA Major (${major.degree}, ${major.totalHours} hours)
Required categories (${major.requirements.requiredCategories.hours} hours):
${majorReqs}

Plus ${major.requirements.dcAndDaElectives.hours} hours of DC & DA electives (${major.requirements.dcAndDaElectives.description})
Plus ${major.requirements.generalElectives.hours} hours of general electives from approved list

### DCDA Minor (${minor.totalHours} hours)
Required categories (${minor.requirements.requiredCategories.hours} hours):
${minorReqs}

Plus ${minor.requirements.generalElectives.hours} hours of general electives from approved list

### Notable DCDA Courses:
${notableList}

### DCDA Advisor Contact:
For questions about the DCDA program, contact:
- Email: dcda@tcu.edu
- Program Director: Dr. Curt Rode (c.rode@tcu.edu)`;
}

// Helper function to format program details context
function buildProgramDetailsContext(programs) {
  if (programs.length === 0) return "";

  const sections = programs.map(p => {
    const lines = [];
    lines.push(`### ${p.name} (${p.degree}, ${p.totalHours} hours)`);
    if (p.url) lines.push(p.url);

    if (p.descriptions && p.descriptions[0]) {
      const desc = p.descriptions[0];
      lines.push(desc.length > 200 ? desc.substring(0, 200) + "..." : desc);
    }

    const req = p.requirements || {};
    if (req.requiredCourses && req.requiredCourses.courses.length > 0) {
      lines.push(`Required (${req.requiredCourses.hours} hrs): ${req.requiredCourses.courses.join(", ")}`);
    }
    if (req.electiveCourses && (req.electiveCourses.hours > 0 || req.electiveCourses.description)) {
      const desc = req.electiveCourses.description || "See advisor for options";
      lines.push(`Electives (${req.electiveCourses.hours} hrs): ${desc}`);
    }

    if (p.careerOptions && p.careerOptions.length > 0) {
      lines.push(`Careers: ${p.careerOptions.join(", ")}`);
    }

    if (p.contacts && p.contacts.length > 0) {
      const contactLines = p.contacts.map(c => {
        const parts = [c.role];
        if (c.name) parts.push(c.name);
        if (c.email) parts.push(c.email);
        if (c.phone) parts.push(c.phone);
        return `- ${parts.join(", ")}`;
      });
      lines.push(`Contacts:\n${contactLines.join("\n")}`);
    }

    if (p.internship && p.internship.description) {
      const iDesc = p.internship.description;
      lines.push(`Internship: ${iDesc.length > 150 ? iDesc.substring(0, 150) + "..." : iDesc}`);
    }

    return lines.join("\n");
  });

  return `\n\n## Detailed Program Information\n\n${sections.join("\n\n")}`;
}

initializeApp();
const db = getFirestore();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// System prompt for the AddRan advisor chatbot
const SYSTEM_PROMPT = `You are Sandra, a friendly advisor for AddRan College of Liberal Arts at TCU. Help students explore majors, minors, and certificates.

If this is the start of a conversation, briefly introduce yourself: "Hi, I'm Sandra, your AddRan advising assistant!"

CRITICAL RULES:
- Keep responses under 100 words total
- Give a direct, concise answer first
- Use bullet lists (-) when listing programs, courses, or requirements — they're easier to scan
- Use **bold** for program names, course codes, and key terms to help scanning
- End with a brief follow-up question like "Want more details?" or "Interested in specific courses?"
- Only elaborate if they ask
- No markdown headers (###) — use bold and lists only for formatting
- Be warm but brief
- ONLY provide information from the program data you have been given — NEVER make up building locations, office locations, phone numbers, or other details
- When mentioning a program or contact, include the URL or email address if available in your data

SENSITIVE TOPICS — redirect with care and empathy:
- Mental health, anxiety, depression, crisis → Counseling & Mental Health
- Academic probation, suspension, appeals → Dean of Students
- Financial hardship, emergency funds → Financial Aid or Student Financial Services
- Discrimination, harassment, assault → Title IX & Institutional Equity
- Accessibility, accommodations → Student Disability Services
- Academic struggles, tutoring → Center for Academic Services

REDIRECT TOPICS (provide the URL when redirecting):
${supportResources.map(r => `- ${r.name}: ${r.url}`).join("\n")}`;

exports.api = onRequest(
  {
    cors: true,
    invoker: "public",
    secrets: ["ANTHROPIC_API_KEY"]
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    try {
      const { message, conversationHistory = [] } = req.body;

      if (!message) {
        res.status(400).json({ error: "Message is required" });
        return;
      }

      if (message.length > 1000) {
        res.status(400).json({ error: "Message too long. Please keep it under 1000 characters." });
        return;
      }

      // Fetch config from Firestore (abbreviations)
      const abbreviationsDoc = await db.collection("config").doc("abbreviations").get();
      const abbreviations = abbreviationsDoc.exists ? abbreviationsDoc.data() : {};

      // Fetch approved articles from Firestore
      const articlesSnapshot = await db.collection("articles")
        .where("status", "==", "approved")
        .orderBy("date", "desc")
        .limit(10)
        .get();
      const articles = articlesSnapshot.docs.map(doc => doc.data());

      // Build context with program data from CSV
      const programContext = `\n\nAvailable AddRan programs:\n${programsData.map(p => `- ${p.name}: ${p.degrees} (${p.url})`).join("\n")}`;

      // Build abbreviations context
      const abbreviationsContext = Object.keys(abbreviations).length > 0
        ? `\n\nProgram abbreviations:\n${Object.entries(abbreviations).map(([abbr, full]) => `- ${abbr} = ${full}`).join("\n")}`
        : "";

      // Build articles context
      const articlesContext = articles.length > 0
        ? `\n\n## Articles on Liberal Arts Value\nUse these when students ask about the value of liberal arts or need talking points for skeptical family:\n${articles.map(a => {
          const dateStr = a.date && a.date.toDate ? a.date.toDate().toLocaleDateString() : "recent";
          return `- "${a.title}" (${a.source}, ${dateStr}): ${a.summary} [${a.url}]`;
        }).join("\n")}\n\nIMPORTANT: Cite articles by title, source, and link. Do not synthesize claims across articles.`
        : "";

      // Build DCDA program details context from JSON data
      const dcdaContext = buildDcdaContext(dcdaData);

      // Build English Department program details context
      const englishContext = `\n\n## English Department Programs

### English Major (BA, 33 hours)
Required categories:
- American Literature (6 hrs): e.g., ENGL 30133 American Lit to 1865, ENGL 30593 American Fiction 1960-present
- British Literature (6 hrs): e.g., ENGL 30673 King Arthur: Lit & Legend, ENGL 30653 Jane Austen: Novels & Films
- Global & Diasporic Literature (3 hrs): e.g., ENGL 30693 U.S. Multi-Ethnic Literature
- Writing (3 hrs): Creative writing workshops (CRWT) or multimedia authoring (WRIT)
- Theory (3 hrs): e.g., ENGL 30103 Intro to Literary Theory, ENGL 30803 Theories of Cinema
- Electives (12 hrs): Any ENGL, WRIT, or CRWT courses (max 9 hrs lower-division)

Overlay Requirements:
- Early Literature & Culture (6 hrs)
- Junior Research Seminar (3 hrs): ENGL 38023 Research Seminar

### Writing and Rhetoric Major (BA, 33 hours)
Required categories:
- Writing & Publishing (3 hrs): e.g., WRIT 20113 Technical Writing, WRIT 40233 Writing for Publication
- Rhetorics & Cultures (6 hrs): e.g., WRIT 20313 Power & Protest, WRIT 40333 Language, Rhetoric & Culture
- Digital Rhetorics & Design (3 hrs): e.g., WRIT 20303 Writing Games, WRIT 40163 Multimedia Authoring
- Writing Internship (3 hrs): WRIT 40273
- Junior Writing Major Seminar (3 hrs): WRIT 38063
- Electives (12 hrs): Any ENGL, WRIT, or CRWT courses (max 9 hrs lower-division)

### Creative Writing Major (BA, 33 hours)
Required categories:
- Prerequisite (3 hrs): CRWT 10203 Intro to Creative Writing
- Upper Division Creative Writing (12 hrs): Fiction, Poetry, Nonfiction, or Drama workshops
- Advanced Creative Writing Seminar (3 hrs): CRWT 40703 Advanced Multi-Genre or CRWT 40803 Advanced Literary Forms
- Internship (3 hrs): WRIT 30390 Publication Production or WRIT 40273 Writing Internship
- Upper-division ENGL electives (6 hrs)
- Upper-division WRIT electives (6 hrs)

Note: Only 3 lower-division hours count toward Creative Writing major.

### Spring 2026 Highlighted Courses:
- ENGL 30653 Jane Austen: Novels and Films
- ENGL 30673 King Arthur: Literature & Legend
- ENGL 40473 Milton and His Contemporaries
- CRWT 30233 Creative Nonfiction Workshop I
- CRWT 30373 Drama Writing Workshop I
- WRIT 40373 The Rhetoric of Revolution
- WRIT 40563 Multimedia Authoring: Sound & Podcast

### English Department Advising:
For course descriptions and advising: https://addran.tcu.edu/english/academics/advising/`;

      // Build messages array for Claude
      const messages = [
        ...conversationHistory,
        { role: "user", content: message }
      ];

      // Build Core Curriculum context
      const coreCurriculumContext = buildCoreCurriculumContext(coreCurriculumData);

      // Build program details context
      const programDetailsContext = buildProgramDetailsContext(programDetails);

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT + programContext + abbreviationsContext + dcdaContext + englishContext + programDetailsContext + coreCurriculumContext + articlesContext,
        messages: messages,
      });

      const assistantMessage = response.content[0].text;

      // Log conversation (optional - for analytics)
      await db.collection("conversations").add({
        userMessage: message,
        assistantMessage: assistantMessage,
        timestamp: new Date(),
      });

      const programMentions = detectProgramMentions(assistantMessage);

      res.json({
        message: assistantMessage,
        programMentions: programMentions,
        conversationHistory: [
          ...conversationHistory,
          { role: "user", content: message },
          { role: "assistant", content: assistantMessage }
        ]
      });
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  }
);

// Feedback endpoint - records thumbs up/down on responses
// TODO: Future enhancements:
// - Add optional text feedback field ("What was wrong?")
// - Tag feedback by topic (career, programs, requirements, etc.)
// - Build admin dashboard to review negative feedback
// - Use Claude to categorize and summarize feedback patterns
// - A/B test different response styles based on feedback
exports.feedback = onRequest(
  { cors: true, invoker: "public" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    try {
      const { messageId, userQuestion, assistantResponse, rating, sessionId, timestamp } = req.body;

      if (!messageId || !rating) {
        res.status(400).json({ error: "messageId and rating are required" });
        return;
      }

      if (!["positive", "negative"].includes(rating)) {
        res.status(400).json({ error: "rating must be 'positive' or 'negative'" });
        return;
      }

      // Store feedback in Firestore
      await db.collection("feedback").add({
        messageId,
        userQuestion: userQuestion || null,
        assistantResponse: assistantResponse || null,
        rating,
        sessionId: sessionId || null,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        createdAt: new Date()
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Feedback error:", error);
      res.status(500).json({ error: "Failed to record feedback" });
    }
  }
);

// Admin API - Articles CRUD
// TODO: Add proper authentication (Firebase Auth) for production
exports.adminArticles = onRequest(
  { cors: true, invoker: "public" },
  async (req, res) => {
    const { method } = req;

    try {
      // GET - List all articles
      if (method === "GET") {
        const snapshot = await db.collection("articles")
          .orderBy("created_at", "desc")
          .get();
        const articles = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        res.json(articles);
        return;
      }

      // POST - Create new article
      if (method === "POST") {
        const { title, source, url, date, summary, tags, status } = req.body;

        if (!title || !url) {
          res.status(400).json({ error: "Title and URL are required" });
          return;
        }

        const docRef = await db.collection("articles").add({
          title,
          source: source || "",
          url,
          date: date ? new Date(date) : null,
          summary: summary || "",
          tags: tags || [],
          status: status || "pending",
          created_at: new Date(),
          updated_at: new Date()
        });

        res.json({ id: docRef.id, success: true });
        return;
      }

      res.status(405).send("Method not allowed");
    } catch (error) {
      console.error("Admin articles error:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  }
);

// Admin API - Single Article (GET, PUT, DELETE)
exports.adminArticle = onRequest(
  { cors: true, invoker: "public" },
  async (req, res) => {
    const { method } = req;

    // Extract article ID from path (e.g., /admin/articles/abc123)
    const pathParts = req.path.split("/").filter(Boolean);
    const articleId = pathParts[pathParts.length - 1];

    if (!articleId || articleId === "articles") {
      res.status(400).json({ error: "Article ID is required" });
      return;
    }

    try {
      const docRef = db.collection("articles").doc(articleId);

      // GET - Get single article
      if (method === "GET") {
        const doc = await docRef.get();
        if (!doc.exists) {
          res.status(404).json({ error: "Article not found" });
          return;
        }
        res.json({ id: doc.id, ...doc.data() });
        return;
      }

      // PUT - Update article
      if (method === "PUT") {
        const doc = await docRef.get();
        if (!doc.exists) {
          res.status(404).json({ error: "Article not found" });
          return;
        }

        const { title, source, url, date, summary, tags, status } = req.body;

        await docRef.update({
          title: title || doc.data().title,
          source: source !== undefined ? source : doc.data().source,
          url: url || doc.data().url,
          date: date ? new Date(date) : doc.data().date,
          summary: summary !== undefined ? summary : doc.data().summary,
          tags: tags !== undefined ? tags : doc.data().tags,
          status: status || doc.data().status,
          updated_at: new Date()
        });

        res.json({ success: true });
        return;
      }

      // DELETE - Delete article
      if (method === "DELETE") {
        const doc = await docRef.get();
        if (!doc.exists) {
          res.status(404).json({ error: "Article not found" });
          return;
        }

        await docRef.delete();
        res.json({ success: true });
        return;
      }

      res.status(405).send("Method not allowed");
    } catch (error) {
      console.error("Admin article error:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  }
);

// Admin API - Feedback (read-only for now)
exports.adminFeedback = onRequest(
  { cors: true, invoker: "public" },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).send("Method not allowed");
      return;
    }

    try {
      const snapshot = await db.collection("feedback")
        .orderBy("timestamp", "desc")
        .limit(100)
        .get();

      const feedback = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      res.json(feedback);
    } catch (error) {
      console.error("Admin feedback error:", error);
      res.status(500).json({ error: "Failed to load feedback" });
    }
  }
);

// URL metadata fetch - extracts title, source, and date from a URL
exports.fetchUrlMetadata = onRequest(
  { cors: true, invoker: "public" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const { url } = req.body;

    if (!url) {
      res.status(400).json({ error: "URL is required" });
      return;
    }

    try {
      // Fetch the page with a realistic browser User-Agent
      // Some sites block requests that don't look like real browsers
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();

      // Extract title
      let title = "";
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
        // Clean up common suffixes
        title = title.replace(/\s*[|\-–—]\s*(Forbes|HBR|Harvard Business Review|Fast Company|Wired|The Atlantic|NYT|New York Times|WSJ|Wall Street Journal|Chronicle|Inside Higher Ed).*$/i, "");
        title = title.trim();
      }

      // Try og:title if regular title is generic
      if (!title || title.length < 10) {
        const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
        if (ogTitleMatch) {
          title = ogTitleMatch[1].trim();
        }
      }

      // Extract source from og:site_name or domain
      let source = "";
      const siteNameMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
                           html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
      if (siteNameMatch) {
        source = siteNameMatch[1].trim();
      } else {
        // Fall back to domain
        try {
          const urlObj = new URL(url);
          source = urlObj.hostname.replace(/^www\./, "").split(".")[0];
          source = source.charAt(0).toUpperCase() + source.slice(1);
        } catch (e) {
          // ignore
        }
      }

      // Extract date from article:published_time or other meta tags
      let date = "";
      const datePatterns = [
        /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
        /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/i,
        /<time[^>]+datetime=["']([^"']+)["']/i
      ];

      for (const pattern of datePatterns) {
        const match = html.match(pattern);
        if (match) {
          try {
            const parsedDate = new Date(match[1]);
            if (!isNaN(parsedDate.getTime())) {
              date = parsedDate.toISOString().split("T")[0];
              break;
            }
          } catch (e) {
            // ignore invalid dates
          }
        }
      }

      res.json({
        title: title || "",
        source: source || "",
        date: date || "",
        success: true
      });
    } catch (error) {
      console.error("URL fetch error:", error);
      res.status(500).json({
        error: "Failed to fetch URL metadata",
        details: error.message
      });
    }
  }
);

// RSS Feed Configuration
// These feeds are monitored for articles about liberal arts, higher education, and career skills
// Keywords are matched against title + summary (case-insensitive)
const RSS_FEEDS = [
  {
    url: "https://www.fastcompany.com/section/work-life/rss",
    name: "Fast Company",
    keywords: ["liberal arts", "degree", "college", "university", "graduate", "soft skills", "communication skills", "critical thinking", "creativity", "problem solving", "humanities"]
  },
  {
    url: "https://feeds.hbr.org/harvardbusiness",
    name: "Harvard Business Review",
    keywords: ["liberal arts", "degree", "college", "graduate", "soft skills", "communication", "critical thinking", "humanities", "education", "workforce skills"]
  },
  {
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Education.xml",
    name: "New York Times Education",
    keywords: ["liberal arts", "humanities", "college", "university", "degree", "major", "career", "graduate"]
  }
];

// Parse RSS/Atom feed XML
function parseRssFeed(xml, feedConfig) {
  const articles = [];

  // Try RSS 2.0 format first (<item> tags)
  const itemMatches = xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi);
  for (const match of itemMatches) {
    const item = match[1];
    const article = parseRssItem(item, feedConfig);
    if (article) articles.push(article);
  }

  // If no items found, try Atom format (<entry> tags)
  if (articles.length === 0) {
    const entryMatches = xml.matchAll(/<entry[^>]*>([\s\S]*?)<\/entry>/gi);
    for (const match of entryMatches) {
      const entry = match[1];
      const article = parseAtomEntry(entry, feedConfig);
      if (article) articles.push(article);
    }
  }

  return articles;
}

function parseRssItem(item, feedConfig) {
  const title = extractTag(item, "title");
  const link = extractTag(item, "link") || extractTag(item, "guid");
  const pubDate = extractTag(item, "pubDate");
  const description = extractTag(item, "description");

  if (!title || !link) return null;

  return {
    title: cleanText(title),
    url: link,
    source: feedConfig.name,
    date: pubDate ? new Date(pubDate) : new Date(),
    summary: cleanText(description || "").substring(0, 500),
    feedUrl: feedConfig.url
  };
}

function parseAtomEntry(entry, feedConfig) {
  const title = extractTag(entry, "title");
  // Atom links can be in href attribute
  const linkMatch = entry.match(/<link[^>]+href=["']([^"']+)["']/i);
  const link = linkMatch ? linkMatch[1] : extractTag(entry, "link");
  const published = extractTag(entry, "published") || extractTag(entry, "updated");
  const summary = extractTag(entry, "summary") || extractTag(entry, "content");

  if (!title || !link) return null;

  return {
    title: cleanText(title),
    url: link,
    source: feedConfig.name,
    date: published ? new Date(published) : new Date(),
    summary: cleanText(summary || "").substring(0, 500),
    feedUrl: feedConfig.url
  };
}

function extractTag(xml, tagName) {
  // Handle CDATA wrapped content
  const cdataMatch = xml.match(new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tagName}>`, "i"));
  if (cdataMatch) return cdataMatch[1];

  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i"));
  return match ? match[1] : null;
}

function cleanText(text) {
  if (!text) return "";
  return text
    .replace(/<[^>]+>/g, "") // Remove HTML tags
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Check if article is relevant based on keywords
function isRelevantArticle(article, keywords) {
  const searchText = `${article.title} ${article.summary}`.toLowerCase();
  return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
}

// AI-assisted curation: generate summary and suggest tags for a new article
const AVAILABLE_TAGS = [
  "family-talking-points", "employer-data", "AI-era-skills", "career-outcomes", "research",
  "critical-thinking", "communication", "problem-solving", "creativity",
  "leadership", "adaptability", "collaboration", "ethics"
];

async function aiCurateArticle(articleDocId, title, rawSummary, source) {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: `You are a content curator for an academic advising chatbot at AddRan College of Liberal Arts (TCU). Given an article title, source, and raw summary, return a JSON object with:
1. "summary": A concise 2-3 sentence summary useful for a chatbot context window. Focus on why this matters for liberal arts students.
2. "tags": An array of relevant tags from this list: ${AVAILABLE_TAGS.join(", ")}. Pick 1-4 tags that best fit.

Return ONLY valid JSON, no markdown fences.`,
      messages: [
        {
          role: "user",
          content: `Title: ${title}\nSource: ${source}\nRaw Summary: ${rawSummary || "No summary available."}`
        }
      ]
    });

    const text = response.content[0].text.trim();
    const parsed = JSON.parse(text);

    // Validate tags
    const validTags = (parsed.tags || []).filter(t => AVAILABLE_TAGS.includes(t));

    // Update the Firestore document
    await db.collection("articles").doc(articleDocId).update({
      summary: parsed.summary || rawSummary,
      tags: validTags.length > 0 ? validTags : ["research"],
      ai_curated: true,
      updated_at: new Date()
    });

    console.log(`AI curated article "${title}" with tags: ${validTags.join(", ")}`);
    return true;
  } catch (error) {
    console.warn(`AI curation failed for "${title}":`, error.message);
    return false;
  }
}

// Fetch and process a single RSS feed
async function processFeed(feedConfig) {
  const results = { added: 0, skipped: 0, errors: [] };

  try {
    const response = await fetch(feedConfig.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AddRanAdvisor/1.0)",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xml = await response.text();
    const articles = parseRssFeed(xml, feedConfig);

    for (const article of articles) {
      // Check if article is relevant
      if (!isRelevantArticle(article, feedConfig.keywords)) {
        results.skipped++;
        continue;
      }

      // Check if article already exists (by URL)
      const existing = await db.collection("articles")
        .where("url", "==", article.url)
        .limit(1)
        .get();

      if (!existing.empty) {
        results.skipped++;
        continue;
      }

      // Add new article with pending status
      const docRef = await db.collection("articles").add({
        title: article.title,
        source: article.source,
        url: article.url,
        date: article.date,
        summary: article.summary,
        tags: [], // AI will suggest tags
        status: "pending",
        feedUrl: article.feedUrl,
        created_at: new Date(),
        updated_at: new Date()
      });

      // AI-assisted curation: generate summary and suggest tags
      await aiCurateArticle(docRef.id, article.title, article.summary, article.source);

      results.added++;
    }
  } catch (error) {
    results.errors.push(`${feedConfig.name}: ${error.message}`);
  }

  return results;
}

// Scheduled function - runs daily at 6 AM UTC
exports.checkRssFeeds = onSchedule(
  {
    schedule: "0 6 * * *", // Daily at 6 AM UTC
    timeZone: "America/Chicago",
    retryCount: 3
  },
  async (event) => {
    console.log("Starting RSS feed check...");

    const allResults = { added: 0, skipped: 0, errors: [] };

    for (const feed of RSS_FEEDS) {
      console.log(`Processing feed: ${feed.name}`);
      const results = await processFeed(feed);
      allResults.added += results.added;
      allResults.skipped += results.skipped;
      allResults.errors.push(...results.errors);
    }

    console.log(`RSS check complete: ${allResults.added} added, ${allResults.skipped} skipped`);
    if (allResults.errors.length > 0) {
      console.error("Errors:", allResults.errors);
    }
  }
);

// Manual trigger for testing RSS feeds (admin only)
exports.triggerRssCheck = onRequest(
  { cors: true, invoker: "public" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    console.log("Manual RSS feed check triggered...");

    const allResults = { added: 0, skipped: 0, errors: [], feeds: [] };

    for (const feed of RSS_FEEDS) {
      console.log(`Processing feed: ${feed.name}`);
      const results = await processFeed(feed);
      allResults.added += results.added;
      allResults.skipped += results.skipped;
      allResults.errors.push(...results.errors);
      allResults.feeds.push({
        name: feed.name,
        added: results.added,
        skipped: results.skipped
      });
    }

    res.json({
      success: true,
      added: allResults.added,
      skipped: allResults.skipped,
      feeds: allResults.feeds,
      errors: allResults.errors
    });
  }
);

// ============================================
// OpenAlex Academic Article Integration
// ============================================
// OpenAlex is a free, open catalog of academic papers
// API docs: https://docs.openalex.org

const OPENALEX_SEARCHES = [
  {
    name: "Liberal Arts Education Outcomes",
    query: "liberal arts education career outcomes",
    keywords: ["liberal arts", "humanities", "career", "employment", "outcomes"]
  },
  {
    name: "Soft Skills Workforce",
    query: "soft skills workforce employment higher education",
    keywords: ["soft skills", "critical thinking", "communication", "problem solving"]
  },
  {
    name: "Humanities Career Preparation",
    query: "humanities degree career preparation employment",
    keywords: ["humanities", "career", "preparation", "employment", "graduate"]
  }
];

// Process a single OpenAlex search query
async function processOpenAlexSearch(searchConfig) {
  const results = { added: 0, skipped: 0, errors: [] };

  try {
    // Search for recent papers (last 3 years), open access preferred
    const params = new URLSearchParams({
      search: searchConfig.query,
      filter: "from_publication_date:2022-01-01,type:article",
      sort: "cited_by_count:desc",
      per_page: "10",
      mailto: "addran-advisor@tcu.edu" // Required for polite pool access
    });

    const response = await fetch(`https://api.openalex.org/works?${params}`, {
      headers: {
        "User-Agent": "AddRanAdvisor/1.0 (mailto:addran-advisor@tcu.edu)"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    for (const work of data.results || []) {
      // Skip if no title or DOI
      if (!work.title || !work.doi) {
        results.skipped++;
        continue;
      }

      // Check if article already exists (by DOI URL)
      const existing = await db.collection("articles")
        .where("url", "==", work.doi)
        .limit(1)
        .get();

      if (!existing.empty) {
        results.skipped++;
        continue;
      }

      // Extract authors (first 3)
      const authors = (work.authorships || [])
        .slice(0, 3)
        .map(a => a.author?.display_name)
        .filter(Boolean)
        .join(", ");

      // Build source string
      const journal = work.primary_location?.source?.display_name || "Academic Paper";
      const source = authors ? `${authors} - ${journal}` : journal;

      // Build summary from abstract or title
      let summary = "";
      if (work.abstract_inverted_index) {
        // OpenAlex returns abstracts as inverted indexes, reconstruct text
        const words = [];
        for (const [word, positions] of Object.entries(work.abstract_inverted_index)) {
          for (const pos of positions) {
            words[pos] = word;
          }
        }
        summary = words.join(" ").substring(0, 500);
      }

      // Add new article with pending status
      const rawSummary = summary || `Academic paper with ${work.cited_by_count || 0} citations.`;
      const docRef = await db.collection("articles").add({
        title: work.title,
        source: source,
        url: work.doi,
        date: work.publication_date ? new Date(work.publication_date) : new Date(),
        summary: rawSummary,
        tags: ["research"],
        status: "pending",
        citedByCount: work.cited_by_count || 0,
        isOpenAccess: work.open_access?.is_oa || false,
        openAlexId: work.id,
        searchQuery: searchConfig.name,
        created_at: new Date(),
        updated_at: new Date()
      });

      // AI-assisted curation: generate summary and suggest tags
      await aiCurateArticle(docRef.id, work.title, rawSummary, source);

      results.added++;
    }
  } catch (error) {
    results.errors.push(`${searchConfig.name}: ${error.message}`);
  }

  return results;
}

// Scheduled function - check OpenAlex weekly (Mondays at 7 AM CT)
exports.checkOpenAlex = onSchedule(
  {
    schedule: "0 7 * * 1", // Weekly on Mondays at 7 AM
    timeZone: "America/Chicago",
    retryCount: 3
  },
  async (event) => {
    console.log("Starting OpenAlex academic search...");

    const allResults = { added: 0, skipped: 0, errors: [] };

    for (const search of OPENALEX_SEARCHES) {
      console.log(`Processing search: ${search.name}`);
      const results = await processOpenAlexSearch(search);
      allResults.added += results.added;
      allResults.skipped += results.skipped;
      allResults.errors.push(...results.errors);
    }

    console.log(`OpenAlex check complete: ${allResults.added} added, ${allResults.skipped} skipped`);
    if (allResults.errors.length > 0) {
      console.error("Errors:", allResults.errors);
    }
  }
);

// Manual trigger for OpenAlex search (admin only)
exports.triggerOpenAlexCheck = onRequest(
  { cors: true, invoker: "public" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    console.log("Manual OpenAlex search triggered...");

    const allResults = { added: 0, skipped: 0, errors: [], searches: [] };

    for (const search of OPENALEX_SEARCHES) {
      console.log(`Processing search: ${search.name}`);
      const results = await processOpenAlexSearch(search);
      allResults.added += results.added;
      allResults.skipped += results.skipped;
      allResults.errors.push(...results.errors);
      allResults.searches.push({
        name: search.name,
        added: results.added,
        skipped: results.skipped
      });
    }

    res.json({
      success: true,
      added: allResults.added,
      skipped: allResults.skipped,
      searches: allResults.searches,
      errors: allResults.errors
    });
  }
);
