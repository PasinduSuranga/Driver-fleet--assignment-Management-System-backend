const db = require('../config/db');

/**
 * Retrieves all users from the database for testing purposes.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
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