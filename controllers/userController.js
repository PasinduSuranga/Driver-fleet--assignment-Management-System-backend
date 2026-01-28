const db = require('../config/db'); // Your DB connection
const nodemailer = require('nodemailer');

// Ensure you have your transporter configured here or imported
const transporter = nodemailer.createTransport({
    service: 'gmail', // or your service
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// 1. Get Active Users (Pending & Approved)
exports.getUsers = (req, res) => {
    // We fetch 0 (Pending) and 1 (Approved). 
    // 2 (Declined) and 3 (Blacklisted) are ignored here.
    const query = "SELECT user_id, name, email, role, is_approved FROM user WHERE is_approved IN (0, 1) ORDER BY is_approved ASC";
    
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching users:", err);
            return res.status(500).json({ message: "Database error" });
        }
        res.status(200).json(results);
    });
};

// 2. Get Blacklisted Users
exports.getBlacklistedUsers = (req, res) => {
    const query = "SELECT user_id, name, email, role, is_approved FROM user WHERE is_approved = 3";
    
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching blacklist:", err);
            return res.status(500).json({ message: "Database error" });
        }
        res.status(200).json(results);
    });
};

// 3. Update User Status (Approve, Decline, Blacklist, Restore)
exports.updateUserStatus = (req, res) => {
    const { user_id, email, status } = req.body;
    
    // status map: 1=Approve, 2=Decline, 3=Blacklist, 0=Restore/Pending
    
    const query = "UPDATE user SET is_approved = ? WHERE user_id = ?";

    db.query(query, [status, user_id], (err, result) => {
        if (err) {
            console.error("Error updating status:", err);
            return res.status(500).json({ message: "Database error" });
        }

        // --- EMAIL LOGIC ---
        let subject = "";
        let text = "";
        let shouldSendMail = false;

        if (status === 1) {
            shouldSendMail = true;
            subject = "Account Approved - City Lion Express Tours";
            text = `Congratulations! Your account has been approved. You can now log in to the system.`;
        } else if (status === 2) {
            shouldSendMail = true;
            subject = "Account Declined - City Lion Express Tours";
            text = `We regret to inform you that your account registration request has been declined.`;
        } else if (status === 3) {
            shouldSendMail = true;
            subject = "Account Blacklisted - City Lion Express Tours";
            text = `Your account has been blacklisted due to violations of our terms of service. Please contact support for more information.`;
        } else if (status === 0) {
            shouldSendMail = true;
            subject = "Account Restored - City Lion Express Tours";
            text = `Your account has been restored to pending status. Please await further review.`;
        }

        

        if (shouldSendMail && email) {
            const mailOptions = {
                from: `"City Lion Express Tours" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: subject,
                text: text
            };

            transporter.sendMail(mailOptions, (mailErr) => {
                if (mailErr) {
                    console.error("Email error:", mailErr);
                    // We don't return error to client if DB update worked, just log it
                }
            });
        }

        res.status(200).json({ message: "User status updated successfully" });
    });
};