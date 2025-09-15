const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const locations = [
  { id: "loc_coorg", title: "Coorg" },
  { id: "loc_hampi", title: "Hampi" },
  { id: "loc_kabini", title: "Kabini" },
  { id: "loc_kalahari", title: "Kalahari" },
];

const Rooms = {
  loc_coorg: [
    {
      id: "lily_pool_cottage", 
      title: "Lily Pool Cottage",
      imageUrl:
        "https://assets.simplotel.com/simplotel/image/upload/x_3,y_0,w_2394,h_1347,r_0,c_crop,q_60,fl_progressive/w_450,f_auto,c_fit/chikkana-halli-estate-coorg-india/feature1_1_of_1_ueq4vr",
      description:
        "Luxury Plantation Style suite with a spacious bedroom, living room, and private pool.",
      price: "₹35,000 / night",
    },
  ],
  loc_hampi: [
    {
      id: "heritage_pool_villa",
      title: "Heritage Pool Villa",
      imageUrl:
        "https://assets.simplotel.com/simplotel/image/upload/x_0,y_20,w_2400,h_1350,r_0,c_crop,q_60,fl_progressive/w_450,f_auto,c_fit/chikkana-halli-estate-coorg-india/banner_1_of_1_ewof1q",
      description:
        "Kodava architecture, personal swimming pool with deck chairs, and lovely sit-outs.",
      price: "₹40,000 / night",
    },
  ],
  loc_kabini: [
    {
      id: "lily_pool_duplex",
      title: "Lily Pool Duplex",
      imageUrl:
        "https://assets.simplotel.com/simplotel/image/upload/x_0,y_13,w_1536,h_863,r_0,c_crop,q_60,fl_progressive/w_450,f_auto,c_fit/evolve-back-coorg/Lily_Pool_Duplex-Courtyard-1536x889_xt45ee",
      description:
        "2-level luxury suite with private temperature-controlled pool and balcony.",
      price: "₹40,000 / night",
    },
  ],
  loc_kalahari: [
    {
      id: "lily_pool_bungalow",
      title: "Lily Pool Bungalow",
      imageUrl:
        "https://assets.simplotel.com/simplotel/image/upload/x_0,y_23,w_2400,h_1349,r_0,c_crop,q_60,fl_progressive/w_450,f_auto,c_fit/chikkana-halli-estate-coorg-india/banner_1_of_1_vma6wj",
      description:
        "Plantation Style 2-bedroom suite with spacious living room and private courtyard pool.",
      price: "₹67,000 / night",
    },
  ],
};

// In-memory session storage (for demo only, reset on restart)
const sessions = {};

// Helper to send messages via WhatsApp API
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

  if (!res.ok) {
    const text = await res.text();
    console.error("Failed to send message:", text);
  }
}

// Handler for webhook GET verification
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

// Handler for incoming messages (POST)
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

        // Extract user input from text or interactive replies
        const userInput =
          message.interactive?.button_reply?.id ||
          message.interactive?.list_reply?.id ||
          message.text?.body?.trim().toLowerCase() ||
          "";

        switch (session.step) {
          case "greeting":
            // Send welcome message + List Message to select location
            await sendMessage(from, {
              type: "text",
              text: {
                body:
                  "👋 Hello! Welcome to Evolve Back hotel booking service. "
              },
            });

            // WhatsApp List Message for locations
            await sendMessage(from, {
              type: "interactive",
              interactive: {
                type: "list",
                header: {
                  type: "text",
                  text: "Choose Location",
                },
                body: {
                  text: "Please select your location:",
                },
                
                action: {
                  button: "Select Location",
                  sections: [
                    {
                      title: "Locations",
                      rows: locations.map((loc) => ({
                        id: loc.id,
                        title: loc.title,
                        description: `Rooms in ${loc.title}`,
                      })),
                    },
                  ],
                },
              },
            });

            session.step = "locationSelected";
            break;

          case "locationSelected": {
            const selectedLocation = locations.find((loc) => loc.id === userInput);
            if (!selectedLocation) {
              await sendMessage(from, {
                type: "text",
                text: {
                  body:
                    "❌ Invalid selection. Please choose your location from the list.",
                },
              });
              break;
            }
            session.location = selectedLocation;

            // Show hotel options for this location 
            const availableRooms = Rooms || [];
            if (availableRooms.length === 0) {
              await sendMessage(from, {
                type: "text",
                text: { body: "No Rooms available for this location." },
              });
              session.step = "greeting"; // restart
              break;
            }

            // Send images with captions describing each hotel (room)
            for (const hotel of availableRooms) {
              await sendMessage(from, {
                type: "image",
                image: {
                  link: hotel.imageUrl,
                  caption: `*${hotel.title}*\n${hotel.description}\nPrice: ${hotel.price}`,
                },
              });
            }

            // Now ask user to select a hotel (using List Message)
            await sendMessage(from, {
              type: "interactive",
              interactive: {
                type: "list",
                header: {
                  type: "text",
                  text: " Rooms ",
                },
                body: {
                  text: "Please select your Room :",
                },
                
                action: {
                  button: "Select Room",
                  sections: [
                    {
                      title: "Available Rooms",
                      rows: availableRooms.map((hotel) => ({
                        id: hotel.id,
                        title: hotel.title,
                        description: hotel.price,
                      })),
                    },
                  ],
                },
              },
            });

            session.step = "Roomselected";
            break;
          }

          case "Roomselected": {
            const locationRooms = Rooms[session.location.id] || [];
            const selectedHotel = locationRooms.find((h) => h.id === userInput);

            session.hotel = selectedHotel;

            // Ask for check-in date as text (no date picker in WhatsApp API)
            await sendMessage(from, {
              type: "text",
              text: { body: "Please enter your check-in date (YYYY-MM-DD):" },
            });

            session.step = "askCheckIn";
            break;
          }

          case "askCheckIn": {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(userInput)) {
              await sendMessage(from, {
                type: "text",
                text: {
                  body:
                    "❌ Invalid date format. Please enter check-in date as YYYY-MM-DD:",
                },
              });
              break;
            }
            session.checkIn = userInput;

            // Ask for check-out date
            await sendMessage(from, {
              type: "text",
              text: { body: "Please enter your check-out date (YYYY-MM-DD):" },
            });

            session.step = "askCheckOut";
            break;
          }

          case "askCheckOut": {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(userInput)) {
              await sendMessage(from, {
                type: "text",
                text: {
                  body:
                    "❌ Invalid date format. Please enter check-out date as YYYY-MM-DD:",
                },
              });
              break;
            }
            session.checkOut = userInput;

            // Ask number of adults (button message)
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
          }

          case "askAdults": {
            if (!userInput.startsWith("adults_")) {
              await sendMessage(from, {
                type: "text",
                text: {
                  body: "Please select number of adults using the buttons below.",
                },
              });
              break;
            }

            session.adults = userInput.split("_")[1];

            // Ask number of children (button message)
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
          }

          case "askChildren": {
            if (!userInput.startsWith("children_")) {
              await sendMessage(from, {
                type: "text",
                text: {
                  body: "Please select number of children using the buttons below.",
                },
              });
              break;
            }

            session.children = userInput.split("_")[1];

            // Ask for promo code (text)
            await sendMessage(from, {
              type: "text",
              text: { body: "Enter promo code (or type 'none'):" },
            });

            session.step = "askPromo";
            break;
          }

          case "askPromo": {
            session.promo = userInput === "none" ? null : userInput;

            // Show booking summary and ask for confirmation
            const summary = `✅ *Booking Summary:*\n
Location: ${session.location.title}
Hotel: ${session.hotel.title}
Check-in: ${session.checkIn}
Check-out: ${session.checkOut}
Adults: ${session.adults}
Children: ${session.children}
Promo Code: ${session.promo || "None"}`;

            await sendMessage(from, {
              type: "interactive",
              interactive: {
                type: "button",
                body: {
                  text: summary + "\n\nDo you want to confirm your booking?",
                },
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
          }

          case "confirmBooking": {
            if (userInput === "confirm_yes") {
              await sendMessage(from, {
                type: "text",
                text: {
                  body:
                    "🎉 Thank you! Your booking is confirmed. We will contact you shortly.",
                },
              });

              session.step = "completed";
            } else if (userInput === "confirm_no") {
              await sendMessage(from, {
                type: "text",
                text: {
                  body:
                    "❌ Booking cancelled. To start again, send any message.",
                },
              });

              delete sessions[from];
            } else {
              await sendMessage(from, {
                type: "text",
                text: {
                  body: "Please confirm your booking by selecting Yes or No.",
                },
              });
            }
            break;
          }

          case "completed":
            await sendMessage(from, {
              type: "text",
              text: {
                body:
                  "Thank you for using our service. To start a new booking, send any message.",
              },
            });
            delete sessions[from];
            break;

          default:
            await sendMessage(from, {
              type: "text",
              text: {
                body:
                  "Sorry, I did not understand that. Please follow the instructions.",
              },
            });
            break;
        }
      }
    }
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}
