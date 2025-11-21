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
  origin: '*', 
  methods: ['GET', 'POST']
 }
});

// Serve file statici (HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

// Rooms e nicknames
const rooms = {}; // { roomId: { socketId: nickname, ... } }

// *** CRONOLOGIA WHITEBOARD ***
const whiteboardHistory = {}; // { roomId: [ { type: 'line', x0, y0, x1, y1, color, width }, ... ] }

// Gestione connessione Socket.IO
io.on('connection', (socket) => {
 console.log('Nuovo client connesso', socket.id);

 socket.on('join-room', (roomId, nickname) => {
  socket.join(roomId);

  if (!rooms[roomId]) rooms[roomId] = {};
  
  // Inizializza cronologia whiteboard se non esiste
  if (!whiteboardHistory[roomId]) whiteboardHistory[roomId] = [];

  // Controllo unicità nickname
  const nicknameExists = Object.values(rooms[roomId]).some(existingNick => existingNick.toLowerCase() === nickname.toLowerCase());

  if (nicknameExists) {
    socket.emit('nickname-in-use', `Il nickname '${nickname}' è già in uso in questa stanza.`);
    socket.disconnect(true); 
    return;
  }
  
  rooms[roomId][socket.id] = nickname;
  
  const peers = Object.entries(rooms[roomId])
   .filter(([id]) => id !== socket.id)
   .map(([id, nick]) => ({ id, nickname: nick }));

  socket.emit('welcome', socket.id, nickname, peers);

  // *** Invia lo stato attuale della whiteboard al nuovo utente ***
  if(whiteboardHistory[roomId] && whiteboardHistory[roomId].length > 0) {
      socket.emit('wb-history', whiteboardHistory[roomId]);
  }

  socket.to(roomId).emit('peer-joined', socket.id, nickname);
  console.log(`${nickname} (${socket.id}) si è unito alla stanza ${roomId}`);
 });

  socket.on('send-message', (roomId, senderNickname, message) => {
    socket.to(roomId).emit('new-message', senderNickname, message);
  });

  socket.on('send-private-message', (roomId, recipientId, senderNickname, message) => {
    io.to(recipientId).emit('new-private-message', senderNickname, message);
  });

  // **********************************************
  // ***** INIZIO LOGICA WHITEBOARD ***************
  // **********************************************

  socket.on('wb-draw', (roomId, data) => {
      if (!whiteboardHistory[roomId]) whiteboardHistory[roomId] = [];
      whiteboardHistory[roomId].push(data);
      // Inoltra il tratto a tutti gli altri
      socket.to(roomId).emit('wb-draw', data);
  });

  socket.on('wb-clear', (roomId) => {
      console.log(`[Whiteboard] Clear requested for room ${roomId}`);
      whiteboardHistory[roomId] = []; // Pulisci server
      io.to(roomId).emit('wb-clear'); // Avvisa tutti
  });

  socket.on('wb-undo', (roomId) => {
      console.log(`[Whiteboard] Undo requested for room ${roomId}`); // LOG DI DEBUG
      
      if (whiteboardHistory[roomId] && whiteboardHistory[roomId].length > 0) {
          whiteboardHistory[roomId].pop(); // Rimuovi l'ultima azione
          
          console.log(`[Whiteboard] Undo executed. Remaining strokes: ${whiteboardHistory[roomId].length}`);
          
          // Invia la nuova cronologia completa a tutti per ridisegnare
          io.to(roomId).emit('wb-history', whiteboardHistory[roomId]);
      } else {
          console.log(`[Whiteboard] Undo ignored: History empty or room undefined`);
      }
  });
  
  socket.on('wb-request-history', (roomId) => {
      if (whiteboardHistory[roomId] && whiteboardHistory[roomId].length > 0) {
          // Invia la history SOLO al richiedente (socket)
          socket.emit('wb-history', whiteboardHistory[roomId]);
      }
  });

  // **********************************************
  // ***** FINE LOGICA WHITEBOARD *****************
  // **********************************************

  socket.on('offer', (toId, offer) => {
   io.to(toId).emit('offer', socket.id, offer);
  });

  socket.on('answer', (toId, answer) => {
   io.to(toId).emit('answer', socket.id, answer);
  });

  socket.on('candidate', (toId, candidate) => {
   io.to(toId).emit('candidate', socket.id, candidate);
  });

  socket.on('audio-status-changed', (room, isTalking) => {
    socket.to(room).emit('audio-status-changed', socket.id, isTalking);
  });
  
  socket.on('stream-type-changed', (room, newRatio) => {
   socket.to(room).emit('remote-stream-type-changed', socket.id, newRatio);
  });

  socket.on('disconnect', () => {
   let roomId = null;
   let disconnectedNickname = 'Un utente';

   for (const id in rooms) {
    if (rooms[id][socket.id]) {
     roomId = id;
     disconnectedNickname = rooms[id][socket.id];
     delete rooms[id][socket.id];

     if (Object.keys(rooms[id]).length === 0) {
      delete rooms[id];
      delete whiteboardHistory[id]; // Pulisci whiteboard se la stanza è vuota
     }
     break;
    }
   }

   if (roomId) {
    socket.to(roomId).emit('peer-left', socket.id, disconnectedNickname);
   }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
 console.log(`Server Socket.IO e WebRTC in ascolto sulla porta ${PORT}`);
});