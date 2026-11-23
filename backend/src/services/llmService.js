/**
 *
 *   LLM_BASE_URL  e.g. https://api.openai.com/v1  (default: local Ollama)
 *   LLM_API_KEY   provider API key (optional, local Ollama needs none)
 *   LLM_MODEL     model name, e.g. gpt-4o-mini or llama3.2:3b
 *   LLM_TIMEOUT_MS request timeout in ms (default: 60000)
 */

const DEFAULT_BASE_URL = "http://localhost:11434/v1";
const DEFAULT_MODEL = "llama3.2:3b";
const DEFAULT_TIMEOUT_MS = 60000;

function getConfig() {
  const timeout = Number(process.env.LLM_TIMEOUT_MS);
  return {
    baseUrl: (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    apiKey: process.env.LLM_API_KEY || "",
    model: process.env.LLM_MODEL || DEFAULT_MODEL,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
  };
}

function unavailable(message) {
  return { status: 503, message };
}

async function generateText(prompt) {
  const { baseUrl, apiKey, model, timeoutMs } = getConfig();

  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err?.name === "TimeoutError") {
      console.error("[LLM] Request timed out");
      throw unavailable("KI-Dienst antwortet nicht (Timeout)");
    }
    console.error("[LLM] Service unreachable");
    throw unavailable("KI-Dienst nicht erreichbar");
  }

  if (!response.ok) {
    console.error(`[LLM] Provider responded with HTTP ${response.status}`);
    if (response.status === 401 || response.status === 403)
      throw unavailable("KI-Dienst: API-Key ungültig oder fehlt");
    if (response.status === 404)
      throw unavailable("KI-Dienst: Modell oder Endpunkt nicht gefunden");
    if (response.status === 429)
      throw unavailable("KI-Dienst: Anfragelimit erreicht, bitte später erneut versuchen");
    throw unavailable("KI-Dienst nicht verfügbar");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw unavailable("KI-Dienst lieferte eine ungültige Antwort");
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim())
    throw unavailable("KI-Dienst lieferte eine leere Antwort");

  return content.trim();
}

module.exports = { generateText, getConfig };
