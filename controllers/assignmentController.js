const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// Validation Helper
const validateCustomer = (data) => {
    const { company_name, contact, address, company_rate_per_km, driver_rate_per_km } = data;

    if (!company_name || company_name.length > 100) return "Name must be between 1 and 100 characters.";
    if (!address || address.length > 250) return "Address must be between 1 and 250 characters.";

    // validation for Sri Lankan numbers
    const phoneRegex = /^(0\d{9}|\+94\d{9})$/;
    if (!contact || !phoneRegex.test(contact)) return "Contact must be 10 digits starting with 0, or 12 characters starting with +94.";

    // Validate rates are valid numbers
    if (isNaN(company_rate_per_km) || isNaN(driver_rate_per_km)) return "Rates must be valid numbers.";

    return null; //no errors
};

/**
 * Retrieves a list of all customers, sorted alphabetically by company name.
 */
exports.getAllCustomers = async (req, res) => {
    try {
        const [rows] = await db.promise().query('SELECT * FROM customer ORDER BY company_name ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Database error while fetching customers." });
    }
};

/**
 * Creates a new customer record after validating the input data.
 */
exports.createCustomer = async (req, res) => {
    const validationError = validateCustomer(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const { company_name, contact, address, company_rate_per_km, driver_rate_per_km } = req.body;
    const customer_id = uuidv4();

    try {
        await db.promise().query(
            `INSERT INTO customer (customer_id, company_name, contact, address, company_rate, driver_rate) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [customer_id, company_name, contact, address, parseFloat(company_rate_per_km).toFixed(2), parseFloat(driver_rate_per_km).toFixed(2)]
        );
        res.status(201).json({ message: "Customer added successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to add customer." });
    }
};

/**
 * Updates an existing customer's details after validating the input data.
 */
exports.updateCustomer = async (req, res) => {
    const validationError = validateCustomer(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const { company_name, contact, address, company_rate_per_km, driver_rate_per_km } = req.body;
    const { id } = req.params;

    try {
        await db.promise().query(
            `UPDATE customer 
             SET company_name = ?, contact = ?, address = ?, company_rate = ?, driver_rate = ? 
             WHERE customer_id = ?`,
            [company_name, contact, address, parseFloat(company_rate_per_km).toFixed(2), parseFloat(driver_rate_per_km).toFixed(2), id]
        );
        res.json({ message: "Customer updated successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to update customer." });
    }
};

/**
 * Deletes a customer from the database. 
 */
exports.deleteCustomer = async (req, res) => {
    try {
        await db.promise().query('DELETE FROM customer WHERE customer_id = ?', [req.params.id]);
        res.json({ message: "Customer removed successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Cannot delete customer. They may have existing assignments." });
    }
};


// Assignment Validation
const validateAssignment = (data) => {
    const { customer_id, start_location, end_location, est_s_TD, est_e_TD, vehicle_number, driver_id } = data;

    if (!customer_id) return "Customer ID is missing.";
    if (!vehicle_number) return "Vehicle is required.";
    if (!driver_id) return "Driver is required.";
    if (!start_location || start_location.length > 100) return "Start location must be between 1 and 100 characters.";
    if (!end_location || end_location.length > 100) return "End location must be between 1 and 100 characters.";

    const start = new Date(est_s_TD);
    const end = new Date(est_e_TD);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "Invalid date and time format.";
    if (start >= end) return "Estimated end time must be after the start time.";

    return null;
};

/**
 * Retrieves available (non-blacklisted and not overlapping with the given time slot) 
 */
exports.getAvailableResources = async (req, res) => {
    const { est_s_TD, est_e_TD } = req.body;

    if (!est_s_TD || !est_e_TD) return res.status(400).json({ error: "Start and End times are required to check availability." });

    try {
        // Query available vehicles (Not blacklisted AND not in an overlapping assignment)
        const [vehicles] = await db.promise().query(
            `SELECT vehicle_number 
             FROM vehicle 
             WHERE (is_blacklisted = 0 OR is_blacklisted IS NULL)
             AND vehicle_number NOT IN (
                 SELECT vehicle_number FROM assignment 
                 WHERE est_s_TD < ? AND est_e_TD > ?
             )`,
            [est_e_TD, est_s_TD]
        );

        // Query available drivers (Not blacklisted AND not in an overlapping assignment)
        const [drivers] = await db.promise().query(
            `SELECT driver_id, name 
             FROM driver 
             WHERE (is_blacklisted = 0 OR is_blacklisted IS NULL)
             AND driver_id NOT IN (
                 SELECT driver_id FROM assignment 
                 WHERE est_s_TD < ? AND est_e_TD > ?
             )`,
            [est_e_TD, est_s_TD]
        );

        res.json({ vehicles, drivers });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Database error while fetching resources." });
    }
};

/**
 * Creates a new trip assignment. Validates inputs, checks for resource conflicts, 
 * fetches customer rates, and saves the assignment to the database.
 */
exports.createAssignment = async (req, res) => {
    const error = validateAssignment(req.body);
    if (error) return res.status(400).json({ error });

    const { customer_id, driver_id, vehicle_number, est_s_TD, est_e_TD, start_location, end_location } = req.body;
    const assignment_id = uuidv4();

    try {
        // Double check overlap just in case someone booked it while user was filling the form
        const [conflicts] = await db.promise().query(
            `SELECT assignment_id FROM assignment 
             WHERE (vehicle_number = ? OR driver_id = ?)
             AND (est_s_TD < ? AND est_e_TD > ?)`,
            [vehicle_number, driver_id, est_e_TD, est_s_TD]
        );

        if (conflicts.length > 0) {
            return res.status(400).json({ error: "The selected driver or vehicle was just booked for this time slot. Please select another." });
        }

        //Fetch the customer rates to save them in the assignment
        const [customerRates] = await db.promise().query(
            `SELECT company_rate, driver_rate FROM customer WHERE customer_id = ?`,
            [customer_id]
        );

        console.log("Customer Rates:", customerRates);

        if (customerRates.length === 0) return res.status(404).json({ error: "Customer not found." });

        const company_rate = customerRates[0].company_rate;
        const driver_rate = customerRates[0].driver_rate;

        console.log("Company Rate:", company_rate, "Driver Rate:", driver_rate);

        //Insert into assignment table
        await db.promise().query(
            `INSERT INTO assignment 
            (assignment_id, driver_id, vehicle_number, customer_id, est_s_TD, est_e_TD, start_location, end_location, company_rate, driver_rate) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [assignment_id, driver_id, vehicle_number, customer_id, est_s_TD, est_e_TD, start_location, end_location, company_rate, driver_rate]
        );

        res.status(201).json({ message: "Assignment created successfully!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create assignment." });
    }
};

/**
 * Retrieves a list of all ongoing assignments along with customer and driver details.
 */
exports.getOngoingAssignments = async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            `SELECT a.*, c.company_name, d.name as driver_name 
             FROM assignment a
             LEFT JOIN customer c ON a.customer_id = c.customer_id
             LEFT JOIN driver d ON a.driver_id = d.driver_id
             WHERE a.status = 'ongoing'
             ORDER BY a.est_s_TD ASC`
        );
        res.json(rows);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Failed to fetch ongoing assignments." });
    }
};

/**
 * Marks an ongoing assignment as completed and calculates final payments 
 * based on the provided total kilometers and applicable rates.
 */
exports.completeAssignment = async (req, res) => {
    const { id } = req.params;

    const totalKMS = parseFloat(req.body.totalKMS);

    if (!totalKMS || isNaN(totalKMS) || totalKMS <= 0) {
        return res.status(400).json({ error: "Please provide a valid total KMS." });
    }

    try {
        //Fetch the rates safely
        const [rows] = await db.promise().query(
            `SELECT a.company_rate, a.driver_rate, c.company_rate, c.driver_rate 
             FROM assignment a
             JOIN customer c ON a.customer_id = c.customer_id
             WHERE a.assignment_id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "Assignment not found." });
        }

        //Extract rates
        const compRate = rows[0].company_rate || rows[0].company_rate_per_km || 0;
        const drivRate = rows[0].driver_rate || rows[0].driver_rate_per_km || 0;

        //Do the math in JavaScript 
        const company_payment = (totalKMS * parseFloat(compRate)).toFixed(2);
        const driver_payment = (totalKMS * parseFloat(drivRate)).toFixed(2);

        //Update the database with the exact calculated values
        await db.promise().query(
            `UPDATE assignment 
             SET totalKMS = ?, 
                 company_payment = ?, 
                 driver_payment = ?, 
                 status = 'completed' 
             WHERE assignment_id = ? AND status = 'ongoing'`,
            [totalKMS, company_payment, driver_payment, id]
        );

        res.json({ message: "Trip marked as completed and payments calculated successfully!" });
    } catch (error) {
        // Logging the error
        console.error("Error in completeAssignment:", error);
        res.status(500).json({ error: "Failed to complete assignment." });
    }
};

/**
 * Retrieves a list of all completed assignments along with customer and driver details.
 */
exports.getCompletedAssignments = async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            `SELECT a.*, c.company_name, d.name as driver_name 
             FROM assignment a
             LEFT JOIN customer c ON a.customer_id = c.customer_id
             LEFT JOIN driver d ON a.driver_id = d.driver_id
             WHERE a.status = 'completed'
             ORDER BY a.est_e_TD DESC`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch completed assignments." });
    }
};

/**
 * Retrieves a list of all cancelled assignments along with customer and driver details.
 */
exports.getCancelledAssignments = async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            `SELECT a.*, c.company_name, d.name as driver_name 
             FROM assignment a
             LEFT JOIN customer c ON a.customer_id = c.customer_id
             LEFT JOIN driver d ON a.driver_id = d.driver_id
             WHERE a.status = 'cancelled'
             ORDER BY a.est_e_TD DESC`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch cancelled assignments." });
    }
};

/**
 * Generates financial reports (Total Customer Invoices and Total Driver Payroll) for a given month.
 */
exports.getMonthlyReports = async (req, res) => {
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: "Month parameter is required." });

    try {
        // Calculate Total Customer Invoices for the Month
        const [invoices] = await db.promise().query(
            `SELECT c.company_name, SUM(a.company_payment) as total_invoice
             FROM assignment a
             JOIN customer c ON a.customer_id = c.customer_id
             WHERE a.status = 'completed' AND DATE_FORMAT(a.est_e_TD, '%Y-%m') = ?
             GROUP BY c.customer_id`,
            [month]
        );

        // Calculate Total Driver Pay for the Month
        const [payroll] = await db.promise().query(
            `SELECT d.name as driver_name, SUM(a.driver_payment) as total_pay
             FROM assignment a
             JOIN driver d ON a.driver_id = d.driver_id
             WHERE a.status = 'completed' AND DATE_FORMAT(a.est_e_TD, '%Y-%m') = ?
             GROUP BY d.driver_id`,
            [month]
        );

        res.json({ invoices, payroll });
    } catch (error) {
        res.status(500).json({ error: "Failed to generate monthly reports." });
    }
};


/**
 * Retrieves comprehensive details for a specific assignment including 
 * associated vehicle, vehicle documents, driver, and driver license photos.
 */
exports.getAssignmentDocData = async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
            SELECT 
                a.assignment_id,
                v.vehicle_number, v.vehicle_photo,
                vd.license as vehicle_license_photo, vd.insurance as vehicle_insurance_photo,
                d.name as driver_name, d.contact as driver_contact,
                dl.front_photo as driver_license_front, dl.back_photo as driver_license_back
            FROM assignment a
            JOIN vehicle v ON a.vehicle_number = v.vehicle_number
            LEFT JOIN vehicle_documents vd ON v.document_id = vd.documnet_id
            JOIN driver d ON a.driver_id = d.driver_id
            LEFT JOIN driver_license dl ON d.license_number = dl.licen_number
            WHERE a.assignment_id = ?
        `;

        const [rows] = await db.promise().query(query, [id]);
        if (rows.length === 0) return res.status(404).json({ error: "Assignment details not found." });

        res.json(rows[0]);
    } catch (error) {
        console.error("Error generating doc data:", error);
        res.status(500).json({ error: "Failed to fetch document data." });
    }
};

/**
 * Proxies an image request to bypass CORS restrictions.
 */
exports.proxyImage = (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send('URL is required');

    const httpOrHttps = imageUrl.startsWith('https') ? require('https') : require('http');

    httpOrHttps.get(imageUrl, (response) => {
        if (response.statusCode !== 200) {
            return res.status(404).send('Image not found');
        }

        res.set('Access-Control-Allow-Origin', '*');
        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
        res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');

        // Stream the image directly to the frontend
        response.pipe(res);
    }).on('error', (err) => {
        console.error("Proxy error:", err);
        res.status(500).send('Error fetching image');
    });
};

/**
 * Retrieves detailed invoice data for a completed assignment.
 */
exports.getInvoiceData = async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT 
                a.assignment_id, a.est_s_TD, a.est_e_TD, 
                a.start_location, a.end_location, a.totalKMS, 
                a.company_rate, a.company_payment, 
                c.company_name, c.contact as customer_contact, c.address as customer_address,
                v.vehicle_number
            FROM assignment a
            JOIN customer c ON a.customer_id = c.customer_id
            JOIN vehicle v ON a.vehicle_number = v.vehicle_number
            WHERE a.assignment_id = ? AND a.status = 'completed'
        `;
        const [rows] = await db.promise().query(query, [id]);
        if (rows.length === 0) return res.status(404).json({ error: "Invoice details not found or trip is not yet completed." });
        res.json(rows[0]);
    } catch (error) {
        console.error("Error generating invoice data:", error);
        res.status(500).json({ error: "Failed to fetch invoice data." });
    }
};


exports.getMonthlyReports = async (req, res) => {
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: "Month parameter is required." });

    try {
        const [rows] = await db.promise().query(
            `SELECT a.assignment_id, a.est_e_TD, a.start_location, a.end_location, a.totalKMS, a.driver_payment, d.driver_id, d.name as driver_name
             FROM assignment a
             JOIN driver d ON a.driver_id = d.driver_id
             WHERE a.status = 'completed' AND DATE_FORMAT(a.est_e_TD, '%Y-%m') = ?
             ORDER BY a.est_e_TD DESC`,
            [month]
        );

        // Group assignments by driver
        const driverMap = {};
        rows.forEach(row => {
            if (!driverMap[row.driver_id]) {
                driverMap[row.driver_id] = {
                    driver_name: row.driver_name,
                    total_pay: 0,
                    assignments: []
                };
            }

            driverMap[row.driver_id].total_pay += parseFloat(row.driver_payment);
            driverMap[row.driver_id].assignments.push({
                assignment_id: row.assignment_id,
                date: row.est_e_TD,
                route: `${row.start_location} ➔ ${row.end_location}`,
                kms: row.totalKMS,
                payment: row.driver_payment
            });
        });

        const driverPayments = Object.values(driverMap);

        res.json({ driverPayments });
    } catch (error) {
        console.error("Error generating monthly reports:", error);
        res.status(500).json({ error: "Failed to generate monthly reports." });
    }
};


/**
 * Retrieves total, ongoing, and completed assignment counts.
 */
exports.getAssignmentCount = async (req, res) => {
    try {
        // Query calculates overall total, ongoing, and completed counts in one go
        const query = `
            SELECT 
                COUNT(*) AS totalAssignments,
                COALESCE(SUM(CASE WHEN status = 'ongoing' THEN 1 ELSE 0 END), 0) AS ongoingAssignments,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completedAssignments
            FROM assignment
        `;

        const [results] = await db.promise().query(query);
        const data = results[0];

        res.status(200).json({
            totalAssignments: parseInt(data.totalAssignments) || 0,
            ongoingAssignments: parseInt(data.ongoingAssignments) || 0,
            completedAssignments: parseInt(data.completedAssignments) || 0
        });
    } catch (error) {
        console.error('Error fetching assignment counts:', error);
        res.status(500).json({ error: 'Database error fetching counts' });
    }
};

/**
 * Cancels an ongoing assignment by updating its status.
 */
exports.cancelAssignment = async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.promise().query(
            `UPDATE assignment SET status = 'cancelled' WHERE assignment_id = ? AND status = 'ongoing'`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Assignment not found or already completed/cancelled." });
        }

        res.status(200).json({ message: "Assignment has been successfully cancelled." });
    } catch (error) {
        console.error("Error cancelling assignment:", error);
        res.status(500).json({ error: "Failed to cancel assignment." });
    }
};

/**
 * Retrieves all customers for administrative views.
 */
exports.getAdminAllCustomers = (req, res) => {
    const query = `
        SELECT 
            customer_id, 
            company_name, 
            contact, 
            address, 
            company_rate, 
            driver_rate 
        FROM customer 
        ORDER BY company_name ASC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching customers:", err);
            return res.status(500).json({ error: "Database error while fetching customers." });
        }
        res.status(200).json(results);
    });
};

