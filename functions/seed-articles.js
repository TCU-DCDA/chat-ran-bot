/**
 * Seed script for articles collection
 * Run from functions folder: node seed-articles.js
 * Requires: firebase-admin, GOOGLE_APPLICATION_CREDENTIALS env var or firebase login
 */

const admin = require("firebase-admin");

// Initialize with default credentials (uses gcloud auth or service account)
admin.initializeApp({
  projectId: "addran-advisor-9125e"
});

const db = admin.firestore();

const seedArticles = [
  {
    title: "Why Top Tech CEOs Want Employees With Liberal Arts Degrees",
    source: "Fast Company",
    url: "https://www.fastcompany.com/3034947/why-top-tech-ceos-want-employees-with-liberal-arts-degrees",
    date: new Date("2014-08-28"),
    summary: "Steve Jobs said technology must be 'married with liberal arts.' Tech CEOs explain how humanities training—creativity, critical thinking, navigating ambiguity—drives business success.",
    tags: ["employer-data", "career-outcomes", "family-talking-points"],
    status: "approved",
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    reviewed_at: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    title: "In the age of AI, human skills are the new advantage",
    source: "World Economic Forum",
    url: "https://www.weforum.org/stories/2026/01/ai-and-human-skills/",
    date: new Date("2026-01-02"),
    summary: "Liberal arts provide the agency and self-governance skills AI cannot replicate. Experience-based learning develops analytical thinking, creativity, communication, and ethical judgment.",
    tags: ["AI-era-skills", "career-outcomes"],
    status: "approved",
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    reviewed_at: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    title: "Future of Jobs Report 2025: The jobs of the future – and the skills you need",
    source: "World Economic Forum",
    url: "https://www.weforum.org/stories/2025/01/future-of-jobs-report-2025-jobs-of-the-future-and-the-skills-you-need-to-get-them/",
    date: new Date("2025-01-08"),
    summary: "170 million new jobs by 2030. Top skills employers want: creative thinking, resilience, flexibility, curiosity, and lifelong learning—all core liberal arts competencies.",
    tags: ["employer-data", "AI-era-skills", "research"],
    status: "approved",
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    reviewed_at: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    title: "The Future of Jobs Report 2025",
    source: "World Economic Forum",
    url: "https://www.weforum.org/publications/the-future-of-jobs-report-2025/",
    date: new Date("2025-01-07"),
    summary: "Major employers report that 39% of key skills will change by 2030. Human skills like communication, collaboration, and critical thinking remain essential alongside technical skills.",
    tags: ["employer-data", "research", "family-talking-points"],
    status: "approved",
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    reviewed_at: admin.firestore.FieldValue.serverTimestamp()
  }
];

async function seed() {
  console.log("Clearing existing articles...\n");
  
  // Delete all existing articles
  const existing = await db.collection("articles").get();
  const deletePromises = existing.docs.map(doc => doc.ref.delete());
  await Promise.all(deletePromises);
  console.log(`Deleted ${existing.size} existing articles.\n`);
  
  console.log("Seeding articles collection...\n");
  
  for (const article of seedArticles) {
    const docRef = await db.collection("articles").add(article);
    console.log(`✓ Added: "${article.title}"`);
    console.log(`  ID: ${docRef.id}\n`);
  }
  
  console.log("Done! Added", seedArticles.length, "articles.");
  process.exit(0);
}

seed().catch(err => {
  console.error("Error seeding articles:", err);
  process.exit(1);
});
