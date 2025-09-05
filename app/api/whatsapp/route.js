// Enhanced WhatsApp Reservation with AI + Button Flow + Error Logging

const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const steps = [
  { key: 'meal', question: 'Is your reservation for Lunch, Tea, or Dinner?', buttons: ['Lunch', 'Tea', 'Dinner'] },
  { key: 'time', question: 'What time would you like to visit?', buttons: [] },
  { key: 'guests', question: 'How many guests (max 20)?', buttons: [] },
  { key: 'location', question: 'Which Kola location do you prefer?', buttons: ['Hennur', 'Sarjapur Road', 'Yeshwantpur'] },
  { key: 'preferences', question: 'Preferences? Smoking, Music, or special needs?', buttons: ['Smoking', 'Non‑Smoking', 'Music', 'No Music', 'None'] },
  { key: 'date', question: 'Please pick a date (within 30 days):', buttons: [] },
  { key: 'confirm', question: 'Reservation summary. Confirm or Cancel?', buttons: ['Confirm', 'Cancel'] },
];

const sessions = {};

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
          sessions[from] = { history: [], reservation: {} };
          await sendButtons(from, steps[0].question, steps[0].buttons);
          continue;
        }

        const session = sessions[from];
        session.history.push({ role: 'user', content: userInput });

        const aiRes = await callOpenRouterAI(session.history);
        session.history.push({ role: 'assistant', content: aiRes });

        let parsed;
        try {
          parsed = JSON.parse(aiRes);
        } catch (e) {
          await sendText(from, "Sorry, I didn't understand that. Could you please rephrase?");
          console.error('AI parse error:', e, aiRes);
          continue;
        }

        const { step, message: msgText, buttons = [] } = parsed;
        if (step && userInput && step !== 'confirm') {
          session.reservation[step] = userInput;
        }

        if (step === 'guests' && parseInt(session.reservation.guests) > 20) {
          await sendText(from, 'Max 20 guests allowed. Please enter a smaller number.');
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
  return `Reservation Summary:

Meal: ${res.meal || '-'}
Time: ${res.time || '-'}
Guests: ${res.guests || '-'}
Location: ${res.location || '-'}
Preferences: ${res.preferences || '-'}
Date: ${res.date || '-'}

Please Confirm or Cancel.`;
}

async function callOpenRouterAI(history) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'openai/gpt-oss-20b:free', messages: history, temperature: 0.6, max_tokens: 500 }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('AI error:', data);
    throw new Error('AI Service Error');
  }
  return data.choices[0]?.message?.content || '';
}

async function sendText(to, text) {
  const res = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body: text } }),
  });

  const body = await res.json();
  if (!res.ok) {
    console.error('WhatsApp sendText error:', body);
  } else {
    console.log('WhatsApp sendText success:', body);
  }
}

async function sendButtons(to, text, buttons) {
  const btns = buttons.slice(0, 3).map((title, idx) => ({
    type: 'reply',
    reply: { id: `btn_${Date.now()}_${idx}`, title: title.slice(0, 20) }
  }));

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: { type: 'button', body: { text }, action: { buttons: btns } }
  };

  const res = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) {
    console.error('WhatsApp sendButtons error:', body);
  } else {
    console.log('WhatsApp sendButtons success:', body);
  }
}
