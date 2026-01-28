const bcrypt = require('bcrypt');
const db = require('../config/db');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

exports.userRegister = (req, res) => {
    const { name, email, password } = req.body;

    const randomNum = Math.floor(1000 + Math.random() * 99000);
    const userId = `CLEUS-${randomNum}`;
    const role = 'user';

    const checkQuery = 'SELECT * FROM user WHERE email = ?';
    
    db.query(checkQuery, [email], (err, results) => {
        if (err) {
            console.error('Database error checking user:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length > 0) {
            return res.status(409).json({ message: 'Email already registered.' });
        }
        
        bcrypt.hash(password, 10, (hashErr, hash) => {
            if (hashErr) {
                console.error('Error hashing password:', hashErr);
                return res.status(500).json({ error: 'Error processing password' });
            }

            const insertQuery = 'INSERT INTO user (user_id, name, email, password, role) VALUES (?, ?, ?, ?, ?)';
            
            db.query(insertQuery, [userId, name, email, hash, role], (insertErr, result) => {
                if (insertErr) {
                    console.error('Error saving user:', insertErr);
                    return res.status(500).json({ error: 'Database error saving user' });
                }

                const mailOptions = {
                    from: `"City Lion Express Tours" <${process.env.EMAIL_USER}>`,
                    to: email,
                    subject: 'Registration Successful - Pending Approval',
                    text: `Dear ${name},\n\nYou have been successfully registered as a user. Please wait for admin approval.\n\nYour User ID is: ${userId}\n\nThank you for registering with us.`,
                };

                transporter.sendMail(mailOptions, (err, info) => {
                    if (err) {
                        console.error('Error sending email:', err);
                        return res.status(201).json({ message: 'User registered successfully! and waiting for admins approval. Failed to send email.', userId: userId });
                    }
                    console.log('Email sent:', info.response);
                });

                res.status(201).json({ message: 'User registered successfully! and waiting for admins approval. You will receive an email confirmation.', userId: userId });
            });
        });
    });
};


exports.adminRegister = (req, res) => {
    const { name, email, password } = req.body;

    const randomNum = Math.floor(1000 + Math.random() * 99000);
    const userId = `CLEAD-${randomNum}`;
    const role = 'admin';

    const checkQuery = 'SELECT * FROM user WHERE email = ?';
    
    db.query(checkQuery, [email], (err, results) => {
        if (err) {
            console.error('Database error checking user:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length > 0) {
            return res.status(409).json({ message: 'Email already registered.' });
        }
        
        bcrypt.hash(password, 10, (hashErr, hash) => {
            if (hashErr) {
                console.error('Error hashing password:', hashErr);
                return res.status(500).json({ error: 'Error processing password' });
            }

            const insertQuery = 'INSERT INTO user (user_id, name, email, password, role) VALUES (?, ?, ?, ?, ?)';
            
            db.query(insertQuery, [userId, name, email, hash, role], (insertErr, result) => {
                if (insertErr) {
                    console.error('Error saving user:', insertErr);
                    return res.status(500).json({ error: 'Database error saving user' });
                }

                const mailOptions = {
                    from: `"City Lion Express Tours" <${process.env.EMAIL_USER}>`,
                    to: email,
                    subject: 'Admin Registration Successful - Pending Approval',
                    text: `Dear ${name},\n\nYou have been successfully registered as an admin. Please wait for approval from another admin.\n\nYour Admin ID is: ${userId}\n\nThank you for registering with us.`,
                };

                transporter.sendMail(mailOptions, (err, info) => {
                    if (err) {
                        console.error('Error sending email:', err);
                        return res.status(201).json({ message: 'Admin registered successfully! and waiting for admins approval. Failed to send email.', userId: userId });
                    }
                    console.log('Email sent:', info.response);
                });

                res.status(201).json({ message: 'Admin registered successfully! and waiting for admins approval. You will receive an email confirmation.', userId: userId });
            });
        });
    });
};


exports.login = (req, res) => {
    const { email, password } = req.body;
    const query = 'SELECT * FROM user WHERE email = ?';

    db.query(query, [email], (err, results) => {
        if (err) {
            console.error('Database error during login:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (results.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        const user = results[0];

        if (user.is_approved === 3) {
            return res.status(401).json({ message: 'Your account is blacklisted.' });
        }

        if (user.is_approved === 0) {
            return res.status(401).json({ message: 'Your account is not approved yet.' });
        }

        bcrypt.compare(password, user.password, (compareErr, isMatch) => {
            if (compareErr) {
                console.error('Error comparing passwords:', compareErr);
                return res.status(500).json({ error: 'Error processing password' });
            }
            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            const token = jwt.sign(
                { userId: user.user_id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '9h' }
            );

            const expiryDate = new Date();
            expiryDate.setHours(expiryDate.getHours() + 1);

            res.status(200).json({
                message: 'Login successful',
                token: token,
                expiry: expiryDate,
                user: {
                    userId: user.user_id,
                    role: user.role,
                },
            });

        });
    });
}


exports.forgotPassword = (req, res) => {
    const { email } = req.body;
    const query = 'SELECT * FROM user WHERE email = ?';

    db.query(query, [email], (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (results.length === 0) return res.status(404).json({ message: 'User not found with this email' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date();
        expiry.setMinutes(expiry.getMinutes() + 10);

        const updateQuery = 'UPDATE user SET OTP = ?, expiryTime = ? WHERE email = ?';
        db.query(updateQuery, [otp, expiry, email], (updateErr) => {
            if (updateErr) return res.status(500).json({ message: 'Error saving OTP' });

            const mailOptions = {
                from: `"City Lion Express Tours" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: 'Password Reset OTP',
                text: `Your OTP for password reset is: ${otp}\n\nThis OTP is valid for 10 minutes.`
            };

            transporter.sendMail(mailOptions, (mailErr) => {
                if (mailErr) return res.status(500).json({ message: 'Error sending email' });
                res.status(200).json({ message: 'OTP sent successfully.' });
            });
        });
    });
};


exports.verifyOTP = (req, res) => {
    const { email, otp } = req.body;
    const query = 'SELECT * FROM user WHERE email = ?';

    db.query(query, [email], (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (results.length === 0) return res.status(404).json({ message: 'User not found' });

        const user = results[0];
        const now = new Date();

        if (user.OTP !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }
        if (new Date(user.expiryTime) < now) {
            return res.status(400).json({ message: 'OTP has expired' });
        }

        res.status(200).json({ message: 'OTP Verified successfully' });
    });
};


exports.resetPassword = (req, res) => {
    const { email, otp, newPassword } = req.body;

    const query = 'SELECT * FROM user WHERE email = ?';
    db.query(query, [email], (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (results.length === 0) return res.status(404).json({ message: 'User not found' });

        const user = results[0];
        
        if (user.OTP !== otp) {
            return res.status(400).json({ message: 'Invalid or expired session. Please start over.' });
        }

        bcrypt.hash(newPassword, 10, (hashErr, hash) => {
            if (hashErr) return res.status(500).json({ message: 'Error hashing password' });

            const updateQuery = 'UPDATE user SET password = ?, OTP = NULL, expiryTime = NULL WHERE email = ?';
            db.query(updateQuery, [hash, email], (updateErr) => {
                if (updateErr) return res.status(500).json({ message: 'Error updating password' });
                res.status(200).json({ message: 'Password reset successful!' });
            });
        });
    });
};


exports.getUser = (req, res) => {
    const userId = req.params.id;
    const query = "SELECT user_id, name, email, role FROM user WHERE user_id = ?";

    db.query(query, [userId], (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (results.length === 0) return res.status(404).json({ message: "User not found" });

        res.json(results[0]);
    });
};