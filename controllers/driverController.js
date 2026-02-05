const db = require('../config/db');
const { sendSMS } = require('../services/smsService');


function capitalizeFirstLetter(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}


exports.getDriverCount = (req, res) => {
    const query = 'SELECT COUNT(*) as totalDrivers FROM driver';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching driver counts:', err);
            return res.status(500).json({ error: 'Database error fetching driver count' });
        }

        const data = results[0];

        res.status(200).json({
            totalDrivers: data.totalDrivers || 0
        });
    });
};


exports.getDrivers = async (req, res) => {
    // Query joins 'driver' and 'driver_license' to get the expiry date
    // Filters strictly for is_blacklisted = '0'
    const query = `
        SELECT 
            d.driver_id, 
            d.name, 
            d.is_available,
            dl.expiry_date 
        FROM driver d
        LEFT JOIN driver_license dl ON d.license_number = dl.licen_number
        WHERE d.is_blacklisted = '0'
    `;

    try {
        const [results] = await db.promise().query(query);
        res.status(200).json(results);
    } catch (err) {
        console.error("Error fetching drivers:", err);
        res.status(500).json({ message: "Database error fetching drivers" });
    }
};


exports.addToBlacklist = async (req, res) => {
    const { driverId } = req.body;

    if (!driverId) {
        return res.status(400).json({ message: "Driver ID is required" });
    }

    const connection = db.promise();

    try {
        // 1. Update Blacklist Status
        const updateQuery = "UPDATE driver SET is_blacklisted = '1' WHERE driver_id = ?";
        const [updateResult] = await connection.query(updateQuery, [driverId]);

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ message: "Driver not found" });
        }

        // 2. Fetch Driver Details for SMS
        const driverQuery = "SELECT contact, name FROM driver WHERE driver_id = ?";
        const [driverRows] = await connection.query(driverQuery, [driverId]);

        if (driverRows.length > 0) {
            const { contact, name } = driverRows[0];
            const message = `Dear ${capitalizeFirstLetter(name)}, You have been added to the blacklist. Please contact City Lion Express Tours for more information.`;

            // 3. Send SMS
            await sendSMS(contact, message);
        } else {
            console.warn("Driver contact not found for SMS.");
        }

        res.status(200).json({ message: "Driver has been added to the blacklist successfully." });

    } catch (err) {
        console.error("Error blacklisting driver:", err);
        res.status(500).json({ message: "Database error processing request" });
    }
};