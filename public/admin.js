// Simple admin password (not secure - just prevents casual access)
// TODO: Replace with Firebase Auth for production
const ADMIN_PASSWORD = "addran2026";

// DOM Elements
const authGate = document.getElementById("auth-gate");
const adminMain = document.getElementById("admin-main");
const authBtn = document.getElementById("auth-btn");
const adminPassword = document.getElementById("admin-password");
const authError = document.getElementById("auth-error");

// Tab elements
const tabBtns = document.querySelectorAll(".tab-btn");
const articlesTab = document.getElementById("articles-tab");
const feedbackTab = document.getElementById("feedback-tab");
const conversationsTab = document.getElementById("conversations-tab");

// Conversations elements
const conversationsList = document.getElementById("conversations-list");
const totalConversations = document.getElementById("total-conversations");
const todayConversations = document.getElementById("today-conversations");
const weekConversations = document.getElementById("week-conversations");
const topicList = document.getElementById("topic-list");

// Articles elements
const addArticleBtn = document.getElementById("add-article-btn");
const articleForm = document.getElementById("article-form");
const formTitle = document.getElementById("form-title");
const saveArticleBtn = document.getElementById("save-article-btn");
const cancelArticleBtn = document.getElementById("cancel-article-btn");
const articlesList = document.getElementById("articles-list");

// Feedback elements
const feedbackFilter = document.getElementById("feedback-filter");
const feedbackList = document.getElementById("feedback-list");
const totalFeedback = document.getElementById("total-feedback");
const positiveFeedback = document.getElementById("positive-feedback");
const negativeFeedback = document.getElementById("negative-feedback");

// URL fetch elements
const fetchUrlBtn = document.getElementById("fetch-url-btn");
const fetchStatus = document.getElementById("fetch-status");

// Sort element
const articleSort = document.getElementById("article-sort");

// RSS elements
const rssCheckBtn = document.getElementById("rss-check-btn");
const rssStatus = document.getElementById("rss-status");

// OpenAlex elements
const openalexCheckBtn = document.getElementById("openalex-check-btn");
const openalexStatus = document.getElementById("openalex-status");

// State
let articles = [];
let feedback = [];
let conversations = [];
let editingArticleId = null;

// Auth
authBtn.addEventListener("click", authenticate);
adminPassword.addEventListener("keypress", (e) => {
  if (e.key === "Enter") authenticate();
});

function authenticate() {
  if (adminPassword.value === ADMIN_PASSWORD) {
    authGate.classList.add("hidden");
    adminMain.classList.remove("hidden");
    loadArticles();
    loadFeedback();
    loadConversations();
    sessionStorage.setItem("adminAuth", "true");
  } else {
    authError.textContent = "Incorrect password";
    adminPassword.value = "";
  }
}

// Check for existing session
if (sessionStorage.getItem("adminAuth") === "true") {
  authGate.classList.add("hidden");
  adminMain.classList.remove("hidden");
  loadArticles();
  loadFeedback();
  loadConversations();
}

// Tabs
tabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    tabBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    const allTabs = { articles: articlesTab, feedback: feedbackTab, conversations: conversationsTab };
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

// Sort change
articleSort.addEventListener("change", renderArticles);

// RSS check
rssCheckBtn.addEventListener("click", checkRssFeeds);

// OpenAlex check
openalexCheckBtn.addEventListener("click", checkOpenAlex);

async function checkRssFeeds() {
  rssStatus.textContent = "Checking RSS feeds...";
  rssStatus.className = "source-status loading";
  rssCheckBtn.disabled = true;

  try {
    const response = await fetch("/admin/rss-check", {
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
    const response = await fetch("/admin/openalex-check", {
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
    const response = await fetch("/admin/fetch-url", {
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
    const response = await fetch("/admin/articles");
    if (!response.ok) throw new Error("Failed to load articles");
    articles = await response.json();
    renderArticles();
  } catch (error) {
    console.error("Error loading articles:", error);
    articlesList.innerHTML = '<p class="empty-state">Failed to load articles. Try refreshing.</p>';
  }
}

function renderArticles() {
  if (articles.length === 0) {
    articlesList.innerHTML = '<p class="empty-state">No articles yet. Add one above!</p>';
    return;
  }

  // Sort articles based on selected sort option
  const sortValue = articleSort ? articleSort.value : "newest";
  const sorted = [...articles];
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

    const response = await fetch(url, {
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

// Feedback
feedbackFilter.addEventListener("change", renderFeedback);

async function loadFeedback() {
  feedbackList.innerHTML = '<p class="loading">Loading feedback...</p>';

  try {
    const response = await fetch("/admin/feedback");
    if (!response.ok) throw new Error("Failed to load feedback");
    feedback = await response.json();
    updateFeedbackStats();
    renderFeedback();
  } catch (error) {
    console.error("Error loading feedback:", error);
    feedbackList.innerHTML = '<p class="empty-state">Failed to load feedback. Try refreshing.</p>';
  }
}

function updateFeedbackStats() {
  const positive = feedback.filter(f => f.rating === "positive").length;
  const negative = feedback.filter(f => f.rating === "negative").length;

  totalFeedback.textContent = feedback.length;
  positiveFeedback.textContent = positive;
  negativeFeedback.textContent = negative;
}

function renderFeedback() {
  const filter = feedbackFilter.value;
  let filtered = feedback;

  if (filter === "positive") {
    filtered = feedback.filter(f => f.rating === "positive");
  } else if (filter === "negative") {
    filtered = feedback.filter(f => f.rating === "negative");
  }

  if (filtered.length === 0) {
    feedbackList.innerHTML = '<p class="empty-state">No feedback yet.</p>';
    return;
  }

  feedbackList.innerHTML = filtered.map(f => `
    <div class="feedback-card ${f.rating}">
      <div class="feedback-header">
        <span class="feedback-rating">${f.rating === "positive" ? "Positive" : "Negative"}</span>
        <span class="feedback-date">${formatDate(f.timestamp)}</span>
      </div>
      <p class="feedback-question"><strong>Q:</strong> ${escapeHtml(f.userQuestion || "—")}</p>
      <div class="feedback-response">${escapeHtml(f.assistantResponse || "—")}</div>
    </div>
  `).join("");
}

// Conversations
async function loadConversations() {
  conversationsList.innerHTML = '<p class="loading">Loading conversations...</p>';

  try {
    const response = await fetch("/admin/conversations");
    if (!response.ok) throw new Error("Failed to load conversations");
    conversations = await response.json();
    updateConversationStats();
    computeTopTopics();
    renderConversations();
  } catch (error) {
    console.error("Error loading conversations:", error);
    conversationsList.innerHTML = '<p class="empty-state">Failed to load conversations. Try refreshing.</p>';
  }
}

function updateConversationStats() {
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

  totalConversations.textContent = conversations.length;
  todayConversations.textContent = todayCount;
  weekConversations.textContent = weekCount;
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

function renderConversations() {
  if (conversations.length === 0) {
    conversationsList.innerHTML = '<p class="empty-state">No conversations yet.</p>';
    return;
  }

  conversationsList.innerHTML = conversations.map(c => {
    const question = escapeHtml(c.userMessage || "—");
    const response = escapeHtml(c.assistantMessage || "—");
    const truncatedResponse = response.length > 200 ? response.substring(0, 200) + "..." : response;

    return `
    <div class="conversation-card">
      <div class="conversation-header">
        <span class="conversation-date">${formatDate(c.timestamp)}</span>
      </div>
      <p class="conversation-question"><strong>Q:</strong> ${question}</p>
      <div class="conversation-response">${truncatedResponse}</div>
    </div>
  `;
  }).join("");
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
