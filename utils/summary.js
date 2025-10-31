import { TokenGen } from "@/utils/TokenGen";

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
for branch always use branch code default "BEN"
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
        model: "nvidia/nemotron-nano-12b-v2-vl:free",
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
    } catch {
      throw new Error("AI did not return valid JSON: " + aiReplyRaw);
    }

    const { action, params = {}, response } = parsed;
    console.log("Parsed", parsed);

    // ACTION HANDLER MAP
    const actionHandlers = {
      fetchCatalog: { fn: fetchCatalog, label: "catalog" },
      fetchResources: { fn: fetchResources, label: "resources" },
      fetchSoldOut: { fn: fetchSoldOut, label: "sold out items" },
      fetchSalesToday: { fn: fetchSalesToday, label: "sales today" },
      fetchSalesSummary: { fn: fetchSalesSummary, label: "sales summary" },
      fetchInventoryAuditPage: {
        fn: fetchInventoryAuditPage,
        label: "inventory audit page",
      },
      fetchInventoryTransferReturn: {
        fn: fetchInventoryTransferReturnPage,
        label: "inventory transfer return page",
      },
      fetchInventoryStoreItems: {
        fn: fetchInventoryStoreItems,
        label: "inventory store items",
      },
      fetchInventorySupplierList: {
        fn: fetchInventorySupplierList,
        label: "inventory supplier list",
      },
    };

    let ristaResponse;
    if (action === "smalltalk") {
      ristaResponse = response || "I'm here to help!";
    } else if (actionHandlers[action]) {
      const { fn, label } = actionHandlers[action];
      const rawData = await fn(params);
      ristaResponse = await summarizeData(rawData, label, userInput, params);
    } else {
      throw new Error("Unknown action from AI: " + action);
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
  const systemContent = `
Summarize the following ${dataType} based on what the user asked: "${userInput}".
Use simple, natural language like a human. Keep it short, clear, and clean — easy to read on WhatsApp.
Avoid special symbols or markdown (except ₹ or $ if needed).
  `.trim();

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "x-ai/grok-4-fast:free",
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

/* =============== API CALL HELPERS =============== */
async function fetchWithAuth(apiUrl) {
  const jwtToken = TokenGen();
  const res = await fetch(apiUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "x-api-key": RISTA_TOKEN,
      "x-api-token": jwtToken,
    },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Rista API error: ${res.status} ${errText}`);
  }
  return await res.json();
}

async function fetchCatalog({ branch = "BEN", channel } = {}) {
  return fetchWithAuth(
    `https://api.ristaapps.com/v1/catalog?branch=${branch}&channel=${
      channel || ""
    }`
  );
}

async function fetchResources({ branch = "BEN" } = {}) {
  return fetchWithAuth(
    `https://api.ristaapps.com/v1/resource?branch=${branch}`
  );
}

async function fetchSoldOut({ branch = "BEN" } = {}) {
  return fetchWithAuth(
    `https://api.ristaapps.com/v1/items/soldout?branch=${branch}`
  );
}

async function fetchSalesToday({ branch = "BEN" } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  return fetchWithAuth(
    `https://api.ristaapps.com/v1/sales/summary?branch=${branch}&day=${today}`
  );
}

async function fetchSalesSummary({ branch = "BEN", date } = {}) {
  const day = date || new Date().toISOString().slice(0, 10);
  return fetchWithAuth(
    `https://api.ristaapps.com/v1/analytics/sales/summary?branch=${branch}&period=${day}`
  );
}

async function fetchInventoryAuditPage({ branch = "BEN", day, lastKey } = {}) {
  const auditDay = day || new Date().toISOString().slice(0, 10);
  let url = `https://api.ristaapps.com/v1/inventory/audit/page?branch=${branch}&day=${auditDay}`;
  if (lastKey) url += `&lastKey=${lastKey}`;
  return fetchWithAuth(url);
}

async function fetchInventoryTransferReturnPage({
  branch = "BEN",
  day,
  lastKey,
} = {}) {
  const auditDay = day || new Date().toISOString().slice(0, 10);
  let url = `https://api.ristaapps.com/v1/inventory/transfer_return/page?branch=${branch}&day=${auditDay}`;
  if (lastKey) url += `&lastKey=${lastKey}`;
  return fetchWithAuth(url);
}

async function fetchInventoryStoreItems({ branch = "BEN", day } = {}) {
  const auditDay = day || new Date().toISOString().slice(0, 10);
  return fetchWithAuth(
    `https://api.ristaapps.com/v1/inventory/store/items?branch=${branch}&day=${auditDay}`
  );
}

async function fetchInventorySupplierList({ branch, supplierCode } = {}) {
  const query = [];
  if (branch) query.push(`branch=${branch}`);
  if (supplierCode) query.push(`supplierCode=${supplierCode}`);
  const url = `https://api.ristaapps.com/v1/inventory/supplier/list${
    query.length ? "?" + query.join("&") : ""
  }`;
  return fetchWithAuth(url);
}
