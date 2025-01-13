
// server/server.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Initialize Express app and server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, '../public')));

// Handle Socket.IO connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join Room
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
        socket.to(roomId).emit('user-connected', socket.id);
    });

    // Video Sync
    socket.on('video-sync', ({ roomId, currentTime, isPlaying }) => {
        socket.to(roomId).emit('video-update', { currentTime, isPlaying });
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
