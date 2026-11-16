const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e7 // 10 MB for larger snippets or images
});

const PORT = process.env.PORT || 3000;

// In-memory room store (history up to 30 clips per room)
const rooms = new Map();

function getRoomData(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      clips: [],
      devices: new Map() // socketId -> device info
    });
  }
  return rooms.get(roomId);
}

// Helper to determine the best local LAN IP
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // IPv4, not internal 127.0.0.1
      if (net.family === 'IPv4' && !net.internal) {
        // Exclude Windows APIPA 169.254.x.x if possible
        if (!net.address.startsWith('169.254.')) {
          candidates.push(net.address);
        }
      }
    }
  }

  // Prefer standard private IP ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  const privateIp = candidates.find(ip => 
    ip.startsWith('192.168.') || ip.startsWith('10.') || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );

  return privateIp || candidates[0] || 'localhost';
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API to get local network details & QR Code for pairing
app.get('/api/info', async (req, res) => {
  const localIp = getLocalIp();
  const room = req.query.room || 'sync';
  const url = `http://${localIp}:${PORT}/?room=${encodeURIComponent(room)}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 280,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });

    res.json({
      localIp,
      port: PORT,
      url,
      qrDataUrl,
      room
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Web Share Target endpoint (handling text/links shared from Android/iOS)
app.get('/share-target', (req, res) => {
  const { title, text, url, room } = req.query;
  const content = [title, text, url].filter(Boolean).join('\n');
  const targetRoom = room || 'sync';
  res.redirect(`/?room=${encodeURIComponent(targetRoom)}&shared=${encodeURIComponent(content)}`);
});

app.post('/share-target', (req, res) => {
  const { title, text, url, room } = req.body;
  const content = [title, text, url].filter(Boolean).join('\n');
  const targetRoom = room || 'sync';
  res.redirect(`/?room=${encodeURIComponent(targetRoom)}&shared=${encodeURIComponent(content)}`);
});

// Socket.IO Realtime handling
io.on('connection', (socket) => {
  let currentRoom = null;
  let clientDeviceInfo = null;

  socket.on('join-room', ({ room, deviceType, deviceName }) => {
    if (!room) return;
    currentRoom = room.trim().toLowerCase();
    socket.join(currentRoom);

    clientDeviceInfo = {
      id: socket.id,
      type: deviceType || 'desktop',
      name: deviceName || 'Device',
      connectedAt: Date.now()
    };

    const roomData = getRoomData(currentRoom);
    roomData.devices.set(socket.id, clientDeviceInfo);

    // Send existing room history to the newly connected device
    socket.emit('init-history', roomData.clips);

    // Broadcast updated device roster to the room
    io.to(currentRoom).emit('room-status', {
      deviceCount: roomData.devices.size,
      devices: Array.from(roomData.devices.values())
    });
  });

  socket.on('send-clip', (payload) => {
    if (!currentRoom) return;

    const { content, type = 'text', deviceName } = payload;
    if (!content || !content.trim()) return;

    const clip = {
      id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      content,
      type, // 'text', 'url', 'code', 'image'
      senderName: deviceName || (clientDeviceInfo ? clientDeviceInfo.name : 'Unknown Device'),
      senderSocketId: socket.id,
      timestamp: Date.now()
    };

    const roomData = getRoomData(currentRoom);
    roomData.clips.unshift(clip);
    if (roomData.clips.length > 50) {
      roomData.clips.pop();
    }

    // Broadcast clip to everyone in the room (including sender for acknowledgment)
    io.to(currentRoom).emit('new-clip', clip);
  });

  socket.on('delete-clip', ({ id }) => {
    if (!currentRoom) return;
    const roomData = getRoomData(currentRoom);
    roomData.clips = roomData.clips.filter(c => c.id !== id);
    io.to(currentRoom).emit('clip-deleted', { id });
  });

  socket.on('clear-all', () => {
    if (!currentRoom) return;
    const roomData = getRoomData(currentRoom);
    roomData.clips = [];
    io.to(currentRoom).emit('all-cleared');
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const roomData = rooms.get(currentRoom);
      roomData.devices.delete(socket.id);
      io.to(currentRoom).emit('room-status', {
        deviceCount: roomData.devices.size,
        devices: Array.from(roomData.devices.values())
      });
      if (roomData.devices.size === 0 && roomData.clips.length === 0) {
        rooms.delete(currentRoom);
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`\n======================================================`);
  console.log(`  🚀 INSTANT CLIPBOARD BRIDGE IS RUNNING!`);
  console.log(`  💻 Laptop (Localhost): http://localhost:${PORT}`);
  console.log(`  📱 Phone (LAN / Wi-Fi): http://${localIp}:${PORT}`);
  console.log(`======================================================\n`);
});
