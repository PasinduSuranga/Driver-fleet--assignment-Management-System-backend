const db = require('../config/db'); // Adjust path to your database config

exports.getDashboardReports = async (req, res) => {
    const { month, fleetType } = req.query;

    // Filters setup
    const monthFilter = month ? month : ''; // e.g., '2026-04' or empty for all-time
    const fleetFilter = fleetType ? fleetType : ''; // e.g., 'Own Fleet', 'Out Source' or empty

    try {
        const dbPromise = db.promise();

        // 1. Gross Margin
        const marginQuery = `
            SELECT 
                SUM(a.company_payment) as total_revenue, 
                SUM(a.driver_payment) as total_payout, 
                SUM(a.company_payment - a.driver_payment) as gross_margin 
            FROM assignment a 
            JOIN vehicle v ON a.vehicle_number = v.vehicle_number 
            WHERE a.status = 'completed' 
            AND (? = '' OR DATE_FORMAT(a.est_e_TD, '%Y-%m') = ?) 
            AND (? = '' OR v.vehicle_type = ?)
        `;
        const [marginResult] = await dbPromise.query(marginQuery, [monthFilter, monthFilter, fleetFilter, fleetFilter]);

        // 2. Customer Billing Summary
        const customerQuery = `
            SELECT 
                c.company_name, 
                SUM(a.company_payment) as total_billed,
                COUNT(a.assignment_id) as total_trips
            FROM assignment a 
            JOIN customer c ON a.customer_id = c.customer_id 
            JOIN vehicle v ON a.vehicle_number = v.vehicle_number 
            WHERE a.status = 'completed' 
            AND (? = '' OR DATE_FORMAT(a.est_e_TD, '%Y-%m') = ?) 
            AND (? = '' OR v.vehicle_type = ?) 
            GROUP BY c.customer_id, c.company_name 
            ORDER BY total_billed DESC
        `;
        const [customerResult] = await dbPromise.query(customerQuery, [monthFilter, monthFilter, fleetFilter, fleetFilter]);

        // 3. Driver Earnings & Mileage
        const driverQuery = `
            SELECT 
                d.name as driver_name, 
                SUM(a.driver_payment) as total_earnings, 
                SUM(a.totalKMS) as total_kms,
                COUNT(a.assignment_id) as total_trips
            FROM assignment a 
            JOIN driver d ON a.driver_id = d.driver_id 
            JOIN vehicle v ON a.vehicle_number = v.vehicle_number 
            WHERE a.status = 'completed' 
            AND (? = '' OR DATE_FORMAT(a.est_e_TD, '%Y-%m') = ?) 
            AND (? = '' OR v.vehicle_type = ?) 
            GROUP BY d.driver_id, d.name 
            ORDER BY total_earnings DESC
        `;
        const [driverResult] = await dbPromise.query(driverQuery, [monthFilter, monthFilter, fleetFilter, fleetFilter]);

        // 4. Vehicle Mileage
        const vehicleQuery = `
            SELECT 
                a.vehicle_number, 
                v.vehicle_type,
                SUM(a.totalKMS) as total_kms,
                COUNT(a.assignment_id) as total_trips
            FROM assignment a 
            JOIN vehicle v ON a.vehicle_number = v.vehicle_number 
            WHERE a.status = 'completed' 
            AND (? = '' OR DATE_FORMAT(a.est_e_TD, '%Y-%m') = ?) 
            AND (? = '' OR v.vehicle_type = ?) 
            GROUP BY a.vehicle_number, v.vehicle_type
            ORDER BY total_kms DESC
        `;
        const [vehicleResult] = await dbPromise.query(vehicleQuery, [monthFilter, monthFilter, fleetFilter, fleetFilter]);

        // 5. Route Frequency
        const routeQuery = `
            SELECT 
                start_location, 
                end_location, 
                COUNT(*) as trip_count 
            FROM assignment a 
            JOIN vehicle v ON a.vehicle_number = v.vehicle_number 
            WHERE a.status = 'completed' 
            AND (? = '' OR DATE_FORMAT(a.est_e_TD, '%Y-%m') = ?) 
            AND (? = '' OR v.vehicle_type = ?) 
            GROUP BY start_location, end_location 
            ORDER BY trip_count DESC 
            LIMIT 15
        `;
        const [routeResult] = await dbPromise.query(routeQuery, [monthFilter, monthFilter, fleetFilter, fleetFilter]);

        // 6. Cancelled Trips Log
        const cancelledQuery = `
            SELECT 
                a.assignment_id, a.est_s_TD, a.start_location, a.end_location, 
                c.company_name, d.name as driver_name, a.vehicle_number, v.vehicle_type
            FROM assignment a 
            LEFT JOIN customer c ON a.customer_id = c.customer_id 
            LEFT JOIN driver d ON a.driver_id = d.driver_id 
            JOIN vehicle v ON a.vehicle_number = v.vehicle_number 
            WHERE a.status = 'cancelled' 
            AND (? = '' OR DATE_FORMAT(a.est_s_TD, '%Y-%m') = ?) 
            AND (? = '' OR v.vehicle_type = ?) 
            ORDER BY a.est_s_TD DESC
        `;
        const [cancelledResult] = await dbPromise.query(cancelledQuery, [monthFilter, monthFilter, fleetFilter, fleetFilter]);

        // 7. Blacklist Logs (Unaffected by date/fleet type - shows current global state)
        const [blacklistedVehicles] = await dbPromise.query(`SELECT vehicle_number, vehicle_type FROM vehicle WHERE is_blacklisted = '1'`);
        const [blacklistedDrivers] = await dbPromise.query(`SELECT driver_id, name, contact FROM driver WHERE is_blacklisted = '1'`);
        const [blacklistedUsers] = await dbPromise.query(`SELECT user_id, name, email, role FROM user WHERE is_approved = 3`); // 3 indicates blacklisted

        res.status(200).json({
            grossMargin: marginResult[0] || { total_revenue: 0, total_payout: 0, gross_margin: 0 },
            customerBilling: customerResult,
            driverEarnings: driverResult,
            vehicleMileage: vehicleResult,
            routeFrequency: routeResult,
            cancelledTrips: cancelledResult,
            blacklists: {
                vehicles: blacklistedVehicles,
                drivers: blacklistedDrivers,
                users: blacklistedUsers
            }
        });

    } catch (error) {
        console.error("Error generating reports:", error);
        res.status(500).json({ error: "Internal Server Error while generating reports." });
    }
};

exports.getDashboardStats = async (req, res) => {
    try {
        const dbPromise = db.promise();

        // 1. Ongoing Assignments (Live Pulse)
        const [[{ ongoingCount }]] = await dbPromise.query(`SELECT COUNT(*) AS ongoingCount FROM assignment WHERE status = 'ongoing'`);

        // 2. Fleet Status (Total & Blacklisted)
        const [[{ totalVehicles }]] = await dbPromise.query(`SELECT COUNT(*) AS totalVehicles FROM vehicle`);
        const [[{ blacklistedVehicles }]] = await dbPromise.query(`SELECT COUNT(*) AS blacklistedVehicles FROM vehicle WHERE is_blacklisted = '1'`);

        // 3. Driver Status (Total & Blacklisted)
        const [[{ totalDrivers }]] = await dbPromise.query(`SELECT COUNT(*) AS totalDrivers FROM driver`);
        const [[{ blacklistedDrivers }]] = await dbPromise.query(`SELECT COUNT(*) AS blacklistedDrivers FROM driver WHERE is_blacklisted = '1'`);

        // 4. Pending User Approvals
        const [[{ pendingUsers }]] = await dbPromise.query(`SELECT COUNT(*) AS pendingUsers FROM user WHERE is_approved = 0`);

        // 5. Today's Active Dispatch (Latest 5 ongoing trips for the mini-table)
        // UPDATED: Joined with customer and driver tables to get company_name and driver_name
        const [activeDispatch] = await dbPromise.query(`
            SELECT 
                a.assignment_id, 
                a.est_s_TD, 
                c.company_name, 
                d.name AS driver_name, 
                a.vehicle_number, 
                a.start_location, 
                a.end_location 
            FROM assignment a
            LEFT JOIN customer c ON a.customer_id = c.customer_id
            LEFT JOIN driver d ON a.driver_id = d.driver_id
            WHERE a.status = 'ongoing' 
            ORDER BY a.est_s_TD DESC 
            LIMIT 5
        `);

        // Calculate rough availability (Total - Blacklisted - Currently on a trip)
        const availableVehicles = totalVehicles - blacklistedVehicles - ongoingCount;
        const availableDrivers = totalDrivers - blacklistedDrivers - ongoingCount;

        res.status(200).json({
            ongoingCount,
            totalVehicles,
            availableVehicles: availableVehicles > 0 ? availableVehicles : 0,
            blacklistedVehicles,
            totalDrivers,
            availableDrivers: availableDrivers > 0 ? availableDrivers : 0,
            blacklistedDrivers,
            pendingUsers,
            activeDispatch
        });

    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        res.status(500).json({ error: "Internal Server Error while fetching dashboard statistics." });
    }
};