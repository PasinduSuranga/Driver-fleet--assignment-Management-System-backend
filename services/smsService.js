const axios = require("axios");

const SMS_API_URL = "https://sms.textware.lk:5001/sms/send_sms.php";
const SMS_USERNAME = "city_lion";   
const SMS_PASSWORD = "vP7l44gZ8OpN";  
const SMS_SENDER_ID = "CLE_Tours";

function formatPhoneNumber(phone) {
  if (!phone) return null;

  phone = phone.trim();

  if (phone.startsWith("94")) return phone;

  if (phone.startsWith("0")) return "94" + phone.slice(1);

  return phone;
}

async function sendSMS(to, message) {
  try {
    const formattedNumber = formatPhoneNumber(to);

    if (!formattedNumber) {
      console.warn("⚠️ Invalid phone number:", to);
      return false;
    }

    const response = await axios.get(SMS_API_URL, {
      params: {
        username: SMS_USERNAME,
        password: SMS_PASSWORD,
        src: SMS_SENDER_ID,
        dst: formattedNumber,
        msg: message,
        dr: 1,
      },
    });

    return response.data;
  } catch (error) {
    console.error("❌ SMS sending failed:", error.message);
    return null;
  }
}

module.exports = { sendSMS };
