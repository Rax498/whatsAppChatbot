const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const sessions = {};
const requiredSteps = ['meal', 'time', 'guests', 'location', 'preferences', 'date'];

function getNextDates(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function isReservationComplete(res) {
  return requiredSteps.every(k => res[k]);
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

function getSystemPrompt() {
  const futureDates = getNextDates(5);
  return `
You are Zoya, a friendly and smart reservation assistant for Kola.

Your job is to help the user complete a reservation through these steps:
1. Ask if it's for Lunch, Tea, or Dinner.
2. Ask preferred time.
3. Ask number of guests (max 20).
4. Ask location: Hennur, Sarjapur Road, or Yeshwantpur.
5. Ask preferences: Smoking, Music, or special needs.
6. Ask for a date within the next 30 days.
7. Summarize and ask for confirmation.

Important Rules:
- Always track which steps have been completed.
- If the user asks a question or gives unrelated input, answer it briefly, then return to the next pending step.
- Do not repeat completed steps.
- Use buttons when possible for these steps: meal, location, preferences, date.
- For the "date" step, suggest buttons like: ${futureDates.join(', ')}.

Always respond ONLY in this JSON format:
{
  "step": "<current_or_next_step_key>",
  "message": "<message to send>",
  "buttons": ["optional", "button", "list"]
}
  `.trim();
}

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
      for (const msg of change.value?.messages || []) {
        const from = msg.from;
        const userInput = msg.interactive?.button_reply?.title?.trim() || msg.text?.body?.trim() || '';

        // Initialize session
        if (!sessions[from]) {
          sessions[from] = {
            history: [{ role: 'system', content: getSystemPrompt() }],
            reservation: {}
          };
        }

        const session = sessions[from];
        session.history.push({ role: 'user', content: userInput });

        let aiRes;
        try {
          aiRes = await callOpenRouterAI(session.history);
          session.history.push({ role: 'assistant', content: aiRes });
        } catch (e) {
          await sendText(from, "Sorry, I'm having trouble understanding. Please try again.");
          continue;
        }

        let parsed;
        try {
          parsed = JSON.parse(aiRes);
        } catch (e) {
          await sendText(from, "Oops! That didn't work. Could you rephrase that?");
          console.error("AI JSON parse error:", e, aiRes);
          continue;
        }

        const { step, message: msgText, buttons = [] } = parsed;

        // Save response only if not already answered
        if (step && step !== 'confirm' && !session.reservation[step]) {
          session.reservation[step] = userInput;
        }

        // Handle guests over 20
        if (step === 'guests' && parseInt(session.reservation.guests) > 20) {
          await sendText(from, 'Maximum is 20 guests. Please enter a valid number.');
          delete session.reservation.guests;
          continue;
        }

        // If reservation is complete, send summary
        if (isReservationComplete(session.reservation)) {
          const summary = generateSummary(session.reservation);
          await sendButtons(from, summary, ['Confirm', 'Cancel']);
          continue;
        }

        // Handle confirmation
        if (step === 'confirm') {
          const action = userInput.toLowerCase();
          if (action === 'confirm') {
            await sendText(from, '✅ Your reservation is confirmed. Thank you!');
          } else if (action === 'cancel') {
            await sendText(from, '❌ Reservation cancelled. Let me know if you want to start again.');
          } else {
            await sendButtons(from, msgText, ['Confirm', 'Cancel']);
            continue;
          }
          delete sessions[from];
          continue;
        }

        // Send message with or without buttons
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

async function callOpenRouterAI(history) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b:free',
      messages: history,
      temperature: 0.6,
      max_tokens: 500
    })
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('OpenRouter AI error:', data);
    throw new Error('AI call failed');
  }

  return data.choices[0]?.message?.content || '';
}

async function sendText(to, text) {
  const res = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
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

  const info = await res.json();
  if (!res.ok) console.error('sendText error:', info);
}

async function sendButtons(to, text, buttons) {
  const btns = buttons.slice(0, 3).map((title, idx) => ({
    type: 'reply',
    reply: { id: `btn_${Date.now()}_${idx}`, title: title.slice(0, 20) }
  }));

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    recipient_type: 'individual',
    interactive: {
      type: 'button',
      body: { text },
      action: { buttons: btns }
    }
  };

  const res = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const info = await res.json();
  if (!res.ok) console.error('sendButtons error:', info);
}
