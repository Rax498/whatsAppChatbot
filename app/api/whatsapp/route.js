const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

async function sendMessage(to, messageData) {
  await fetch(`https://graph.facebook.com/v15.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      ...messageData,
    }),
  });
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

        if (msg.type === "button") {
          const buttonId = msg.button?.payload || msg.interactive?.button_reply?.id;
          if (buttonId === "start_booking_flow") {
            await sendMessage(from, {
              type: "template",
              template: {
                name: "your_flow_template_name",
                language: { code: "en_US" },
              },
            });
            continue;
          }
        }

        if (msg.type === "text" || msg.type === "interactive") {
          await sendMessage(from, {
            text: { body: "Hi! Welcome to our service. Ready to book?" },
          });

          await sendMessage(from, {
            interactive: {
              type: "button",
              body: { text: "Click 'Book Now' to start booking flow" },
              action: {
                buttons: [
                  {
                    type: "reply",
                    reply: { id: "start_booking_flow", title: "Book Now" },
                  },
                ],
              },
            },
          });
        }
      }
    }
  }
  return new Response("EVENT_RECEIVED", { status: 200 });
}
