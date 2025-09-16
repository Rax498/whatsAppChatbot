import { TokenGen } from "@/app/utils/TokenGen";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const RISTA_TOKEN = process.env.RISTA_TOKEN;
const RISTA_SECURITY_KEY = process.env.RISTA_SECURITY_KEY;

export async function RistaApi(userInput) {
  const history = [
    {
      role: "system",
      content: `
You are an API intent router for a chatbot. Based on user input you have to decide which below API to call with necessary parameters (branch always BEN).
Respond ONLY in JSON with these fields:
1. "action": string — one of "fetchCatalog", "fetchResources", "fetchSoldOut"
2. "params": object — parameters to pass to the API (branch, channel, etc.)

Example output:
{
  "action": "fetchCatalog",
  "params": {
    "branch": "BEN",
    "channel": "Takeaway"
  }
}
      `,
    },
    { role: "user", content: userInput },
  ];

  try {
    // Step 1: Call OpenRouter AI
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free",
        messages: history,
        temperature: 0.1,
      }),
    });
    const data = await res.json();
    const aiReplyRaw = data.choices?.message?.content || "{}";
    const jsonMatch = aiReplyRaw.match(/{[\s\S]*}/);
    if (!jsonMatch) throw new Error("AI did not return valid JSON");
    const parsed = JSON.parse(jsonMatch);

    // Step 2: Route the API Call
    const { action, params } = parsed;
    let ristaResponse;
    if (action === "fetchCatalog") {
      ristaResponse = await fetchCatalog(params);
    } else if (action === "fetchResources") {
      ristaResponse = await fetchResources(params);
    } else if (action === "fetchSoldOut") {
      ristaResponse = await fetchSoldOut(params);
    } else {
      throw new Error("Unknown action from AI: " + action);
    }
    // Respond as string; you may want to format for WhatsApp
    return JSON.stringify(ristaResponse);
  } catch (err) {
    console.error("AI router error:", err);
    return "Error handling your request.";
  }
}

// --- Rista API methods w/ fresh JWT token per request ---
async function fetchSoldOut({ branch }) {
  const jwtToken = TokenGen();
  const apiUrl = `https://api.ristaapps.com/v1/items/soldout?branch=${branch}`;
  const res = await fetch(apiUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "x-api-key": RISTA_TOKEN,
      "x-api-token": jwtToken,
    },
  });
  if (!res.ok) throw new Error(`Rista API error: ${res.status}`);
  return res.json();
}

async function fetchCatalog({ branch, channel }) {
  const jwtToken = TokenGen();
  const apiUrl = `https://api.ristaapps.com/v1/catalog?branch=${branch}&channel=${channel}`;
  const res = await fetch(apiUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "x-api-key": RISTA_TOKEN,
      "x-api-token": jwtToken,
    },
  });
  if (!res.ok) throw new Error(`Rista API error: ${res.status}`);
  return res.json();
}

async function fetchResources({ branch }) {
  const jwtToken = TokenGen();
  const apiUrl = `https://api.ristaapps.com/v1/resource?branch=${branch}`;
  const res = await fetch(apiUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "x-api-key": RISTA_TOKEN,
      "x-api-token": jwtToken,
    },
  });
  if (!res.ok) throw new Error(`Rista API error: ${res.status}`);
  return res.json();
}
