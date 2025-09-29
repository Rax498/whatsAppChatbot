import {
  formatCatalog,
  formatResources,
  formatSoldout,
} from "@/utils/Format_Utils";
import { TokenGen } from "@/utils/TokenGen";
import { NextResponse } from "next/server";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const RISTA_TOKEN = process.env.RISTA_TOKEN;

const POST = async (req) => {
  const body = await req.json();
  console.log(body);
  return NextResponse({ recieved: body });
};

export async function RistaApi(userInput) {
  console.log(userInput);
  const history = [
    {
      role: "system",
      content: `
You are an API intent router and friendly assistant for a restaurant chatbot.
Respond ONLY in JSON: 
- "action": "fetchCatalog", "fetchResources", "fetchSoldOut", or "smalltalk" (for greetings, chitchat, jokes, etc)
- "params": object (for "smalltalk" leave as {})
- "response": a friendly reply to user for "smalltalk", empty otherwise
If user's message is not about menu, resources, or sold-out items, set action to "smalltalk".

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
    console.log("data", data);
    const aiReplyRaw = data.choices?.[0]?.message?.content || "{}";
    const jsonMatch = aiReplyRaw.match(/{[\s\S]*}/);
    if (!jsonMatch) throw new Error("AI did not return valid JSON");
    const parsed = JSON.parse(jsonMatch[0]);
    console.log(aiReplyRaw);

    // calling THe appropriate api using Ai response
    const { action, params, response } = parsed;
    let ristaResponse;
    if (action === "fetchCatalog") {
      ristaResponse = await fetchCatalog(params);
    } else if (action === "fetchResources") {
      ristaResponse = await fetchResources(params);
    } else if (action === "fetchSoldOut") {
      ristaResponse = await fetchSoldOut(params);
    } else if (action === "smalltalk") {
      ristaResponse = response || "I'm here to help!";
    } else {
      throw new Error("Unknown action from AI: " + action);
    }
    return typeof ristaResponse === "string"
      ? ristaResponse
      : JSON.stringify(ristaResponse);
  } catch (error) {
    return new Response("handling error", error);
  }
}

// -------------- Available Api's ------------

async function fetchCatalog({ branch, channel }) {
  const _branch = branch || "BEN";
  const _channel = channel;
  const jwtToken = TokenGen();
  const apiUrl = `https://api.ristaapps.com/v1/catalog?branch=${_branch}&channel=${_channel}`;
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
  const result = formatCatalog(jsonData);
  return result;
}

async function fetchResources({ branch }) {
  const _branch = branch || "BEN";
  const jwtToken = TokenGen();
  const apiUrl = `https://api.ristaapps.com/v1/resource?branch=${_branch}`;
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
  const result = formatResources(jsonData);
  return result;
}

async function fetchSoldOut({ branch }) {
  const _branch = branch || "BEN";
  const jwtToken = TokenGen();
  const apiUrl = `https://api.ristaapps.com/v1/items/soldout?branch=${_branch}`;
  const res = await fetch(apiUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "x-api-key": RISTA_TOKEN,
      "x-api-token": jwtToken,
    },
  });
  if (!res.ok) throw new Error(`Rista API error: ${res.status}`);
  const jsonData = res.json();
  const result = formatSoldout(jsonData);
  return result;
}
async function fetchSalesToday({ branch }) {
  const _branch = branch || "BEN";
  const today = new Date();
  const _day = today.toISOString().slice(0, 10);
  const jwtToken = TokenGen();
  const apiUrl = `https://api.ristaapps.com/v1/sales/summary?branch=${_branch}&day=${_day}`;

  const res = await fetch(apiUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "x-api-key": RISTA_TOKEN,
      "x-api-token": jwtToken,
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP error! Status: ${res.status}`);
  }
  const jsonData = res.json();
  const result = formatSalesToday(jsonData);
  return result;
}
