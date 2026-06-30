require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const quizRoutes = require('./routes/quizzes');
const analyticsRoutes = require('./routes/analytics');
const adminRoutes = require('./routes/admin');
const duelRoutes = require('./routes/duels');
const groupRoutes = require('./routes/groups');
const discussionRoutes = require('./routes/discussions');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
});
app.set('io', io);

// Connect Database
connectDB();

// Init Middleware
app.use(cors());
app.use(express.json());

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Simple Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', time: new Date() });
});

// Define Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/duels', duelRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/discussions', discussionRoutes);

// Setup Socket.io battle logic
require('./sockets/battle')(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log(`Socket.io listening for quiz battle events`);
});
