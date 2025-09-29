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

const sessions = new Map();

// __ sending messages to Meta __
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

// ----GET REQUEST FOR WEBHOOK VERIFICATION

export async function GET(req) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req) {
  const body = await req.json();

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      for (const message of change.value?.messages || []) {
        const from = message.from;

        let session = sessions.get(from);
        if (!session) {
          session = { step: "greeting" };
          sessions.set(from, session);
        }

        const userInput = extractUserInput(message, session.step);
        if (!userInput && session.step !== "greeting")
          return new Response("OK");

        // __Exicuting steps__

        switch (session.step) {
          case "greeting":
            await sendMessage(from, {
              type: "text",
              text: {
                body: "👋 Welcome to Evolve Back Booking. Please select a location.",
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

            //  __ sending room card__

            for (const room of Rooms) {
              await sendMessage(from, {
                type: "image",
                image: {
                  link: room.imageUrl,
                  caption: `*${room.title}*\n${room.description}\nPrice: ${room.price}`,
                },
              });
            }
            // __sending room name menue__
            await sendMessage(from, {
              type: "interactive",
              interactive: {
                type: "list",
                header: { type: "text", text: "Select Room" },
                body: { text: "Choose your room:" },
                action: {
                  button: "Select Room",
                  sections: [
                    {
                      title: "Rooms",
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

            // __sending dates__

            await sendMessage(from, {
              type: "text",
              text: { body: "Please enter your check-in date (YYYY-MM-DD):" },
            });

            session.step = "askCheckIn";
            sessions.set(from, session);
            return new Response("OK");

          case "askCheckIn":
            if (!/^\d{4}-\d{2}-\d{2}$/.test(userInput)) {
              await sendMessage(from, {
                type: "text",
                text: {
                  body: "Invalid date format. Please enter check-in date as YYYY-MM-DD:",
                },
              });
              return new Response("OK");
            }

            session.checkIn = userInput;
            sessions.set(from, session);

            await sendMessage(from, {
              type: "text",
              text: { body: "Please enter your check-out date (YYYY-MM-DD):" },
            });

            session.step = "askCheckOut";
            sessions.set(from, session);
            return new Response("OK");

          case "askCheckOut":
            if (!/^\d{4}-\d{2}-\d{2}$/.test(userInput)) {
              await sendMessage(from, {
                type: "text",
                text: {
                  body: "Invalid date format. Please enter check-out date as YYYY-MM-DD:",
                },
              });
              return new Response("OK");
            }

            session.checkOut = userInput;
            sessions.set(from, session);

            // __Asking number of adults __

            await sendMessage(from, {
              type: "interactive",
              interactive: {
                type: "button",
                body: { text: "Number of adults:" },
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
                body: { text: "Number of children:" },
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
              text: { body: "Enter promo code (or type 'none'):" },
            });

            session.step = "askPromo";
            sessions.set(from, session);
            return new Response("OK");

          case "askPromo":
            session.promo = userInput === "none" ? null : userInput;
            sessions.set(from, session);

            // __ Summary card __

            const summary = `✅ *Booking Summary*:
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
                    {
                      type: "reply",
                      reply: { id: "confirm_yes", title: "Yes" },
                    },
                    { type: "reply", reply: { id: "confirm_no", title: "No" } },
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
                text: { body: "🎉 Thank you! Your booking is confirmed. 🏨" },
              });

              session.step = "completed";
              sessions.set(from, session);
              return new Response("OK");
            } else if (userInput === "confirm_no") {
              await sendMessage(from, {
                type: "text",
                text: {
                  body: "❌ Booking cancelled. To start a new booking, just send a message anytime.",
                },
              });

              sessions.delete(from);
              return new Response("OK");
            }

            return new Response("OK");

          case "completed":
            await sendMessage(from, {
              type: "text",
              text: {
                body: "Thank you for using our service. To start a new booking, send any message.",
              },
            });

            sessions.delete(from);
            return new Response("OK");

          default:
            await sendMessage(from, {
              type: "text",
              text: {
                body: "❗ Something went wrong. Please type 'hi' to start over.",
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
