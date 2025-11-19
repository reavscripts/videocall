// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configurazione Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*', // modifica con il tuo dominio in produzione
    methods: ['GET', 'POST']
  }
});

// Serve file statici (HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

// Rooms e nicknames
const rooms = {}; // { roomId: { socketId: nickname, ... } }

// Gestione connessione Socket.IO
io.on('connection', (socket) => {
  console.log('Nuovo client connesso', socket.id);

  socket.on('join-room', (roomId, nickname) => {
    socket.join(roomId);

    if (!rooms[roomId]) rooms[roomId] = {};
    rooms[roomId][socket.id] = nickname;

    // Avvisa chi era già nella stanza
    const peers = Object.entries(rooms[roomId])
      .filter(([id]) => id !== socket.id)
      .map(([id, nick]) => ({ id, nickname: nick }));

    socket.emit('welcome', socket.id, nickname, peers);

    // Avvisa gli altri peer
    socket.to(roomId).emit('peer-joined', socket.id, nickname);

    // Messaggi chat
    socket.on('send-message', (room, sender, message) => {
      io.to(room).emit('new-message', sender, message);
    });

    // Offerte/Answer ICE per WebRTC
    socket.on('offer', (toId, offer) => {
      io.to(toId).emit('offer', socket.id, offer);
    });

    socket.on('answer', (toId, answer) => {
      io.to(toId).emit('answer', socket.id, answer);
    });

    socket.on('candidate', (toId, candidate) => {
      io.to(toId).emit('candidate', socket.id, candidate);
    });

    socket.on('stream-type-changed', (room, newRatio) => {
      socket.to(room).emit('remote-stream-type-changed', socket.id, newRatio);
    });

    socket.on('disconnect', () => {
      if (rooms[roomId]) {
        delete rooms[roomId][socket.id];
        socket.to(roomId).emit('peer-left', socket.id);
        if (Object.keys(rooms[roomId]).length === 0) delete rooms[roomId];
      }
      console.log(`Client ${socket.id} disconnesso`);
    });
  });
});

// Avvio server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server in ascolto su porta ${PORT}`));
