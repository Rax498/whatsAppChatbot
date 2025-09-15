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

const sessions = {};

async function sendMessage(to, messageBody) {
  const res = await fetch(
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
}

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
        let session = sessions[from];
        if (!session) {
          session = { step: "greeting" };
          sessions[from] = session;
        }

        const userInput =
          message.interactive?.button_reply?.id ||
          message.interactive?.list_reply?.id ||
          message.text?.body?.trim().toLowerCase() ||
          "";

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
            break;

          case "locationSelected":
            // ignore userInput, show sample rooms (Rooms array) always same for all locations
            for (const room of Rooms) {
              await sendMessage(from, {
                type: "image",
                image: { link: room.imageUrl, caption: `*${room.title}*\n${room.description}\nPrice: ${room.price}` },
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
            break;

          case "roomSelected":
            const selectedRoom = Rooms.find((r) => r.id === userInput);
            if (!selectedRoom) {
              await sendMessage(from, {
                type: "text",
                text: { body: "Please select a valid room from the list." },
              });
              break;
            }
            session.room = selectedRoom;

            await sendMessage(from, {
              type: "text",
              text: { body: "Please enter your check-in date (YYYY-MM-DD):" },
            });

            session.step = "askCheckIn";
            break;

          case "askCheckIn":
            if (!/^\d{4}-\d{2}-\d{2}$/.test(userInput)) {
              await sendMessage(from, {
                type: "text",
                text: { body: "Invalid date format. Please enter check-in date as YYYY-MM-DD:" },
              });
              break;
            }
            session.checkIn = userInput;

            await sendMessage(from, {
              type: "text",
              text: { body: "Please enter your check-out date (YYYY-MM-DD):" },
            });

            session.step = "askCheckOut";
            break;

          case "askCheckOut":
            if (!/^\d{4}-\d{2}-\d{2}$/.test(userInput)) {
              await sendMessage(from, {
                type: "text",
                text: { body: "Invalid date format. Please enter check-out date as YYYY-MM-DD:" },
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
                  buttons: [1, 2, 3, 4, 5].map((n) => ({
                    type: "reply",
                    reply: { id: `adults_${n}`, title: n.toString() },
                  })),
                },
              },
            });

            session.step = "askAdults";
            break;

          case "askAdults":
            if (!userInput.startsWith("adults_")) {
              await sendMessage(from, {
                type: "text",
                text: { body: "Please select number of adults using the buttons." },
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
                  buttons: [0, 1, 2, 3, 4, 5].map((n) => ({
                    type: "reply",
                    reply: { id: `children_${n}`, title: n.toString() },
                  })),
                },
              },
            });

            session.step = "askChildren";
            break;

          case "askChildren":
            if (!userInput.startsWith("children_")) {
              await sendMessage(from, {
                type: "text",
                text: { body: "Please select number of children using the buttons." },
              });
              break;
            }

            session.children = userInput.split("_")[1];

            await sendMessage(from, {
              type: "text",
              text: { body: "Enter promo code (or type 'none'):" },
            });

            session.step = "askPromo";
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
            break;

          case "confirmBooking":
            if (userInput === "confirm_yes") {
              await sendMessage(from, {
                type: "text",
                text: { body: "🎉 Thank you! Your booking is confirmed." },
              });
              session.step = "completed";
            } else if (userInput === "confirm_no") {
              await sendMessage(from, {
                type: "text",
                text: { body: "Booking cancelled. To start again, send any message." },
              });
              delete sessions[from];
            } else {
              await sendMessage(from, {
                type: "text",
                text: { body: "Please confirm your booking by selecting Yes or No." },
              });
            }
            break;

          case "completed":
            await sendMessage(from, {
              type: "text",
              text: { body: "Thank you for using our service. To start a new booking, send any message." },
            });
            delete sessions[from];
            break;

          default:
            await sendMessage(from, {
              type: "text",
              text: { body: "Please follow instructions." },
            });
            break;
        }
        break; // Stop processing more steps for this message
      }
    }
  }

  return new Response("OK", { status: 200 });
}
