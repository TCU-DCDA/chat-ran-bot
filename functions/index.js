const { onRequest } = require("firebase-functions/v2/https");
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

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT + programContext + abbreviationsContext + dcdaContext + englishContext + coreCurriculumContext + articlesContext,
        messages: messages,
      });

      const assistantMessage = response.content[0].text;

      // Log conversation (optional - for analytics)
      await db.collection("conversations").add({
        userMessage: message,
        assistantMessage: assistantMessage,
        timestamp: new Date(),
      });

      res.json({
        message: assistantMessage,
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
