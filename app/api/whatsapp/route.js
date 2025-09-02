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

✨ Format your messages to be **readable** and **visually pleasant**:
- Use **line breaks** to separate items.
- Use **emoji bullets (e.g., 👉, ✅, ❌)** or dashes (–) to list options.
- Keep each option or step on a **separate line**.
- NEVER send long paragraphs or cluttered messages.

Ask one question at a time and follow this booking flow:

1. Greet the user.
2. Ask if the reservation is for **Lunch, Dinner, or Tea**.
3. Ask for the **preferred time**.
4. Ask for the **number of guests**.
5. Ask the user to choose a **Kola location**:
   👉 Hennur  
   👉 Sarjapur Road  
   👉 Yeshwantpur
6. Ask about **preferences**:
   - 🚬 Smoking or 🚭 Non-smoking  
   - 🎶 Music or 🔇 No music  
   - ♿ Any special needs
7. Summarize and confirm all reservation details clearly.

💬 Example format for preferences:

Please let me know your preferences:  
1. 🚬 Smoking or 🚭 Non-smoking  
2. 🎶 Music or 🔇 No music  
3. ♿ Any special needs?

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
          if (message.type === 'text') {
            const from = message.from;
            const userText = message.text.body;

            if (!chatHistories[from]) {
              chatHistories[from] = [
                { role: 'system', content: systemPrompt }
              ];
            }

            chatHistories[from].push({ role: 'user', content: userText });

            const aiReply = await callOpenRouterAI(chatHistories[from]);

            chatHistories[from].push({ role: 'assistant', content: aiReply });

            await sendWhatsAppMessage(from, aiReply);
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

// 🔗 Call OpenRouter AI
async function callOpenRouterAI(chatHistory) {
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
      max_tokens: 2000,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message || 'OpenRouter request failed');
  }

  return data.choices[0].message.content.trim();
}

// 🔗 Send message via WhatsApp API
async function sendWhatsAppMessage(to, text) {
  const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
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

