const db = require('../config/db');

exports.getCategories = (req, res) => {
    const query = "SELECT * FROM vehicle_category";
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching categories:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
};

// --- 3. ADD NEW CATEGORY ---
exports.addCategory = (req, res) => {
    const { category_name } = req.body;

    if (!category_name) {
        return res.status(400).json({ message: "Category name is required" });
    }

    // Generate Random Category ID (e.g., CAT-12345)
    const randomId = Math.floor(10000 + Math.random() * 90000);
    const category_id = `CAT-${randomId}`;

    const query = "INSERT INTO vehicle_category (category_id, category_name) VALUES (?, ?)";

    db.query(query, [category_id, category_name], (err, result) => {
        if (err) {
            console.error("Error adding category:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.status(201).json({ message: "Category added successfully", category_id, category_name });
    });
};