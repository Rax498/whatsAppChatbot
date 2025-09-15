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
    id: "room_1",
    title: "Lily Pool Cottage",
    imageUrl:
      "https://assets.simplotel.com/simplotel/image/upload/x_3,y_0,w_2394,h_1347,r_0,c_crop,q_60,fl_progressive/w_450,f_auto,c_fit/chikkana-halli-estate-coorg-india/feature1_1_of_1_ueq4vr",
    description:
      "Luxury Plantation Style suite with a spacious bedroom, living room, and private pool.",
    price: "₹35,000 / night",
  },
  {
    id: "room_2",
    title: "Heritage Pool Villa",
    imageUrl:
      "https://assets.simplotel.com/simplotel/image/upload/x_0,y_20,w_2400,h_1350,r_0,c_crop,q_60,fl_progressive/w_450,f_auto,c_fit/chikkana-halli-estate-coorg-india/banner_1_of_1_ewof1q",
    description:
      "Kodava architecture, personal swimming pool with deck chairs, and lovely sit-outs.",
    price: "₹40,000 / night",
  },
  {
    id: "room_3",
    title: "Lily Pool Bungalow",
    imageUrl:
      "https://assets.simplotel.com/simplotel/image/upload/x_0,y_23,w_2400,h_1349,r_0,c_crop,q_60,fl_progressive/w_450,f_auto,c_fit/chikkana-halli-estate-coorg-india/banner_1_of_1_vma6wj",
    description:
      "Plantation Style 2-bedroom suite with living room and private courtyard pool.",
    price: "₹67,000 / night",
  },
];

const sessions = {};

async function sendMessage(to, messageBody) {
  await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
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

export async function GET(req) {
  const url = new URL(req.url);
  if (
    url.searchParams.get("hub.mode") === "subscribe" &&
    url.searchParams.get("hub.verify_token") === VERIFY_TOKEN
  ) {
    return new Response(url.searchParams.get("hub.challenge"), {
      status: 200,
    });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req) {
  const body = await req.json();

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      for (const message of change.value?.messages || []) {
        const from = message.from;
        const msg =
          message.interactive?.button_reply?.id ||
          message.interactive?.list_reply?.id ||
          message.text?.body?.trim().toLowerCase();

        if (!sessions[from]) {
          sessions[from] = { step: "greeting" };
        }

        const session = sessions[from];

        if (session.step === "greeting") {
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
                button: "Locations",
                sections: [
                  {
                    title: "Available Locations",
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
          return new Response("OK", { status: 200 });
        }

        if (session.step === "locationSelected") {
          session.location = msg;

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
                button: "Rooms",
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
          return new Response("OK", { status: 200 });
        }

        if (session.step === "roomSelected") {
          const room = Rooms.find((r) => r.id === msg);
          if (!room) return new Response("OK", { status: 200 });

          session.hotel = room;
          await sendMessage(from, {
            type: "text",
            text: {
              body: "Enter your check-in date (YYYY-MM-DD):",
            },
          });

          session.step = "askCheckIn";
          return new Response("OK", { status: 200 });
        }

        if (session.step === "askCheckIn") {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(msg)) return new Response("OK");

          session.checkIn = msg;
          await sendMessage(from, {
            type: "text",
            text: {
              body: "Enter your check-out date (YYYY-MM-DD):",
            },
          });

          session.step = "askCheckOut";
          return new Response("OK", { status: 200 });
        }

        if (session.step === "askCheckOut") {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(msg)) return new Response("OK");

          session.checkOut = msg;
          await sendMessage(from, {
            type: "interactive",
            interactive: {
              type: "button",
              body: { text: "Number of adults:" },
              action: {
                buttons: [1, 2, 3, 4].map((n) => ({
                  type: "reply",
                  reply: { id: `adults_${n}`, title: `${n}` },
                })),
              },
            },
          });

          session.step = "askAdults";
          return new Response("OK", { status: 200 });
        }

        if (session.step === "askAdults") {
          if (!msg.startsWith("adults_")) return new Response("OK");

          session.adults = msg.split("_")[1];
          await sendMessage(from, {
            type: "interactive",
            interactive: {
              type: "button",
              body: { text: "Number of children:" },
              action: {
                buttons: [0, 1, 2, 3].map((n) => ({
                  type: "reply",
                  reply: { id: `children_${n}`, title: `${n}` },
                })),
              },
            },
          });

          session.step = "askChildren";
          return new Response("OK", { status: 200 });
        }

        if (session.step === "askChildren") {
          if (!msg.startsWith("children_")) return new Response("OK");

          session.children = msg.split("_")[1];
          await sendMessage(from, {
            type: "text",
            text: { body: "Enter promo code (or type 'none'):" },
          });

          session.step = "askPromo";
          return new Response("OK", { status: 200 });
        }

        if (session.step === "askPromo") {
          session.promo = msg === "none" ? null : msg;

          const summary = `✅ *Booking Summary:*\nLocation: ${session.location}\nRoom: ${session.hotel.title}\nCheck-in: ${session.checkIn}\nCheck-out: ${session.checkOut}\nAdults: ${session.adults}\nChildren: ${session.children}\nPromo Code: ${session.promo || "None"}`;

          await sendMessage(from, {
            type: "interactive",
            interactive: {
              type: "button",
              body: {
                text: summary + "\n\nConfirm booking?",
              },
              action: {
                buttons: [
                  {
                    type: "reply",
                    reply: { id: "confirm_yes", title: "Yes" },
                  },
                  {
                    type: "reply",
                    reply: { id: "confirm_no", title: "No" },
                  },
                ],
              },
            },
          });

          session.step = "confirmBooking";
          return new Response("OK", { status: 200 });
        }

        if (session.step === "confirmBooking") {
          if (msg === "confirm_yes") {
            await sendMessage(from, {
              type: "text",
              text: { body: "🎉 Booking confirmed. Thank you!" },
            });
            delete sessions[from];
          } else if (msg === "confirm_no") {
            await sendMessage(from, {
              type: "text",
              text: { body: "❌ Booking cancelled." },
            });
            delete sessions[from];
          }
        }
      }
    }
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}
