const db = require('../config/db');

// Example function to get all users
exports.getAllUsers = (req, res) => {
    const query = 'SELECT * FROM user';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.status(500).json({ error: 'Database query error' });
        }
        res.json(results);
    });
};