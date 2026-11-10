const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const chatStatus = document.getElementById("chatStatus");
const sendButton = document.getElementById("sendBtn");
const workerUrl = document.querySelector('meta[name="worker-url"]').content.trim();

const systemPrompt = "You are a friendly L’Oréal beauty advisor. Help with L’Oréal products, makeup, skincare, haircare, fragrance, and related routines. Politely redirect unrelated questions to those topics. Use preferences and names already shared when relevant. Ask a brief follow-up if needed. Use short plain-text paragraphs or bullets. Avoid medical advice and invented product details, prices, or availability.";
const conversation = [];

// Render both user and assistant text without interpreting it as HTML.
function addMessage(role, text) {
  const bubble = document.createElement("div");
  bubble.className = `message ${role}`;
  const label = document.createElement("strong");
  label.textContent = role === "user" ? "You" : "Beauty Advisor";
  const body = document.createElement("p");
  body.textContent = text;
  bubble.append(label, body);
  chatWindow.append(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return bubble;
}

addMessage("assistant", "Hi! Tell me what you’re looking for, or choose a question to get started.");
if (!workerUrl) chatStatus.textContent = "The live advisor is awaiting its Cloudflare connection.";

// Starter questions fill the input so users can personalize them before sending.
for (const suggestion of document.querySelectorAll("[data-prompt]")) {
  suggestion.addEventListener("click", () => {
    userInput.value = suggestion.dataset.prompt;
    userInput.focus();
  });
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = userInput.value.trim();
  if (!question || sendButton.disabled || !workerUrl) return;

  const userMessage = { role: "user", content: question };
  const bubble = addMessage("user", question);
  userInput.value = "";
  sendButton.disabled = true;
  chatStatus.textContent = "Beauty Advisor is thinking…";

  try {
    // Keep recent turns so follow-up questions have context without growing every request.
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "system", content: systemPrompt }, ...conversation, userMessage] }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error("Chat request failed");
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) throw new Error("Empty reply");
    addMessage("assistant", reply);
    conversation.push(userMessage, { role: "assistant", content: reply });
    if (conversation.length > 16) conversation.splice(0, 2);
    chatStatus.textContent = "";
  } catch {
    bubble.remove();
    if (!userInput.value) userInput.value = question;
    chatStatus.textContent = "The advisor couldn’t reply. Please try again.";
  } finally {
    sendButton.disabled = false;
  }
});
