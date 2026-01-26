require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// Import your new Socket Handler
const socketHandler = require('./socket/socketHandler');

const testRoutes = require('./routes/testRoutes');
const authenticationRoutes = require('./routes/authenticationRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const driverRoutes = require('./routes/driverRoute');
const assignmentRoutes = require('./routes/assignmentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const categoryRoutes = require('./routes/categoryRoutes');

const app = express();

// 1. Create HTTP server
const server = http.createServer(app);

// 2. Initialize Socket.io
const io = new Server(server, {
    cors: {
        // Allow connections from your local frontend or production frontend
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// 3. Pass the 'io' instance to your handler
socketHandler(io);

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use('/test', testRoutes);
app.use('/driver', driverRoutes);
app.use('/vehicle', vehicleRoutes);
app.use('/authentication', authenticationRoutes);
app.use('/assignment', assignmentRoutes);
app.use('/notification', notificationRoutes);
app.use('/category', categoryRoutes);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});