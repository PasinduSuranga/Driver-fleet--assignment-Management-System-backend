const db = require('../config/db');

exports.getAllOwners = (req, res) => {
    const query = "SELECT owner_id, name, contact FROM owner ORDER BY name ASC";
    db.query(query, (err, result) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(result);
    });
};


exports.addOwner = (req, res) => {
    const { owner_id, name, contact } = req.body;

    if (!owner_id || !name || !contact) {
        return res.status(400).json({ message: "All fields are required" });
    }

    // Check for ID Duplication
    const checkQuery = "SELECT owner_id FROM owner WHERE owner_id = ?";
    db.query(checkQuery, [owner_id], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error checking owner" });
        
        if (result.length > 0) {
            return res.status(409).json({ message: "Owner ID already exists" });
        }

        const insertQuery = "INSERT INTO owner (owner_id, name, contact) VALUES (?, ?, ?)";
        db.query(insertQuery, [owner_id, name, contact], (err, result) => {
            if (err) return res.status(500).json({ message: "Failed to add owner" });
            res.status(201).json({ message: "Owner added successfully", owner_id, name });
        });
    });
};