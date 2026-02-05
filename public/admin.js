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

// RSS elements
const rssCheckBtn = document.getElementById("rss-check-btn");
const rssStatus = document.getElementById("rss-status");

// OpenAlex elements
const openalexCheckBtn = document.getElementById("openalex-check-btn");
const openalexStatus = document.getElementById("openalex-status");

// State
let articles = [];
let feedback = [];
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
}

// Tabs
tabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    tabBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    if (tab === "articles") {
      articlesTab.classList.remove("hidden");
      feedbackTab.classList.add("hidden");
    } else {
      articlesTab.classList.add("hidden");
      feedbackTab.classList.remove("hidden");
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

  articlesList.innerHTML = articles.map(article => `
    <div class="article-card">
      <div class="article-card-header">
        <div>
          <h4>${escapeHtml(article.title)}</h4>
          <span class="source">${escapeHtml(article.source)} · ${formatDate(article.date)}</span>
        </div>
        <div class="article-actions">
          <span class="status-badge status-${article.status}">${article.status}</span>
          <button class="btn-secondary btn-small" onclick="editArticle('${article.id}')">Edit</button>
          <button class="btn-danger btn-small" onclick="deleteArticle('${article.id}')">Delete</button>
        </div>
      </div>
      <p class="summary">${escapeHtml(article.summary || "")}</p>
      <div class="tags">
        ${(article.tags || []).map(tag => `<span class="tag">${tag}</span>`).join("")}
      </div>
      <a href="${escapeHtml(article.url)}" target="_blank" style="font-size: 0.75rem; color: #4d1979;">View article</a>
    </div>
  `).join("");
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

window.deleteArticle = async function(id) {
  if (!confirm("Delete this article?")) return;

  try {
    const response = await fetch(`/admin/articles/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Failed to delete article");
    loadArticles();
  } catch (error) {
    console.error("Error deleting article:", error);
    alert("Failed to delete article. Try again.");
  }
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

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
