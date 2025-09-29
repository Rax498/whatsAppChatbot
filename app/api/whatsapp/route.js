const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
import { RistaApi } from "../RistaApi/route";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    } else {
      return new Response("Forbidden", { status: 403 });
    }
  } catch (error) {
    console.error("GET error:", error.message);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const entry = body.entry || [];

    for (const e of entry) {
      const changes = e.changes || [];
      for (const change of changes) {
        const messages = change.value?.messages || [];
        for (const message of messages) {
          if (message.type === "text") {
            const from = message.from;
            const messageId = message.id; // <-- WhatsApp message ID here
            const userText = message.text.body;

            // Send typing indicator (mark message read + typing)
            await sendTypingIndicator(from, messageId);

            // Call AI and get response
            const aiResponse = await RistaApi(userText);

            await sendWhatsAppMessage(from, {
              type: "text",
              textBody: aiResponse,
            });
          }
        }
      }
    }
    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("POST error:", error.message);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// Send typing indicator
async function sendTypingIndicator(to, messageId) {
  const bodyPayload = {
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
    typing_indicator: {
      type: "text",
    },
  };

  const response = await fetch(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyPayload),
    }
  );
  return response;
}

// Send  WhatsApp text message
async function sendWhatsAppMessage(to, options) {
  const bodyPayload = {
    messaging_product: "whatsapp",
    to,
    type: options.type,
  };

  if (options.type === "text") {
    bodyPayload.text = { body: options.textBody };
  }

  const response = await fetch(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyPayload),
    }
  );

  return response;
}
