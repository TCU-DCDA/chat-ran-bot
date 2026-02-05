const messagesContainer = document.getElementById("messages");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const clearBtn = document.getElementById("clear-btn");

let conversationHistory = JSON.parse(localStorage.getItem("conversationHistory") || "[]");

// Restore previous messages on page load
conversationHistory.forEach(msg => addMessage(msg.content, msg.role));

// Clear chat button
clearBtn.addEventListener("click", () => {
  conversationHistory = [];
  localStorage.removeItem("conversationHistory");
  messagesContainer.innerHTML = `
    <div class="message assistant">
      <span class="avatar">🎓</span>
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

function addMessage(content, role, scrollToElement = null) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;
  
  const avatar = role === "assistant" ? "🎓" : "👤";
  const contentHtml = role === "assistant" ? formatMarkdown(content) : `<p>${escapeHtml(content)}</p>`;
  
  messageDiv.innerHTML = `
    <span class="avatar">${avatar}</span>
    <div class="message-content">${contentHtml}</div>
  `;
  
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
    <span class="avatar">🎓</span>
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
    addMessage(response, "assistant", userMessageDiv);
    localStorage.setItem("conversationHistory", JSON.stringify(conversationHistory));
  } catch (error) {
    hideLoading();
    addMessage("Sorry, I encountered an error. Please try again.", "assistant");
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
