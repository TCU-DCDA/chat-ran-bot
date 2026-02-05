const messagesContainer = document.getElementById("messages");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const clearBtn = document.getElementById("clear-btn");
const themeToggle = document.getElementById("theme-toggle");

let conversationHistory = JSON.parse(localStorage.getItem("conversationHistory") || "[]");

// Dark mode handling
function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = savedTheme || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
}

initTheme();
themeToggle.addEventListener("click", toggleTheme);

// Generate a simple session ID for anonymous feedback tracking
const sessionId = localStorage.getItem("sessionId") || (() => {
  const id = "session_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
  localStorage.setItem("sessionId", id);
  return id;
})();

// Restore previous messages on page load
conversationHistory.forEach(msg => addMessage(msg.content, msg.role));

// Clear chat button
clearBtn.addEventListener("click", () => {
  conversationHistory = [];
  localStorage.removeItem("conversationHistory");
  messagesContainer.innerHTML = `
    <div class="message assistant">
      <span class="avatar assistant-avatar"></span>
      <div class="message-content">
        <p>Hi! I'm here to help you explore programs in AddRan College of Liberal Arts. What would you like to know?</p>
      </div>
    </div>
    <div class="suggested-prompts" id="suggested-prompts">
      <button class="prompt-chip" data-prompt="What majors do you offer?">What majors do you offer?</button>
      <button class="prompt-chip" data-prompt="Tell me about the English program">English program</button>
      <button class="prompt-chip" data-prompt="What can I do with a liberal arts degree?">Career paths</button>
      <button class="prompt-chip" data-prompt="My parents think liberal arts is useless">Convince my parents</button>
    </div>
  `;
  attachPromptChipListeners();
});

function addMessage(content, role, scrollToElement = null, userQuestion = null) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;
  const messageId = "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
  messageDiv.dataset.messageId = messageId;

  const avatarClass = role === "assistant" ? "assistant-avatar" : "user-avatar";
  const contentHtml = role === "assistant" ? formatMarkdown(content) : `<p>${escapeHtml(content)}</p>`;

  // Add feedback buttons for assistant messages (except initial greeting)
  const feedbackHtml = role === "assistant" && userQuestion ? `
    <div class="feedback-buttons" data-message-id="${messageId}">
      <button class="feedback-btn" data-rating="positive" title="Helpful">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
        </svg>
      </button>
      <button class="feedback-btn" data-rating="negative" title="Not helpful">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
        </svg>
      </button>
    </div>
  ` : "";

  messageDiv.innerHTML = `
    <span class="avatar ${avatarClass}"></span>
    <div class="message-content">${contentHtml}</div>
    ${feedbackHtml}
  `;

  // Store message data for feedback
  if (role === "assistant" && userQuestion) {
    messageDiv.dataset.userQuestion = userQuestion;
    messageDiv.dataset.assistantResponse = content;
  }

  // Attach feedback listeners
  if (role === "assistant" && userQuestion) {
    attachFeedbackListeners(messageDiv);
  }

  messagesContainer.appendChild(messageDiv);
  // Scroll to the specified element (user's question) or this message
  const target = scrollToElement || messageDiv;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  return messageDiv;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatMarkdown(text) {
  // Escape HTML first
  let html = escapeHtml(text);

  // Convert URLs to clickable links (before other formatting)
  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Convert email addresses to mailto links
  html = html.replace(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    '<a href="mailto:$1">$1</a>'
  );

  // Convert **bold** to <strong>
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Convert bullet points (• or - at start of line) to list items
  const lines = html.split('\n');
  let inList = false;
  let result = [];

  for (let line of lines) {
    const bulletMatch = line.match(/^[•\-\*]\s+(.+)$/);
    if (bulletMatch) {
      if (!inList) {
        result.push('<ul>');
        inList = true;
      }
      result.push(`<li>${bulletMatch[1]}</li>`);
    } else {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      if (line.trim()) {
        result.push(`<p>${line}</p>`);
      }
    }
  }

  if (inList) {
    result.push('</ul>');
  }

  return result.join('');
}

function showLoading() {
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "message assistant loading";
  loadingDiv.id = "loading-message";
  loadingDiv.innerHTML = `
    <span class="avatar assistant-avatar"></span>
    <div class="message-content">
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  messagesContainer.appendChild(loadingDiv);
  loadingDiv.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideLoading() {
  const loadingDiv = document.getElementById("loading-message");
  if (loadingDiv) {
    loadingDiv.remove();
  }
}

async function sendMessage(message) {
  try {
    const response = await fetch("/api", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: message,
        conversationHistory: conversationHistory,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to get response");
    }

    const data = await response.json();
    conversationHistory = data.conversationHistory;
    return data.message;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = userInput.value.trim();
  if (!message) return;
  if (message.length > 1000) {
    alert("Please keep your message under 1000 characters.");
    return;
  }

  // Clear input and disable form
  userInput.value = "";
  userInput.disabled = true;
  sendBtn.disabled = true;

  // Hide suggested prompts after first interaction
  hideSuggestedPrompts();

  // Add user message to chat
  const userMessageDiv = addMessage(message, "user");

  // Show loading indicator
  showLoading();

  try {
    const response = await sendMessage(message);
    hideLoading();
    // Scroll to user's question so it stays visible with the response
    addMessage(response, "assistant", userMessageDiv, message);
    localStorage.setItem("conversationHistory", JSON.stringify(conversationHistory));
  } catch (error) {
    hideLoading();
    addMessage("Sorry, I encountered an error. Please try again.", "assistant", null, null);
  } finally {
    // Re-enable form
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
});

// Suggested prompts handling
function attachPromptChipListeners() {
  document.querySelectorAll(".prompt-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const prompt = chip.dataset.prompt;
      userInput.value = prompt;
      chatForm.dispatchEvent(new Event("submit"));
    });
  });
}

// Hide suggested prompts after first message
function hideSuggestedPrompts() {
  const prompts = document.getElementById("suggested-prompts");
  if (prompts) prompts.remove();
}

// Attach listeners on page load
attachPromptChipListeners();

// Feedback handling
function attachFeedbackListeners(messageDiv) {
  const buttons = messageDiv.querySelectorAll(".feedback-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const rating = btn.dataset.rating;
      const messageId = messageDiv.dataset.messageId;
      const userQuestion = messageDiv.dataset.userQuestion;
      const assistantResponse = messageDiv.dataset.assistantResponse;

      // Disable buttons and show selected state
      const container = btn.closest(".feedback-buttons");
      container.querySelectorAll(".feedback-btn").forEach(b => b.disabled = true);
      btn.classList.add("selected");

      try {
        await sendFeedback({
          messageId,
          userQuestion,
          assistantResponse,
          rating,
          sessionId,
          timestamp: new Date().toISOString()
        });
        container.classList.add("submitted");
      } catch (error) {
        console.error("Failed to submit feedback:", error);
        // Re-enable buttons on error
        container.querySelectorAll(".feedback-btn").forEach(b => b.disabled = false);
        btn.classList.remove("selected");
      }
    });
  });
}

async function sendFeedback(feedbackData) {
  const response = await fetch("/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(feedbackData)
  });
  if (!response.ok) throw new Error("Feedback submission failed");
  return response.json();
}
