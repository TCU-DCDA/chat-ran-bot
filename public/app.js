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
  messagesContainer.innerHTML = `<div class="message assistant"><p>Hi! I'm here to help you explore programs in AddRan College of Liberal Arts. What would you like to know about our majors, minors, or certificates?</p></div>`;
});

function addMessage(content, role) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;
  messageDiv.innerHTML = role === "assistant" ? formatMarkdown(content) : `<p>${escapeHtml(content)}</p>`;
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
  loadingDiv.innerHTML = "<p>Thinking...</p>";
  messagesContainer.appendChild(loadingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
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

  // Add user message to chat
  addMessage(message, "user");

  // Show loading indicator
  showLoading();

  try {
    const response = await sendMessage(message);
    hideLoading();
    addMessage(response, "assistant");
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
