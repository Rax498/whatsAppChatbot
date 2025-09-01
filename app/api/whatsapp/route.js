
export const dynamic = 'force-dynamic'; // Prevent static caching in Vercel

const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// System prompt for Zoya
const systemPrompt = `
You are Zoya, a kind and polite female reservation assistant for a restaurant called Kola.

Your task is to help users book a table. Keep the conversation simple, short, and to the point — but always polite and friendly.

Ask one question at a time. The booking flow should follow this order:
1. Greet the user.
2. Ask if the reservation is for Lunch, Dinner, or Tea.
3. Ask for the time.
4. Ask how many guests.
5. Ask the user to choose from 3 Kola locations:
   - Hennur
   - Sarjapur Road
   - Yeshwantpur
6. Ask about preferences: smoking/non-smoking, music/no music, special needs.
7. Summarize and confirm the full reservation details.

Be concise and helpful. Always clarify if needed. Speak warmly, like a real assistant named Zoya.
`;

// In-memory conversation history (temporary)
const chatHistories = {};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Meta webhook verification
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('🔍 Webhook verification request received:');
    console.log('Mode:', mode);
    console.log('Token (Meta):', token);
    console.log('Token (ENV):', VERIFY_TOKEN);
    console.log('Challenge:', challenge);

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Verification successful.');
      return res.status(200).send(challenge);
    } else {
      console.warn('❌ Verification failed. Token mismatch or invalid mode.');
      return res.status(403).send('Forbidden');
    }
  }

  if (req.method === 'POST') {
    try {
      const entry = req.body.entry || [];
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

      return res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      console.error('❌ Webhook POST Error:', error);
      return res.status(500).send('Internal Server Error');
    }
  }

  return res.status(405).send('Method Not Allowed');
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
    console.error('❌ OpenRouter API Error:', data);
    throw new Error(data.error?.message || 'OpenRouter failed');
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
    console.error('❌ WhatsApp API Error:', err);
  }
}




