const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const systemPrompt = `
You are Zoya, a kind and polite female reservation assistant for Kola.
Your job is to help users book a table with a friendly, human-like tone.

Follow this booking flow, one step at a time:
1. Greet
2. Ask: Lunch, Tea, Dinner
3. Ask: Preferred time
4. Ask: Number of guests (max 20)
5. Ask: Location (Hennur, Sarjapur Road, Yeshwantpur)
6. Ask: Preferences (Smoking/Non, Music/No music, Special needs)
7. Confirm all details
`;

const chatHistories = {};

export async function POST(req) {
  const rawBody = await req.text();
  console.log('[WEBHOOK] Raw incoming payload:\n', rawBody);

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (err) {
    console.error('[ERROR] Invalid JSON:', err);
    return new Response('Bad JSON', { status: 400 });
  }

  try {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const messages = change.value?.messages || [];
        for (const message of messages) {
          const from = message.from;
          if (!chatHistories[from]) {
            chatHistories[from] = [{ role: 'system', content: systemPrompt }];
          }

          let userText = '';

          // Handle button replies correctly
          if (message.interactive?.type === 'button_reply') {
            userText = message.interactive.button_reply.id;
          } else if (message.text?.body) {
            userText = message.text.body;
          }

          if (!userText) {
            console.log('[WARN] No user message text or button_reply found.');
            continue;
          }

          chatHistories[from].push({ role: 'user', content: userText });

          let aiReply = await callOpenRouterAI(chatHistories[from]);
          chatHistories[from].push({ role: 'assistant', content: aiReply });

          await sendWhatsAppMessage(from, aiReply);

          // Show meal option buttons if AI mentions them
          if (/lunch|tea|dinner/i.test(aiReply)) {
            await sendInteractiveButtons(from, 'Please choose one:', [
              { title: 'Lunch', payload: 'lunch' },
              { title: 'Tea', payload: 'tea' },
              { title: 'Dinner', payload: 'dinner' },
            ]);
          }

          // Show location buttons if AI asks for location
          if (/location/i.test(aiReply)) {
            await sendInteractiveButtons(from, 'Which location do you prefer?', [
              { title: 'Hennur', payload: 'Hennur' },
              { title: 'Sarjapur Rd', payload: 'Sarjapur' },
              { title: 'Yeshwantpur', payload: 'Yeshwantpur' },
            ]);
          }

          // Show preference options if AI asks for them
          if (/smoking|music|special/i.test(aiReply)) {
            await sendInteractiveButtons(from, 'Preferences?', [
              { title: 'Smoking 🚬', payload: 'smoking' },
              { title: 'Non-Smoking 🚭', payload: 'non-smoking' },
              { title: 'Music 🎶', payload: 'music' },
              { title: 'No Music 🔇', payload: 'no-music' },
            ]);
          }
        }
      }
    }

    return new Response('EVENT_RECEIVED', { status: 200 });
  } catch (err) {
    console.error('[POST Handler Error]:', err.message);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function sendWhatsAppMessage(to, text) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[WhatsApp Text Error]', err);
    }
  } catch (err) {
    console.error('[sendWhatsAppMessage Error]:', err.message);
  }
}

async function sendInteractiveButtons(to, text, buttons) {
  const formattedButtons = buttons.slice(0, 3).map((btn, i) => ({
    type: 'reply',
    reply: {
      id: btn.payload,
      title: btn.title.slice(0, 20), // WhatsApp limit: 20 chars
    },
  }));

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text },
      action: { buttons: formattedButtons },
    },
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[WhatsApp Buttons Error]', err);
    }
  } catch (err) {
    console.error('[sendInteractiveButtons Error]:', err.message);
  }
}

async function callOpenRouterAI(history) {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b:free',
        messages: history,
        temperature: 0.6,
        max_tokens: 1000,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[OpenRouter Error]', data);
      throw new Error(data.error?.message || 'AI API error');
    }

    return data.choices?.[0]?.message?.content || 'Zoya here! Something went wrong. Try again?';
  } catch (err) {
    console.error('[AI Error]', err.message);
    return 'Sorry, there was an error processing your request. Please try again.';
  }
}
