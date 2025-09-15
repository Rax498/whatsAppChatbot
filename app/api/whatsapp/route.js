const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const locations = [
  { id: "loc_coorg", title: "Coorg" },
  { id: "loc_hampi", title: "Hampi" },
  { id: "loc_kabini", title: "Kabini" },
  { id: "loc_kalahari", title: "Kalahari" },
];

const hotels = {
  loc_coorg: [
    {
      id: "Lily Pool Cottage ",
      title: "Lily Pool Cottage ",
      imageUrl:
        "https://assets.simplotel.com/simplotel/image/upload/x_3,y_0,w_2394,h_1347,r_0,c_crop,q_60,fl_progressive/w_450,f_auto,c_fit/chikkana-halli-estate-coorg-india/feature1_1_of_1_ueq4vr",
      description:
        "The Lily Pool Cottage is a luxury Plantation Style suite with a charming, spacious bedroom, living room and an ensuite bathroom. Perfect for couples, these elegantly designed suites come with a spacious sit-out overlooking a courtyard with a private pool set amidst a tranquil lily pond.",
      price: "₹35,000/ night",
    },
  ],
  loc_hampi: [
    {
      id: "Heritage Pool Villa",
      title: "Heritage Pool Villa",
      imageUrl:
        "https://assets.simplotel.com/simplotel/image/upload/x_0,y_20,w_2400,h_1350,r_0,c_crop,q_60,fl_progressive/w_450,f_auto,c_fit/chikkana-halli-estate-coorg-india/banner_1_of_1_ewof1q",
      description:
        "This is Kodava architecture at its luxurious best. The Heritage Pool Villas boast a separate living room and en-suite bedroom, with a courtyard and your very own personal swimming pool with deck chairs. And, affording a pool view are two lovely sit-outs, complete with planters’ chairs to laze on with a book and drink on hand. *Minimum pool temperature – 26° C (Temperature control in the pools are deactivated during April and May)",
      price: "₹40,000 / night",
    },
  ],
  loc_kabini: [
    {
      id: "Lily Pool Duplex",
      title: "Lily Pool Duplex",
      imageUrl:
        "https://assets.simplotel.com/simplotel/image/upload/x_0,y_13,w_1536,h_863,r_0,c_crop,q_60,fl_progressive/w_450,f_auto,c_fit/evolve-back-coorg/Lily_Pool_Duplex-Courtyard-1536x889_xt45ee",
      description:
        "The Lily Pool Duplex is a Plantation Style, 2-level luxury suite. Perfect for families, these elegantly designed villas come with a living area and a powder room on the ground floor leading to a deck overlooking your private temperature-controlled* pool, set amidst a tranquil lily pond. The first floor boasts a spacious bedroom with an attached bath and a private balcony. *Minimum pool temperature – 26° C (Temperature control in the pools are deactivated during April and May).",
      price: "₹40,000 / night",
    },
  ],
  loc_kalahari: [
    {
      id: "Lily Pool Bungalow ",
      title: "Lily Pool Bungalow ",
      imageUrl:
        "https://assets.simplotel.com/simplotel/image/upload/x_0,y_23,w_2400,h_1349,r_0,c_crop,q_60,fl_progressive/w_450,f_auto,c_fit/chikkana-halli-estate-coorg-india/banner_1_of_1_vma6wj",
      description:
        "The Lily Pool Bungalow is a Plantation Style 2-bedroom luxury suite with 2 baths and a spacious living room. Perfect for families, these elegantly designed bungalows come with a spacious sit-out overlooking a private courtyard with its own pool set amidst a tranquil lily pond. *Minimum pool temperature – 26° C (Temperature control in the pools are deactivated during April and May)",
      price: "₹67,000 / night",
    },
  ],
};

// Simple in-memory session store
const sessions = {};

async function sendMessage(to, messageBody) {
  return fetch(`https://graph.facebook.com/v15.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
    },
    body: JSON.stringify({ messaging_product: "whatsapp", to, ...messageBody }),
  });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  if (
    searchParams.get("hub.mode") === "subscribe" &&
    searchParams.get("hub.verify_token") === VERIFY_TOKEN
  ) {
    return new Response(searchParams.get("hub.challenge"), { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req) {
  const body = await req.json();

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      for (const msg of change.value?.messages || []) {
        const from = msg.from;

        if (!sessions[from]) {
          sessions[from] = { step: "greeting" };
        }

        const session = sessions[from];
        const userInput =
          msg.interactive?.button_reply?.id ||
          msg.text?.body?.trim().toLowerCase() ||
          "";

        if (session.step === "greeting") {
          await sendMessage(from, {
            type: "text",
            text: {
              body: "👋 Hello! Welcome to our hotel booking service.\nPlease select your location:",
            },
          });
          // Send location selection buttons
          await sendMessage(from, {
            type: "interactive",
            interactive: {
              type: "button",
              body: { text: "Choose your location:" },
              action: {
                buttons: locations.map((loc) => ({
                  type: "reply",
                  reply: { id: loc.id, title: loc.title },
                })),
              },
            },
          });
          session.step = "locationSelected";
          continue;
        }

        if (session.step === "locationSelected") {
          const selectedLocation = locations.find(
            (loc) => loc.id === userInput
          );
          if (!selectedLocation) {
            await sendMessage(from, {
              type: "text",
              text: { body: "Please select a location from the options." },
            });
            continue;
          }
          session.location = selectedLocation;
          // Send hotels for selected location with image + description + price as individual image messages
          const availableHotels = hotels[selectedLocation.id] || [];

          for (const hotel of availableHotels) {
            await sendMessage(from, {
              type: "image",
              image: {
                link: hotel.imageUrl,
                caption: `${hotel.title}\n${hotel.description}\nPrice: ${hotel.price}`,
              },
            });
          }

          // Then ask user to pick hotel
          await sendMessage(from, {
            type: "interactive",
            interactive: {
              type: "button",
              body: { text: "Please select your hotel:" },
              action: {
                buttons: availableHotels.map((hotel) => ({
                  type: "reply",
                  reply: { id: hotel.id, title: hotel.title },
                })),
              },
            },
          });
          session.step = "hotelSelected";
          continue;
        }

        if (session.step === "hotelSelected") {
          // Validate hotel selection
          const locationHotels = hotels[session.location.id] || [];
          const selectedHotel = locationHotels.find((h) => h.id === userInput);
          if (!selectedHotel) {
            await sendMessage(from, {
              type: "text",
              text: { body: "Please select a valid hotel from the options." },
            });
            continue;
          }
          session.hotel = selectedHotel;

          // Ask for Check-in date (as text since no date picker)
          await sendMessage(from, {
            type: "text",
            text: { body: "Please enter your check-in date (YYYY-MM-DD):" },
          });
          session.step = "askCheckIn";
          continue;
        }

        if (session.step === "askCheckIn") {
          // Basic validation for date format
          if (!/^\d{4}-\d{2}-\d{2}$/.test(userInput)) {
            await sendMessage(from, {
              type: "text",
              text: {
                body: "Invalid date format. Please enter check-in date as YYYY-MM-DD:",
              },
            });
            continue;
          }
          session.checkIn = userInput;

          // Ask check-out
          await sendMessage(from, {
            type: "text",
            text: { body: "Please enter your check-out date (YYYY-MM-DD):" },
          });
          session.step = "askCheckOut";
          continue;
        }

        if (session.step === "askCheckOut") {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(userInput)) {
            await sendMessage(from, {
              type: "text",
              text: {
                body: "Invalid date format. Please enter check-out date as YYYY-MM-DD:",
              },
            });
            continue;
          }
          session.checkOut = userInput;

          // Ask adults numbera
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
          continue;
        }

        if (session.step === "askAdults") {
          if (!userInput.startsWith("adults_")) {
            await sendMessage(from, {
              type: "text",
              text: {
                body: "Please select number of adults using the buttons.",
              },
            });
            continue;
          }
          session.adults = userInput.split("_")[1];

          // children number
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
          continue;
        }

        if (session.step === "askChildren") {
          if (!userInput.startsWith("children_")) {
            await sendMessage(from, {
              type: "text",
              text: {
                body: "Please select number of children using the buttons.",
              },
            });
            continue;
          }
          session.children = userInput.split("_")[1];

          //  promo code
          await sendMessage(from, {
            type: "text",
            text: { body: "Enter promo code (or type 'none'):" },
          });
          session.step = "askPromo";
          continue;
        }

        if (session.step === "askPromo") {
          session.promo = userInput === "none" ? null : userInput;

          //  summary and ask confirm
          let summary =
            `✅ *Booking Summary:*\n` +
            `Location: ${session.location.title}\n` +
            `Hotel: ${session.hotel.title}\n` +
            `Check-in: ${session.checkIn}\n` +
            `Check-out: ${session.checkOut}\n` +
            `Adults: ${session.adults}\n` +
            `Children: ${session.children}\n` +
            `Promo Code: ${session.promo || "None"}`;

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
          continue;
        }

        if (session.step === "confirmBooking") {
          if (userInput === "confirm_yes") {
            await sendMessage(from, {
              type: "text",
              text: {
                body: "Thank you! Your booking has been confirmed. We will contact you shortly.",
              },
            });
            session.step = "completed";
          } else if (userInput === "confirm_no") {
            await sendMessage(from, {
              type: "text",
              text: {
                body: "Booking cancelled. If you want to start again, type anything.",
              },
            });
            delete sessions[from];
          } else {
            await sendMessage(from, {
              type: "text",
              text: { body: "Please confirm by selecting 'Yes' or 'No'." },
            });
          }
          continue;
        }

        if (session.step === "completed") {
          await sendMessage(from, {
            type: "text",
            text: {
              body: "Thank you for using our service. To start a new booking, type anything.",
            },
          });
          delete sessions[from];
          continue;
        }

        // Default fallback
        await sendMessage(from, {
          type: "text",
          text: {
            body: "Sorry, I did not understand that. Please follow the instructions.",
          },
        });
      }
    }
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}
