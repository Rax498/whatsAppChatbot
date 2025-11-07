// const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
// const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
// const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
// import { RistaApi } from "../RistaApi/route";

// export async function GET(req) {
//   try {
//     const { searchParams } = new URL(req.url);
//     const mode = searchParams.get("hub.mode");
//     const token = searchParams.get("hub.verify_token");
//     const challenge = searchParams.get("hub.challenge");

//     if (mode === "subscribe" && token === VERIFY_TOKEN) {
//       return new Response(challenge, { status: 200 });
//     } else {
//       return new Response("Forbidden", { status: 403 });
//     }
//   } catch (error) {
//     console.error("GET error:", error.message);
//     return new Response("Internal Server Error", { status: 500 });
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
//           if (message.type === "text") {
//             const from = message.from;
//             const messageId = message.id; // <-- WhatsApp message ID here
//             const userText = message.text.body;

//             // Send typing indicator (mark message read + typing)
//             await sendTypingIndicator(from, messageId);

//             // Call AI and get response
//             const aiResponse = await RistaApi(userText);

//             await sendWhatsAppMessage(from, {
//               type: "text",
//               textBody: aiResponse,
//             });
//           }
//         }
//       }
//     }
//     return new Response("EVENT_RECEIVED", { status: 200 });
//   } catch (error) {
//     console.error("POST error:", error.message);
//     return new Response("Internal Server Error", { status: 500 });
//   }
// }

// // Send typing indicator
// async function sendTypingIndicator(to, messageId) {
//   const bodyPayload = {
//     messaging_product: "whatsapp",
//     status: "read",
//     message_id: messageId,
//     typing_indicator: {
//       type: "text",
//     },
//   };

//   const response = await fetch(
//     `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
//     {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${WHATSAPP_TOKEN}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(bodyPayload),
//     }
//   );
//   return response;
// }

// // Send  WhatsApp text message
// async function sendWhatsAppMessage(to, options) {
//   const bodyPayload = {
//     messaging_product: "whatsapp",
//     to,
//     type: options.type,
//   };

//   if (options.type === "text") {
//     bodyPayload.text = { body: options.textBody };
//   }

//   const response = await fetch(
//     `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
//     {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${WHATSAPP_TOKEN}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(bodyPayload),
//     }
//   );

//   return response;
// }




const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const locations = [
  { id: "loc_coorg", title: "Coorg" },
  { id: "loc_hampi", title: "Hampi" },
  { id: "loc_kabini", title: "Kabini" },
  { id: "loc_kalahari", title: "Kalahari" },
];

const Rooms = [
  {
    id: "lily_pool_cottage",
    title: "Lily Pool Cottage",
    imageUrl:
      "https://assets.simplotel.com/simplotel/image/upload/x_3,y_0,w_2394,h_1347,r_0,c_crop,q_60,fl_progressive/w_450,f_auto,c_fit/chikkana-halli-estate-coorg-india/feature1_1_of_1_ueq4vr",
    description:
      "Luxury Plantation Style suite with a spacious bedroom, living room, and private pool.",
    price: "₹35,000 / night",
  },
  {
    id: "heritage_pool_villa",
    title: "Heritage Pool Villa",
    imageUrl:
      "https://assets.simplotel.com/simplotel/image/upload/x_0,y_20,w_2400,h_1350,r_0,c_crop,q_60,fl_progressive/w_450,f_auto,c_fit/chikkana-halli-estate-coorg-india/banner_1_of_1_ewof1q",
    description:
      "Kodava architecture, personal swimming pool with deck chairs, and lovely sit-outs.",
    price: "₹40,000 / night",
  },
  {
    id: "lily_pool_duplex",
    title: "Lily Pool Duplex",
    imageUrl:
      "https://assets.simplotel.com/simplotel/image/upload/x_0,y_13,w_1536,h_863,r_0,c_crop,q_60,fl_progressive/w_450,f_auto,c_fit/evolve-back-coorg/Lily_Pool_Duplex-Courtyard-1536x889_xt45ee",
    description:
      "2-level luxury suite with private temperature-controlled pool and balcony.",
    price: "₹40,000 / night",
  },
  {
    id: "lily_pool_bungalow",
    title: "Lily Pool Bungalow",
    imageUrl:
      "https://assets.simplotel.com/simplotel/image/upload/x_0,y_23,w_2400,h_1349,r_0,c_crop,q_60,fl_progressive/w_450,f_auto,c_fit/chikkana-halli-estate-coorg-india/banner_1_of_1_vma6wj",
    description:
      "Plantation Style 2-bedroom suite with spacious living room and private courtyard pool.",
    price: "₹67,000 / night",
  },
];

// In-memory session storage
const sessions = new Map();

// Send message to WhatsApp user via Meta API
async function sendMessage(to, messageBody) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v15.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          ...messageBody,
        }),
      }
    );
    
    if (!response.ok) {
      console.error("Failed to send message:", await response.text());
    }
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

// Extract user input based on current step
function extractUserInput(message, step) {
  if (step === "locationSelected" || step === "roomSelected") {
    return message.interactive?.list_reply?.id || "";
  }
  if (
    step === "askAdults" ||
    step === "askChildren" ||
    step === "confirmBooking"
  ) {
    return message.interactive?.button_reply?.id || "";
  }
  return message.text?.body?.trim().toLowerCase() || "";
}

// GET - Webhook verification
export async function GET(req) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully");
    return new Response(challenge, { status: 200 });
  }
  
  console.log("Webhook verification failed");
  return new Response("Forbidden", { status: 403 });
}

// POST - Handle incoming messages
export async function POST(req) {
  const body = await req.json();

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      for (const message of change.value?.messages || []) {
        const from = message.from;

        // Get or create session
        let session = sessions.get(from);
        if (!session) {
          session = { step: "greeting" };
          sessions.set(from, session);
        }

        const userInput = extractUserInput(message, session.step);
        
        // Skip if no input and not greeting step
        if (!userInput && session.step !== "greeting") {
          return new Response("OK");
        }

        // Process booking flow
        switch (session.step) {
          case "greeting":
            await sendMessage(from, {
              type: "text",
              text: {
                body: "👋 Welcome to Evolve Back Booking!\n\nLet's find the perfect room for your stay.",
              },
            });

            await sendMessage(from, {
              type: "interactive",
              interactive: {
                type: "list",
                header: { type: "text", text: "Select Location" },
                body: { text: "Choose your destination:" },
                action: {
                  button: "Select Location",
                  sections: [
                    {
                      title: "Locations",
                      rows: locations.map((loc) => ({
                        id: loc.id,
                        title: loc.title,
                        description: `Explore rooms in ${loc.title}`,
                      })),
                    },
                  ],
                },
              },
            });
            
            session.step = "locationSelected";
            sessions.set(from, session);
            return new Response("OK");

          case "locationSelected":
            session.location = userInput;
            sessions.set(from, session);

            // Send room cards with images
            for (const room of Rooms) {
              await sendMessage(from, {
                type: "image",
                image: {
                  link: room.imageUrl,
                  caption: `*${room.title}*\n\n${room.description}\n\n💰 ${room.price}`,
                },
              });
            }

            // Send room selection menu
            await sendMessage(from, {
              type: "interactive",
              interactive: {
                type: "list",
                header: { type: "text", text: "Select Room" },
                body: { text: "Choose your preferred room:" },
                action: {
                  button: "Select Room",
                  sections: [
                    {
                      title: "Available Rooms",
                      rows: Rooms.map((room) => ({
                        id: room.id,
                        title: room.title,
                        description: room.price,
                      })),
                    },
                  ],
                },
              },
            });

            session.step = "roomSelected";
            sessions.set(from, session);
            return new Response("OK");

          case "roomSelected":
            const selectedRoom = Rooms.find((r) => r.id === userInput);
            if (!selectedRoom) return new Response("OK");

            session.room = selectedRoom;
            sessions.set(from, session);

            await sendMessage(from, {
              type: "text",
              text: {
                body: "📅 Please enter your check-in date:\n\nFormat: YYYY-MM-DD\nExample: 2025-12-25",
              },
            });

            session.step = "askCheckIn";
            sessions.set(from, session);
            return new Response("OK");

          case "askCheckIn":
            if (!/^\d{4}-\d{2}-\d{2}$/.test(userInput)) {
              await sendMessage(from, {
                type: "text",
                text: {
                  body: "❌ Invalid date format.\n\nPlease enter check-in date as YYYY-MM-DD:",
                },
              });
              return new Response("OK");
            }

            session.checkIn = userInput;
            sessions.set(from, session);

            await sendMessage(from, {
              type: "text",
              text: {
                body: "📅 Please enter your check-out date:\n\nFormat: YYYY-MM-DD",
              },
            });

            session.step = "askCheckOut";
            sessions.set(from, session);
            return new Response("OK");

          case "askCheckOut":
            if (!/^\d{4}-\d{2}-\d{2}$/.test(userInput)) {
              await sendMessage(from, {
                type: "text",
                text: {
                  body: "❌ Invalid date format.\n\nPlease enter check-out date as YYYY-MM-DD:",
                },
              });
              return new Response("OK");
            }

            session.checkOut = userInput;
            sessions.set(from, session);

            // Ask number of adults
            await sendMessage(from, {
              type: "interactive",
              interactive: {
                type: "button",
                body: { text: "👨‍👩‍👧‍👦 How many adults?" },
                action: {
                  buttons: [1, 2, 3, 4, 5].map((n) => ({
                    type: "reply",
                    reply: { id: `adults_${n}`, title: n.toString() },
                  })),
                },
              },
            });

            session.step = "askAdults";
            sessions.set(from, session);
            return new Response("OK");

          case "askAdults":
            if (!userInput.startsWith("adults_")) return new Response("OK");

            session.adults = userInput.split("_")[1];
            sessions.set(from, session);

            await sendMessage(from, {
              type: "interactive",
              interactive: {
                type: "button",
                body: { text: "👶 How many children?" },
                action: {
                  buttons: [0, 1, 2, 3, 4, 5].map((n) => ({
                    type: "reply",
                    reply: { id: `children_${n}`, title: n.toString() },
                  })),
                },
              },
            });

            session.step = "askChildren";
            sessions.set(from, session);
            return new Response("OK");

          case "askChildren":
            if (!userInput.startsWith("children_")) return new Response("OK");

            session.children = userInput.split("_")[1];
            sessions.set(from, session);

            await sendMessage(from, {
              type: "text",
              text: {
                body: "🎟️ Do you have a promo code?\n\nEnter your code or type 'none':",
              },
            });

            session.step = "askPromo";
            sessions.set(from, session);
            return new Response("OK");

          case "askPromo":
            session.promo = userInput === "none" ? null : userInput;
            sessions.set(from, session);

            // Booking summary
            const summary = `✅ *Booking Summary*

📍 Location: ${locations.find(l => l.id === session.location)?.title || 'N/A'}
🏨 Room: ${session.room.title}
📅 Check-in: ${session.checkIn}
📅 Check-out: ${session.checkOut}
👥 Adults: ${session.adults}
👶 Children: ${session.children}
🎟️ Promo Code: ${session.promo || "None"}

💰 Price: ${session.room.price}`;

            await sendMessage(from, {
              type: "interactive",
              interactive: {
                type: "button",
                body: { text: summary + "\n\n━━━━━━━━━━━━━━━━\nConfirm your booking?" },
                action: {
                  buttons: [
                    {
                      type: "reply",
                      reply: { id: "confirm_yes", title: "✅ Confirm" },
                    },
                    {
                      type: "reply",
                      reply: { id: "confirm_no", title: "❌ Cancel" },
                    },
                  ],
                },
              },
            });

            session.step = "confirmBooking";
            sessions.set(from, session);
            return new Response("OK");

          case "confirmBooking":
            if (userInput === "confirm_yes") {
              await sendMessage(from, {
                type: "text",
                text: {
                  body: "🎉 Booking Confirmed!\n\nThank you for choosing Evolve Back. We look forward to welcoming you! 🏨\n\nYou will receive a confirmation email shortly.",
                },
              });

              // Clear session
              sessions.delete(from);
              return new Response("OK");
              
            } else if (userInput === "confirm_no") {
              await sendMessage(from, {
                type: "text",
                text: {
                  body: "❌ Booking Cancelled\n\nNo problem! To start a new booking, just send any message.",
                },
              });

              // Clear session
              sessions.delete(from);
              return new Response("OK");
            }

            return new Response("OK");

          default:
            await sendMessage(from, {
              type: "text",
              text: {
                body: "❗ Something went wrong.\n\nPlease type 'hi' to start a new booking.",
              },
            });

            sessions.delete(from);
            return new Response("OK");
        }
      }
    }
  }
  
  return new Response("OK", { status: 200 });
}
