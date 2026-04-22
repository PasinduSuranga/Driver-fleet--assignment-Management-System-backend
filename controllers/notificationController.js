const db = require('../config/db'); // Ensure this path is correct
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc);
const { sendSMS } = require('../services/smsService');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Calculates and retrieves upcoming expiration notifications for vehicles and drivers.
 * Broadcasts the alerts via Socket.io to connected clients.
 */
const getExpiryNotifications = async (req, res) => {
  try {
    // 1. Get Socket.io instance
    const io = req.app.get("socketio");

    const today = dayjs().utc().startOf("day");
    const daysList = [14, 7, 3, 1, 0];

    const vehicleAlertsMap = {};
    const driverAlertsMap = {};

    // ---------------------------------------------------------
    // 1. FETCH VEHICLES (JOIN with vehicle_documents Table)
    // ---------------------------------------------------------
    const vehicles = await new Promise((resolve, reject) => {
      // UPDATED QUERY: 
      // 1. Changed table name to 'vehicle_documents' (based on your logs)
      // 2. Changed JOIN to 'd.id' (assuming 'id' is the primary key of vehicle_documents)
      // 3. Updated column names to match your schema error log
      const query = `
            SELECT 
                v.vehicle_number, 
                d.license_expiry_date, 
                d.insurance_expiry_date 
            FROM vehicle v
            LEFT JOIN vehicle_documents d ON v.document_id = d.documnet_id
        `;
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    // ---------------------------------------------------------
    // 2. PROCESS VEHICLES
    // ---------------------------------------------------------
    for (let days of daysList) {
      const targetDate = today.add(days, "day");
      const startOfDay = targetDate.startOf("day").toDate();
      const endOfDay = targetDate.endOf("day").toDate();

      for (const vehicle of vehicles) {
        let key = `${vehicle.vehicle_number}-${days}`;

        // Check License Expiry
        if (
          vehicle.license_expiry_date && // Check if date exists
          vehicle.license_expiry_date >= startOfDay &&
          vehicle.license_expiry_date <= endOfDay
        ) {
          if (!vehicleAlertsMap[key]) {
            vehicleAlertsMap[key] = {
              registrationNumber: vehicle.vehicle_number,
              daysLeft: days,
              types: [],
            };
          }
          vehicleAlertsMap[key].types.push("License");
        }

        // Check Insurance Expiry
        if (
          vehicle.insurance_expiry_date && // Check if date exists
          vehicle.insurance_expiry_date >= startOfDay &&
          vehicle.insurance_expiry_date <= endOfDay
        ) {
          if (!vehicleAlertsMap[key]) {
            vehicleAlertsMap[key] = {
              registrationNumber: vehicle.vehicle_number,
              daysLeft: days,
              types: [],
            };
          }
          vehicleAlertsMap[key].types.push("Insurance");
        }
      }
    }

    // Check Expired Vehicles (Already Past Date)
    for (const vehicle of vehicles) {
      let key = `${vehicle.vehicle_number}-expired`;

      if (vehicle.license_expiry_date && new Date(vehicle.license_expiry_date) < today.toDate()) {
        if (!vehicleAlertsMap[key]) {
          vehicleAlertsMap[key] = {
            registrationNumber: vehicle.vehicle_number,
            daysLeft: -1,
            types: [],
          };
        }
        vehicleAlertsMap[key].types.push("License");
      }

      if (vehicle.insurance_expiry_date && new Date(vehicle.insurance_expiry_date) < today.toDate()) {
        if (!vehicleAlertsMap[key]) {
          vehicleAlertsMap[key] = {
            registrationNumber: vehicle.vehicle_number,
            daysLeft: -1,
            types: [],
          };
        }
        vehicleAlertsMap[key].types.push("Insurance");
      }
    }

    // ---------------------------------------------------------
    // 3. FETCH DRIVERS (JOIN with driver_license Table)
    // ---------------------------------------------------------
    const drivers = await new Promise((resolve, reject) => {
      // JOIN condition: Matches driver.license_number with driver_license.licen_number
      const query = `
            SELECT 
                d.name, 
                dl.expiry_date 
            FROM driver d
            LEFT JOIN driver_license dl ON d.license_number = dl.licen_number
        `;
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    // ---------------------------------------------------------
    // 4. PROCESS DRIVERS
    // ---------------------------------------------------------
    for (let days of daysList) {
      const targetDate = today.add(days, "day");
      const startOfDay = targetDate.startOf("day").toDate();
      const endOfDay = targetDate.endOf("day").toDate();

      for (const driver of drivers) {
        let key = `${driver.name}-${days}`;

        if (
          driver.expiry_date &&
          driver.expiry_date >= startOfDay &&
          driver.expiry_date <= endOfDay
        ) {
          if (!driverAlertsMap[key]) {
            driverAlertsMap[key] = {
              driverName: driver.name,
              daysLeft: days,
              types: [],
            };
          }
          driverAlertsMap[key].types.push("License");
        }
      }
    }

    // Check Expired Drivers
    for (const driver of drivers) {
      let key = `${driver.name}-expired`;

      if (driver.expiry_date && new Date(driver.expiry_date) < today.toDate()) {
        if (!driverAlertsMap[key]) {
          driverAlertsMap[key] = {
            driverName: driver.name,
            daysLeft: -1,
            types: [],
          };
        }
        driverAlertsMap[key].types.push("License");
      }
    }

    // ---------------------------------------------------------
    // 5. SEND NOTIFICATIONS
    // ---------------------------------------------------------
    if (
      Object.keys(vehicleAlertsMap).length > 0 ||
      Object.keys(driverAlertsMap).length > 0
    ) {
      if (io) {
        io.emit("expiryUpdate", {
          vehicleAlerts: Object.values(vehicleAlertsMap),
          driverAlerts: Object.values(driverAlertsMap),
        });
      }
    }

    res.status(200).json({
      message: "✅ Expiry notifications generated successfully.",
      vehicleAlerts: Object.values(vehicleAlertsMap),
      driverAlerts: Object.values(driverAlertsMap),
    });

  } catch (error) {
    console.error("❌ Error generating expiry notifications:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Fetches all vehicle and driver expiration notifications.
 * Sorts them by urgency (expired first, then nearest expiry).
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllNotifications = async (req, res) => {
  try {
    const today = dayjs().utc().startOf("day");
    const allowedDays = [14, 7, 3, 1, 0];
    const notifications = [];

    // 1. Check Vehicles
    const vQuery = `
            SELECT v.vehicle_number, d.license_expiry_date, d.insurance_expiry_date 
            FROM vehicle v
            LEFT JOIN vehicle_documents d ON v.document_id = d.documnet_id
        `;
    const [vehicles] = await db.promise().query(vQuery);

    vehicles.forEach(v => {
      const checkDate = (dateStr, type) => {
        if (!dateStr) return;
        const expDate = dayjs(dateStr).utc().startOf("day");
        const diffDays = expDate.diff(today, 'day');

        if (diffDays < 0) {
          notifications.push({
            id: `v-${v.vehicle_number}-${type}`,
            type: 'Vehicle',
            entity: v.vehicle_number,
            docType: type,
            daysLeft: -1,
            status: 'Expired',
            date: expDate.format('YYYY-MM-DD')
          });
        } else if (allowedDays.includes(diffDays)) {
          notifications.push({
            id: `v-${v.vehicle_number}-${type}`,
            type: 'Vehicle',
            entity: v.vehicle_number,
            docType: type,
            daysLeft: diffDays,
            status: diffDays === 0 ? 'Expiring Today' : `Expiring in ${diffDays} days`,
            date: expDate.format('YYYY-MM-DD')
          });
        }
      };
      checkDate(v.license_expiry_date, 'License');
      checkDate(v.insurance_expiry_date, 'Insurance');
    });

    // 2. Check Drivers
    const dQuery = `
            SELECT d.name, dl.expiry_date 
            FROM driver d
            LEFT JOIN driver_license dl ON d.license_number = dl.licen_number
        `;
    const [drivers] = await db.promise().query(dQuery);

    drivers.forEach(d => {
      if (!d.expiry_date) return;
      const expDate = dayjs(d.expiry_date).utc().startOf("day");
      const diffDays = expDate.diff(today, 'day');

      if (diffDays < 0) {
        notifications.push({
          id: `d-${d.name}-license`,
          type: 'Driver',
          entity: d.name,
          docType: 'License',
          daysLeft: -1,
          status: 'Expired',
          date: expDate.format('YYYY-MM-DD')
        });
      } else if (allowedDays.includes(diffDays)) {
        notifications.push({
          id: `d-${d.name}-license`,
          type: 'Driver',
          entity: d.name,
          docType: 'License',
          daysLeft: diffDays,
          status: diffDays === 0 ? 'Expiring Today' : `Expiring in ${diffDays} days`,
          date: expDate.format('YYYY-MM-DD')
        });
      }
    });

    // Sort notifications: Most urgent (Expired) first, then 0, 1, 3, 7, 14
    notifications.sort((a, b) => a.daysLeft - b.daysLeft);

    res.status(200).json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications." });
  }
};

/**
 * Checks for expirations and dispatches automated SMS alerts to owners/drivers.
 * Also compiles a daily summary report and emails it to all system admins.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const sendExpiryAlerts = async (req, res) => {
  try {
    const today = dayjs().utc().startOf("day");
    const allowedDays = [14, 7, 3, 1, 0];

    const vehicleAlerts = {};
    const driverAlerts = {};
    let emailContent = `<h2>Daily Expiry Alert Report</h2>`;
    let hasAlerts = false;

    // ---------------------------------------------------------
    // 1. FETCH & PROCESS VEHICLES (JOIN with owner for contact info)
    // ---------------------------------------------------------
    const vQuery = `
            SELECT 
                v.vehicle_number, 
                d.license_expiry_date, 
                d.insurance_expiry_date,
                o.contact AS owner_contact,
                o.name AS owner_name
            FROM vehicle v
            LEFT JOIN vehicle_documents d ON v.document_id = d.documnet_id
            LEFT JOIN owner o ON v.owner_id = o.owner_id
        `;
    const [vehicles] = await db.promise().query(vQuery);

    vehicles.forEach(v => {
      const vehicleMessages = [];
      const checkDate = (dateStr, type) => {
        if (!dateStr) return;
        const expDate = dayjs(dateStr).utc().startOf("day");
        const diffDays = expDate.diff(today, 'day');

        if (diffDays < 0) {
          vehicleMessages.push(`${type} is Expired`);
        } else if (allowedDays.includes(diffDays)) {
          vehicleMessages.push(`${type} expires in ${diffDays} day(s)`);
        }
      };

      checkDate(v.license_expiry_date, 'License');
      checkDate(v.insurance_expiry_date, 'Insurance');

      if (vehicleMessages.length > 0) {
        hasAlerts = true;
        vehicleAlerts[v.vehicle_number] = {
          ownerContact: v.owner_contact,
          ownerName: v.owner_name,
          messages: vehicleMessages
        };
      }
    });

    // ---------------------------------------------------------
    // 2. FETCH & PROCESS DRIVERS
    // ---------------------------------------------------------
    const dQuery = `
            SELECT 
                d.name, 
                d.contact, 
                dl.expiry_date 
            FROM driver d
            LEFT JOIN driver_license dl ON d.license_number = dl.licen_number
        `;
    const [drivers] = await db.promise().query(dQuery);

    drivers.forEach(d => {
      if (!d.expiry_date) return;
      const expDate = dayjs(d.expiry_date).utc().startOf("day");
      const diffDays = expDate.diff(today, 'day');

      let message = null;
      if (diffDays < 0) {
        message = `License is Expired`;
      } else if (allowedDays.includes(diffDays)) {
        message = `License expires in ${diffDays} day(s)`;
      }

      if (message) {
        hasAlerts = true;
        driverAlerts[d.name] = {
          contact: d.contact,
          message: message
        };
      }
    });

    // ---------------------------------------------------------
    // 3. SEND SMS & BUILD EMAIL CONTENT
    // ---------------------------------------------------------
    emailContent += `<h3>Vehicle Alerts</h3><ul>`;

    for (const [vehicleNum, data] of Object.entries(vehicleAlerts)) {
      const combinedMessage = `City Lion Tours Alert: Vehicle ${vehicleNum} - ${data.messages.join(' AND ')}. Please renew immediately.`;

      // Add to Email
      emailContent += `<li><strong>Vehicle ${vehicleNum}</strong> (Owner: ${data.ownerName}): ${data.messages.join(' & ')}</li>`;

      // Send SMS
      if (data.ownerContact) {
        await sendSMS(data.ownerContact, combinedMessage);
      }
    }
    if (Object.keys(vehicleAlerts).length === 0) emailContent += `<li>No vehicle alerts today.</li>`;
    emailContent += `</ul>`;

    emailContent += `<h3>Driver Alerts</h3><ul>`;

    for (const [driverName, data] of Object.entries(driverAlerts)) {
      const smsMessage = `City Lion Tours Alert: Driver ${driverName} - ${data.message}. Please renew immediately.`;

      // Add to Email
      emailContent += `<li><strong>Driver ${driverName}</strong>: ${data.message}</li>`;

      // Send SMS
      if (data.contact) {
        await sendSMS(data.contact, smsMessage);
      }
    }
    if (Object.keys(driverAlerts).length === 0) emailContent += `<li>No driver alerts today.</li>`;
    emailContent += `</ul>`;

    // ---------------------------------------------------------
    // 4. SEND EMAIL TO ADMINS
    // ---------------------------------------------------------
    if (hasAlerts) {
      // Fetch all approved admins
      const [admins] = await db.promise().query(`SELECT email FROM user WHERE role = 'admin' AND is_approved = 1`);

      const adminEmails = admins.map(a => a.email).join(',');

      if (adminEmails) {
        const mailOptions = {
          from: `"City Lion Express Tours" <${process.env.EMAIL_USER}>`,
          to: adminEmails,
          subject: 'Daily Fleet Expiry Alerts - Action Required',
          html: emailContent,
        };

        transporter.sendMail(mailOptions, (err, info) => {
          if (err) console.error('Error sending admin alert email:', err);
          else console.log('Admin alert email sent:', info.response);
        });
      }
    }

    res.status(200).json({
      message: "Expiry alerts processed successfully. SMS and Emails dispatched.",
      vehiclesAlerted: Object.keys(vehicleAlerts).length,
      driversAlerted: Object.keys(driverAlerts).length
    });

  } catch (error) {
    console.error("Error processing expiry alerts:", error);
    res.status(500).json({ error: "Failed to process and send expiry alerts." });
  }
};

module.exports = { getExpiryNotifications, getAllNotifications, sendExpiryAlerts };