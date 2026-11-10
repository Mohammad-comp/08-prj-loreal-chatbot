// Deploy this module to Cloudflare and bind OPENAI_API_KEY as a secret.
const systemPrompt = "You are a friendly L’Oréal beauty advisor. Help with L’Oréal products, makeup, skincare, haircare, fragrance, and related routines. Politely redirect unrelated questions to those topics. Use preferences and names already shared when relevant. Ask a brief follow-up if needed. Use short plain-text paragraphs or bullets. Avoid medical advice and invented product details, prices, or availability.";

export default {
  async fetch(request, env) {
    // Only the published site or configured preview origin can call the browser API.
    const origin = request.headers.get("Origin");
    const allowedOrigins = (env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim());
    if (!origin || !allowedOrigins.includes(origin)) {
      return new Response("Origin not allowed", { status: 403 });
    }
    const headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
      Vary: "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const error = (message, status) => Response.json({ error: message }, { status, headers });
    if (request.method !== "POST") return error("Use POST", 405);
    if (!env.OPENAI_API_KEY) return error("Advisor is not configured", 503);

    try {
      const body = await request.text();
      if (body.length > 40000) return error("Request is too large", 413);
      const { messages } = JSON.parse(body);
      if (!Array.isArray(messages) || messages.length > 18) return error("Invalid conversation", 400);
      // Use the server's instructions and accept only bounded conversation turns.
      const turns = messages.filter((message) => message?.role !== "system");
      if (turns.at(-1)?.role !== "user" || turns.some((message, index) =>
        message?.role !== (index % 2 === 0 ? "user" : "assistant") ||
        typeof message.content !== "string" || !message.content.trim() || message.content.length > 4000
      )) return error("Invalid conversation", 400);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1",
          messages: [{ role: "system", content: systemPrompt }, ...turns],
          max_completion_tokens: 300,
        }),
      });
      if (!response.ok) return error("Advisor service unavailable", 502);
      return Response.json(await response.json(), { headers });
    } catch (exception) {
      return exception instanceof SyntaxError
        ? error("Invalid JSON", 400)
        : error("Advisor service unavailable", 502);
    }
  },
};
