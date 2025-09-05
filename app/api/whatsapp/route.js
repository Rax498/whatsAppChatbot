const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const systemPrompt = `
You are Zoya, a kind and polite female reservation assistant for a restaurant called Kola.

Your job is to help users book a table with a friendly and natural conversation.

🟢 Speak like a warm human assistant.
🔴 NEVER include any internal reasoning or analysis.
✅ ONLY send short, clear, and polite messages that a user would see in a WhatsApp chat.

✨ Format messages nicely with line breaks and bullet points if needed.

Follow this flow, asking one question at a time:

1. Greet the user and introduce yourself.
2. Ask if the reservation is for Lunch, Tea, or Dinner.
3. Ask for the preferred time.
4. Ask for the number of guests (max 20).
5. Ask which Kola location they prefer: Hennur, Sarjapur Road, or Yeshwantpur.
6. Ask about preferences (Smoking/Non-Smoking, Music/No Music, Special Needs).
7. Summarize and confirm the reservation.

Always be warm, respectful, and professional.
`;

const chatHistories = {};

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  } catch (error) {
    console.error('GET error:', error.message);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        for (const message of change.value?.messages || []) {
          const from = message.from;
          const userInput = message.text?.body || message.interactive?.button_reply?.payload;

          // Initialize chat history if needed
          if (!chatHistories[from]) {
            chatHistories[from] = [{ role: 'system', content: systemPrompt }];
          }

          // Append user message to history
          chatHistories[from].push({ role: 'user', content: userInput });

          // Call AI for response
          const aiReply = await getAIResponse(chatHistories[from]);

          // Append AI reply to history
          chatHistories[from].push({ role: 'assistant', content: aiReply });

          // Send AI text message
          await sendWhatsAppMessage(from, aiReply);

          // Send buttons if AI reply clearly requests options:
          // Check AI reply for explicit prompt keywords to send buttons
          if (/Lunch|Tea|Dinner/i.test(aiReply) && !message.interactive?.button_reply) {
            // Meal options buttons
            await sendInteractiveButtons(from, 'Please select your reservation type:', [
              { title: 'Lunch', payload: 'Lunch' },
              { title: 'Tea', payload: 'Tea' },
              { title: 'Dinner', payload: 'Dinner' },
            ]);
          } else if (/location/i.test(aiReply) && !message.interactive?.button_reply) {
            // Location buttons
            await sendInteractiveButtons(from, 'Please choose a Kola location:', [
              { title: 'Hennur', payload: 'Hennur' },
              { title: 'Sarjapur Road', payload: 'Sarjapur' },
              { title: 'Yeshwantpur', payload: 'Yeshwantpur' },
            ]);
          } else if (/preferences|smoking|music/i.test(aiReply) && !message.interactive?.button_reply) {
            // Preferences buttons
            await sendInteractiveButtons(from, 'Please select your preferences:', [
              { title: 'Smoking', payload: 'Smoking' },
              { title: 'Non-Smoking', payload: 'Non-Smoking' },
              { title: 'Music', payload: 'Music' },
              { title: 'No Music', payload: 'No Music' },
            ]);
          }
        }
      }
    }

    return new Response('EVENT_RECEIVED', { status: 200 });
  } catch (error) {
    console.error('POST error:', error.message);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function getAIResponse(history) {
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
      max_tokens: 1500,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'OpenRouter API error');
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}

async function sendWhatsAppMessage(to, text) {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  };

  const res = await fetch(`https://graph.facebook.com/v16.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('WhatsApp send message error:', err);
  }
}

async function sendInteractiveButtons(to, text, buttons) {
  const formattedButtons = buttons.slice(0, 3).map((btn, i) => ({
    type: 'reply',
    reply: {
      id: btn.payload || `btn_${i + 1}`,
      title: btn.title,
    },
  }));

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text },
      action: { buttons: formattedButtons },
    },
  };

  const res = await fetch(`https://graph.facebook.com/v16.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('WhatsApp send buttons error:', err);
  }
}
