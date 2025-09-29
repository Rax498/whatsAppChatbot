// // export const dynamic = 'force-dynamic'; // Prevent static caching in Vercel

// // const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
// //  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
// // const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// // const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// // // System prompt for Zoya
// // const systemPrompt = `
// // You are Zoya, a kind and polite female reservation assistant for a restaurant called Kola.

// // Your job is to help users book a table by having a friendly, natural, and easy-to-read conversation.

// // 🟢 Speak like a warm human assistant.
// // 🔴 Do NOT include any internal reasoning or analysis in your replies.
// // ✅ ONLY reply with short, clear, and polite messages that a user would see in a real WhatsApp conversation.

// // ✨ Format your messages to be **readable** and **visually pleasant**:
// // - Use **line breaks** to separate items.
// // - Keep each option or step on a **separate line**.

// // Ask one question at a time and follow this booking flow:

// // 1. Greet the user introduce urself.
// // 2. Ask if the reservation is for
// //    1.Lunch
// //    2.Tea
// //    3.Dinner
// // 3. Ask for the **preferred time**.
// // 4. Ask for the **number of guests** (max guests=20).
// // 5. Ask the user to choose a **Kola location**:
// //    1. Hennur
// //    2. Sarjapur Road
// //    3. Yeshwantpur
// // 6. Ask about **preferences**:
// //    - 🚬 Smoking or 🚭 Non-smoking
// //    - 🎶 Music or 🔇 No music
// //    - ♿ Any special needs
// // 7. Summarize and confirm all reservation details clearly.

// // Always keep the tone friendly, respectful, and professional. Never break character as Zoya.
// // `;

// // // In-memory conversation history
// // const chatHistories = {};

// export async function GET(req) {
//   try {
//     const { searchParams } = new URL(req.url);
//     const mode = searchParams.get('hub.mode');
//     const token = searchParams.get('hub.verify_token');
//     const challenge = searchParams.get('hub.challenge');

//     if (mode === 'subscribe' && token === VERIFY_TOKEN) {
//       return new Response(challenge, { status: 200 });
//     } else {
//       return new Response('Forbidden', { status: 403 });
//     }
//   } catch (error) {
//     console.error('GET error:', error.message);
//     return new Response('Internal Server Error', { status: 500 });
//   }
// }

// export async function POST(req) {
//   try {
//     const body = await req.json();

//     const entry = body.entry || [];
//     for (const e of entry) {
//       const changes = e.changes || [];
//       for (const change of changes) {
//         const messages = change.value?.messages || [];
//         for (const message of messages) {
//           if (message.type === 'text') {
//             const from = message.from;
//             const userText = message.text.body;

//             if (!chatHistories[from]) {
//               chatHistories[from] = [
//                 { role: 'system', content: systemPrompt }
//               ];
//             }

//             chatHistories[from].push({ role: 'user', content: userText });

//             const aiReply = await callOpenRouterAI(chatHistories[from]);

//             chatHistories[from].push({ role: 'assistant', content: aiReply });

//             await sendWhatsAppMessage(from, aiReply);
//           }
//         }
//       }
//     }

//     return new Response('EVENT_RECEIVED', { status: 200 });
//   } catch (error) {
//     console.error('POST error:', error.message);
//     return new Response('Internal Server Error', { status: 500 });
//   }
// }

// // // 🔗 Call OpenRouter AI
// // async function callOpenRouterAI(chatHistory) {
// //   const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
// //     method: 'POST',
// //     headers: {
// //       Authorization: `Bearer ${OPENROUTER_API_KEY}`,
// //       'Content-Type': 'application/json',
// //     },
// //     body: JSON.stringify({
// //       model: 'openai/gpt-oss-20b:free',
// //       messages: chatHistory,
// //       temperature: 0.6,
// //       max_tokens: 2000,
// //     }),
// //   });

// //   const data = await res.json();

// //   if (!res.ok) {
// //     throw new Error(data.error?.message || 'OpenRouter request failed');
// //   }

// //   // Trim the internal reasoning or analysis by splitting on "assistantfinal"
// // const rawReply = data.choices[0].message.content;
// // const cleanReply = rawReply.split('assistantfinal')[1] || rawReply;

// //   return cleanReply;
// // }

// // // 🔗 Send message via WhatsApp API
// // async function sendWhatsAppMessage(to, text) {
// //   const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;

// //   const payload = {
// //     messaging_product: 'whatsapp',
// //     to,
// //     type: 'text',
// //     text: { body: text },
// //   };

// //   const res = await fetch(url, {
// //     method: 'POST',
// //     headers: {
// //       Authorization: `Bearer ${WHATSAPP_TOKEN}`,
// //       'Content-Type': 'application/json',
// //     },
// //     body: JSON.stringify(payload),
// //   });

// //   if (!res.ok) {
// //     const err = await res.json();
// //     console.error('WhatsApp API error:', err.error?.message || err);
// //   }
// // }

// // WhatsApp Reservation Flow: AI-powered with proper button handling (Meta Cloud API compliant)

// const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
// const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
// const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// const sessions = {};
// const requiredSteps = [
//   "meal",
//   "time",
//   "guests",
//   "location",
//   "preferences",
//   "date",
// ];

// function getNextDates(n) {
//   return Array.from({ length: n }, (_, i) => {
//     const d = new Date();
//     d.setDate(d.getDate() + i);
//     return d.toISOString().split("T")[0];
//   });
// }

// function isReservationComplete(res) {
//   return requiredSteps.every((k) => res[k]);
// }

// function generateSummary(res) {
//   return `Here’s your reservation:

// • Meal: ${res.meal || "-"}
// • Time: ${res.time || "-"}
// • Guests: ${res.guests || "-"}
// • Location: ${res.location || "-"}
// • Preferences: ${res.preferences || "-"}
// • Date: ${res.date || "-"}

// Please Confirm or Cancel.`;
// }

// function getSystemPrompt() {
//   const futureDates = getNextDates(5);
//   return `
// You are Zoya, a friendly and smart reservation assistant for Kola.

// Your job is to help the user complete a reservation through these steps:
// 1. Ask if it's for Lunch, Tea, or Dinner.
// 2. Ask preferred time.
// 3. Ask number of guests (max 20).
// 4. Ask location: Hennur, Sarjapur, or Yeshwantpur.
// 5. Ask preferences: Smoking, Music, or special needs.
// 6. Ask for a date within the next 30 days.
// 7. Summarize and ask for confirmation.

// Important Rules:
// - Always track which steps have been completed.
// - If the user asks a question or gives unrelated input, answer it briefly, then return to the next pending step.
// - Do not repeat completed steps.
// - Use buttons when possible for these steps: meal, location, preferences, date.
// - For the "date" step, suggest buttons like: ${futureDates.join(", ")}.

// Always respond ONLY in this JSON format:
// {
//   "step": "<current_or_next_step_key>",
//   "message": "<message to send>",
//   "buttons": ["optional", "button", "list"]
// }
//   `.trim();
// }

// export async function GET(req) {
//   const { searchParams } = new URL(req.url);
//   if (
//     searchParams.get("hub.mode") === "subscribe" &&
//     searchParams.get("hub.verify_token") === VERIFY_TOKEN
//   ) {
//     return new Response(searchParams.get("hub.challenge"), { status: 200 });
//   }
//   return new Response("Forbidden", { status: 403 });
// }

// export async function POST(req) {
//   const body = await req.json();
//   for (const entry of body.entry || []) {
//     for (const change of entry.changes || []) {
//       for (const msg of change.value?.messages || []) {
//         const from = msg.from;
//         const userInput =
//           msg.interactive?.button_reply?.title?.trim() ||
//           msg.text?.body?.trim() ||
//           "";

//         // Initialize session
//         if (!sessions[from]) {
//           sessions[from] = {
//             history: [{ role: "system", content: getSystemPrompt() }],
//             reservation: {},
//           };
//         }

//         const session = sessions[from];
//         session.history.push({ role: "user", content: userInput });

//         let aiRes;
//         try {
//           aiRes = await callOpenRouterAI(session.history);
//           session.history.push({ role: "assistant", content: aiRes });
//         } catch (e) {
//           await sendText(
//             from,
//             "Sorry, I'm having trouble understanding. Please try again."
//           );
//           continue;
//         }

//         let parsed;
//         try {
//           parsed = JSON.parse(aiRes);
//         } catch (e) {
//           await sendText(
//             from,
//             "Oops! That didn't work. Could you rephrase that?"
//           );
//           console.error("AI JSON parse error:", e, aiRes);
//           continue;
//         }

//         const { step, message: msgText, buttons = [] } = parsed;

//         // Save response only if not already answered
//         if (step && step !== "confirm" && !session.reservation[step]) {
//           session.reservation[step] = userInput;
//         }

//         // Handle guests over 20
//         if (step === "guests" && parseInt(session.reservation.guests) > 20) {
//           await sendText(
//             from,
//             "Maximum is 20 guests. Please enter a valid number."
//           );
//           delete session.reservation.guests;
//           continue;
//         }

//         // If reservation is complete, send summary
//         if (isReservationComplete(session.reservation)) {
//           const summary = generateSummary(session.reservation);
//           await sendButtons(from, summary, ["Confirm", "Cancel"]);
//           continue;
//         }

//         // Handle confirmation
//         if (step === "confirm") {
//           const action = userInput.toLowerCase();
//           if (action === "confirm") {
//             await sendText(
//               from,
//               "✅ Your reservation is confirmed. Thank you!"
//             );
//           } else if (action === "cancel") {
//             await sendText(
//               from,
//               "❌ Reservation cancelled. Let me know if you want to start again."
//             );
//           } else {
//             await sendButtons(from, msgText, ["Confirm", "Cancel"]);
//             continue;
//           }
//           delete sessions[from];
//           continue;
//         }

//         // Send message with or without buttons
//         if (buttons.length > 0) {
//           await sendButtons(from, msgText, buttons);
//         } else {
//           await sendText(from, msgText);
//         }
//       }
//     }
//   }

//   return new Response("EVENT_RECEIVED", { status: 200 });
// }

// async function callOpenRouterAI(history) {
//   const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
//     method: "POST",
//     headers: {
//       Authorization: `Bearer ${OPENROUTER_API_KEY}`,
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify({
//       model: "openai/gpt-oss-20b:free",
//       messages: history,
//       temperature: 0.6,
//     }),
//   });

//   const data = await res.json();
//   if (!res.ok) {
//     console.error("OpenRouter AI error:", data);
//     throw new Error("AI call failed");
//   }

//   return data.choices[0]?.message?.content || "";
// }

// async function sendText(to, text) {
//   const res = await fetch(
//     `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
//     {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${WHATSAPP_TOKEN}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         messaging_product: "whatsapp",
//         to,
//         type: "text",
//         text: { body: text },
//       }),
//     }
//   );

//   const info = await res.json();
//   if (!res.ok) console.error("sendText error:", info);
// }

// async function sendButtons(to, text, buttons) {
//   const btns = buttons.slice(0, 3).map((title, idx) => ({
//     type: "reply",
//     reply: { id: `btn_${Date.now()}_${idx}`, title: title.slice(0, 20) },
//   }));

//   const payload = {
//     messaging_product: "whatsapp",
//     to,
//     type: "interactive",
//     recipient_type: "individual",
//     interactive: {
//       type: "button",
//       body: { text },
//       action: { buttons: btns },
//     },
//   };

//   const res = await fetch(
//     `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
//     {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${WHATSAPP_TOKEN}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(payload),
//     }
//   );

//   const info = await res.json();
//   if (!res.ok) console.error("sendButtons error:", info);
// }

// google/gemini-2.0-flash-exp:free

// {
//   "version": "7.2",
//   "screens": [
//     {
//       "id": "screen_vssixn",
//       "title": "Kola Reservation",
//       "layout": {
//         "type": "SingleColumnLayout",
//         "children": [
//           {
//             "name": "flow_path",
//             "type": "Form",
//             "children": [
//               {
//                 "type": "RadioButtonsGroup",
//                 "label": "Select the slot",
//                 "name": "Select_the_slot_b6f01a",
//                 "required": true,
//                 "data-source": [
//                   { "id": "0_Lunch", "title": "Lunch" },
//                   { "id": "1_Tea", "title": "Tea" },
//                   { "id": "2_Dinner", "title": "Dinner" }
//                 ]
//               },
//               {
//                 "type": "DatePicker",
//                 "label": "Select the Date",
//                 "name": "Select_the_Date_e24e51",
//                 "required": true,
//                 "helper-text": "max up to 1 month"
//               },
//               {
//                 "type": "TextInput",
//                 "input-type": "text",
//                 "label": "Choose the Time",
//                 "name": "Choose_the_Time_a1a055",
//                 "required": true,
//                 "helper-text": "select appropriate time slot ( lunch, dinner, tea)"
//               },
//               {
//                 "type": "RadioButtonsGroup",
//                 "label": "select the location",
//                 "name": "select_the_location_fc0560",
//                 "required": true,
//                 "data-source": [
//                   { "id": "0_Hennur", "title": "Hennur" },
//                   { "id": "1_Sarjapur_Road", "title": "Sarjapur Road" },
//                   { "id": "2_Yeshwantpur", "title": "Yeshwantpur" }
//                 ]
//               },
//               {
//                 "type": "CheckboxGroup",
//                 "label": "Preferences",
//                 "name": "Preferences_f1691b",
//                 "required": true,
//                 "data-source": [
//                   { "id": "0_Smoking", "title": "Smoking" },
//                   { "id": "1_Music", "title": "Music" },
//                   { "id": "2_Special_Needs", "title": "Special Needs" },
//                   { "id": "3_None", "title": "None" }
//                 ]
//               },
//               {
//                 "type": "TextInput",
//                 "input-type": "text",
//                 "label": "other needs",
//                 "name": "other_needs_6b59cb",
//                 "required": false
//               },
//               {
//                 "type": "Footer",
//                 "label": "Continue",
//                 "on-click-action": {
//                   "name": "navigate",
//                   "next": {
//                     "name": "screen_ztrgcl",
//                     "type": "screen"
//                   },
//                   "payload": {
//                     "screen_0_Select_the_slot_0": "${form.Select_the_slot_b6f01a}",
//                     "screen_0_Select_the_Date_1": "${form.Select_the_Date_e24e51}",
//                     "screen_0_Choose_the_Time_2": "${form.Choose_the_Time_a1a055}",
//                     "screen_0_select_the_location_3": "${form.select_the_location_fc0560}",
//                     "screen_0_Preferences_4": "${form.Preferences_f1691b}",
//                     "screen_0_other_needs_5": "${form.other_needs_6b59cb}"
//                   }
//                 }
//               }
//             ]
//           }
//         ]
//       },
//       "data": {}
//     },
//     {
//       "id": "screen_ztrgcl",
//       "title": "Summary",
//       "terminal": true,
//       "data": {
//         "screen_0_Select_the_slot_0": {
//           "type": "string",
//           "__example__": "Example"
//         },
//         "screen_0_Select_the_Date_1": {
//           "type": "string",
//           "__example__": "Example"
//         },
//         "screen_0_Choose_the_Time_2": {
//           "type": "string",
//           "__example__": "Example"
//         },
//         "screen_0_select_the_location_3": {
//           "type": "string",
//           "__example__": "Example"
//         },
//         "screen_0_Preferences_4": {
//           "type": "array",
//           "items": { "type": "string" },
//           "__example__": []
//         },
//         "screen_0_other_needs_5": {
//           "type": "string",
//           "__example__": "Example"
//         }
//       },
//       "layout": {
//         "type": "SingleColumnLayout",
//         "children": [
//           {
//             "name": "flow_path",
//             "type": "Form",
//             "children": [
//              {
//   "type": "TextBody",
//   "text": "Slot: ${data.screen_0_Select_the_slot_0}"
// },
// {
//   "type": "TextBody",
//   "text": "Date: ${data.screen_0_Select_the_Date_1}"
// },
// {
//   "type": "TextBody",
//   "text": "Time: ${data.screen_0_Choose_the_Time_2}"
// }
// ,
//               {
//                 "type": "Footer",
//                 "label": "Done",
//                 "on-click-action": {
//                   "name": "complete",
//                   "payload": {
//                     "screen_0_Select_the_slot_0": "${data.screen_0_Select_the_slot_0}",
//                     "screen_0_Select_the_Date_1": "${data.screen_0_Select_the_Date_1}",
//                     "screen_0_Choose_the_Time_2": "${data.screen_0_Choose_the_Time_2}",
//                     "screen_0_select_the_location_3": "${data.screen_0_select_the_location_3}",
//                     "screen_0_Preferences_4": "${data.screen_0_Preferences_4}",
//                     "screen_0_other_needs_5": "${data.screen_0_other_needs_5}"
//                   }
//                 }
//               }
//             ]
//           }
//         ]
//       }
//     }
//   ]
// }
