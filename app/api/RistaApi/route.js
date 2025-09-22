import { TokenGen } from "@/app/utils/TokenGen";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const RISTA_TOKEN = process.env.RISTA_TOKEN;

export async function RistaApi(userInput) {
  const history = [
    {
      role: "system",
      content: `
You are an API intent router and friendly assistant for a restaurant chatbot.
Respond ONLY in JSON with:
- "action": one of fetchCatalog, fetchResources, fetchSoldOut, fetchSalesToday, fetchSalesSummary, fetchInventoryAuditPage, fetchInventoryTransferReturn, fetchInventoryStoreItems, fetchInventorySupplierList, smalltalk
- "params": object with details like branchcode, date(YYY-MM-DD), invoiceId, productId, branch, channel, lastKey, supplierCode, etc.
- "response": friendly text reply (only for smalltalk), empty otherwise.
for branch always use branch code  default "BEN"
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
        model: "x-ai/grok-4-fast:free",
        messages: history,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      let errorBody;
      try {
        errorBody = await res.json();
      } catch {
        errorBody = await res.text();
      }
      console.error(
        `OpenRouter API error: ${res.status} ${res.statusText}`,
        errorBody
      );
      throw new Error(
        `OpenRouter API error: ${res.status} ${
          res.statusText
        }: ${JSON.stringify(errorBody)}`
      );
    }

    const data = await res.json();
    const aiReplyRaw = data.choices?.[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(aiReplyRaw);
    } catch (err) {
      console.error("AI did not return valid JSON:", aiReplyRaw);
      throw new Error("AI did not return valid JSON");
    }

    const { action, params = {}, response } = parsed;
    console.log('Parsed',parsed)

    let ristaResponse;

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
      case "fetchSalesSummary": {
        const salesSummaryData = await fetchSalesSummary(params);
        ristaResponse = await summarizeData(
          salesSummaryData,
          "sales summary",
          userInput,
          params
        );
        break;
      }
      case "fetchInventoryAudit": {
        const auditData = await fetchInventoryAuditPage(params.params);
        ristaResponse = await summarizeData(
          auditData,
          "inventory audit page",
          userInput,
          params
        );
        break;
      }
      case "fetchInventoryTransferReturn": {
        const transferReturnData = await fetchInventoryTransferReturnPage(
         params.params
        );
        ristaResponse = await summarizeData(
          transferReturnData,
          "inventory transfer return page",
          userInput,
          params
        );
        break;
      }
      case "fetchInventoryStoreItems": {
        const storeItemsData = await fetchInventoryStoreItems(params);
        ristaResponse = await summarizeData(
          storeItemsData,
          "inventory store items",
          userInput,
          params
        );
        break;
      }
      case "fetchInventorySupplierList": {
        const supplierListData = await fetchInventorySupplierList(params);
        ristaResponse = await summarizeData(
          supplierListData,
          "inventory supplier list",
          userInput,
          params
        );
        break;
      }
      case "smalltalk": {
        ristaResponse = response || "I'm here to help!";
        break;
      }
      default: {
        throw new Error("Unknown action from AI: " + action);
      }
    }

    return typeof ristaResponse === "string"
      ? ristaResponse
      : JSON.stringify(ristaResponse);
  } catch (error) {
    console.error("RistaApi error:", error);
    return "Sorry, something went wrong. Please try again later.";
  }
}

async function summarizeData(data, dataType, userInput, params) {
  const paramInfo =
    params && Object.keys(params).length > 0
      ? `using these parameters: ${JSON.stringify(params)}`
      : "";

  const systemContent = `
Summarize the following ${dataType} based on what the user asked: "${userInput}".
Use simple, natural language like a human. Keep it short,structured, clear, and clean — easy to read on WhatsApp.
Avoid special symbols or markdown (except ₹ or $ if needed). No technical terms. Just a helpful, friendly reply.
`.trim();

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model:"x-ai/grok-4-fast:free",
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

// Your fetch functions with correct indentation

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

async function fetchSalesSummary({ branch = "BEN", date }) {
  console.log(branch,date)
  const jwtToken = TokenGen();
  const day = date || new Date().toISOString().slice(0, 10);
  const apiUrl = `https://api.ristaapps.com/v1/analytics/sales/summary?branch=${branch}&date=${day}`;
  const res = await fetch(apiUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "x-api-key": RISTA_TOKEN,
      "x-api-token": jwtToken,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Rista API error:", res.status, text);
    throw new Error(`Rista API error: ${res.status} ${text}`);
  }
  return await res.json();
}

async function fetchInventoryAuditPage({ branch = "BEN", day, lastKey }) {
  console.log(branch,day,lastkey)
  const jwtToken = TokenGen();
  const auditDay = day || new Date().toISOString().slice(0, 10);
  let apiUrl = `https://api.ristaapps.com/v1/inventory/audit/page?branch=${branch}&day=${auditDay}`;
  // if (lastKey) {
  //   apiUrl += `&lastKey=${lastKey}`;
  // }
  const res = await fetch(apiUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "x-api-key": RISTA_TOKEN,
      "x-api-token": jwtToken,
    },
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error("Rista API error:", res.status, errorText);
    throw new Error(`Rista API error: ${res.status} ${errorText}`);
  }
  return await res.json();
}

async function fetchInventoryTransferReturnPage({
  branch = "BEN",
  day,
  lastKey,
}) {
  const jwtToken = TokenGen();
  const auditDay = day || new Date().toISOString().slice(0, 10);
  let apiUrl = `https://api.ristaapps.com/v1/inventory/transfer_return/page?branch=${branch}&day=${auditDay}`;
  if (lastKey) {
    apiUrl += `&lastKey=${lastKey}`;
  }
  const res = await fetch(apiUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "x-api-key": RISTA_TOKEN,
      "x-api-token": jwtToken,
    },
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error("Rista API error:", res.status, errorText);
    throw new Error(`Rista API error: ${res.status} ${errorText}`);
  }
  return await res.json();
}

async function fetchInventoryStoreItems({ branch = "BEN", day }) {
  const jwtToken = TokenGen();
  const auditDay = day || new Date().toISOString().slice(0, 10);
  const apiUrl = `https://api.ristaapps.com/v1/inventory/store/items?branch=${branch}&day=${auditDay}`;
  const res = await fetch(apiUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "x-api-key": RISTA_TOKEN,
      "x-api-token": jwtToken,
    },
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error("Rista API error:", res.status, errorText);
    throw new Error(`Rista API error: ${res.status} ${errorText}`);
  }
  return await res.json();
}

async function fetchInventorySupplierList({ branch, supplierCode }) {
  const jwtToken = TokenGen();
  let apiUrl = "https://api.ristaapps.com/v1/inventory/supplier/list";
  const queryParams = [];
  if (branch) queryParams.push(`branch=${branch}`);
  if (supplierCode) queryParams.push(`supplierCode=${supplierCode}`);
  if (queryParams.length > 0) {
    apiUrl += "?" + queryParams.join("&");
  }
  const res = await fetch(apiUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "x-api-key": RISTA_TOKEN,
      "x-api-token": jwtToken,
    },
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error("Rista API error:", res.status, errorText);
    throw new Error(`Rista API error: ${res.status} ${errorText}`);
  }
  return await res.json();
}
