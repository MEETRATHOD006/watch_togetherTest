const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');
const { joinRoom } = require('./joinRoomHandler');
const db = require('./db');
const app = express();
const port = process.env.PORT || 3000;

const { Server } = require("socket.io");
const http = require("http");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use('/socket.io', express.static(path.join(__dirname, 'node_modules/socket.io/client-dist')));
app.use(express.json());
app.use(express.static('public'));

// PostgreSQL connection
const pool = new Pool({
  connectionString: 'postgresql://postgres.pezdqmellmcmewcvssbv:8594@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

// Test DB connection
pool.connect()
  .then(() => console.log('Connected to PostgreSQL database'))
  .catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });

// Routes for room creation and joining
app.post('/create_room', async (req, res) => {
  const { room_id, room_name, admin_name } = req.body.room_id ? req.body : req.query;
  if (!room_id || !room_name || !admin_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO rooms (room_id, room_name, admin_name, participants) VALUES ($1, $2, $3, $4) RETURNING *',
      [room_id, room_name, admin_name, JSON.stringify([])]
    );
    res.status(200).json({ message: 'Room created successfully', data: result.rows[0] });
  } catch (err) {
    console.error('Failed to create room:', err.message);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

app.post('/join_room', joinRoom);

// In-memory room storage
const rooms = {};
const users = {};

// Load rooms from DB at startup
async function loadRoomsFromDatabase() {
  const dbRooms = await db.getAllRooms();
  dbRooms.forEach(room => {
    rooms[room.room_id] = {
      room_name: room.room_name,
      admin_name: room.admin_name,
      participants: room.participants || [],
    };
  });
}

// WebRTC signaling with Socket.IO
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Create a new room
  socket.on("create_room", async ({ room_id, room_name, admin_name }) => {
    if (rooms[room_id]) {
      socket.emit("room_created", { success: false, error: "Room already exists." });
      return;
    }

    await db.createRoom({ room_id, room_name, admin_name, participants: admin_name });
    rooms[room_id] = { room_name, admin_name, participants: [admin_name] };
    users[socket.id] = { room_id, participant_name: admin_name };

    socket.join(room_id);
    socket.emit("room_created", { success: true, room_id, room_name, admin_name });
  });

  // Join an existing room
  socket.on("join_room", async ({ room_id, participant_name }) => {
    let room = rooms[room_id];

    if (!room) {
      const dbRoom = await db.getRoomById(room_id);
      if (!dbRoom) {
        socket.emit("room_joined", { success: false, error: "Room does not exist." });
        return;
      }
      rooms[room_id] = {
        room_name: dbRoom.room_name,
        admin_name: dbRoom.admin_name,
        participants: dbRoom.participants.split(","),
      };
      room = rooms[room_id];
    }

    room.participants.push(participant_name);
    await db.updateParticipants(room_id, JSON.stringify(room.participants));
    users[socket.id] = { room_id, participant_name };

    socket.join(room_id);
    socket.emit("room_joined", { success: true, room_id, room_name: room.room_name });
    socket.to(room_id).emit("room_update", { participants: room.participants });
  });

  // WebRTC signaling events
  socket.on("offer", ({ sdp, room_id }) => {
    console.log("Offer received:", { sdp, room_id });
    socket.to(room_id).emit("offer", { sdp, from: socket.id });
  });

  socket.on("answer", ({ sdp, room_id }) => {
    console.log("Answer received:", { sdp, room_id });
    socket.to(room_id).emit("answer", { sdp, from: socket.id });
  });

  socket.on("ice-candidate", ({ candidate, room_id }) => {
    console.log("ICE candidate received:", { candidate, room_id });
    socket.to(room_id).emit("ice-candidate", { candidate, from: socket.id });
  });

  // Handle disconnection
  socket.on("disconnect", async () => {
    const user = users[socket.id];
    if (!user) return;

    const { room_id, participant_name } = user;
    const room = rooms[room_id];
    if (!room) return;

    room.participants = room.participants.filter(name => name !== participant_name);
    await db.updateParticipants(room_id, room.participants);
    delete users[socket.id];

    if (room.participants.length === 0) {
      await db.deleteRoom(room_id);
      delete rooms[room_id];
    }

    socket.to(room_id).emit("room_update", { participants: room.participants });
  });
});

// Start server and load rooms
server.listen(port, async () => {
  await loadRoomsFromDatabase();
  console.log(`Server running on http://localhost:${port}`);
});
