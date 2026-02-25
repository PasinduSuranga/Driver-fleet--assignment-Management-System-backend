const db = require('../config/db');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const { sendSMS } = require('../services/smsService');


function capitalizeFirstLetter(str) {
    if (!str) return "";
    
    return str
        .toLowerCase()
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}


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


exports.getDrivers = async (req, res) => {
    // Query joins 'driver' and 'driver_license' to get the expiry date
    // Filters strictly for is_blacklisted = '0'
    const query = `
        SELECT 
            d.driver_id, 
            d.name, 
            d.is_available,
            dl.expiry_date 
        FROM driver d
        LEFT JOIN driver_license dl ON d.license_number = dl.licen_number
        WHERE d.is_blacklisted = '0'
    `;

    try {
        const [results] = await db.promise().query(query);
        res.status(200).json(results);
    } catch (err) {
        console.error("Error fetching drivers:", err);
        res.status(500).json({ message: "Database error fetching drivers" });
    }
};


exports.addToBlacklist = async (req, res) => {
    const { driverId } = req.body;

    if (!driverId) {
        return res.status(400).json({ message: "Driver ID is required" });
    }

    const connection = db.promise();

    try {
        // 1. Update Blacklist Status
        const updateQuery = "UPDATE driver SET is_blacklisted = '1' WHERE driver_id = ?";
        const [updateResult] = await connection.query(updateQuery, [driverId]);

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ message: "Driver not found" });
        }

        // 2. Fetch Driver Details for SMS
        const driverQuery = "SELECT contact, name FROM driver WHERE driver_id = ?";
        const [driverRows] = await connection.query(driverQuery, [driverId]);

        if (driverRows.length > 0) {
            const { contact, name } = driverRows[0];
            const message = `Dear ${capitalizeFirstLetter(name)}, You have been added to the blacklist. Please contact City Lion Express Tours for more information.`;

            // 3. Send SMS
            await sendSMS(contact, message);
        } else {
            console.warn("Driver contact not found for SMS.");
        }

        res.status(200).json({ message: "Driver has been added to the blacklist successfully." });

    } catch (err) {
        console.error("Error blacklisting driver:", err);
        res.status(500).json({ message: "Database error processing request" });
    }
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


exports.addDriver = async (req, res) => {
  const files = req.files || {};

  try {
    const licenseFrontUrl = await uploadToR2(
      files.licenseFrontPhoto ? files.licenseFrontPhoto[0] : null
    );
    const licenseBackUrl = await uploadToR2(
      files.licenseBackPhoto ? files.licenseBackPhoto[0] : null
    );

    const { driverName, contactNumber, licenseNumber, licenseExpiry } = req.body;

    // Required validations (same style as vehicle controller)
    if (!driverName) return res.status(400).json({ message: "Driver name is required" });
    if (!contactNumber) return res.status(400).json({ message: "Contact number is required" });
    if (!licenseNumber) return res.status(400).json({ message: "License number is required" });
    if (!licenseExpiry) return res.status(400).json({ message: "License expiry date is required" });

    if (!licenseFrontUrl) return res.status(400).json({ message: "License front photo is required" });
    if (!licenseBackUrl) return res.status(400).json({ message: "License back photo is required" });

    // Generate driver_id
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const driver_id = `CLDR-${randomNum}`;

    db.beginTransaction(async (err) => {
      if (err) throw err;

      // 1) Insert into driver_license (PK = licen_number)
      const licenseQuery = `
        INSERT INTO driver_license
        (licen_number, front_photo, back_photo, expiry_date)
        VALUES (?, ?, ?, ?)
      `;

      db.query(
        licenseQuery,
        [licenseNumber, licenseFrontUrl, licenseBackUrl, licenseExpiry],
        (err1) => {
          if (err1) {
            return db.rollback(() => {
              if (err1.code === 'ER_DUP_ENTRY') {
                res.status(409).json({ message: "License Number already exists" });
              } else {
                res.status(500).json({ error: "DB Error: Driver License" });
              }
            });
          }

          // 2) Insert into driver
          const driverQuery = `
            INSERT INTO driver
            (driver_id, name, contact, is_available, license_number, is_blacklisted)
            VALUES (?, ?, ?, 1, ?, 0)
          `;

          db.query(
            driverQuery,
            [driver_id, driverName, contactNumber, licenseNumber],
            (err2) => {
              if (err2) {
                return db.rollback(() => {
                  if (err2.code === 'ER_DUP_ENTRY') {
                    res.status(409).json({ message: "Driver already exists" });
                  } else {
                    res.status(500).json({ error: "DB Error: " + err2.message });
                  }
                });
              }

              // --- SMS LOGIC (same style as vehicle controller) ---
              const message = `Dear ${capitalizeFirstLetter(driverName)}, You have been successfully registered as a driver with City Lion Express Tours. Thank you!`;

              (async () => {
                try {
                  await sendSMS(contactNumber, message);
                } catch (smsError) {
                  console.error("SMS Sending Error:", smsError);
                }

                console.log("Driver added and SMS sent (if successful).");
                console.log("Driver ID:", contactNumber);

                // Commit Transaction
                db.commit((err3) => {
                  if (err3) {
                    return db.rollback(() => res.status(500).json({ error: "Commit Error" }));
                  }
                  res.status(201).json({ message: "Driver added successfully!" });
                });
              })();
              // --- SMS LOGIC ENDED ---
            }
          );
        }
      );
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error processing request" });
  }
};

exports.getDriverDetails = async (req, res) => {
  const { driverId } = req.query;

  if (!driverId) {
    return res.status(400).json({ error: "Driver ID is required" });
  }

  const query = `
    SELECT 
      d.driver_id,
      d.name,
      d.contact,
      d.is_available,
      d.license_number,
      d.is_blacklisted,

      dl.front_photo,
      dl.back_photo,
      dl.expiry_date
    FROM driver d
    LEFT JOIN driver_license dl 
      ON d.license_number = dl.licen_number
    WHERE d.driver_id = ?
  `;

  try {
    const [results] = await db.promise().query(query, [driverId]);

    if (results.length === 0) {
      return res.status(404).json({ error: "Driver not found" });
    }

    res.status(200).json(results[0]);
  } catch (error) {
    console.error("Error fetching driver details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.updateDriver = async (req, res) => {
  const { driverId, driverName, contactNumber, licenseExpiry } = req.body;
  const files = req.files || {};

  if (!driverId) {
    return res.status(400).json({ message: "Driver ID is required" });
  }

  const connection = await db.promise();

  try {
    await connection.beginTransaction();

    // 1) Fetch current driver + license
    const fetchQuery = `
      SELECT 
        d.name, d.contact, d.license_number,
        dl.front_photo, dl.back_photo, dl.expiry_date
      FROM driver d
      LEFT JOIN driver_license dl ON d.license_number = dl.licen_number
      WHERE d.driver_id = ?
    `;
    const [rows] = await connection.query(fetchQuery, [driverId]);

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Driver not found" });
    }

    const current = rows[0];

    // 2) Upload new photos if provided
    const newFrontPhoto =
      (files.licenseFrontPhoto && files.licenseFrontPhoto[0])
        ? await uploadToR2(files.licenseFrontPhoto[0])
        : current.front_photo;

    const newBackPhoto =
      (files.licenseBackPhoto && files.licenseBackPhoto[0])
        ? await uploadToR2(files.licenseBackPhoto[0])
        : current.back_photo;

    // 3) Strict value validation (avoid overwriting with empty)
    const isValid = (val) => val !== undefined && val !== 'undefined' && val !== 'null' && val !== '';

    const finalName = isValid(driverName) ? driverName : current.name;
    const finalContact = isValid(contactNumber) ? contactNumber : current.contact;

    // expiry date
    const finalExpiry = isValid(licenseExpiry) ? licenseExpiry : current.expiry_date;

    // 4) Update driver table (NO license number update)
    await connection.query(
      `UPDATE driver SET name = ?, contact = ? WHERE driver_id = ?`,
      [finalName, finalContact, driverId]
    );

    // 5) Update driver_license table (by license number)
    // If license record exists -> update, else insert a new row (safe fallback)
    const licNo = current.license_number;

    const [licRows] = await connection.query(
      `SELECT licen_number FROM driver_license WHERE licen_number = ?`,
      [licNo]
    );

    if (licRows.length > 0) {
      await connection.query(
        `UPDATE driver_license 
         SET front_photo = ?, back_photo = ?, expiry_date = ?
         WHERE licen_number = ?`,
        [newFrontPhoto, newBackPhoto, finalExpiry, licNo]
      );
    } else {
      await connection.query(
        `INSERT INTO driver_license (licen_number, front_photo, back_photo, expiry_date)
         VALUES (?, ?, ?, ?)`,
        [licNo, newFrontPhoto, newBackPhoto, finalExpiry]
      );
    }

    await connection.commit();
    res.status(200).json({ message: "Driver updated successfully" });

  } catch (error) {
    await connection.rollback();
    console.error("Error updating driver:", error);
    res.status(500).json({ message: "Failed to update driver details" });
  }
};