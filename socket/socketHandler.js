const db = require('../config/db');

// Helper function to fetch counts from DB
const fetchCounts = () => { // Removed 'async' as we return a Promise directly
    return new Promise((resolve, reject) => {
        const vehicleQuery = `
            SELECT 
                COUNT(*) as totalVehicles,
                SUM(CASE WHEN vehicle_type = 'OwnFleet' THEN 1 ELSE 0 END) as ownFleetVehicles,
                SUM(CASE WHEN vehicle_type = 'OutSource' THEN 1 ELSE 0 END) as outSourceVehicles
            FROM vehicle
        `;

        const driverQuery = `SELECT COUNT(*) as totalDrivers FROM driver`;

        const assignmentQuery = `
            SELECT 
                COUNT(*) as totalAssignments,
                SUM(CASE WHEN status = '1' THEN 1 ELSE 0 END) as ongoingAssignments,
                SUM(CASE WHEN MONTH(start_date) = MONTH(CURDATE()) AND YEAR(start_date) = YEAR(CURDATE()) THEN 1 ELSE 0 END) as totalAssignmentsThisMonth
            FROM assignment
        `;

        // Run all queries in parallel for better performance
        // We wrap db.query in small Promises to use Promise.all
        const p1 = new Promise((res, rej) => db.query(vehicleQuery, (err, data) => err ? rej(err) : res(data)));
        const p2 = new Promise((res, rej) => db.query(driverQuery, (err, data) => err ? rej(err) : res(data)));
        const p3 = new Promise((res, rej) => db.query(assignmentQuery, (err, data) => err ? rej(err) : res(data)));

        Promise.all([p1, p2, p3])
            .then(([vehicleRes, driverRes, assignmentRes]) => {
                resolve({
                    vehicleCounts: {
                        totalVehicles: vehicleRes[0]?.totalVehicles || 0,
                        ownFleetVehicles: Number(vehicleRes[0]?.ownFleetVehicles) || 0,
                        outSourceVehicles: Number(vehicleRes[0]?.outSourceVehicles) || 0
                    },
                    driverCounts: {
                        totalDrivers: driverRes[0]?.totalDrivers || 0
                    },
                    assignmentCounts: {
                        totalAssignments: assignmentRes[0]?.totalAssignments || 0,
                        ongoingAssignments: Number(assignmentRes[0]?.ongoingAssignments) || 0,
                        totalAssignmentsThisMonth: Number(assignmentRes[0]?.totalAssignmentsThisMonth) || 0
                    }
                });
            })
            .catch(err => reject(err));
    });
};

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('Client connected to socket');
        
        fetchCounts()
            .then(data => socket.emit("updateCounts", data))
            .catch(err => console.error("Error sending initial data:", err));
    });

    setInterval(() => {
        fetchCounts()
            .then(data => io.emit("updateCounts", data))
            .catch(err => console.error("Error broadcasting updates:", err));
    }, 5000);
};