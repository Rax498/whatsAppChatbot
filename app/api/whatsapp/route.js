const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Simple session store
const sessions = {};

// Helper to send message to WhatsApp
async function sendMessage(message) {
  await fetch(`https://graph.facebook.com/v15.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
    },
    body: JSON.stringify(message),
  });
}

// Helpers to send different types of messages
async function sendListMessage(to, text, button, sections) {
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text },
      action: { button, sections },
    },
  });
}

async function sendButtonMessage(to, text, buttons) {
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text },
      action: { buttons },
    },
  });
}

async function sendTextMessage(to, text) {
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}

// Steps list
const steps = [
  "location",
  "hotel",
  "check_in",
  "check_out",
  "adults",
  "children",
  "promo",
  "confirm",
  "add_on",
  "name",
  "email",
  "phone",
  "done",
];

// Main flow engine
async function handleStep(from, input, session) {
  const data = session.data;

  switch (session.step) {
    case "location":
      await sendListMessage(from, "📍 Choose your location:", "Select", [
        {
          title: "Locations",
          rows: [
            { id: "loc_Coorg", title: "Coorg" },
            { id: "loc_Hampi", title: "Hampi" },
            { id: "loc_Kabini", title: "Kabini" },
            { id: "loc_Kalahari", title: "Kalahari" },
          ],
        },
      ]);
      break;

    case "hotel":
      data.location = input;
      await sendListMessage(from, "🏨 Choose your hotel:", "Select Hotel", [
        {
          title: "Hotels",
          rows: [
            {
              id: "hotel_Evolve_Hampi",
              title: "Evolve Back, Hampi",
            },
          ],
        },
      ]);
      break;

    case "check_in":
      data.hotel = input;
      await sendTextMessage(from, "🗓️ Enter check-in date (e.g. 2025-12-01):");
      break;

    case "check_out":
      data.check_in = input;
      await sendTextMessage(from, "🗓️ Enter check-out date (e.g. 2025-12-05):");
      break;

    case "adults":
      data.check_out = input;
      await sendButtonMessage(from, "👨‍👩‍👧‍👦 How many adults?", [
        { type: "reply", reply: { id: "adults_1", title: "1" } },
        { type: "reply", reply: { id: "adults_2", title: "2" } },
        { type: "reply", reply: { id: "adults_3", title: "3" } },
      ]);
      break;

    case "children":
      data.adults = input;
      await sendButtonMessage(from, "🧒 How many children?", [
        { type: "reply", reply: { id: "children_0", title: "0" } },
        { type: "reply", reply: { id: "children_1", title: "1" } },
        { type: "reply", reply: { id: "children_2", title: "2" } },
      ]);
      break;

    case "promo":
      data.children = input;
      await sendTextMessage(from, "💬 Enter promo code (or type 'None'):");
      break;

    case "confirm":
      data.promo = input;
      const summary = `✅ Booking Summary:
Location: ${data.location}
Hotel: ${data.hotel}
Check-in: ${data.check_in}
Check-out: ${data.check_out}
Adults: ${data.adults}
Children: ${data.children}
Promo Code: ${data.promo}`;
      await sendTextMessage(from, summary);
      await sendButtonMessage(from, "Would you like to continue?", [
        { type: "reply", reply: { id: "confirm_yes", title: "✅ Yes" } },
        { type: "reply", reply: { id: "confirm_no", title: "❌ No" } },
      ]);
      break;

    case "add_on":
      await sendButtonMessage(from, "🎈 Add Hot Air Balloon (₹25,000)?", [
        { type: "reply", reply: { id: "add_yes", title: "👍 Yes" } },
        { type: "reply", reply: { id: "add_no", title: "👎 No" } },
      ]);
      break;

    case "name":
      data.add_on = input;
      await sendTextMessage(from, "🧑 Please enter your full name:");
      break;

    case "email":
      data.name = input;
      await sendTextMessage(from, "📧 Enter your email address:");
      break;

    case "phone":
      data.email = input;
      await sendTextMessage(from, "📞 Enter your phone number:");
      break;

    case "done":
      data.phone = input;
      await sendTextMessage(from, `🎉 Thank you ${data.name}! We’ve received your booking and will be in touch.`);
      session.step = "complete";
      break;

    default:
      await sendTextMessage(from, "❓ Something went wrong. Please type 'start' to begin again.");
      session.step = "location";
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
        const session = sessions[from] || {
          step: "location",
          data: {},
        };
        sessions[from] = session;

        const input =
          msg.interactive?.button_reply?.id ||
          msg.interactive?.list_reply?.id ||
          msg.text?.body?.trim() ||
          "";

        const currentIndex = steps.indexOf(session.step);
        await handleStep(from, input, session);

        // Move to next step unless in confirmation or complete state
        if (session.step !== "confirm" && session.step !== "complete") {
          session.step = steps[currentIndex + 1];
        }
      }
    }
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}
