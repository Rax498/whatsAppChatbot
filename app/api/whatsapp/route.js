export const dynamic = 'force-dynamic'; // Prevent static caching in Vercel

const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// System prompt for Zoya
const systemPrompt = `
You are Zoya, a kind and polite female reservation assistant for a restaurant called Kola.
Your job is to help users book a table by having a friendly, natural, and easy-to-read conversation.

🟢 Speak like a warm human assistant.
🔴 Do NOT include any internal reasoning or analysis in your replies.
✅ ONLY reply with short, clear, and polite messages that a user would see in a real WhatsApp conversation.

✨ Format your messages to be *readable* and *visually pleasant*:
- Use *line breaks* to separate items.
- Keep each option or step on a *separate line*.
`;

// In-memory conversation history
const chatHistories = {};

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    } else {
      return new Response('Forbidden', { status: 403 });
    }
  } catch (error) {
    console.error('GET error:', error.message);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const entry = body.entry || [];
    for (const e of entry) {
      const changes = e.changes || [];
      for (const change of changes) {
        const messages = change.value?.messages || [];
        for (const message of messages) {
          const from = message.from;
          let userText = message.text?.body || message.interactive?.button_reply?.payload;

          // Initialize chat history for each user if it's the first interaction
          if (!chatHistories[from]) {
            chatHistories[from] = [{ role: 'system', content: systemPrompt }];
          }

          // Add the user's latest message or button payload to the chat history
          chatHistories[from].push({ role: 'user', content: userText });

          // Send the entire chat history to the AI to maintain context
          const aiReply = await callOpenRouterAI(chatHistories[from]);

          // Add AI's reply to the chat history
          chatHistories[from].push({ role: 'assistant', content: aiReply });

          // Send the AI's response back to the user
          await sendWhatsAppMessage(from, aiReply);

          // If the AI's reply includes a choice (Lunch, Tea, Dinner), send buttons for next actions
          if (aiReply.includes('Lunch') || aiReply.includes('Tea') || aiReply.includes('Dinner')) {
            const buttons = [
              { title: 'Lunch', payload: 'lunch' },
              { title: 'Tea', payload: 'tea' },
              { title: 'Dinner', payload: 'dinner' }
            ];
            await sendWhatsAppMessage(from, "Please select your preferred dining time:", buttons);
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

// 🔗 Send message via WhatsApp API with interactive buttons (Correct structure)
async function sendWhatsAppMessage(to, text, buttons = []) {
  const url = `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`;

  // If no buttons, send a simple text message
  if (buttons.length === 0) {
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        body: text
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('WhatsApp API error:', err.error?.message || err);
    }
    return;
  }

  // Construct the interactive message with correct structure
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',  // Type of interactive message
      body: {
        text: text, // Message to display above the buttons
      },
      action: {
        buttons: buttons.map(button => ({
          type: 'reply',  // Button type: 'reply'
          reply: {
            id: button.payload,     // Button payload (value returned when button clicked)
            title: button.title,  // Button title (text on the button)
          }
        })),
      },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error('WhatsApp API error:', err.error?.message || err);
  }
}

// 🔗 Call OpenRouter AI (with full chat history to maintain context)
async function callOpenRouterAI(chatHistory) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b:free',
      messages: chatHistory,  // Pass the full conversation history
      temperature: 0.6,
      max_tokens: 2000,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message || 'OpenRouter request failed');
  }

  // Clean the reply by removing internal reasoning if any
  const rawReply = data.choices[0].message.content;
  const cleanReply = rawReply.split('assistantfinal')[1] || rawReply;

  return cleanReply;
}
