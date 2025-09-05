// Next.js API handler: WhatsApp reservation flow with AI + proper button structure

const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const steps = [
  { key: 'meal', question: 'Is your reservation for Lunch, Tea, or Dinner?', buttons: ['Lunch', 'Tea', 'Dinner'] },
  { key: 'time', question: 'What time would you like to visit?', buttons: [] },
  { key: 'guests', question: 'How many guests (max 20)?', buttons: [] },
  { key: 'location', question: 'Which Kola location do you prefer?', buttons: ['Hennur', 'Sarjapur Road', 'Yeshwantpur'] },
  { key: 'preferences', question: 'Any preferences? (Smoking, Music, or Special needs)', buttons: ['Smoking', 'Non‑Smoking', 'Music', 'No Music', 'None'] },
  { key: 'date', question: 'Please choose a date (within 30 days):', buttons: [] },
  { key: 'confirm', question: 'Here is your reservation summary. Confirm or Cancel?', buttons: ['Confirm', 'Cancel'] },
];

const sessions = {};

const systemPrompt = `
You are Zoya, a warm, friendly reservation assistant for Kola.

Follow this flow:
1. Ask if the reservation is for Lunch, Tea, or Dinner.
2. Ask for preferred time.
3. Ask for number of guests (max 20).
4. Ask for location: Hennur, Sarjapur Road, or Yeshwantpur.
5. Ask for preferences (Smoking, Music, or special needs).
6. Ask for booking date within 30 days.
7. Summarize and ask for confirmation.

If user provides multiple details (e.g. "Dinner at 7 for 3 at Hennur tomorrow"), parse and skip steps accordingly.

Return only JSON:
{ "step": "<step_key>", "message": "<user visible text>", "buttons": ["Option1","Option2"] }
`;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('hub.mode') === 'subscribe' && searchParams.get('hub.verify_token') === VERIFY_TOKEN) {
    return new Response(searchParams.get('hub.challenge'), { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(req) {
  const body = await req.json();
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      for (const message of change.value?.messages || []) {
        const from = message.from;
        const userInput = message.interactive?.button_reply?.title?.trim() || message.text?.body?.trim() || '';

        if (!sessions[from]) {
          sessions[from] = { history: [{ role: 'system', content: systemPrompt }], reservation: {} };
        }
        const session = sessions[from];
        session.history.push({ role: 'user', content: userInput });

        const aiRes = await callOpenRouterAI(session.history);
        session.history.push({ role: 'assistant', content: aiRes });

        let parsed;
        try { parsed = JSON.parse(aiRes); }
        catch {
          await sendText(from, "Sorry, I didn't catch that. Could you rephrase?");
          continue;
        }

        const { step, message: msgText, buttons = [] } = parsed;
        if (step && userInput && step !== 'confirm') {
          session.reservation[step] = userInput;
        }

        if (step === 'guests' && parseInt(session.reservation.guests) > 20) {
          await sendText(from, "Maximum is 20 guests. Please enter a valid number.");
          continue;
        }

        if (step === 'date') {
          await sendButtons(from, msgText, getNextDates(5));
          continue;
        }

        if (step === 'confirm') {
          const summary = generateSummary(session.reservation);
          await sendButtons(from, summary, ['Confirm', 'Cancel']);
          continue;
        }

        if (buttons.length > 0) {
          await sendButtons(from, msgText, buttons);
        } else {
          await sendText(from, msgText);
        }
      }
    }
  }
  return new Response('EVENT_RECEIVED', { status: 200 });
}

function getNextDates(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  });
}

function generateSummary(res) {
  return `Here’s your reservation:

• Meal: ${res.meal || '-'}
• Time: ${res.time || '-'}
• Guests: ${res.guests || '-'}
• Location: ${res.location || '-'}
• Preferences: ${res.preferences || '-'}
• Date: ${res.date || '-'}

Please Confirm or Cancel.`;
}

async function callOpenRouterAI(history) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'openai/gpt-oss-20b:free', messages: history, temperature: 0.6, max_tokens: 500 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'AI error');
  return data.choices[0].message.content;
}

async function sendText(to, text) {
  await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body: text } }),
  });
}

async function sendButtons(to, text, buttons) {
  const btns = buttons.slice(0, 3).map((title, idx) => ({
    type: 'reply',
    reply: { id: `btn_${idx + 1}`, title },
  }));

  await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text },
        action: { buttons: btns },
      },
    }),
  });
}
