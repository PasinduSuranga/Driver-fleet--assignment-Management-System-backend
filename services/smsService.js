// Import axios for making HTTP requests
const axios = require("axios");

// SMS API configuration credentials
const SMS_API_URL = "https://sms.textware.lk:5001/sms/send_sms.php";
const SMS_USERNAME = "city_lion";   
const SMS_PASSWORD = "vP7l44gZ8OpN";  
const SMS_SENDER_ID = "CLE_Tours";

// Formats phone numbers to match the Sri Lankan 94xxxxxxxxx standard
function formatPhoneNumber(phone) {
  // Return null if no phone number is provided
  if (!phone) return null;

  // Remove leading and trailing spaces
  phone = phone.trim();

  // If already starts with 94, it's good to go
  if (phone.startsWith("94")) return phone;

  // If starts with 0 (e.g., 071...), replace 0 with 94
  if (phone.startsWith("0")) return "94" + phone.slice(1);

  // Return the processed phone number
  return phone;
}

// Sends an SMS via the Textware API
async function sendSMS(to, message) {
  try {
    // Format the recipient phone number
    const formattedNumber = formatPhoneNumber(to);

    // Check if the formatted number is valid
    if (!formattedNumber) {
      console.warn("⚠️ Invalid phone number:", to);
      return false;
    }

    // Send HTTP GET request to the SMS API
    const response = await axios.get(SMS_API_URL, {
      params: {
        username: SMS_USERNAME, // API username
        password: SMS_PASSWORD, // API password
        src: SMS_SENDER_ID,     // Sender ID
        dst: formattedNumber,   // Destination number
        msg: message,           // Message content
        dr: 1,                  // Delivery report request
      },
    });

    // Return the response data on success
    return response.data;
  } catch (error) {
    // Log the error if the SMS sending fails
    console.error("❌ SMS sending failed:", error.message);
    return null;
  }
}

// Export the sendSMS function for use in other modules
module.exports = { sendSMS };
