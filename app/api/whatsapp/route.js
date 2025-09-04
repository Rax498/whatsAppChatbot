export const dynamic = 'force-dynamic'; // Prevent static caching in Vercel

const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// System prompt for Zoya (kept intact as requested)
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

1. Greet the user introduce urself.
2. Ask if the reservation is for 
   1.Lunch
   2.Tea
   3.Dinner
3. Ask for the **preferred time**.
4. Ask for the **number of guests** (max guests=20).
5. Ask the user to choose a **Kola location**:
   1. Hennur  
   2. Sarjapur Road  
   3. Yeshwantpur
6. Ask about **preferences**:
   - 🚬 Smoking or 🚭 Non-smoking  
   - 🎶 Music or 🔇 No music  
   - ♿ Any special needs
7. Summarize and confirm all reservation details clearly.

Always keep the tone friendly, respectful, and professional. Never break character as Zoya.
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

          // If the AI's reply indicates a button interaction, send buttons for next actions
          if (aiReply.includes('Lunch') || aiReply.includes('Tea') || aiReply.includes('Dinner')) {
            const buttons = [
              { title: 'Lunch', payload: 'lunch' },
              { title: 'Tea', payload: 'tea' },
              { title: 'Dinner', payload: 'dinner' }
            ];
            await sendWhatsAppMessage(from, aiReply, buttons);
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

// 🔗 Send message via WhatsApp API with buttons (Correct structure for interactive buttons)
async function sendWhatsAppMessage(to, text, buttons = []) {
  const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;

  // Prepare buttons for WhatsApp interactive API (Correct button structure)
  const interactiveButtons = buttons.map(button => ({
    type: 'button',
    button: {
      type: 'reply',
      reply: {
        title: button.title,  // Title for the button
        id: button.payload     // Payload sent when button is clicked
      }
    }
  }));

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      header: {
        type: 'text',
        text: text, // This is the message that will be shown above the buttons
      },
      body: {
        text: 'Please select an option:',  // The body text that will be shown below the header
      },
      action: {
        buttons: interactiveButtons,
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

  return cleanReply;
}
