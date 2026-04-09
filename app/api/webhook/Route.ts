import { normalizeWebhook } from "@/lib/normalize";

const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

export const GET = async (req: Request) => {
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
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const normalized = normalizeWebhook(body);

    console.log("Normalized:", normalized);

    // ✅ Now you get clean messages
    for (const msg of normalized.messages) {
      console.log("Message:", msg);

      // Example: handle text message
      if (msg.type === "text") {
        const text = msg.text?.body;
        const from = msg.from;

        console.log("User:", from, "Text:", text);

        // your logic here
      }

      // Example: direction (your extraData)
      if (msg.extraData?.direction === "inbound") {
        console.log("Incoming message");
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("POST error:", error.message);
    return new Response("Internal Server Error", { status: 500 });
  }
}
