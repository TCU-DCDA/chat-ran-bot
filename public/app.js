const messagesContainer = document.getElementById("messages");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const clearBtn = document.getElementById("clear-btn");
const themeToggle = document.getElementById("theme-toggle");
const exportBtn = document.getElementById("export-btn");

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
conversationHistory.forEach(msg => addMessage(msg.content, msg.role, null, null, msg.programMentions || null));
if (conversationHistory.length > 0) exportBtn.disabled = false;

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
  exportBtn.disabled = true;
});

function formatTimestamp(date) {
  const now = new Date();
  const d = date || now;
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${h}:${minutes} ${ampm}`;
}

function addMessage(content, role, scrollToElement = null, userQuestion = null, programMentions = null) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;
  const messageId = "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
  messageDiv.dataset.messageId = messageId;

  const avatarClass = role === "assistant" ? "assistant-avatar" : "user-avatar";
  const contentHtml = role === "assistant" ? formatMarkdown(content) : `<p>${escapeHtml(content)}</p>`;
  const timestamp = formatTimestamp();

  // Build program cards HTML if mentions exist
  let cardsHtml = "";
  if (role === "assistant" && programMentions && programMentions.length > 0) {
    const autoExpand = programMentions.length === 1;
    const cards = programMentions.map(p => renderProgramCard(p, autoExpand)).join("");
    cardsHtml = `<div class="program-cards">${cards}</div>`;
  }

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
    <div class="message-body">
      <div class="message-content">${contentHtml}</div>
      ${cardsHtml}
      <span class="message-timestamp">${timestamp}</span>
      ${feedbackHtml}
    </div>
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
        conversationHistory: conversationHistory.map(({ role, content }) => ({ role, content })),
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to get response");
    }

    const data = await response.json();
    conversationHistory = data.conversationHistory;
    return data;
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
    const data = await sendMessage(message);
    hideLoading();
    const mentions = data.programMentions || null;
    // Scroll to user's question so it stays visible with the response
    addMessage(data.message, "assistant", userMessageDiv, message, mentions);
    // Store programMentions in the last assistant message for history restoration
    if (mentions && mentions.length > 0) {
      const lastMsg = conversationHistory[conversationHistory.length - 1];
      if (lastMsg && lastMsg.role === "assistant") {
        lastMsg.programMentions = mentions;
      }
    }
    localStorage.setItem("conversationHistory", JSON.stringify(conversationHistory));
    exportBtn.disabled = false;
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

// Program card rendering
function renderProgramCard(program, expanded = false) {
  const expandedClass = expanded ? " expanded" : "";
  const desc = program.description
    ? `<p class="program-card-desc">${escapeHtml(program.description.length > 250 ? program.description.substring(0, 250) + "..." : program.description)}</p>`
    : "";

  let careersHtml = "";
  if (program.careerOptions && program.careerOptions.length > 0) {
    const tags = program.careerOptions.map(c => `<span class="program-card-tag">${escapeHtml(c)}</span>`).join("");
    careersHtml = `<div class="program-card-section"><h4>Career Options</h4><div class="program-card-tags">${tags}</div></div>`;
  }

  let contactsHtml = "";
  if (program.contacts && program.contacts.length > 0) {
    const items = program.contacts.map(c => {
      const parts = [escapeHtml(c.name)];
      if (c.role) parts.unshift(`<strong>${escapeHtml(c.role)}</strong>`);
      if (c.email) parts.push(`<a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a>`);
      return `<li>${parts.join(" &middot; ")}</li>`;
    }).join("");
    contactsHtml = `<div class="program-card-section"><h4>Contacts</h4><ul>${items}</ul></div>`;
  }

  let linkHtml = "";
  if (program.url) {
    linkHtml = `<a href="${escapeHtml(program.url)}" class="program-card-link" target="_blank" rel="noopener noreferrer">Visit Program Page &rarr;</a>`;
  }

  const meta = [program.degree, program.totalHours ? program.totalHours + " hours" : ""].filter(Boolean).join(" &middot; ");

  return `
    <div class="program-card${expandedClass}">
      <div class="program-card-header" role="button" tabindex="0" aria-expanded="${expanded}">
        <div class="program-card-title">
          <strong>${escapeHtml(program.name)}</strong>
          <span class="program-card-meta">${meta}</span>
        </div>
        <svg class="program-card-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      <div class="program-card-body">
        ${desc}
        ${careersHtml}
        ${contactsHtml}
        ${linkHtml}
      </div>
    </div>
  `;
}

// Program card expand/collapse
function toggleProgramCard(headerEl) {
  const card = headerEl.closest(".program-card");
  if (!card) return;
  const isExpanded = card.classList.toggle("expanded");
  headerEl.setAttribute("aria-expanded", isExpanded);
}

// Event delegation for program card headers (click + keyboard)
messagesContainer.addEventListener("click", (e) => {
  const header = e.target.closest(".program-card-header");
  if (header) toggleProgramCard(header);
});

messagesContainer.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    const header = e.target.closest(".program-card-header");
    if (header) {
      e.preventDefault();
      toggleProgramCard(header);
    }
  }
});

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

// PDF Export
async function loadJsPDF() {
  if (window.jspdf) return window.jspdf;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = () => resolve(window.jspdf);
    script.onerror = () => reject(new Error("Failed to load PDF library"));
    document.head.appendChild(script);
  });
}

function getExportableMessages() {
  const messageDivs = messagesContainer.querySelectorAll(".message:not(.loading)");
  const messages = [];
  messageDivs.forEach(div => {
    const role = div.classList.contains("user") ? "user" : "assistant";
    const contentEl = div.querySelector(".message-content");
    const timestampEl = div.querySelector(".message-timestamp");
    const timestamp = timestampEl ? timestampEl.textContent.trim() : "";
    const htmlContent = contentEl ? contentEl.innerHTML : "";

    // Extract program card data from DOM
    const programs = [];
    div.querySelectorAll(".program-card").forEach(card => {
      const name = card.querySelector(".program-card-title strong")?.textContent || "";
      const meta = card.querySelector(".program-card-meta")?.textContent || "";
      const desc = card.querySelector(".program-card-desc")?.textContent || "";
      const link = card.querySelector(".program-card-link")?.href || "";
      const contacts = [];
      card.querySelectorAll(".program-card-section:last-of-type li").forEach(li => {
        contacts.push(li.textContent.trim());
      });
      const careers = [];
      card.querySelectorAll(".program-card-tag").forEach(tag => {
        careers.push(tag.textContent.trim());
      });
      programs.push({ name, meta, desc, link, contacts, careers });
    });

    messages.push({ role, htmlContent, timestamp, programs });
  });
  return messages;
}

function pdfEnsureSpace(doc, y, needed, pageHeight, margin) {
  if (y + needed > pageHeight - margin) {
    doc.addPage();
    return margin;
  }
  return y;
}

function pdfDrawHeader(doc, y, pageWidth, margin, contentWidth) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(77, 25, 121);
  doc.text("AddRan Advisor", margin, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric"
  });
  doc.text("Conversation Export \u00B7 " + dateStr, margin, y + 14);

  doc.setDrawColor(77, 25, 121);
  doc.setLineWidth(0.5);
  doc.line(margin, y + 18, pageWidth - margin, y + 18);
  return y + 24;
}

function pdfRenderText(doc, html, y, margin, contentWidth, pageHeight) {
  const parser = new DOMParser();
  const fragment = parser.parseFromString("<div>" + html + "</div>", "text/html");
  const container = fragment.body.firstChild;

  for (const node of container.childNodes) {
    if (node.nodeName === "UL") {
      for (const li of node.querySelectorAll("li")) {
        y = pdfEnsureSpace(doc, y, 5, pageHeight, margin);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(45, 45, 45);
        const lines = doc.splitTextToSize("\u2022  " + li.textContent.trim(), contentWidth - 4);
        for (const line of lines) {
          y = pdfEnsureSpace(doc, y, 4.5, pageHeight, margin);
          doc.text(line, margin + 2, y);
          y += 4.5;
        }
        y += 0.5;
      }
      y += 1.5;
    } else if (node.nodeName === "P" || (node.nodeType === 3 && node.textContent.trim())) {
      const text = node.textContent.trim();
      if (!text) continue;

      // Check for bold segments
      const strongs = node.nodeName === "P" ? node.querySelectorAll("strong") : [];
      if (strongs.length === 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(45, 45, 45);
        const lines = doc.splitTextToSize(text, contentWidth);
        for (const line of lines) {
          y = pdfEnsureSpace(doc, y, 4.5, pageHeight, margin);
          doc.text(line, margin, y);
          y += 4.5;
        }
      } else {
        // Render with inline bold
        y = pdfRenderInlineBold(doc, node, y, margin, contentWidth, pageHeight);
      }
      y += 2;
    }
  }
  return y;
}

function pdfRenderInlineBold(doc, pNode, y, margin, contentWidth, pageHeight) {
  // Flatten child nodes into segments with bold flag
  const segments = [];
  for (const child of pNode.childNodes) {
    if (child.nodeType === 3) {
      const t = child.textContent;
      if (t) segments.push({ text: t, bold: false });
    } else if (child.nodeName === "STRONG") {
      segments.push({ text: child.textContent, bold: true });
    } else if (child.nodeName === "A") {
      segments.push({ text: child.textContent, bold: false, url: child.href });
    } else {
      segments.push({ text: child.textContent, bold: false });
    }
  }

  // Concatenate all text for line splitting, then render with formatting
  const fullText = segments.map(s => s.text).join("");
  const lines = doc.splitTextToSize(fullText, contentWidth);

  doc.setFontSize(10);
  let charIndex = 0;

  for (const line of lines) {
    y = pdfEnsureSpace(doc, y, 4.5, pageHeight, margin);
    let x = margin;
    let lineCharsLeft = line.length;
    let segIdx = 0;
    let segOffset = 0;

    // Find which segment charIndex falls in
    let cumLen = 0;
    for (let i = 0; i < segments.length; i++) {
      if (cumLen + segments[i].text.length > charIndex) {
        segIdx = i;
        segOffset = charIndex - cumLen;
        break;
      }
      cumLen += segments[i].text.length;
    }

    while (lineCharsLeft > 0 && segIdx < segments.length) {
      const seg = segments[segIdx];
      const available = seg.text.length - segOffset;
      const take = Math.min(available, lineCharsLeft);
      const chunk = seg.text.substring(segOffset, segOffset + take);

      doc.setFont("helvetica", seg.bold ? "bold" : "normal");
      doc.setTextColor(45, 45, 45);

      if (seg.url) {
        doc.setTextColor(77, 25, 121);
        doc.textWithLink(chunk, x, y, { url: seg.url });
        doc.setTextColor(45, 45, 45);
      } else {
        doc.text(chunk, x, y);
      }
      x += doc.getTextWidth(chunk);

      lineCharsLeft -= take;
      charIndex += take;
      segOffset += take;

      if (segOffset >= seg.text.length) {
        segIdx++;
        segOffset = 0;
      }
    }
    y += 4.5;
  }
  return y;
}

function pdfDrawProgramCard(doc, prog, y, margin, contentWidth, pageHeight) {
  const cardMargin = margin + 2;
  const cardWidth = contentWidth - 4;
  const startY = y;

  y += 5;

  // Name + meta
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(45, 45, 45);
  doc.text(prog.name, cardMargin + 3, y);

  if (prog.meta) {
    const nameWidth = doc.getTextWidth(prog.name + "  ");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(prog.meta, cardMargin + 3 + nameWidth, y);
  }
  y += 5;

  // Description
  if (prog.desc) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const descLines = doc.splitTextToSize(prog.desc, cardWidth - 6);
    for (const line of descLines) {
      y = pdfEnsureSpace(doc, y, 4, pageHeight, margin);
      doc.text(line, cardMargin + 3, y);
      y += 3.5;
    }
    y += 2;
  }

  // Career options
  if (prog.careers && prog.careers.length > 0) {
    y = pdfEnsureSpace(doc, y, 8, pageHeight, margin);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(136, 136, 136);
    doc.text("CAREER OPTIONS", cardMargin + 3, y);
    y += 3.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const careerLines = doc.splitTextToSize(prog.careers.join(", "), cardWidth - 6);
    for (const line of careerLines) {
      doc.text(line, cardMargin + 3, y);
      y += 3.5;
    }
    y += 2;
  }

  // Contacts
  if (prog.contacts && prog.contacts.length > 0) {
    y = pdfEnsureSpace(doc, y, 8, pageHeight, margin);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(136, 136, 136);
    doc.text("CONTACTS", cardMargin + 3, y);
    y += 3.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    for (const contact of prog.contacts) {
      const cLines = doc.splitTextToSize(contact, cardWidth - 6);
      for (const line of cLines) {
        y = pdfEnsureSpace(doc, y, 3.5, pageHeight, margin);
        doc.text(line, cardMargin + 3, y);
        y += 3.5;
      }
    }
    y += 2;
  }

  // Link
  if (prog.link) {
    y = pdfEnsureSpace(doc, y, 5, pageHeight, margin);
    doc.setFontSize(8);
    doc.setTextColor(77, 25, 121);
    doc.textWithLink("Visit Program Page \u2192", cardMargin + 3, y, { url: prog.link });
    y += 5;
  }

  y += 2;

  // Draw card border
  doc.setDrawColor(224, 224, 224);
  doc.setLineWidth(0.3);
  doc.roundedRect(cardMargin, startY, cardWidth, y - startY, 2, 2);
  return y + 2;
}

function pdfDrawDisclaimer(doc, y, margin, contentWidth) {
  doc.setDrawColor(224, 224, 224);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentWidth, y);
  y += 5;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(136, 136, 136);
  const disclaimer = "AI-generated responses may contain errors. Program details reflect the most recent data update and may not match the latest catalog. Confirm details with your advisor or department.";
  const lines = doc.splitTextToSize(disclaimer, contentWidth);
  for (const line of lines) {
    doc.text(line, margin, y);
    y += 3.5;
  }
  return y;
}

async function exportConversationPDF() {
  exportBtn.disabled = true;
  const originalTitle = exportBtn.title;
  exportBtn.title = "Generating PDF...";

  try {
    const { jsPDF } = await loadJsPDF();
    const doc = new jsPDF({ unit: "mm", format: "letter" });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let y = margin;

    // Header
    y = pdfDrawHeader(doc, y, pageWidth, margin, contentWidth);

    // Messages
    const messages = getExportableMessages();
    // Skip the initial greeting (first assistant message with no timestamp in history)
    const startIdx = messages.length > 0 && messages[0].role === "assistant" && !messages[0].timestamp ? 1 : 0;

    for (let i = startIdx; i < messages.length; i++) {
      const msg = messages[i];
      y = pdfEnsureSpace(doc, y, 20, pageHeight, margin);

      const isUser = msg.role === "user";
      const labelText = isUser ? "You" : "AddRan Advisor";

      // Role label
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(77, 25, 121);
      doc.text(labelText, margin, y);

      // Timestamp
      if (msg.timestamp) {
        const labelWidth = doc.getTextWidth(labelText + "  ");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(136, 136, 136);
        doc.text(msg.timestamp, margin + labelWidth, y);
      }
      y += 5;

      // Message body
      y = pdfRenderText(doc, msg.htmlContent, y, margin, contentWidth, pageHeight);

      // Program cards
      if (msg.programs && msg.programs.length > 0) {
        for (const prog of msg.programs) {
          y = pdfEnsureSpace(doc, y, 20, pageHeight, margin);
          y = pdfDrawProgramCard(doc, prog, y, margin, contentWidth, pageHeight);
        }
      }

      y += 4;
    }

    // Disclaimer
    y = pdfEnsureSpace(doc, y, 20, pageHeight, margin);
    pdfDrawDisclaimer(doc, y, margin, contentWidth);

    // Save
    const dateStr = new Date().toISOString().split("T")[0];
    doc.save("addran-advisor-" + dateStr + ".pdf");
  } catch (error) {
    console.error("PDF export failed:", error);
    alert("Sorry, the PDF export failed. Please try again.");
  } finally {
    exportBtn.disabled = conversationHistory.length === 0;
    exportBtn.title = originalTitle;
  }
}

exportBtn.addEventListener("click", exportConversationPDF);
