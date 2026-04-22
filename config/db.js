const mysql = require('mysql2');

// Create the connection instance to the MySQL database
// Using environment variables for secure credential storage
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASSWORD,
    database: 'clet_database'
});

// Establish and verify the connection to the database
// Logs an error if the connection fails, otherwise confirms success
db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the MySQL database.');
});

module.exports = db;