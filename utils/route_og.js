const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const sessions = {};
const requiredSteps = [
  "meal",
  "time",
  "guests",
  "location",
  "preferences",
  "date",
];

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

function getSystemPrompt(userPhone) {
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
- Always track completed steps.
- If user input is unrelated, respond briefly then return to next pending step.
- Do not repeat completed steps.
- Use buttons for these steps: meal, location, preferences, date.
- For "date" step, suggest buttons like: ${futureDates.join(", ")}.

You MUST respond ONLY with a tool call

If sending text only, omit the "buttons" field or send an empty array.
`.trim();
}

async function callOpenRouterAI(history) {
  const tools = [
    {
      type: "function",
      function: {
        name: "sendButtons",
        description: "Send WhatsApp buttons to user",
        parameters: {
          type: "object",
          properties: {
            to: { type: "string" },
            text: { type: "string" },
            buttons: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["to", "text"],
        },
      },
    },
    {
      type: "function",
      function: {
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
    },
  ];

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
      tools,
      tool_choice: "auto",
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
  const res = await fetch(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    {
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
    }
  );

  const info = await res.json();
  if (!res.ok) {
    console.error("sendText error:", info);
  }
}

async function sendButtons(to, text, buttons) {
  const btns = buttons.slice(0, 3).map((title, idx) => ({
    type: "reply",
    reply: {
      id: `btn_${idx}_${Math.random().toString(36).slice(2, 5)}`,
      title: title.slice(0, 20),
    },
  }));

  const res = await fetch(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text },
          action: { buttons: btns },
        },
      }),
    }
  );

  const info = await res.json();
  if (!res.ok) {
    console.error("sendButtons error:", info);
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
            history: [{ role: "system", content: getSystemPrompt(from) }],
            reservation: {},
          };
        }

        const session = sessions[from];
        session.history.push({ role: "user", content: userInput });

        let aiMessage;
        try {
          aiMessage = await callOpenRouterAI(session.history);
        } catch (e) {
          console.error("AI Error:", e);
          await sendText(
            from,
            "Sorry, I'm having trouble right now. Please try again."
          );
          continue;
        }

        session.history.push({
          role: "assistant",
          content: aiMessage.content || "",
        });

        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
          for (const toolCall of aiMessage.tool_calls) {
            const toolName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);

            // Fix 'user' placeholder if present
            if (args.to === "user") args.to = from;

            if (toolName === "sendButtons") {
              await sendButtons(args.to, args.text, args.buttons || []);
            } else if (toolName === "sendText") {
              await sendText(args.to, args.text);
            } else {
              await sendText(from, "Unknown tool requested.");
            }
          }
        } else if (aiMessage.content) {
          await sendText(from, aiMessage.content);
        }
      }
    }
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}
