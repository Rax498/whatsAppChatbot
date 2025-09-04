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
          let userText = message.text?.body || 
                        message.interactive?.button_reply?.title || 
                        message.interactive?.button_reply?.payload ||
                        message.interactive?.list_reply?.title;

          // Handle numbered responses for dining options
          if (userText === '1') userText = 'Lunch';
          if (userText === '2') userText = 'Tea';  
          if (userText === '3') userText = 'Dinner';

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

          // If the AI's reply includes a choice (Lunch, Tea, Dinner), send a simple text menu
          if (aiReply.includes('Lunch') || aiReply.includes('Tea') || aiReply.includes('Dinner')) {
            const menuText = `🍽️ *Please select your preferred dining time:*

Reply with the number:
1️⃣ *Lunch* (12:00 PM - 3:00 PM)
2️⃣ *Tea* (3:00 PM - 6:00 PM) 
3️⃣ *Dinner* (7:00 PM - 10:00 PM)

Just type: *1*, *2*, or *3*`;
            
            await sendWhatsAppMessage(from, menuText);
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

// 🔗 Send message via WhatsApp API - Simplified for text messages only
async function sendWhatsAppMessage(to, text) {
  const url = `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'text',
    text: {
      body: text
    }
  };

  try {
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
      console.error('Error details:', JSON.stringify(err, null, 2));
      console.error('Payload sent:', JSON.stringify(payload, null, 2));
      return false;
    }
    
    console.log('Message sent successfully to:', to);
    return true;
  } catch (error) {
    console.error('Network error sending message:', error);
    return false;
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
