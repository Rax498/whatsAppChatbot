const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Simple in-memory session store (use DB for production)
const sessions = {};

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

        // Initialize session if new user
        if (!sessions[from]) {
          sessions[from] = { currentScreen: "RATE", data: {} };
        }
        const session = sessions[from];

        // TODO: parse userInput and update session.data & currentScreen based on your JSON flow
        // For now, just echo back what user sent with a simple reply

        const replyMessage = {
          messaging_product: "whatsapp",
          to: from,
          type: "text",
          text: {
            body: `You said: ${userInput}\n(Current screen: ${session.currentScreen})`,
          },
        };

        await fetch(
          `https://graph.facebook.com/v15.0/${PHONE_NUMBER_ID}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            },
            body: JSON.stringify(replyMessage),
          }
        );
      }
    }
  }
  return new Response("EVENT_RECEIVED", { status: 200 });
}
