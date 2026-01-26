const db = require('../config/db'); // Ensure this path is correct
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc);

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
      if(io) {
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

module.exports = { getExpiryNotifications };