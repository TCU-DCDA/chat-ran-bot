const messagesContainer = document.getElementById("messages");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

let conversationHistory = [];

function addMessage(content, role) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;
  messageDiv.innerHTML = `<p>${escapeHtml(content)}</p>`;
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return messageDiv;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
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
