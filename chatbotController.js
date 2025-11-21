const axios = require("axios");
const { getSession, saveSession } = require("./utils/sessionStore");
const { getHousingData } = require("./utils/sheets");
const detectIntent = require("./utils/intents");   // ✅ Moved to separate file

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

/* ---------------------------------------------------
   📤 UNIVERSAL SEND MESSAGE
-----------------------------------------------------*/
async function sendMessage(to, message, phone_number_id = PHONE_NUMBER_ID) {
  console.log(`✉️ Sending message to ${to}:`, message);

  const url = `https://graph.facebook.com/v19.0/${phone_number_id}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "text",
    text: { body: message },
  };

  try {
    await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    console.log("✅ Message sent successfully");
  } catch (err) {
    console.error(
      "❌ Error sending:",
      err.response ? err.response.data : err.message
    );
  }
}

/* ---------------------------------------------------
   🧠 MAIN LOGIC — HANDLE INCOMING MESSAGE
-----------------------------------------------------*/
async function handleIncomingMessage(sender, msg, session, phone_number_id) {
  console.log(`📩 Incoming from ${sender}: ${msg}`);
  console.log("Current session:", session);

  const intent = detectIntent(msg);  // ✅ Now externalized

  if (intent === "housing") {
    return await handleHousing(sender, msg, session, phone_number_id);
  }

  if (intent === "jobs") {
    await sendMessage(sender, "💼 Job search module coming soon!");
    return session;
  }

  if (intent === "leads") {
    await sendMessage(sender, "📊 Leads finder module is coming soon!");
    return session;
  }

  await sendMessage(
    sender,
    "I'm here to help! Try:\n\n" +
      "• *2bhk in Noida under 15k*\n" +
      "• *IT job in Bangalore*\n" +
      "• *Real estate buyer leads in Gurgaon*"
  );

  return session;
}

/* ---------------------------------------------------
   🏠 HOUSING HANDLER
-----------------------------------------------------*/
async function handleHousing(sender, msg, session, phone_number_id) {
  await sendMessage(sender, "🔍 Searching the best options for you...");

  try {
    const listings = await getHousingData();

    if (!listings || listings.length === 0) {
      await sendMessage(sender, "⚠️ No listings found at the moment.");
      return session;
    }

    let message = "🏠 *Top Properties Matching Your Query:*\n\n";

    listings.slice(0, 3).forEach((item, i) => {
      message += `${i + 1}. *${item.property_type}* in *${item.location}*\n`;
      message += `💰 ${item.price}\n`;
      message += `📞 ${item.contact}\n\n`;
    });

    await sendMessage(sender, message);

    session.step = "housingShown";
    session.lastQuery = msg;

    return session;
  } catch (err) {
    console.error("❌ Error fetching housing data:", err.message);
    await sendMessage(
      sender,
      "⚠️ Something went wrong while fetching properties. Try again shortly."
    );

    return session;
  }
}

module.exports = {
  sendMessage,
  handleIncomingMessage,
};
