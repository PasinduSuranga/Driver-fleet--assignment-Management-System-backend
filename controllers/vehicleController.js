const db = require('../config/db');
const {S3Client, PutObjectCommand} = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const { sendSMS } = require('../services/smsService');

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


exports.getVehicles = (req, res) => {
    const query = `
        SELECT 
            v.vehicle_number, 
            v.vehicle_type, 
            v.availability, 
            v.vehicle_photo,
            v.category_id,
            c.category_name,
            d.license_expiry_date,
            d.insurance_expiry_date
        FROM vehicle v
        LEFT JOIN vehicle_category c ON v.category_id = c.category_id
        LEFT JOIN vehicle_documents d ON v.document_id = d.documnet_id
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching vehicles:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
};


exports.checkRegistration = (req, res) => {
    const { regNo } = req.body;
    const query = "SELECT vehicle_number FROM vehicle WHERE vehicle_number = ?";
    db.query(query, [regNo], (err, result) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (result.length > 0) {
            return res.json({ exists: true, message: "Vehicle number already exists" });
        }
        return res.json({ exists: false });
    });
};


const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});


const uploadToR2 = async (file) => {
    if (!file) return null;

    const fileName = `${crypto.randomUUID()}-${file.originalname}`;

    const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
    });

    try {
        await s3Client.send(command);
        return `${process.env.R2_PUBLIC_URL}/${fileName}`;
    } catch (error) {
        console.error("R2 Upload Error:", error);
        throw new Error("Failed to upload image to Cloud Storage");
    }
};

exports.addVehicle = async (req, res) => {
    const files = req.files || {};
    
    try {
        const vehiclePhotoUrl = await uploadToR2(files.vehiclePhoto ? files.vehiclePhoto[0] : null);
        const bookCopyUrl = await uploadToR2(files.bookCopyPhoto ? files.bookCopyPhoto[0] : null);
        const licenseUrl = await uploadToR2(files.licensePhoto ? files.licensePhoto[0] : null);
        const insuranceUrl = await uploadToR2(files.insurancePhoto ? files.insurancePhoto[0] : null);

        const {
            registrationNumber,
            owner_id, // Sent from frontend (Selected from dropdown)
            vehicleType,
            category,
            licenseExpiry,
            insuranceExpiry
        } = req.body;

        if (!vehiclePhotoUrl) return res.status(400).json({ message: "Vehicle photo is required" });
        if (!owner_id) return res.status(400).json({ message: "Owner is required" });

        // Generate Document ID
        const randomDocNum = Math.floor(10000 + Math.random() * 90000);
        const document_id = `CLED-${randomDocNum}`;

        db.beginTransaction(async (err) => {
            if (err) throw err;

            // Insert Documents
            const docQuery = `
                INSERT INTO vehicle_documents 
                (documnet_id, book_copy, license, license_expiry_date, insurance, insurance_expiry_date) 
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            
            db.query(docQuery, [document_id, bookCopyUrl, licenseUrl, licenseExpiry, insuranceUrl, insuranceExpiry], (err, result) => {
                if (err) {
                    return db.rollback(() => res.status(500).json({ error: "DB Error: Documents" }));
                }

                // Insert Vehicle (Linked to existing owner_id)
                const vehicleQuery = `
                    INSERT INTO vehicle 
                    (vehicle_number, owner_id, vehicle_photo, vehicle_type, category_id, availability, document_id) 
                    VALUES (?, ?, ?, ?, ?, 1, ?)
                `;

                db.query(vehicleQuery, [registrationNumber, owner_id, vehiclePhotoUrl, vehicleType, category, document_id], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            // Check for duplicate entry error specifically
                            if (err.code === 'ER_DUP_ENTRY') {
                                res.status(409).json({ message: "Vehicle Number already exists" });
                            } else {
                                res.status(500).json({ error: "DB Error: " + err.message });
                            }
                        });
                    }

                    db.commit((err) => {
                        if (err) return db.rollback(() => res.status(500).json({ error: "Commit Error" }));
                        res.status(201).json({ message: "Vehicle added successfully!" });
                    });
                });
            });
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error processing request" });
    }
};


exports.getVehicleDetails = async (req, res) => {
  const { vehicleNumber } = req.query;

  if (!vehicleNumber) {
    return res.status(400).json({ error: 'Vehicle number is required' });
  }

  // UPDATED QUERY based on your screenshots:
  // 1. Joins 'vehicle' with 'owner', 'vehicle_category', and 'vehicle_documents'.
  // 2. Uses the exact column spelling 'documnet_id' found in your vehicle_documents table.
  const query = `
    SELECT 
      v.vehicle_number, 
      v.vehicle_photo, 
      v.vehicle_type, 
      v.availability,
      
      o.name AS owner_name, 
      o.contact AS contact_no, 
      
      vc.category_name, 
      
      vd.book_copy, 
      vd.license AS license_copy, 
      vd.license_expiry_date AS license_expiry, 
      vd.insurance AS insurance_copy, 
      vd.insurance_expiry_date AS insurance_expiry 
    FROM vehicle v 
    LEFT JOIN owner o ON v.owner_id = o.owner_id 
    LEFT JOIN vehicle_category vc ON v.category_id = vc.category_id 
    LEFT JOIN vehicle_documents vd ON v.document_id = vd.documnet_id 
    WHERE v.vehicle_number = ?
  `;

  try {
    // We use .promise() here because you are using mysql2 with createConnection.
    // This wrapper allows us to use 'await' without changing your db.js file.
    const [results] = await db.promise().query(query, [vehicleNumber]);

    if (results.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    // Return the single vehicle object
    res.status(200).json(results[0]);
  } catch (error) {
    console.error('Error fetching vehicle details:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


exports.updateVehicle = async (req, res) => {
    const { vehicleNumber, vehicleType, ownerId, ownerContact, licenseExpiry, insuranceExpiry } = req.body;
    const files = req.files || {};

    if (!vehicleNumber) {
        return res.status(400).json({ message: "Vehicle number is required" });
    }

    const connection = await db.promise();

    try {
        await connection.beginTransaction();

        // 1. Fetch Current Data
        const fetchQuery = `
            SELECT 
                v.vehicle_photo, v.vehicle_type, v.owner_id, v.document_id,
                vd.book_copy, vd.license, vd.insurance
            FROM vehicle v
            LEFT JOIN vehicle_documents vd ON v.document_id = vd.documnet_id
            WHERE v.vehicle_number = ?
        `;
        const [rows] = await connection.query(fetchQuery, [vehicleNumber]);
        
        if (rows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Vehicle not found" });
        }
        const current = rows[0];

        // 2. Handle R2 Uploads
        const newVehiclePhoto = (files.vehiclePhoto && files.vehiclePhoto[0]) ? await uploadToR2(files.vehiclePhoto[0]) : current.vehicle_photo;
        const newBookCopy = (files.bookCopyPhoto && files.bookCopyPhoto[0]) ? await uploadToR2(files.bookCopyPhoto[0]) : current.book_copy;
        const newLicense = (files.licensePhoto && files.licensePhoto[0]) ? await uploadToR2(files.licensePhoto[0]) : current.license;
        const newInsurance = (files.insurancePhoto && files.insurancePhoto[0]) ? await uploadToR2(files.insurancePhoto[0]) : current.insurance;

        // 3. Prepare Text Data (FIXED: Strict check to avoid null/empty string overwrites)
        const isValid = (val) => val !== undefined && val !== 'undefined' && val !== 'null' && val !== '';
        
        const finalType = isValid(vehicleType) ? vehicleType : current.vehicle_type;
        const finalOwnerId = isValid(ownerId) ? ownerId : current.owner_id;

        // 4. Update Vehicle Table
        await connection.query(
            "UPDATE vehicle SET vehicle_photo = ?, vehicle_type = ?, owner_id = ? WHERE vehicle_number = ?",
            [newVehiclePhoto, finalType, finalOwnerId, vehicleNumber]
        );

        // 5. Update Documents Table
        if (current.document_id) {
            const [dateRows] = await connection.query("SELECT license_expiry_date, insurance_expiry_date FROM vehicle_documents WHERE documnet_id = ?", [current.document_id]);
            const currentDates = dateRows[0] || {};
            
            const finalLicExp = isValid(licenseExpiry) ? licenseExpiry : currentDates.license_expiry_date;
            const finalInsExp = isValid(insuranceExpiry) ? insuranceExpiry : currentDates.insurance_expiry_date;

            await connection.query(
                `UPDATE vehicle_documents 
                 SET book_copy = ?, license = ?, license_expiry_date = ?, insurance = ?, insurance_expiry_date = ? 
                 WHERE documnet_id = ?`,
                [newBookCopy, newLicense, finalLicExp, newInsurance, finalInsExp, current.document_id]
            );
        }

        // 6. Update Owner Contact
        if (isValid(ownerContact) && finalOwnerId) {
            await connection.query("UPDATE owner SET contact = ? WHERE owner_id = ?", [ownerContact, finalOwnerId]);
        }

        await connection.commit();
        res.status(200).json({ message: "Vehicle updated successfully" });

    } catch (error) {
        await connection.rollback();
        console.error("Error updating vehicle:", error);
        res.status(500).json({ message: "Failed to update vehicle details" });
    }
};