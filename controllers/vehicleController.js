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