const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const Anthropic = require("@anthropic-ai/sdk");

initializeApp();
const db = getFirestore();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// System prompt for the AddRan advisor chatbot
const SYSTEM_PROMPT = `You are a friendly advisor for AddRan College of Liberal Arts at TCU (Texas Christian University). Your role is to help students explore majors, minors, and certificates offered by AddRan.

Be warm and conversational, but not over-the-top enthusiastic. Provide accurate information about programs and be encouraging about the value of a liberal arts education.

If asked about topics outside your scope (financial aid, housing, registration, etc.), politely redirect to the appropriate resource.

Always offer to connect students with a human advisor for complex questions.

IMPORTANT FORMATTING RULES:
- Keep each paragraph under 100 words
- Use short, scannable paragraphs separated by blank lines
- When listing courses, use bullet points
- Be concise — students prefer quick, clear answers`;

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

      // Fetch program data and config from Firestore
      const [programsSnapshot, abbreviationsDoc] = await Promise.all([
        db.collection("programs").get(),
        db.collection("config").doc("abbreviations").get()
      ]);

      const programs = programsSnapshot.docs.map(doc => doc.data());
      const abbreviations = abbreviationsDoc.exists ? abbreviationsDoc.data() : {};

      // Build context with program data
      const programContext = programs.length > 0
        ? `\n\nAvailable AddRan programs:\n${programs.map(p => `- ${p.name}: ${p.degrees} (${p.url})`).join("\n")}`
        : "";

      // Build abbreviations context
      const abbreviationsContext = Object.keys(abbreviations).length > 0
        ? `\n\nProgram abbreviations:\n${Object.entries(abbreviations).map(([abbr, full]) => `- ${abbr} = ${full}`).join("\n")}`
        : "";

      // Build DCDA program details context (always included)
      const dcdaContext = `\n\n## DCDA (Digital Culture and Data Analytics) Program Details

### DCDA Major (BS, 33 hours)
Required categories (15 hours):
- Intro: Choose from ENGL 20813, WRIT 20303, WRIT 20323, or WRIT 20333
- Statistics: MATH 10043 or INSC 20153
- Coding: WRIT 20833, GEOG 30323, or COSC 10603
- Multimedia Authoring: Choose from WRIT 40163/40263/40363/40463/40563, CRWT 30363, STCO 36403, or EDUC 50263
- Capstone: DCDA 40833 (offered each Spring) or DCDA 40003 (Senior Honors Seminar)

Plus 6 hours of DC & DA electives (1 Digital Culture + 1 Data Analytics)
Plus 12 hours of general electives from approved list

### DCDA Minor (21 hours)
Required categories (12 hours):
- Statistics: MATH 10043 or INSC 20153
- Coding: WRIT 20833, GEOG 30323, or COSC 10603
- Multimedia Authoring: Choose from WRIT 40163/40263/40363/40463/40563, CRWT 30363, STCO 36403, or EDUC 50263
- Capstone: DCDA 40833 or DCDA 40003

Plus 9 hours of general electives from approved list

### Notable DCDA Courses:
- DCDA 40343: AI & LLM Concepts & Apps (new course!)
- ADRN 30503: A Human-Centered AI Future
- WRIT 20833: Intro to Coding in the Humanities
- GEOG 30323: Data Analysis and Visualization
- CRWT 30363: Digital Creative Writing
- STCO 36403: Digital Storytelling

### DCDA Advisor Contact:
For questions about the DCDA program, contact:
- Email: dcda@tcu.edu
- Program Director: Dr. Curt Rode (c.rode@tcu.edu)`;

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

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT + programContext + abbreviationsContext + dcdaContext + englishContext,
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
