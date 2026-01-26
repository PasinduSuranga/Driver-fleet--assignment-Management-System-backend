const db = require('../config/db');

exports.getAssignmentCount = (req, res) => {
    const query = `
    SELECT COUNT(*) as totalAssignments,
            SUM(CASE WHEN status = '1' THEN 1 ELSE 0 END) as ongoingAssignments,
            SUM(CASE WHEN MONTH(start_date) = MONTH(CURDATE()) AND YEAR(start_date) = YEAR(CURDATE())
            THEN 1 
            ELSE 0 
        END
    ) AS totalAssignmentsThisMonth
        FROM assignment`;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching assignment counts:', err);
            return res.status(500).json({ error: 'Database error fetching counts' });
        }
        const data = results[0];

        res.status(200).json({
            totalAssignments: data.totalAssignments || 0,
            ongoingAssignments: Number(data.ongoingAssignments) || 0,
            totalAssignmentsThisMonth: Number(data.totalAssignmentsThisMonth) || 0
        });
    });
};  