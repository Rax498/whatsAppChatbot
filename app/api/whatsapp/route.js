const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const steps = [
  { key: 'meal', question: 'Is your reservation for Lunch, Tea, or Dinner?', buttons: ['Lunch', 'Tea', 'Dinner'] },
  { key: 'time', question: 'What time would you like to visit?', buttons: [] },
  { key: 'guests', question: 'How many guests?', buttons: [] },
  { key: 'location', question: 'Which Kola location do you prefer?', buttons: ['Hennur', 'Sarjapur Road', 'Yeshwantpur'] },
  { key: 'preferences', question: 'Do you prefer Smoking or Non-Smoking? Music or No Music? Any special needs?', buttons: ['Smoking', 'Non-Smoking', 'Music', 'No Music', 'None'] },
  { key: 'confirm', question: 'Here is your reservation summary. Confirm?', buttons: ['Confirm', 'Cancel'] },
];

const userData = {}; // Store user chat state

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
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
          const isButtonReply = !!message.interactive?.button_reply?.title;
          const userInput = isButtonReply
            ? message.interactive.button_reply.title.trim()
            : message.text?.body.trim();

          if (!userData[from]) {
            userData[from] = {
              stepIndex: 0,
              reservation: {},
              chatHistory: [{ role: 'system', content: systemPrompt }],
            };
            const firstStep = steps[0];
            await sendInteractiveButtons(from, `Hello! 👋 I’m Zoya, your friendly reservation assistant at Kola.\n\n${firstStep.question}`, firstStep.buttons);
            userData[from].chatHistory.push({ role: 'assistant', content: firstStep.question });
            continue;
          }

          const userState = userData[from];
          userState.chatHistory.push({ role: 'user', content: userInput });

          // If we're on the confirm step, handle confirm or cancel explicitly
          if (userState.stepIndex === steps.length - 1) {
            if (userInput.toLowerCase() === 'confirm') {
              await sendWhatsAppMessage(from, 'Thank you! Your reservation is confirmed. We look forward to seeing you at Kola 😊');
              userState.stepIndex = 0;
              userState.reservation = {};
              userState.chatHistory = [{ role: 'system', content: systemPrompt }];
              continue;
            } else if (userInput.toLowerCase() === 'cancel') {
              await sendWhatsAppMessage(from, 'Reservation cancelled. Let’s start over.');
              userState.stepIndex = 0;
              userState.reservation = {};
              const firstStep = steps[0];
              await sendInteractiveButtons(from, firstStep.question, firstStep.buttons);
              userState.chatHistory.push({ role: 'assistant', content: firstStep.question });
              continue;
            }
          }

          // Save current step's answer
          const currentStep = steps[userState.stepIndex];
          userState.reservation[currentStep.key] = userInput;

          // Move to next step
          userState.stepIndex++;

          // If we finished all steps, show summary with buttons Confirm/Cancel
          if (userState.stepIndex >= steps.length) {
            const summaryText = generateSummaryText(userState.reservation);
            await sendInteractiveButtons(from, summaryText, ['Confirm', 'Cancel']);
            userState.chatHistory.push({ role: 'assistant', content: summaryText });
            // Keep stepIndex on confirm step to handle Confirm/Cancel
            userState.stepIndex = steps.length - 1;
            continue;
          }

          // Send next step question with buttons if any
          const nextStep = steps[userState.stepIndex];
          if (nextStep.buttons.length > 0) {
            await sendInteractiveButtons(from, nextStep.question, nextStep.buttons);
          } else {
            await sendWhatsAppMessage(from, nextStep.question);
          }
          userState.chatHistory.push({ role: 'assistant', content: nextStep.question });
        }
      }
    }

    return new Response('EVENT_RECEIVED', { status: 200 });
  } catch (error) {
    console.error('POST error:', error.message);
    return new Response('Internal Server Error', { status: 500 });
  }
}

function generateSummaryText(res) {
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
  const formattedButtons = buttons.slice(0, 3).map((title, i) => ({
    type: 'reply',
    reply: { id: `btn_${i + 1}`, title },
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
You are Zoya, a warm and polite female reservation assistant for the restaurant Kola.

Help users book a table by guiding them step-by-step in a friendly way.

Only respond with messages a user would see on WhatsApp — short, clear, polite, and professional.

If user says something unrelated, respond naturally, then resume the current reservation step.
`;
