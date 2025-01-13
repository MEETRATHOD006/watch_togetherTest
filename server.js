const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const { Pool } = require("pg");
const path = require("path");
const PeerServer = require('peerjs').PeerServer;

const pool = new Pool({
  connectionString: 'postgresql://postgres.pezdqmellmcmewcvssbv:8594@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

app.use(express.json());
app.use(express.static("public"));

// Test DB connection
pool.connect()
  .then(() => console.log("Connected to PostgreSQL database"))
  .catch(err => {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  });

// Create Room
app.post("/create_room", async (req, res) => {
  const { room_id, room_name, admin_name } = req.body;
  if (!room_id || !room_name || !admin_name) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO rooms (room_id, room_name, admin_name, participants) VALUES ($1, $2, $3, $4) RETURNING *",
      [room_id, room_name, admin_name, JSON.stringify([])]
    );

    res.status(200).json({ message: "Room created successfully" });
  } catch (err) {
    console.error("Failed to create room:", err.message);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// Join Room
app.post("/join_room", async (req, res) => {
  const { room_id, participant_name } = req.body;
  
  if (!room_id || !participant_name) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  try {
    // Check if room exists
    const result = await pool.query("SELECT * FROM rooms WHERE room_id = $1", [room_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Update participants
    const room = result.rows[0];
    const participants = room.participants;
    participants.push(participant_name);
    
    await pool.query("UPDATE rooms SET participants = $1 WHERE room_id = $2", [
      JSON.stringify(participants),
      room_id,
    ]);
    console.log("pool query done");
    res.status(200).json({ message: "Joined room successfully" });
  } catch (err) {
    console.error("Error joining room:", err.message);
    res.status(500).json({ error: "Failed to join room" });
  }
});


// Handle Room Routes
app.get("/:room", async (req, res) => {
  const roomId = req.params.room;

  try {
    const result = await pool.query("SELECT * FROM rooms WHERE room_id = $1", [roomId]);
    if (result.rowCount === 0) {
      return res.status(404).send("Room not found.");
    }
    console.log("its working");
    res.sendFile(path.join(__dirname, "public", "index.html"));
    console.log("its working too");
  } catch (err) {
    console.error("Failed to load room:", err.message);
    res.status(500).send("Internal server error.");
  }
});

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  socket.on("create_room", (data) => {
    console.log("Room created:", data.room_id);
    socket.join(data.room_id);
  });

  socket.on("join_room", ({ room_id, participant_name }) => {
    socket.join(room_id);
    io.to(room_id).emit("user_joined", { participant_name });
    console.log(`User ${participant_name} joined room ${room_id}`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// PeerJS server on a different port (default is 9000)
const peerServer = PeerServer({
  port: 3001,
  path: "/",  // Optional: you can customize the path
  debug: true,     // Optional: Enable debug mode
});

server.listen(3000, () => console.log("Server running on port 3000"));
