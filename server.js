const express = require('express');
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);

const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');
const { joinRoom } = require('./joinRoomHandler');
const db = require('./db');
const port = process.env.PORT || 3000;


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
      res.(redirect(`/${room_id}`));
    );
    res.status(200).json({ message: 'Room created successfully', data: result.rows[0] });
  } catch (err) {
    console.error('Failed to create room:', err.message);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

app.get('/:room', (req, res) => {
  res.render('room', {room_id: req.params.room})
})

app.post('/join_room', joinRoom);


// Start server and load rooms
server.listen(port, async () => {
  console.log(`Server running on http://localhost:${port}`);
});
