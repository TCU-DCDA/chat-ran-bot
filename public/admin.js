// Firebase Auth — only these emails can access admin (server enforces this too)
const ALLOWED_ADMIN_EMAILS = ["c.rode@tcu.edu", "0expatriate0@gmail.com"];

const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Current user's ID token for API calls
let currentIdToken = null;

// Authenticated fetch helper — adds Firebase ID token to admin API calls
async function adminFetch(url, options = {}) {
  if (firebase.auth().currentUser) {
    currentIdToken = await firebase.auth().currentUser.getIdToken();
  }
  if (!currentIdToken) {
    throw new Error("Not authenticated");
  }
  const headers = {
    ...options.headers,
    "Authorization": `Bearer ${currentIdToken}`,
  };
  return fetch(url, { ...options, headers });
}

// DOM Elements
const authGate = document.getElementById("auth-gate");
const adminMain = document.getElementById("admin-main");
const authError = document.getElementById("auth-error");
const googleSignInBtn = document.getElementById("google-sign-in-btn");
const signOutBtn = document.getElementById("sign-out-btn");

// Tab elements
const tabBtns = document.querySelectorAll(".tab-btn");
const articlesTab = document.getElementById("articles-tab");
const conversationsTab = document.getElementById("conversations-tab");

// Conversations elements
const conversationsList = document.getElementById("conversations-list");
const conversationFilter = document.getElementById("conversation-filter");
const totalConversations = document.getElementById("total-conversations");
const todayConversations = document.getElementById("today-conversations");
const weekConversations = document.getElementById("week-conversations");
const positiveFeedbackStat = document.getElementById("positive-feedback");
const negativeFeedbackStat = document.getElementById("negative-feedback");
const topicList = document.getElementById("topic-list");
const programList = document.getElementById("program-list");

// Articles elements
const addArticleBtn = document.getElementById("add-article-btn");
const articleForm = document.getElementById("article-form");
const formTitle = document.getElementById("form-title");
const saveArticleBtn = document.getElementById("save-article-btn");
const cancelArticleBtn = document.getElementById("cancel-article-btn");
const articlesList = document.getElementById("articles-list");

// URL fetch elements
const fetchUrlBtn = document.getElementById("fetch-url-btn");
const fetchStatus = document.getElementById("fetch-status");

// Sort/filter elements
const articleSort = document.getElementById("article-sort");
const articleFilter = document.getElementById("article-filter");

// RSS elements
const rssCheckBtn = document.getElementById("rss-check-btn");
const rssStatus = document.getElementById("rss-status");

// OpenAlex elements
const openalexCheckBtn = document.getElementById("openalex-check-btn");
const openalexStatus = document.getElementById("openalex-status");

// Backfill button
const backfillScoresBtn = document.getElementById("backfill-scores-btn");

// Export button
const exportCsvBtn = document.getElementById("export-csv-btn");

// State
let articles = [];
let feedback = [];
let conversations = [];
let editingArticleId = null;

// Google Sign-In
googleSignInBtn.addEventListener("click", async () => {
  authError.textContent = "";
  try {
    const result = await auth.signInWithPopup(googleProvider);
    if (!ALLOWED_ADMIN_EMAILS.includes(result.user.email.toLowerCase())) {
      authError.textContent = "Access denied. This account is not authorized for admin access.";
      await auth.signOut();
    }
  } catch (error) {
    if (error.code === "auth/popup-closed-by-user") return;
    console.error("Sign-in error:", error);
    authError.textContent = "Sign-in failed. Please try again.";
  }
});

// Sign Out
signOutBtn.addEventListener("click", async () => {
  await auth.signOut();
});

// Auth state listener — handles sign-in, sign-out, and page refresh
auth.onAuthStateChanged(async (user) => {
  if (user && ALLOWED_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    currentIdToken = await user.getIdToken();
    authGate.classList.add("hidden");
    adminMain.classList.remove("hidden");
    signOutBtn.classList.remove("hidden");
    loadArticles();
    loadConversationsWithFeedback();
  } else {
    currentIdToken = null;
    authGate.classList.remove("hidden");
    adminMain.classList.add("hidden");
    signOutBtn.classList.add("hidden");
  }
});

// Tabs
tabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    tabBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    const allTabs = { articles: articlesTab, conversations: conversationsTab };
    for (const [name, el] of Object.entries(allTabs)) {
      if (name === tab) {
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    }
  });
});

// Articles CRUD
addArticleBtn.addEventListener("click", () => {
  editingArticleId = null;
  formTitle.textContent = "Add New Article";
  clearArticleForm();
  articleForm.classList.remove("hidden");
});

cancelArticleBtn.addEventListener("click", () => {
  editingArticleId = null;
  articleForm.classList.add("hidden");
  clearArticleForm();
});

saveArticleBtn.addEventListener("click", saveArticle);

// Sort/filter change
articleSort.addEventListener("change", renderArticles);
articleFilter.addEventListener("change", renderArticles);

// RSS check
rssCheckBtn.addEventListener("click", checkRssFeeds);

// OpenAlex check
openalexCheckBtn.addEventListener("click", checkOpenAlex);

// Backfill relevance scores
backfillScoresBtn.addEventListener("click", backfillRelevanceScores);

async function checkRssFeeds() {
  rssStatus.textContent = "Checking RSS feeds...";
  rssStatus.className = "source-status loading";
  rssCheckBtn.disabled = true;

  try {
    const response = await adminFetch("/admin/rss-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
      throw new Error("Failed to check RSS feeds");
    }

    const data = await response.json();

    if (data.added > 0) {
      rssStatus.textContent = `Found ${data.added} new article${data.added > 1 ? "s" : ""}! Check pending articles below.`;
      rssStatus.className = "source-status success";
      loadArticles(); // Refresh the list
    } else {
      rssStatus.textContent = "No new relevant articles found.";
      rssStatus.className = "source-status success";
    }

    // Show errors if any
    if (data.errors && data.errors.length > 0) {
      console.warn("RSS check errors:", data.errors);
    }
  } catch (error) {
    console.error("RSS check error:", error);
    rssStatus.textContent = "Failed to check RSS feeds. Try again.";
    rssStatus.className = "source-status error";
  } finally {
    rssCheckBtn.disabled = false;
  }
}

// OpenAlex academic search
async function checkOpenAlex() {
  openalexStatus.textContent = "Searching academic papers...";
  openalexStatus.className = "source-status loading";
  openalexCheckBtn.disabled = true;

  try {
    const response = await adminFetch("/admin/openalex-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
      throw new Error("Failed to search OpenAlex");
    }

    const data = await response.json();

    if (data.added > 0) {
      openalexStatus.textContent = `Found ${data.added} academic paper${data.added > 1 ? "s" : ""}! Check pending articles below.`;
      openalexStatus.className = "source-status success";
      loadArticles(); // Refresh the list
    } else {
      openalexStatus.textContent = "No new academic papers found.";
      openalexStatus.className = "source-status success";
    }

    // Show errors if any
    if (data.errors && data.errors.length > 0) {
      console.warn("OpenAlex check errors:", data.errors);
    }
  } catch (error) {
    console.error("OpenAlex check error:", error);
    openalexStatus.textContent = "Failed to search academic papers. Try again.";
    openalexStatus.className = "source-status error";
  } finally {
    openalexCheckBtn.disabled = false;
  }
}

// Backfill relevance scores for unscored articles
async function backfillRelevanceScores() {
  backfillScoresBtn.disabled = true;
  backfillScoresBtn.textContent = "Scoring...";

  try {
    const response = await adminFetch("/admin/backfill-scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
      // 502/504 likely means the function is still running (hosting proxy timeout)
      if (response.status === 502 || response.status === 504) {
        alert("Scoring is running in the background. Refresh the page in a minute to see updated scores.");
        setTimeout(() => loadArticles(), 60000);
        return;
      }
      throw new Error("Failed to backfill scores");
    }

    const data = await response.json();

    if (data.scored > 0) {
      alert(`Scored ${data.scored} article${data.scored > 1 ? "s" : ""}${data.failed > 0 ? ` (${data.failed} failed)` : ""}.`);
      loadArticles();
    } else {
      alert(data.message || "No articles needed scoring.");
    }
  } catch (error) {
    console.error("Backfill error:", error);
    alert("Failed to backfill scores. Try again.");
  } finally {
    backfillScoresBtn.disabled = false;
    backfillScoresBtn.textContent = "Backfill Scores";
  }
}

// URL auto-fetch
fetchUrlBtn.addEventListener("click", fetchUrlMetadata);

async function fetchUrlMetadata() {
  const url = document.getElementById("article-url").value.trim();

  if (!url) {
    fetchStatus.textContent = "Enter a URL first";
    fetchStatus.className = "fetch-status error";
    return;
  }

  // Validate URL format
  try {
    new URL(url);
  } catch (e) {
    fetchStatus.textContent = "Invalid URL format";
    fetchStatus.className = "fetch-status error";
    return;
  }

  fetchStatus.textContent = "Fetching...";
  fetchStatus.className = "fetch-status loading";
  fetchUrlBtn.disabled = true;

  try {
    const response = await adminFetch("/admin/fetch-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      throw new Error("Failed to fetch URL");
    }

    const data = await response.json();

    // Only fill in empty fields
    const titleInput = document.getElementById("article-title");
    const sourceInput = document.getElementById("article-source");
    const dateInput = document.getElementById("article-date");

    let filled = [];

    if (data.title && !titleInput.value) {
      titleInput.value = data.title;
      filled.push("title");
    }

    if (data.source && !sourceInput.value) {
      sourceInput.value = data.source;
      filled.push("source");
    }

    if (data.date && !dateInput.value) {
      dateInput.value = data.date;
      filled.push("date");
    }

    if (filled.length > 0) {
      fetchStatus.textContent = `Filled: ${filled.join(", ")}`;
      fetchStatus.className = "fetch-status success";
    } else {
      fetchStatus.textContent = "No new data found (fields already filled)";
      fetchStatus.className = "fetch-status";
    }
  } catch (error) {
    console.error("Fetch error:", error);
    fetchStatus.textContent = "Could not fetch metadata from URL";
    fetchStatus.className = "fetch-status error";
  } finally {
    fetchUrlBtn.disabled = false;
  }
}

function clearArticleForm() {
  document.getElementById("article-id").value = "";
  document.getElementById("article-title").value = "";
  document.getElementById("article-source").value = "";
  document.getElementById("article-url").value = "";
  document.getElementById("article-date").value = "";
  document.getElementById("article-summary").value = "";
  fetchStatus.textContent = "";
  fetchStatus.className = "fetch-status";
  document.getElementById("article-status").value = "pending";
  document.querySelectorAll('input[name="tags"]').forEach(cb => cb.checked = false);
}

function populateArticleForm(article) {
  document.getElementById("article-id").value = article.id;
  document.getElementById("article-title").value = article.title || "";
  document.getElementById("article-source").value = article.source || "";
  document.getElementById("article-url").value = article.url || "";
  document.getElementById("article-date").value = article.date ? formatDateForInput(article.date) : "";
  document.getElementById("article-summary").value = article.summary || "";
  document.getElementById("article-status").value = article.status || "pending";

  document.querySelectorAll('input[name="tags"]').forEach(cb => {
    cb.checked = article.tags && article.tags.includes(cb.value);
  });
}

function formatDateForInput(dateVal) {
  // Handle Firestore timestamp (with _seconds or seconds) or date string
  let date;
  if (dateVal && (dateVal._seconds || dateVal.seconds)) {
    date = new Date((dateVal._seconds || dateVal.seconds) * 1000);
  } else if (dateVal) {
    date = new Date(dateVal);
  } else {
    return "";
  }
  return date.toISOString().split("T")[0];
}

function formatDate(dateVal) {
  if (!dateVal) return "—";
  let date;
  if (dateVal._seconds || dateVal.seconds) {
    date = new Date((dateVal._seconds || dateVal.seconds) * 1000);
  } else {
    date = new Date(dateVal);
  }
  return date.toLocaleDateString();
}

async function loadArticles() {
  articlesList.innerHTML = '<p class="loading">Loading articles...</p>';

  try {
    const response = await adminFetch("/admin/articles");
    if (!response.ok) throw new Error("Failed to load articles");
    articles = await response.json();
    renderArticles();
  } catch (error) {
    console.error("Error loading articles:", error);
    articlesList.innerHTML = '<p class="empty-state">Failed to load articles. Try refreshing.</p>';
  }
}

function renderArticles() {
  // Filter by status
  const filterValue = articleFilter ? articleFilter.value : "all";
  const filtered = filterValue === "all"
    ? articles
    : articles.filter(a => a.status === filterValue);

  if (filtered.length === 0) {
    articlesList.innerHTML = `<p class="empty-state">${articles.length === 0 ? 'No articles yet. Add one above!' : 'No articles match this filter.'}</p>`;
    return;
  }

  // Sort articles based on selected sort option
  const sortValue = articleSort ? articleSort.value : "newest";
  const sorted = [...filtered];
  if (sortValue === "relevance") {
    sorted.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  } else if (sortValue === "oldest") {
    sorted.sort((a, b) => {
      const dateA = a.date ? (a.date._seconds || a.date.seconds || 0) : 0;
      const dateB = b.date ? (b.date._seconds || b.date.seconds || 0) : 0;
      return dateA - dateB;
    });
  }
  // "newest" is the default from the API (created_at desc)

  articlesList.innerHTML = sorted.map(article => {
    const score = article.relevanceScore;
    const scoreBadge = score != null
      ? `<span class="relevance-badge relevance-${score >= 7 ? 'high' : score >= 4 ? 'mid' : 'low'}" title="${escapeHtml(article.relevanceReason || '')}">${score}/10</span>`
      : "";

    return `
    <div class="article-card">
      <div class="article-card-header">
        <div>
          <h4>${escapeHtml(article.title)}</h4>
          <span class="source">${escapeHtml(article.source)} · ${formatDate(article.date)}</span>
        </div>
        <div class="article-actions">
          ${scoreBadge}
          <span class="status-badge status-${article.status}">${article.status}</span>
          <button class="btn-secondary btn-small" onclick="editArticle('${article.id}')">Edit</button>
        </div>
      </div>
      <p class="summary">${escapeHtml(article.summary || "")}</p>
      <div class="tags">
        ${(article.tags || []).map(tag => `<span class="tag">${tag}</span>`).join("")}
      </div>
      <a href="${escapeHtml(article.url)}" target="_blank" style="font-size: 0.75rem; color: #4d1979;">View article</a>
    </div>
  `;
  }).join("");
}

async function saveArticle() {
  const articleData = {
    title: document.getElementById("article-title").value.trim(),
    source: document.getElementById("article-source").value.trim(),
    url: document.getElementById("article-url").value.trim(),
    date: document.getElementById("article-date").value,
    summary: document.getElementById("article-summary").value.trim(),
    status: document.getElementById("article-status").value,
    tags: Array.from(document.querySelectorAll('input[name="tags"]:checked')).map(cb => cb.value)
  };

  if (!articleData.title || !articleData.url) {
    alert("Title and URL are required");
    return;
  }

  try {
    const method = editingArticleId ? "PUT" : "POST";
    const url = editingArticleId ? `/admin/articles/${editingArticleId}` : "/admin/articles";

    const response = await adminFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(articleData)
    });

    if (!response.ok) throw new Error("Failed to save article");

    articleForm.classList.add("hidden");
    editingArticleId = null;
    clearArticleForm();
    loadArticles();
  } catch (error) {
    console.error("Error saving article:", error);
    alert("Failed to save article. Try again.");
  }
}

window.editArticle = function(id) {
  const article = articles.find(a => a.id === id);
  if (!article) return;

  editingArticleId = id;
  formTitle.textContent = "Edit Article";
  populateArticleForm(article);
  articleForm.classList.remove("hidden");
};

// Conversations (unified with feedback)
conversationFilter.addEventListener("change", renderConversations);

async function loadConversationsWithFeedback() {
  conversationsList.innerHTML = '<p class="loading">Loading conversations...</p>';

  try {
    const [convResponse, fbResponse] = await Promise.all([
      adminFetch("/admin/conversations"),
      adminFetch("/admin/feedback")
    ]);

    if (!convResponse.ok) throw new Error("Failed to load conversations");
    if (!fbResponse.ok) throw new Error("Failed to load feedback");

    conversations = await convResponse.json();
    feedback = await fbResponse.json();

    joinFeedbackToConversations();
    updateUnifiedStats();
    computeTopTopics();
    computeTopPrograms();
    renderConversations();
  } catch (error) {
    console.error("Error loading conversations:", error);
    conversationsList.innerHTML = '<p class="empty-state">Failed to load conversations. Try refreshing.</p>';
  }
}

function getTimestampMs(ts) {
  if (!ts) return 0;
  if (ts._seconds || ts.seconds) {
    return (ts._seconds || ts.seconds) * 1000;
  }
  return new Date(ts).getTime();
}

function joinFeedbackToConversations() {
  // Build map: normalized question text -> array of feedback entries
  const feedbackByQuestion = {};
  for (const fb of feedback) {
    const key = (fb.userQuestion || "").trim().toLowerCase();
    if (!key) continue;
    if (!feedbackByQuestion[key]) feedbackByQuestion[key] = [];
    feedbackByQuestion[key].push(fb);
  }

  // Match feedback to conversations by question text
  for (const conv of conversations) {
    const key = (conv.userMessage || "").trim().toLowerCase();
    const candidates = feedbackByQuestion[key];

    if (!candidates || candidates.length === 0) {
      conv.feedback = null;
      continue;
    }

    if (candidates.length === 1) {
      conv.feedback = candidates[0];
      continue;
    }

    // Multiple matches — pick closest in timestamp
    const convTs = getTimestampMs(conv.timestamp);
    let best = candidates[0];
    let bestDiff = Math.abs(getTimestampMs(best.timestamp) - convTs);

    for (let i = 1; i < candidates.length; i++) {
      const diff = Math.abs(getTimestampMs(candidates[i].timestamp) - convTs);
      if (diff < bestDiff) {
        best = candidates[i];
        bestDiff = diff;
      }
    }
    conv.feedback = best;
  }
}

function updateUnifiedStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  let todayCount = 0;
  let weekCount = 0;

  for (const c of conversations) {
    const ts = c.timestamp;
    if (!ts) continue;
    const date = new Date((ts._seconds || ts.seconds) * 1000);
    if (date >= todayStart) todayCount++;
    if (date >= weekStart) weekCount++;
  }

  const positiveCount = feedback.filter(f => f.rating === "positive").length;
  const negativeCount = feedback.filter(f => f.rating === "negative").length;

  totalConversations.textContent = conversations.length;
  todayConversations.textContent = todayCount;
  weekConversations.textContent = weekCount;
  positiveFeedbackStat.textContent = positiveCount;
  negativeFeedbackStat.textContent = negativeCount;
}

function computeTopTopics() {
  // Common advising-related terms to look for in user messages
  const topicKeywords = {
    "major": /\bmajor(s|ing)?\b/i,
    "minor": /\bminor(s|ing)?\b/i,
    "career": /\bcareer(s)?\b/i,
    "requirements": /\brequire(ment|ments|d)?\b/i,
    "courses": /\bcourse(s)?\b|\bclass(es)?\b/i,
    "advising": /\badvis(or|ing|e)\b/i,
    "core curriculum": /\bcore\b/i,
    "internship": /\binternship(s)?\b/i,
    "AI / future of work": /\b(ai|artificial intelligence|automation|future of work)\b/i,
    "liberal arts value": /\b(value|worth|why)\b.*\b(liberal arts|degree|humanities)\b/i,
    "transfer": /\btransfer(ring)?\b/i,
    "study abroad": /\bstudy abroad\b|\babroad\b/i,
    "graduate school": /\bgrad(uate)?\s*(school|program)\b/i,
    "DCDA": /\bdcda\b|\bdigital culture\b|\bdata analytics\b/i,
  };

  const counts = {};
  for (const topic of Object.keys(topicKeywords)) {
    counts[topic] = 0;
  }

  for (const c of conversations) {
    const msg = (c.userMessage || "").toLowerCase();
    for (const [topic, pattern] of Object.entries(topicKeywords)) {
      if (pattern.test(msg)) counts[topic]++;
    }
  }

  // Sort by count descending, take top 8 with count > 0
  const sorted = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (sorted.length === 0) {
    topicList.innerHTML = '<span class="empty-state" style="padding: 0.5rem 0;">Not enough data yet.</span>';
    return;
  }

  const maxCount = sorted[0][1];
  topicList.innerHTML = sorted.map(([topic, count]) => {
    const pct = Math.round((count / maxCount) * 100);
    return `
      <div class="topic-row">
        <span class="topic-name">${escapeHtml(topic)}</span>
        <div class="topic-bar-bg">
          <div class="topic-bar" style="width: ${pct}%"></div>
        </div>
        <span class="topic-count">${count}</span>
      </div>
    `;
  }).join("");
}

// AddRan program names to detect in user messages
const PROGRAM_NAMES = [
  "English", "History", "Political Science", "Psychology", "Sociology",
  "Economics", "Anthropology", "Biology", "Chemistry", "Philosophy",
  "Religion", "Spanish", "French", "German", "Chinese", "Italian",
  "Geography", "Criminology", "Criminal Justice",
  "Writing", "Rhetoric", "Creative Writing",
  "DCDA", "Digital Culture", "Data Analytics",
  "International Relations", "Latin American Studies",
  "Women", "Gender", "WGSS", "W&GS",
  "African American", "Africana", "CRES",
  "Asian Studies", "Middle East", "Urban Studies",
  "Classical Studies", "Latinx",
  "AFROTC", "ROTC", "Military Science", "Aerospace",
];

function computeTopPrograms() {
  const counts = {};

  for (const c of conversations) {
    const msg = (c.userMessage || "");
    for (const name of PROGRAM_NAMES) {
      const pattern = new RegExp("\\b" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
      if (pattern.test(msg)) {
        counts[name] = (counts[name] || 0) + 1;
      }
    }
  }

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (sorted.length === 0) {
    programList.innerHTML = '<span class="empty-state" style="padding: 0.5rem 0;">Not enough data yet.</span>';
    return;
  }

  const maxCount = sorted[0][1];
  programList.innerHTML = sorted.map(([name, count]) => {
    const pct = Math.round((count / maxCount) * 100);
    return `
      <div class="topic-row">
        <span class="topic-name">${escapeHtml(name)}</span>
        <div class="topic-bar-bg">
          <div class="topic-bar" style="width: ${pct}%"></div>
        </div>
        <span class="topic-count">${count}</span>
      </div>
    `;
  }).join("");
}

function renderConversations() {
  const filter = conversationFilter.value;
  let filtered = conversations;

  if (filter === "has-feedback") {
    filtered = conversations.filter(c => c.feedback != null);
  } else if (filter === "positive") {
    filtered = conversations.filter(c => c.feedback && c.feedback.rating === "positive");
  } else if (filter === "negative") {
    filtered = conversations.filter(c => c.feedback && c.feedback.rating === "negative");
  }

  if (filtered.length === 0) {
    conversationsList.innerHTML = '<p class="empty-state">No conversations match this filter.</p>';
    return;
  }

  conversationsList.innerHTML = filtered.map(c => {
    const question = escapeHtml(c.userMessage || "\u2014");
    const response = escapeHtml(c.assistantMessage || "\u2014");
    const truncatedResponse = response.length > 200 ? response.substring(0, 200) + "\u2026" : response;
    const needsExpand = response.length > 200;

    // Determine border color and badge based on feedback
    let borderClass = "border-none";
    let feedbackBadge = "";
    if (c.feedback) {
      if (c.feedback.rating === "positive") {
        borderClass = "border-positive";
        feedbackBadge = '<span class="feedback-indicator positive" title="Positive feedback">\uD83D\uDC4D</span>';
      } else {
        borderClass = "border-negative";
        feedbackBadge = '<span class="feedback-indicator negative" title="Negative feedback">\uD83D\uDC4E</span>';
      }
    }

    return `
    <div class="conversation-card ${borderClass}">
      <div class="conversation-header">
        ${feedbackBadge}
        <span class="conversation-date">${formatDate(c.timestamp)}</span>
      </div>
      <p class="conversation-question"><strong>Q:</strong> ${question}</p>
      <div class="conversation-response conversation-truncated">${truncatedResponse}</div>
      ${needsExpand ? `<div class="conversation-response conversation-full hidden">${response}</div>` : ""}
      ${needsExpand ? '<button class="expand-btn" onclick="toggleExpand(this)">Show full response</button>' : ""}
    </div>
  `;
  }).join("");
}

window.toggleExpand = function(btn) {
  const card = btn.closest(".conversation-card");
  const truncated = card.querySelector(".conversation-truncated");
  const full = card.querySelector(".conversation-full");

  if (full.classList.contains("hidden")) {
    truncated.classList.add("hidden");
    full.classList.remove("hidden");
    btn.textContent = "Show less";
    card.classList.add("expanded");
  } else {
    full.classList.add("hidden");
    truncated.classList.remove("hidden");
    btn.textContent = "Show full response";
    card.classList.remove("expanded");
  }
};

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// CSV Export
exportCsvBtn.addEventListener("click", exportConversationsCsv);

function exportConversationsCsv() {
  if (conversations.length === 0) {
    alert("No conversations to export.");
    return;
  }

  const headers = ["Timestamp", "Session ID", "Question", "Response", "Feedback"];
  const rows = conversations.map(c => {
    const ts = c.timestamp;
    const date = ts ? new Date((ts._seconds || ts.seconds) * 1000).toISOString() : "";
    const sessionId = c.sessionId || "";
    const question = c.userMessage || "";
    const response = c.assistantMessage || "";
    const feedback = c.feedback ? c.feedback.rating : "";
    return [date, sessionId, question, response, feedback];
  });

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `addran-conversations-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
