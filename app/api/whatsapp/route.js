const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const systemPrompt = `
You are Zoya, a reservation assistant. Respond with JSON containing:
- "step": current step key (e.g., "meal", "time", "location", etc.)
- "message": user-facing text (WhatsApp-friendly)
- "buttons": optional array (max 3) of button titles

User input may vary—figure out what step to ask or respond with next.

Example:
{ "step":"meal", "message":"Is this for Lunch, Tea or Dinner?", "buttons":["Lunch","Tea","Dinner"] }
`;

const sessions = {};

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('hub.mode') === 'subscribe'
      && searchParams.get('hub.verify_token') === VERIFY_TOKEN) {
    return new Response(searchParams.get('hub.challenge'), { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(req) {
  try {
    const body = await req.json();
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        for (const msg of change.value?.messages || []) {
          const from = msg.from;
          const userText = msg.interactive?.button_reply?.title?.trim()
                         || msg.text?.body?.trim()
                         || '';
          if (!sessions[from]) {
            sessions[from] = { history: [{ role: 'system', content: systemPrompt }], reservation: {} };
          }
          const session = sessions[from];
          session.history.push({ role: 'user', content: userText });

          const aiResponse = await callOpenRouterAI(session.history);
          session.history.push({ role: 'assistant', content: aiResponse });

          let parsed;
          try { parsed = JSON.parse(aiResponse); }
          catch {
            await sendTextMessage(from, "Sorry, I didn't understand that. Could you please rephrase?");
            continue;
          }

          const { step, message, buttons = [] } = parsed;

          // Save answer to reservation if recognized
          if (step && userText && step !== 'confirm') {
            session.reservation[step] = userText;
          }

          if (buttons.length > 0) {
            await sendButtonMessage(from, message, buttons);
          } else {
            await sendTextMessage(from, message);
          }

          // If step is confirm, handle final confirm/cancel logic
          if (step === 'confirm') {
            // Wait for user to tap Confirm or Cancel next message
          }
        }
      }
    }
    return new Response('EVENT_RECEIVED', { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function callOpenRouterAI(history) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'openai/gpt-oss-20b:free', messages: history, max_tokens: 500, temperature: 0.6 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'AI error');
  return data.choices[0].message.content;
}

async function sendTextMessage(to, text) {
  await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body: text } }),
  });
}

async function sendButtonMessage(to, text, buttons) {
  const btnPayload = buttons.slice(0, 3).map((label, i) => ({
    type: 'reply',
    reply: { id: `btn_${i}`, title: label }
  }));
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text },
      action: { buttons: btnPayload }
    }
  };
  await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
