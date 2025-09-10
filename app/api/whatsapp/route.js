const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const sessions = {};
const requiredSteps = ["meal", "time", "guests", "location", "preferences", "date"];

function getNextDates(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

function isReservationComplete(res) {
  return requiredSteps.every((k) => res[k]);
}

function generateSummary(res) {
  return `Here’s your reservation:

• Meal: ${res.meal || "-"}
• Time: ${res.time || "-"}
• Guests: ${res.guests || "-"}
• Location: ${res.location || "-"}
• Preferences: ${res.preferences || "-"}
• Date: ${res.date || "-"}

Please Confirm or Cancel.`;
}

// System prompt instructing AI to call functions, NOT return JSON or plain text directly
function getSystemPrompt() {
  const futureDates = getNextDates(5);
  return `
You are Zoya, a friendly and smart reservation assistant for Kola.

Your job is to help the user complete a reservation through these steps:
1. Ask if it's for Lunch, Tea, or Dinner.
2. Ask preferred time.
3. Ask number of guests (max 20).
4. Ask location: Hennur, Sarjapur, or Yeshwantpur.
5. Ask preferences: Smoking, Music, or special needs.
6. Ask for a date within the next 30 days.
7. Summarize and ask for confirmation.

Important:
- You MUST respond ONLY by calling one of these functions: sendButtons or sendText.
- Never respond with plain text or JSON.
- Use sendButtons for steps: meal, location, preferences, date (provide buttons for the user to click).
- Use sendText only for simple messages without buttons.
- For "date" step, use buttons with these dates: ${futureDates.join(", ")}.

Return function calls exactly like this format:

{
  "role": "assistant",
  "function_call": {
    "name": "sendButtons",
    "arguments": "{\"to\":\"<user_phone>\",\"text\":\"<message>\",\"buttons\":[\"button1\",\"button2\"]}"
  }
}

Always follow these rules strictly.
`;
}

const functions = [
  {
    name: "sendButtons",
    description: "Send WhatsApp buttons to user",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string" },
        text: { type: "string" },
        buttons: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["to", "text", "buttons"],
    },
  },
  {
    name: "sendText",
    description: "Send plain WhatsApp text message",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string" },
        text: { type: "string" },
      },
      required: ["to", "text"],
    },
  },
];

async function callOpenRouterAI(history) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-exp:free",
      messages: history,
      temperature: 0.6,
      functions,
      function_call: "auto",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("OpenRouter AI error:", data);
    throw new Error("AI call failed");
  }

  return data.choices[0].message;
}

async function sendText(to, text) {
  const res = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("sendText error:", err);
  }
}

async function sendButtons(to, text, buttons) {
  const btns = buttons.slice(0, 3).map((title, idx) => ({
    type: "reply",
    reply: { id: `btn_${Date.now()}_${idx}`, title: title.slice(0, 20) },
  }));

  const res = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      recipient_type: "individual",
      interactive: {
        type: "button",
        body: { text },
        action: { buttons: btns },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("sendButtons error:", err);
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  if (
    searchParams.get("hub.mode") === "subscribe" &&
    searchParams.get("hub.verify_token") === VERIFY_TOKEN
  ) {
    return new Response(searchParams.get("hub.challenge"), { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req) {
  const body = await req.json();

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      for (const msg of change.value?.messages || []) {
        const from = msg.from;
        const userInput =
          msg.interactive?.button_reply?.title?.trim() ||
          msg.text?.body?.trim() ||
          "";

        if (!sessions[from]) {
          sessions[from] = {
            history: [{ role: "system", content: getSystemPrompt() }],
            reservation: {},
          };
        }

        const session = sessions[from];
        session.history.push({ role: "user", content: userInput });

        let message;
        try {
          message = await callOpenRouterAI(session.history);
        } catch (e) {
          await sendText(from, "Sorry, I’m having trouble understanding. Please try again.");
          continue;
        }

        session.history.push(message);

        if (message.function_call) {
          const { name, arguments: argsStr } = message.function_call;
          const args = JSON.parse(argsStr);

          if (name === "sendButtons") {
            await sendButtons(args.to, args.text, args.buttons);
          } else if (name === "sendText") {
            await sendText(args.to, args.text);
          }

          // Record tool call success for AI context
          session.history.push({ role: "tool", name, content: "OK" });
        } else {
          // In case AI ignores instruction (should not happen with good prompt)
          await sendText(from, message.content);
        }
      }
    }
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}
