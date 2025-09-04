const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const systemPrompt = `
You are Zoya, a kind and polite female reservation assistant for a restaurant called Kola.

Your job is to help users book a table by having a friendly, natural, and easy-to-read conversation.

🟢 Speak like a warm human assistant.
🔴 Do NOT include any internal reasoning or analysis in your replies.
✅ ONLY reply with short, clear, and polite messages that a user would see in a real WhatsApp conversation.

✨ Format your messages to be **readable** and **visually pleasant**:
- Use **line breaks** to separate items.
- Keep each option or step on a **separate line**.
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

          // Initialize chat history if it's the user's first message
          if (!chatHistories[from]) {
            chatHistories[from] = [{ role: 'system', content: systemPrompt }];
          }

          // Update the chat history with the user's latest message
          chatHistories[from].push({ role: 'user', content: userText });

          // Get AI's response from OpenRouter (ChatGPT-like behavior)
          const aiReply = await callOpenRouterAI(chatHistories[from]);

          // Update chat history with the assistant's response
          chatHistories[from].push({ role: 'assistant', content: aiReply });

          // Send the AI's response back to the user
          await sendWhatsAppMessage(from, aiReply);

          // If the AI's response suggests options like "Lunch", "Tea", or "Dinner", send buttons
          if (aiReply.includes('Lunch') || aiReply.includes('Tea') || aiReply.includes('Dinner')) {
            const buttons = [
              { title: 'Lunch', payload: 'lunch' },
              { title: 'Tea', payload: 'tea' },
              { title: 'Dinner', payload: 'dinner' }
            ];
            await sendInteractiveButtons(from, aiReply, buttons);
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

// Function to send interactive buttons to WhatsApp using the correct API structure
async function sendInteractiveButtons(to, text, buttons) {
  // Structure buttons correctly according to WhatsApp's API
  const formattedButtons = buttons.slice(0, 3).map((button, index) => ({
    type: 'reply',
    reply: { id: `button_${index + 1}`, title: button.title },
  }));

  const payload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text },
      action: {
        buttons: formattedButtons,
      },
    },
  };

  try {
    const response = await fetch(`https://graph.facebook.com/v16.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error sending buttons:', errorData.error?.message || errorData);
      throw new Error(`WhatsApp API Error: ${JSON.stringify(errorData)}`);
    }
  } catch (error) {
    console.error('Error sending buttons:', error.message || error);
  }
}

// Function to call OpenRouter AI with full chat history
async function callOpenRouterAI(chatHistory) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b:free',
      messages: chatHistory,  // Use full chat history
      temperature: 0.6,
      max_tokens: 2000,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message || 'OpenRouter request failed');
  }

  const rawReply = data.choices[0].message.content;
  return rawReply;
}

// Function to send a simple WhatsApp message (text)
async function sendWhatsAppMessage(to, text) {
  const payload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'text',
    text: { body: text },
  };

  try {
    const response = await fetch(`https://graph.facebook.com/v16.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error sending WhatsApp message:', errorData.error?.message || errorData);
      throw new Error(`WhatsApp API Error: ${JSON.stringify(errorData)}`);
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error.message || error);
  }
}
