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

Ask one question at a time and follow this booking flow:

1. Greet the user introduce yourself.
2. Ask if the reservation is for:
   - Lunch
   - Tea
   - Dinner
3. Ask for the **preferred time**.
4. Ask for the **number of guests** (max guests=20).
5. Ask the user to choose a **Kola location**:
   - Hennur
   - Sarjapur Road
   - Yeshwantpur
6. Ask about **preferences**:
   - 🚬 Smoking or 🚭 Non-smoking
   - 🎶 Music or 🔇 No music
   - ♿ Any special needs
7. Summarize and confirm all reservation details clearly.

Always keep the tone friendly, respectful, and professional. Never break character as Zoya.
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

          // Initialize chat history for user if first time
          if (!chatHistories[from]) {
            chatHistories[from] = [{ role: 'system', content: systemPrompt }];
          }

          let userText;

          // Handle button replies
          if (message.interactive?.button_reply?.payload) {
            const payload = message.interactive.button_reply.payload.toLowerCase();

            userText = payload;
            chatHistories[from].push({ role: 'user', content: userText });

            let aiReply = '';

            // Handle meal time selection
            if (['lunch', 'tea', 'dinner'].includes(payload)) {
              aiReply = `Great! What time would you like to visit for ${payload}?`;
              chatHistories[from].push({ role: 'assistant', content: aiReply });
              await sendWhatsAppMessage(from, aiReply);

              // Ask for location next with buttons
              const locationButtons = [
                { title: 'Hennur', payload: 'hennur' },
                { title: 'Sarjapur Road', payload: 'sarjapur' },
                { title: 'Yeshwantpur', payload: 'yeshwantpur' },
              ];
              await sendInteractiveButtons(from, 'Please select a location:', locationButtons);

              continue; // Done with this message
            }

            // Handle location selection
            if (['hennur', 'sarjapur', 'yeshwantpur'].includes(payload)) {
              aiReply = `Great! You've chosen the ${payload.charAt(0).toUpperCase() + payload.slice(1)} location.\nLet's move on to your preferences.`;
              chatHistories[from].push({ role: 'assistant', content: aiReply });
              await sendWhatsAppMessage(from, aiReply);

              // Ask preferences next with buttons
              const preferenceButtons = [
                { title: 'Smoking', payload: 'smoking' },
                { title: 'Non-Smoking', payload: 'non-smoking' },
                { title: 'Music', payload: 'music' },
                { title: 'No Music', payload: 'no-music' },
              ];
              await sendInteractiveButtons(from, 'Do you have any preferences?', preferenceButtons);

              continue;
            }

            // Handle preferences - smoking/music
            if (['smoking', 'non-smoking', 'music', 'no-music'].includes(payload)) {
              aiReply = `Thank you for letting me know your preference: ${payload.replace('-', ' ')}.\nDo you have any special needs or requests? (If none, please type 'No')`;
              chatHistories[from].push({ role: 'assistant', content: aiReply });
              await sendWhatsAppMessage(from, aiReply);
              continue;
            }

            // For other button payloads, fallback polite message
            aiReply = `Thanks for your response. Please continue.`;
            chatHistories[from].push({ role: 'assistant', content: aiReply });
            await sendWhatsAppMessage(from, aiReply);

          } else {
            // Normal text input from user (free text)

            userText = message.text?.body;
            chatHistories[from].push({ role: 'user', content: userText });

            // Call OpenRouter AI with full chat history
            const aiReply = await callOpenRouterAI(chatHistories[from]);

            // Clean AI reply: remove internal reasoning or analysis per your prompt
            // You said AI prompt forbids that, but just in case:
            // You can sanitize or format here if needed

            chatHistories[from].push({ role: 'assistant', content: aiReply });

            // Send AI reply text message
            await sendWhatsAppMessage(from, aiReply);

            // If AI reply contains meal time options (case insensitive), send buttons
            if (/(lunch|tea|dinner)/i.test(aiReply)) {
              const mealButtons = [
                { title: 'Lunch', payload: 'lunch' },
                { title: 'Tea', payload: 'tea' },
                { title: 'Dinner', payload: 'dinner' },
              ];
              await sendInteractiveButtons(from, aiReply, mealButtons);
            }
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

// Send interactive buttons with consistent payload ids (all lowercase)
async function sendInteractiveButtons(to, text, buttons) {
  const formattedButtons = buttons.slice(0, 3).map(btn => ({
    type: 'reply',
    reply: {
      id: btn.payload.toLowerCase(), // stable, consistent id for WhatsApp button reply
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

  try {
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
      throw new Error(err.error?.message || 'WhatsApp API error sending buttons');
    }
  } catch (error) {
    console.error('Error sending buttons:', error.message || error);
  }
}

// Call OpenRouter API with full chat history
async function callOpenRouterAI(chatHistory) {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b:free',
        messages: chatHistory,
        temperature: 0.6,
        max_tokens: 1500,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message || 'OpenRouter request failed');
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenRouter API error:', error.message);
    return 'Sorry, there was an error processing your request. Please try again.';
  }
}

// Send simple WhatsApp text message
async function sendWhatsAppMessage(to, text) {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  };

  try {
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
      throw new Error(err.error?.message || 'WhatsApp API error sending message');
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error.message || error);
  }
}
