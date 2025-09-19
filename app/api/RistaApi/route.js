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
  // Conversation history sent to AI intent router
  const history = [
    {
      role: "system",
      content: `
You are an API intent router and friendly assistant for a restaurant chatbot.
Respond ONLY in JSON with:
- "action": one of [fetchCatalog, fetchResources, fetchSoldOut, fetchSalesToday, smalltalk]
- "params": object with details like date, invoiceId, productId, channel, etc.
- "response": friendly text reply (only for smalltalk), empty otherwise.
Example outputs:
{
  "action": "smalltalk",
  "params": {},
  "response": "I'm doing great! How can I help you with our restaurant services today?"
}
{
  "action": "fetchCatalog",
  "params": {
    "branch": "BEN",
    "channel": "Takeaway"
  }
}
No extra text.
      `,
    },
    { role: "user", content: userInput },
  ];

  try {
    // Get AI intent routing JSON response
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
    const { action, params = {}, response } = parsed;

    // Initialize variable for final bot reply
    let ristaResponse;

    // Route API actions cleanly
    switch (action) {
      case "fetchCatalog": {
        const catalogData = await fetchCatalog(params);
        ristaResponse = await summarizeData(
          catalogData,
          "catalog",
          userInput,
          params
        );
        break;
      }
      case "fetchResources": {
        const resourcesData = await fetchResources(params);
        ristaResponse = await summarizeData(
          resourcesData,
          "resources",
          userInput,
          params
        );
        break;
      }
      case "fetchSoldOut": {
        const soldOutData = await fetchSoldOut(params);
        ristaResponse = await summarizeData(
          soldOutData,
          "sold out items",
          userInput,
          params
        );
        break;
      }
      case "fetchSalesToday": {
        const salesData = await fetchSalesToday(params);
        ristaResponse = await summarizeData(
          salesData,
          "sales summary",
          userInput,
          params
        );
        break;
      }
      case "smalltalk":
        ristaResponse = response || "I'm here to help!";
        break;
      default:
        throw new Error("Unknown action from AI: " + action);
    }

    // Return string response or stringify object response
    return typeof ristaResponse === "string"
      ? ristaResponse
      : JSON.stringify(ristaResponse);
  } catch (error) {
    console.error("RistaApi error:", error);
    return "Sorry, something went wrong. Please try again later.";
  }
}

// Summarize data respecting data type, user input, and params
async function summarizeData(data, dataType, userInput, params) {
  const paramInfo =
    params && Object.keys(params).length > 0
      ? `using these parameters: ${JSON.stringify(params)}`
      : "";

  const systemContent = `
You are a summarizer.Like a assitance Summarize the following ${dataType} data in concise points.using user context: "${userInput}"
Keep the reply simple,clean well formated suitable for WhatsApp chat.
  `.trim();

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
        { role: "system", content: systemContent },
        { role: "user", content: JSON.stringify(data) },
      ],
    }),
  });

  const json = await res.json();
  return json.choices?.[0]?.message?.content || "No summary available.";
}

// Fetch functions -- clean with default params
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
  return await res.json();
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
  return await res.json();
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
  return await res.json();
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
  if (!res.ok) throw new Error(`Rista API error: ${res.status}`);
  return await res.json();
}
