// Import Socket.IO client
const socket = io("https://watch-togethertest.onrender.com"); // Update the URL as per your server
import { Peer } from "peerjs"
const peer = new Peer();

const peers = {}; // Store peer connections
let localStream; // Store the local video stream

// Connection established
socket.on("connect", () => {
  console.log("Connected to Socket.IO server with ID:", socket.id);
});

// Capture Local Video Stream
async function captureLocalVideo() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    displayLocalVideo(localStream);
  } catch (error) {
    console.error("Error accessing the camera or microphone: ", error);
  }
}

// Display Local Video
function displayLocalVideo(stream) {
  const videoElement = document.createElement("video");
  videoElement.srcObject = stream;
  videoElement.autoplay = true;
  videoElement.muted = true;
  videoElement.classList.add("localVideo");
  const displayVideoCalls = document.getElementById("displayvideocalls");
  const individualVideoDiv = document.createElement("div");
  individualVideoDiv.classList.add("individualsVideo");
  displayVideoCalls.appendChild(individualVideoDiv);
  individualVideoDiv.appendChild(videoElement);
}

// 📌 CREATE ROOM EVENT LISTENER
const createRoomButton = document.getElementById("create");
const createRoomPopup = document.getElementById("createRoomPopup");
const createRoomConfirmButton = document.getElementById("createRoomConfirm");
const closeCreateRoomPopupButton = document.getElementById("closeCreateRoomPopup");

// Show Room Creation Popup
createRoomButton.addEventListener("click", () => {
  createRoomPopup.style.display = "block"; // Show the popup
});

// Confirm Room Creation
createRoomConfirmButton.addEventListener("click", createRoom);

/**
 * Update UI after room creation
 */
function updateUIAfterRoomCreation(roomId) {
  // Replace buttons with room details
  const createJoinBtnDiv = document.querySelector(".creatJoinBtn");
  createJoinBtnDiv.innerHTML = `
    <span id="roomIdDisplay">Room ID: ${roomId}</span>
    <i class="fa-solid fa-copy" id="copyRoomId" style="cursor: pointer; color: yellow;"></i>
  `;

  // Enable copying Room ID
  document.getElementById("copyRoomId").addEventListener("click", () => {
            navigator.clipboard.writeText(roomId).then(() => {
              // Toast-style notification
              const copyMessage = document.createElement("div");
              copyMessage.textContent = "Room ID copied to clipboard!";
              copyMessage.style.position = "fixed";
              copyMessage.style.bottom = "20px";
              copyMessage.style.right = "20px";
              copyMessage.style.backgroundColor = "#4CAF50";
              copyMessage.style.color = "#fff";
              copyMessage.style.padding = "10px";
              copyMessage.style.borderRadius = "5px";
              document.body.appendChild(copyMessage);
              setTimeout(() => copyMessage.remove(), 3000);
            });
          });

  // Clear and hide popup
  createRoomPopup.style.display = "none";
  document.getElementById("roomName").value = "";
  document.getElementById("adminName").value = "";
}

closeCreateRoomPopupButton.addEventListener("click", () => {
  createRoomPopup.style.display = "none"; // Close the create room popup
  document.getElementById("roomName").value = "";
  document.getElementById("adminName").value = "";
});


// 📌 JOIN ROOM POPUP HANDLER
const joinButton = document.getElementById("join");
const joinPopup = document.getElementById("join-popup");
const closePopupButton = document.getElementById("closePopup");
const joinRoomButton = document.getElementById("joinRoom");
const joinRoomIdInput = document.getElementById("joinRoomId");
const joinErrorText = document.getElementById("joinError");

// Show Join Popup
joinButton.addEventListener("click", () => {
  joinPopup.style.display = "block";
});

// Close Join Popup
closePopupButton.addEventListener("click", () => {
  joinPopup.style.display = "none";
  joinErrorText.style.display = "none";
  joinRoomIdInput.value = "";
});

// 📌 Join Room
async function joinRoom(roomId) {
  if (!roomId) {
    alert("Room ID is required to join.");
    return;
  }

  try {
    await captureLocalVideo();
    socket.emit("join_room", { room_id: roomId, peer_id: peer.id });

    socket.on("user-connected", (peerId) => {
      console.log(`User connected: ${peerId}`);
      connectToNewUser(peerId, localStream);
    });
  } catch (error) {
    console.error("Error joining room:", error);
    alert("Failed to join room.");
  }
}

// Handle join room button
joinRoomButton.addEventListener("click", async () => {
  const roomId = joinRoomIdInput.value.trim();

  // Validation
  if (!roomId) {
    joinErrorText.textContent = "Please enter a Room ID.";
    joinErrorText.style.display = "block";
    return;
  }

  const participantName = generateRandomName(); // Ensure this function is implemented
  joinErrorText.style.display = "none"; // Clear any previous error message

  try {
    const response = await fetch("https://watch-togethertest.onrender.com/join_room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_id: roomId, participant_name: participantName }),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    if (data.message === "Joined room successfully") {
      socket.emit("join_room", { room_id: roomId, participant_name: participantName });

      // Listen for room_joined event
      socket.on("room_joined", (serverResponse) => {
        if (serverResponse.success) {
          const createJoinBtnDiv = document.querySelector(".creatJoinBtn");
          createJoinBtnDiv.innerHTML = `
            <span id="roomIdDisplay">Room ID: ${roomId}</span>
            <i class="fa-solid fa-copy" id="copyRoomId" style="cursor: pointer; color: yellow;"></i>
          `;

          document.getElementById("copyRoomId").addEventListener("click", () => {
            navigator.clipboard.writeText(roomId).then(() => {
              // Toast-style notification
              const copyMessage = document.createElement("div");
              copyMessage.textContent = "Room ID copied to clipboard!";
              copyMessage.style.position = "fixed";
              copyMessage.style.bottom = "20px";
              copyMessage.style.right = "20px";
              copyMessage.style.backgroundColor = "#4CAF50";
              copyMessage.style.color = "#fff";
              copyMessage.style.padding = "10px";
              copyMessage.style.borderRadius = "5px";
              document.body.appendChild(copyMessage);
              setTimeout(() => copyMessage.remove(), 3000);
            });
          });

          joinRoom(roomId, participantName); // Ensure implementation exists
          joinPopup.style.display = "none";
          joinRoomIdInput.value = "";
        } else {
          joinErrorText.textContent = serverResponse.error || "Failed to join the room.";
          joinErrorText.style.display = "block";
        }
      });
    } else {
      joinErrorText.textContent = data.message || "Failed to join the room.";
      joinErrorText.style.display = "block";
    }
  } catch (error) {
    console.error("Error joining room:", error);
    joinErrorText.textContent = "An error occurred. Please try again.";
    joinErrorText.style.display = "block";
  }
});


// 📌 Utility Function: Copy to Clipboard
function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => alert("Room ID copied to clipboard!"))
    .catch((err) => console.error("Error copying text:", err));
}

// Handle Remote Stream
function displayRemoteVideo(stream) {
  const videoElement = document.createElement("video");
  videoElement.srcObject = stream;
  videoElement.autoplay = true;
  videoElement.classList.add("remoteVideo");
  const displayVideoCalls = document.getElementById("displayvideocalls");
  const individualVideoDiv = document.createElement("div");
  individualVideoDiv.classList.add("individualsVideo");
  displayVideoCalls.appendChild(individualVideoDiv);
  individualVideoDiv.appendChild(videoElement);
}

function connectToNewUser(peerId, stream) {
  const call = peer.call(peerId, stream);

  call.on("stream", (remoteStream) => {
    displayRemoteVideo(remoteStream);
  });

  call.on("close", () => {
    console.log(`Call with ${peerId} closed.`);
  });

  peers[peerId] = call;
}

// 📌 Handle Incoming Calls
peer.on("call", (call) => {
  call.answer(localStream);

  call.on("stream", (remoteStream) => {
    displayRemoteVideo(remoteStream);
  });
});

// 📌 Peer Disconnected
socket.on("user-disconnected", (peerId) => {
  console.log(`User disconnected: ${peerId}`);
  if (peers[peerId]) peers[peerId].close();
});

// Create Peer Connection
function createPeerConnection(peerId) {
  const peerConnection = new RTCPeerConnection();

  // Add local stream tracks to the connection
  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

  // Handle incoming tracks
  peerConnection.ontrack = (event) => {
    const [remoteStream] = event.streams;
    displayRemoteVideo(remoteStream);
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", { to: peerId, candidate: event.candidate });
    }
  };

  return peerConnection;
}
// Create Room
async function createRoom() {
  const roomName = document.getElementById("roomName").value.trim();
  const adminName = document.getElementById("adminName").value.trim();
  if (!roomName || !adminName) {
    alert("Please enter both Room Name and Admin Name.");
    return;
  }

  const roomId = generateRoomId();
  try {
    const response = await fetch("https://watch-togethertest.onrender.com/create_room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_id: roomId, room_name: roomName, admin_name: adminName }),
    });
    const data = await response.json();
    if (data.message === "Room created successfully") {
      console.log(data);
      socket.emit("create_room", { room_id: roomId, room_name: roomName, admin_name: adminName });
      captureLocalVideo();
      updateUIAfterRoomCreation(roomId);
      alert("Room created successfully!");
    } else {
      alert("Failed to create room: " + data.message);
    }
  } catch (error) {
    console.error("Error creating room:", error);
  }
}

// Handle incoming offer
socket.on("offer", async ({ from, offer }) => {
  const peerConnection = createPeerConnection(from);
  peers[from] = peerConnection;

  peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  peerConnection.setLocalDescription(answer);

  socket.emit("answer", { to: from, answer });
});

// Handle incoming answer
socket.on("answer", ({ from, answer }) => {
  const peerConnection = peers[from];
  if (peerConnection) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }
});

// Handle incoming ICE candidate
socket.on("ice-candidate", ({ from, candidate }) => {
  const peerConnection = peers[from];
  if (peerConnection) {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
});

// 📌 Generate Random Room ID
function generateRoomId() {
  return Math.random().toString(36).substr(2, 9); // Random 9 character ID
}

function generateRandomName() {
  const adjectives = ["Quick", "Bright", "Brave", "Calm", "Sharp", "Wise"];
  const nouns = ["Lion", "Tiger", "Falcon", "Eagle", "Wolf", "Bear"];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${
    nouns[Math.floor(Math.random() * nouns.length)]
  }`;
}


