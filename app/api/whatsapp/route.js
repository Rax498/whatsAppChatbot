const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Reservation steps to follow, used in backend for reference
const steps = [
  { key: 'meal', question: 'Is your reservation for Lunch, Tea, or Dinner?', buttons: ['Lunch', 'Tea', 'Dinner'] },
  { key: 'time', question: 'What time would you like to visit?', buttons: [] }, // buttons can be empty, AI can handle options
  { key: 'guests', question: 'How many guests?', buttons: [] },
  { key: 'location', question: 'Which Kola location do you prefer?', buttons: ['Hennur', 'Sarjapur Road', 'Yeshwantpur'] },
  { key: 'preferences', question: 'Do you prefer Smoking or Non-Smoking? Music or No Music? Any special needs?', buttons: ['Smoking', 'Non-Smoking', 'Music', 'No Music', 'None'] },
  { key: 'confirm', question: 'Here is your reservation summary. Confirm?', buttons: ['Confirm', 'Cancel'] },
];

// Store chat and reservation data per user
const userData = {}; // { [phone]: { stepIndex: 0, reservation: {}, chatHistory: [] } }

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
    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        const messages = change.value?.messages || [];

        for (const message of messages) {
          const from = message.from;
          const isButtonReply = !!message.interactive?.button_reply?.payload;
          const userInput = isButtonReply
            ? message.interactive.button_reply.title.trim()
            : message.text?.body.trim();

          if (!userData[from]) {
            // Initialize user data on first contact
            userData[from] = {
              stepIndex: 0,
              reservation: {},
              chatHistory: [
                { role: 'system', content: systemPrompt },
              ],
            };

            // Greet user and ask first question
            const firstStep = steps[0];
            await sendInteractiveButtons(from, `Hello! 👋 I’m Zoya, your friendly reservation assistant at Kola.\n\n${firstStep.question}`, firstStep.buttons.map(b => ({ title: b, payload: b })));
            userData[from].chatHistory.push({ role: 'assistant', content: firstStep.question });
            continue;
          }

          const userState = userData[from];
          userState.chatHistory.push({ role: 'user', content: userInput });

          // If user says something unrelated, let AI handle normally, else process step
          const currentStep = steps[userState.stepIndex];

          // If still in reservation flow steps
          if (userState.stepIndex < steps.length) {
            // Save user answer to reservation for the current step key
            userState.reservation[currentStep.key] = userInput;

            // Move to next step
            userState.stepIndex++;

            // If done with all steps
            if (userState.stepIndex >= steps.length) {
              // Send confirmation summary from AI
              const summaryPrompt = generateSummaryPrompt(userState.reservation);

              userState.chatHistory.push({ role: 'assistant', content: summaryPrompt });
              await sendWhatsAppMessage(from, summaryPrompt);
              // Clear or reset after confirmation or cancel
              userState.stepIndex = 0;
              userState.reservation = {};
              continue;
            }

            // Ask next step question with buttons if available
            const nextStep = steps[userState.stepIndex];

            if (nextStep.buttons.length > 0) {
              await sendInteractiveButtons(from, nextStep.question, nextStep.buttons.map(b => ({ title: b, payload: b })));
              userState.chatHistory.push({ role: 'assistant', content: nextStep.question });
            } else {
              // No buttons, just ask text question
              await sendWhatsAppMessage(from, nextStep.question);
              userState.chatHistory.push({ role: 'assistant', content: nextStep.question });
            }
          } else {
            // Outside normal flow, ask AI to answer like normal human then resume
            const aiResponse = await callOpenRouterAI(userState.chatHistory);
            userState.chatHistory.push({ role: 'assistant', content: aiResponse });
            await sendWhatsAppMessage(from, aiResponse);
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

// Helper to generate reservation summary text
function generateSummaryPrompt(res) {
  return `Here is your reservation summary:

- Meal: ${res.meal || '-'}
- Time: ${res.time || '-'}
- Guests: ${res.guests || '-'}
- Location: ${res.location || '-'}
- Preferences: ${res.preferences || '-'}

Please reply *Confirm* to book or *Cancel* to start over.`;
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
    const err = await res.json();
    console.error('WhatsApp message error:', err.error || err);
    throw new Error('WhatsApp message send failed');
  }
}

async function sendInteractiveButtons(to, text, buttons) {
  const formattedButtons = buttons.slice(0, 3).map((btn, i) => ({
    type: 'reply',
    reply: { id: `btn_${i + 1}`, title: btn.title },
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
    const err = await res.json();
    console.error('WhatsApp buttons error:', err.error || err);
    throw new Error('WhatsApp buttons send failed');
  }
}

const systemPrompt = `
You are Zoya, a kind and polite female reservation assistant for a restaurant called Kola.

Your job is to help users book a table by having a friendly, natural, and easy-to-read conversation.

Speak like a warm human assistant.
Do NOT include internal reasoning or analysis in replies.
ONLY reply with short, clear, and polite messages that a user would see in a real WhatsApp conversation.

Keep the tone friendly, respectful, and professional.

If the user says something unrelated to reservation flow, reply as a warm assistant, then resume the flow at the current step.
`;

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
      temperature: 0.7,
      max_tokens: 250,
      stop: null,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('OpenRouter API error:', data);
    return "Sorry, I couldn't process that. Please try again.";
  }

  return data.choices[0].message.content.trim();
}
