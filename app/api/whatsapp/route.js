const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const RISTA_TOKEN = process.env.RISTA_TOKEN;
const RISTA_SECURITY_KEY = process.env.RISTA_SECURITY_KEY;

// WhatsApp GET webhook verification
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

// WhatsApp POST webhook handler
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
            const userText = message.text.body;

            await sendText(from, "Hello, welcome to Rista Api!"); // Add await for sendText

            // AI Routing: Pass userText as string, fix argument format
            const aiResponse = await RistaApi(userText);

            // Ensure the AI response is a string/plain text or safe to send
            await sendText(from, aiResponse);
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

// Send message to WhatsApp user
async function sendText(to, text) {
  const response = await fetch(
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
  if (!response.ok) {
    const err = await response.text();
    console.error("WhatsApp send error:", err);
  }
}
