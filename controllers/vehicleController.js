const db = require('../config/db');

exports.getVehicleCount = (req, res) => {
    const query = `
        SELECT 
            COUNT(*) as totalVehicles,
            SUM(CASE WHEN vehicle_type = 'OwnFleet' THEN 1 ELSE 0 END) as ownFleetVehicles,
            SUM(CASE WHEN vehicle_type = 'OutSource' THEN 1 ELSE 0 END) as outSourceVehicles
        FROM vehicle
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching vehicle counts:', err);
            return res.status(500).json({ error: 'Database error fetching counts' });
        }
        
        const data = results[0];
        
        res.status(200).json({
            totalVehicles: data.totalVehicles || 0,
            ownFleetVehicles: Number(data.ownFleetVehicles) || 0,
            outSourceVehicles: Number(data.outSourceVehicles) || 0
        });
    });
};


exports.getVehicles = (req, res) => {
    const query = `
        SELECT 
            v.vehicle_number, 
            v.vehicle_type, 
            v.availability, 
            v.vehicle_photo,
            v.category_id,
            c.category_name,
            d.license_expiry_date,
            d.insurance_expiry_date
        FROM vehicle v
        LEFT JOIN vehicle_category c ON v.category_id = c.category_id
        LEFT JOIN vehicle_documents d ON v.document_id = d.documnet_id
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching vehicles:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
};