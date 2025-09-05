// File: /app/api/whatsapp/route.ts

const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const sessions = {};

const systemPrompt = `
You are Zoya, a polite WhatsApp reservation assistant for the restaurant Kola.

Follow this strict flow and return ONLY structured JSON:

1. Greet the user and introduce yourself (only once).
2. Ask if the reservation is for: Lunch, Tea, or Dinner.
3. Ask for the preferred time (e.g., 12:30 PM).
4. Ask for number of guests (max 20).
5. Ask for the Kola location: Hennur, Sarjapur Road, or Yeshwantpur.
6. Ask about preferences (one at a time):
   - Smoking or Non-smoking
   - Music or No music
   - Any special needs
7. Summarize the reservation clearly and ask for confirmation.

If the user gives multiple details at once (e.g., “Dinner at 8 PM for 4 at Sarjapur”), extract them and only ask for what's missing.

For date:
- Use "today", "tomorrow", or allow picking a date within 30 days.
- Normalize all dates to YYYY-MM-DD internally.

Always respond with this format:

{
  "step": "time",
  "message": "What time would you like to come?",
  "buttons": []
}
`;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(req) {
  try {
    const body = await req.json();
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const messages = change.value?.messages || [];
        for (const msg of messages) {
          const from = msg.from;
          const userText =
            msg.interactive?.button_reply?.title?.trim() ||
            msg.text?.body?.trim() || '';

          // Initialize user session
          if (!sessions[from]) {
            sessions[from] = {
              history: [{ role: 'system', content: systemPrompt }],
              reservation: {},
              greeted: false
            };
          }

          const session = sessions[from];
          session.history.push({ role: 'user', content: userText });

          // Call AI
          const aiReply = await callOpenRouterAI(session.history);
          session.history.push({ role: 'assistant', content: aiReply });

          let parsed;
          try {
            parsed = JSON.parse(aiReply);
          } catch {
            await sendTextMessage(from, "Sorry, I didn't understand that. Could you rephrase?");
            continue;
          }

          const { step, message, buttons = [] } = parsed;

          if (step && step !== 'confirm') {
            session.reservation[step] = userText;
          }

          if (step === 'guests') {
            const guests = parseInt(userText);
            if (guests > 20) {
              await sendTextMessage(from, "Sorry, we only allow up to 20 guests.");
              continue;
            }
          }

          if (step === 'date') {
            // simulate date buttons (today + 2 days)
            const dateButtons = getDateButtons(3);
            await sendButtonMessage(from, message, dateButtons);
            continue;
          }

          if (step === 'confirm') {
            const summary = generateSummary(session.reservation);
            await sendButtonMessage(from, summary, ['Confirm', 'Cancel']);
            continue;
          }

          if (buttons.length > 0) {
            await sendButtonMessage(from, message, buttons);
          } else {
            await sendTextMessage(from, message);
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

function getDateButtons(n = 3) {
  const buttons = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const label = d.toDateString(); // e.g., "Fri Sep 06 2025"
    buttons.push(label);
  }
  return buttons;
}

function generateSummary(res) {
  return `Here’s your reservation:

🍽️ Meal: ${res.meal || '-'}
🕒 Time: ${res.time || '-'}
👥 Guests: ${res.guests || '-'}
📍 Location: ${res.location || '-'}
📅 Date: ${res.date || '-'}
🚬 Smoking: ${res.smoking || '-'}
🎶 Music: ${res.music || '-'}
♿ Special Needs: ${res.special_needs || 'None'}

Would you like to confirm?`;
}

async function callOpenRouterAI(history) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o',
      messages: history,
      temperature: 0.5,
      max_tokens: 800
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'OpenRouter failed');
  return data.choices[0].message.content;
}

async function sendTextMessage(to, text) {
  const res = await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text }
    })
  });

  if (!res.ok) {
    const err = await res.json();
    console.error('WhatsApp text send error:', err.error?.message || err);
  }
}

async function sendButtonMessage(to, text, buttons) {
  const btns = buttons.slice(0, 3).map((title, i) => ({
    type: 'reply',
    reply: { id: `btn_${i + 1}`, title }
  }));

  const res = await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text },
        action: { buttons: btns }
      }
    })
  });

  if (!res.ok) {
    const err = await res.json();
    console.error('WhatsApp button send error:', err.error?.message || err);
  }
}
