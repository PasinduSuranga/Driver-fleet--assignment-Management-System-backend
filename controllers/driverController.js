const db = require('../config/db');

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