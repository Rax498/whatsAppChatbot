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
    imageUrl: "https://assets.simplotel.com/simplotel/image/upload/x_3,y_0,w_2394,h_1347,r_0,c_crop,q_60,fl_progressive/w_450,f_auto,c_fit/chikkana-halli-estate-coorg-india/feature1_1_of_1_ueq4vr",
    description: "Luxury Plantation Style suite with a spacious bedroom, living room, and private pool.",
    price: "₹35,000 / night",
  },
  {
    id: "heritage_pool_villa",
    title: "Heritage Pool Villa",
    imageUrl: "https://assets.simplotel.com/simplotel/image/upload/x_0,y_20,w_2400,h_1350,r_0,c_crop,q_60,fl_progressive/w_450,f_auto,c_fit/chikkana-halli-estate-coorg-india/banner_1_of_1_ewof1q",
    description: "Kodava architecture, personal swimming pool with deck chairs, and lovely sit-outs.",
    price: "₹40,000 / night",
  },
  {
    id: "lily_pool_duplex",
    title: "Lily Pool Duplex",
    imageUrl: "https://assets.simplotel.com/simplotel/image/upload/x_0,y_13,w_1536,h_863,r_0,c_crop,q_60,fl_progressive/w_450,f_auto,c_fit/evolve-back-coorg/Lily_Pool_Duplex-Courtyard-1536x889_xt45ee",
    description: "2-level luxury suite with private temperature-controlled pool and balcony.",
    price: "₹40,000 / night",
  },
  {
    id: "lily_pool_bungalow",
    title: "Lily Pool Bungalow",
    imageUrl: "https://assets.simplotel.com/simplotel/image/upload/x_0,y_23,w_2400,h_1349,r_0,c_crop,q_60,fl_progressive/w_450,f_auto,c_fit/chikkana-halli-estate-coorg-india/banner_1_of_1_vma6wj",
    description: "Plantation Style 2-bedroom suite with spacious living room and private courtyard pool.",
    price: "₹67,000 / night",
  },
];

const sessions = new Map();

// Session timeout configuration (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [userId, session] of sessions.entries()) {
    if (session.lastActivity && (now - session.lastActivity) > SESSION_TIMEOUT) {
      sessions.delete(userId);
    }
  }
}

function updateSessionActivity(userId) {
  const session = sessions.get(userId);
  if (session) {
    session.lastActivity = Date.now();
    sessions.set(userId, session);
  }
}

function setSessionStep(from, step) {
  const session = sessions.get(from) || {};
  session.step = step;
  session.lastActivity = Date.now();
  sessions.set(from, session);
}

async function sendMessage(to, messageBody) {
  await fetch(`https://graph.facebook.com/v15.0/${PHONE_NUMBER_ID}/messages`, {
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
  });
}

function extractUserInput(message, step) {
  if (step === "locationSelected" || step === "roomSelected") {
    return message.interactive?.list_reply?.id;
  }
  if (["askAdults", "askChildren", "confirmBooking"].includes(step)) {
    return message.interactive?.button_reply?.id;
  }
  return message.text?.body?.trim().toLowerCase();
}

function isRestartCommand(input) {
  const restartCommands = ['hi', 'hello', 'start', 'restart', 'begin', 'new booking'];
  return typeof input === 'string' && restartCommands.includes(input.toLowerCase());
}

function resetSession(from) {
  sessions.set(from, { 
    step: "greeting", 
    lastActivity: Date.now() 
  });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("hub.mode") === "subscribe" && searchParams.get("hub.verify_token") === VERIFY_TOKEN) {
    return new Response(searchParams.get("hub.challenge"));
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req) {
  const body = await req.json();

  // Clean up expired sessions
  cleanupExpiredSessions();

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      for (const message of change.value?.messages || []) {
        const from = message.from;
        let session = sessions.get(from) || { 
          step: "greeting", 
          lastActivity: Date.now() 
        };

        // Update session activity
        updateSessionActivity(from);

        const userInput = extractUserInput(message, session.step);
        
        // Check for restart commands
        if (isRestartCommand(userInput)) {
          resetSession(from);
          session = sessions.get(from);
        }
        
        if (!userInput && session.step !== "greeting") continue;

        switch (session.step) {
          case "greeting":
            await sendMessage(from, {
              type: "text",
              text: { body: "👋 Welcome to Evolve Back Booking. Please select a location." },
            });

            await sendMessage(from, {
              type: "interactive",
              interactive: {
                type: "list",
                header: { type: "text", text: "Select Location" },
                body: { text: "Choose your destination:" },
                action: {
                  button: "Select Location",
                  sections: [{
                    title: "Locations",
                    rows: locations.map(loc => ({
                      id: loc.id,
                      title: loc.title,
                      description: `Explore rooms in ${loc.title}`,
                    })),
                  }],
                },
              },
            });

            session.step = "locationSelected";
            session.lastActivity = Date.now();
            sessions.set(from, session);
            break;

          case "locationSelected":
            const selectedLocation = locations.find(loc => loc.id === userInput);
            if (!selectedLocation) {
              await sendMessage(from, {
                type: "text",
                text: { body: "❗ Invalid location selected. Please choose from the list above." },
              });
              break;
            }

            session.location = selectedLocation;

            for (const room of Rooms) {
              await sendMessage(from, {
                type: "image",
                image: {
                  link: room.imageUrl,
                  caption: `*${room.title}*\n${room.description}\nPrice: ${room.price}`,
                },
              });
            }

            await sendMessage(from, {
              type: "interactive",
              interactive: {
                type: "list",
                header: { type: "text", text: "Select Room" },
                body: { text: "Choose your room:" },
                action: {
                  button: "Select Room",
                  sections: [{
                    title: "Rooms",
                    rows: Rooms.map(room => ({
                      id: room.id,
                      title: room.title,
                      description: room.price,
                    })),
                  }],
                },
              },
            });

            session.step = "roomSelected";
            session.lastActivity = Date.now();
            sessions.set(from, session);
            break;

          case "roomSelected":
            const selectedRoom = Rooms.find(r => r.id === userInput);
            if (!selectedRoom) {
              await sendMessage(from, {
                type: "text",
                text: { body: "❗ Invalid room selected. Please choose from the list above." },
              });
              break;
            }

            session.room = selectedRoom;
            await sendMessage(from, {
              type: "text",
              text: { body: "Please enter your check-in date (YYYY-MM-DD):" },
            });

            session.step = "askCheckIn";
            session.lastActivity = Date.now();
            sessions.set(from, session);
            break;

          case "askCheckIn":
            if (!/^\d{4}-\d{2}-\d{2}$/.test(userInput)) {
              await sendMessage(from, {
                type: "text",
                text: { body: "❗ Invalid date format. Please enter check-in date as YYYY-MM-DD (e.g., 2025-12-25):" },
              });
              break;
            }

            const inputCheckInDate = new Date(userInput);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (inputCheckInDate < today) {
              await sendMessage(from, {
                type: "text",
                text: { body: "❗ Check-in date cannot be in the past. Please enter a future date (YYYY-MM-DD):" },
              });
              break;
            }

            session.checkIn = userInput;
            await sendMessage(from, {
              type: "text",
              text: { body: "Please enter your check-out date (YYYY-MM-DD):" },
            });

            session.step = "askCheckOut";
            session.lastActivity = Date.now();
            sessions.set(from, session);
            break;

          case "askCheckOut":
            if (!/^\d{4}-\d{2}-\d{2}$/.test(userInput)) {
              await sendMessage(from, {
                type: "text",
                text: { body: "❗ Invalid date format. Please enter check-out date as YYYY-MM-DD (e.g., 2025-12-26):" },
              });
              break;
            }

            const checkOutDate = new Date(userInput);
            const checkInDate = new Date(session.checkIn);
            
            if (checkOutDate <= checkInDate) {
              await sendMessage(from, {
                type: "text",
                text: { body: "❗ Check-out date must be after check-in date. Please enter a valid check-out date (YYYY-MM-DD):" },
              });
              break;
            }

            session.checkOut = userInput;
            await sendMessage(from, {
              type: "interactive",
              interactive: {
                type: "button",
                body: { text: "Number of adults:" },
                action: {
                  buttons: [1, 2, 3, 4, 5].map(n => ({
                    type: "reply",
                    reply: { id: `adults_${n}`, title: n.toString() },
                  })),
                },
              },
            });

            session.step = "askAdults";
            session.lastActivity = Date.now();
            sessions.set(from, session);
            break;

          case "askAdults":
            if (!userInput.startsWith("adults_")) {
              await sendMessage(from, {
                type: "text", 
                text: { body: "❗ Please select the number of adults using the buttons above." },
              });
              break;
            }
            session.adults = userInput.split("_")[1];

            await sendMessage(from, {
              type: "interactive",
              interactive: {
                type: "button",
                body: { text: "Number of children:" },
                action: {
                  buttons: [0, 1, 2, 3, 4, 5].map(n => ({
                    type: "reply",
                    reply: { id: `children_${n}`, title: n.toString() },
                  })),
                },
              },
            });

            session.step = "askChildren";
            session.lastActivity = Date.now();
            sessions.set(from, session);
            break;

          case "askChildren":
            if (!userInput.startsWith("children_")) {
              await sendMessage(from, {
                type: "text",
                text: { body: "❗ Please select the number of children using the buttons above." },
              });
              break;
            }
            session.children = userInput.split("_")[1];

            await sendMessage(from, {
              type: "text",
              text: { body: "Enter promo code (or type 'none'):" },
            });

            session.step = "askPromo";
            session.lastActivity = Date.now();
            sessions.set(from, session);
            break;

          case "askPromo":
            session.promo = userInput === "none" ? null : userInput;

            const summary = `✅ Booking Summary:
Room: ${session.room.title}
Check-in: ${session.checkIn}
Check-out: ${session.checkOut}
Adults: ${session.adults}
Children: ${session.children}
Promo Code: ${session.promo || "None"}`;

            await sendMessage(from, {
              type: "interactive",
              interactive: {
                type: "button",
                body: { text: summary + "\n\nConfirm booking?" },
                action: {
                  buttons: [
                    { type: "reply", reply: { id: "confirm_yes", title: "Yes" } },
                    { type: "reply", reply: { id: "confirm_no", title: "No" } },
                  ],
                },
              },
            });

            session.step = "confirmBooking";
            session.lastActivity = Date.now();
            sessions.set(from, session);
            break;

          case "confirmBooking":
            if (userInput === "confirm_yes") {
              await sendMessage(from, {
                type: "text",
                text: { body: "🎉 Thank you! Your booking is confirmed. We will contact you shortly with payment details. To make a new booking, just type 'hi'. 🏨" },
              });
              sessions.delete(from);
            } else if (userInput === "confirm_no") {
              await sendMessage(from, {
                type: "text",
                text: { body: "❌ Booking cancelled. To start a new booking, just type 'hi'." },
              });
              sessions.delete(from);
            } else {
              await sendMessage(from, {
                type: "text",
                text: { body: "❗ Please use the Yes or No buttons to confirm or cancel your booking." },
              });
            }
            break;

          default:
            await sendMessage(from, {
              type: "text",
              text: { body: "❗ Something went wrong. Please type 'hi' to start a new booking." },
            });
            resetSession(from);
            break;
        }
      }
    }
  }

  return new Response("OK");
}
