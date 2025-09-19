import {
  formatCatalog,
  formatResources,
  formatSoldout,
  formatSalesToday,
} from "@/app/utils/Format_Utils";
import { TokenGen } from "@/app/utils/TokenGen";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const RISTA_TOKEN = process.env.RISTA_TOKEN;

export async function RistaApi(userInput) {
  console.log("User Input:", userInput);

  const history = [
    {
      role: "system",
      content: `
You are an API intent router and friendly assistant for a restaurant chatbot.
Respond ONLY in JSON with:
- "action": "fetchCatalog", "fetchResources", "fetchSoldOut", "fetchSalesToday" or "smalltalk"
- "params": object
- "response": a friendly reply to user for "smalltalk", empty otherwise.
      `,
    },
    { role: "user", content: userInput },
  ];

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openrouter/sonoma-sky-alpha",
        messages: history,
        temperature: 0.1,
      }),
    });

    const data = await res.json();
    const aiReplyRaw = data.choices?.[0]?.message?.content || "{}";
    const jsonMatch = aiReplyRaw.match(/{[\s\S]*}/);
    if (!jsonMatch) throw new Error("AI did not return valid JSON");
    const parsed = JSON.parse(jsonMatch[0]);
    const { action, params, response } = parsed;

    // Handle API action
    let ristaResponse;

    switch (action) {
      case "fetchCatalog":
        ristaResponse = await fetchCatalog(params);
        break;
      case "fetchResources":
        ristaResponse = await fetchResources(params);
        break;
      case "fetchSoldOut":
        ristaResponse = await fetchSoldOut(params);
        break;
      case "fetchSalesToday":
        ristaResponse = await fetchSalesToday(params);
        break;
      case "smalltalk":
        ristaResponse = response || "I'm here to help!";
        break;
      default:
        throw new Error("Unknown action from AI: " + action);
    }

    return typeof ristaResponse === "string"
      ? ristaResponse
      : JSON.stringify(ristaResponse);
  } catch (error) {
    console.error("RistaApi error:", error);
    // Return a simple user-friendly error message
    return `Sorry, something went wrong. Please try again later.`;
  }
}

async function summarizeData(data, dataType) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openrouter/sonoma-sky-alpha",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `You are a summarizer. Summarize the following ${dataType} data in concise bullet points.`,
        },
        {
          role: "user",
          content: JSON.stringify(data),
        },
      ],
    }),
  });

  const json = await res.json();
  const summary =
    json.choices?.[0]?.message?.content || "No summary available.";
  return summary;
}

async function fetchCatalog({ branch = "BEN", channel }) {
  const jwtToken = TokenGen();
  const apiUrl = `https://api.ristaapps.com/v1/catalog?branch=${branch}&channel=${
    channel || ""
  }`;
  const res = await fetch(apiUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "x-api-key": RISTA_TOKEN,
      "x-api-token": jwtToken,
    },
  });

  if (!res.ok) throw new Error(`Rista API error: ${res.status}`);
  const jsonData = await res.json();
  return summarizeData(jsonData, "catalog");
}

async function fetchResources({ branch = "BEN" }) {
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
  const jsonData = await res.json();
  return summarizeData(jsonData, "resources");
}

async function fetchSoldOut({ branch = "BEN" }) {
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
  const jsonData = await res.json();
  return summarizeData(jsonData, "sold out items");
}

async function fetchSalesToday({ branch = "BEN" }) {
  const today = new Date().toISOString().slice(0, 10);
  const jwtToken = TokenGen();
  const apiUrl = `https://api.ristaapps.com/v1/sales/summary?branch=${branch}&day=${today}`;
  const res = await fetch(apiUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "x-api-key": RISTA_TOKEN,
      "x-api-token": jwtToken,
    },
  });

  if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
  const jsonData = await res.json();
  return summarizeData(jsonData, "sales summary");
}
