// Provider-independent transport. The API key for whichever AI provider is
// used must live ONLY on a server (a small proxy endpoint you deploy
// yourself) and is never read, stored, or referenced here — this file only
// knows how to reach that proxy, never a raw provider API.
//
// Configuration is a single env var: VITE_AI_PROXY_URL, pointing at your
// deployed proxy (e.g. a Vercel/Netlify serverless function). Unset by
// default in this project — see README for what the proxy contract expects.
const PROXY_URL = import.meta.env.VITE_AI_PROXY_URL ?? null;

export function isAiConfigured() {
  return Boolean(PROXY_URL);
}

export async function requestExplanation(kind, summary) {
  if (!PROXY_URL) {
    throw new Error("AI proxy not configured (VITE_AI_PROXY_URL is unset)");
  }
  const response = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, summary }),
  });
  if (!response.ok) {
    throw new Error(`AI proxy responded with HTTP ${response.status}`);
  }
  const data = await response.json();
  if (typeof data.explanation !== "string") {
    throw new Error('AI proxy response is missing an "explanation" string');
  }
  return data.explanation;
}
