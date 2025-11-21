// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// *** CONFIGURAZIONE ADMIN ***
const ADMIN_PASSWORD = "admin123"; // <--- CAMBIA QUESTA PASSWORD!

const io = new Server(server, {
 cors: {
  origin: '*', 
  methods: ['GET', 'POST']
 }
});

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {}; 
const whiteboardHistory = {}; 
const admins = new Set(); // Set di socket ID che sono admin loggati

io.on('connection', (socket) => {
 console.log('Nuovo client connesso', socket.id);

 socket.on('join-room', (roomId, nickname) => {
  socket.join(roomId);

  if (!rooms[roomId]) rooms[roomId] = {};
  if (!whiteboardHistory[roomId]) whiteboardHistory[roomId] = [];

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

  if(whiteboardHistory[roomId] && whiteboardHistory[roomId].length > 0) {
      socket.emit('wb-history', whiteboardHistory[roomId]);
  }

  socket.to(roomId).emit('peer-joined', socket.id, nickname);
  
  // Aggiorna gli admin se ci sono cambiamenti
  broadcastAdminUpdate();
 });

  // **********************************************
  // ***** INIZIO LOGICA ADMIN ********************
  // **********************************************

  socket.on('admin-login', (password) => {
      if (password === ADMIN_PASSWORD) {
          admins.add(socket.id);
          socket.emit('admin-login-success');
          sendAdminData(socket.id); // Invia dati iniziali
      } else {
          socket.emit('admin-login-fail');
      }
  });

  socket.on('admin-kick-user', (targetSocketId) => {
      if (!admins.has(socket.id)) return; // Sicurezza
      
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
          targetSocket.emit('kicked-by-admin'); // Avvisa l'utente
          targetSocket.disconnect(true); // Disconnetti forzatamente
          console.log(`Admin ${socket.id} ha espulso ${targetSocketId}`);
      }
      broadcastAdminUpdate(); // Aggiorna la lista
  });

  socket.on('admin-close-room', (targetRoomId) => {
      if (!admins.has(socket.id)) return;

      // Disconnetti tutti nella stanza
      io.in(targetRoomId).fetchSockets().then(sockets => {
          sockets.forEach(s => {
              s.emit('room-closed-by-admin');
              s.disconnect(true);
          });
      });
      
      // Pulisci dati server
      delete rooms[targetRoomId];
      delete whiteboardHistory[targetRoomId];
      
      broadcastAdminUpdate();
  });

  socket.on('admin-refresh', () => {
      if(admins.has(socket.id)) sendAdminData(socket.id);
  });

  // Helper: Manda i dati a un admin specifico
  function sendAdminData(adminSocketId) {
      const stats = {
          totalUsers: io.engine.clientsCount,
          rooms: rooms
      };
      io.to(adminSocketId).emit('admin-data-update', stats);
  }

  // Helper: Aggiorna tutti gli admin attivi
  function broadcastAdminUpdate() {
      if (admins.size === 0) return;
      const stats = {
          totalUsers: io.engine.clientsCount,
          rooms: rooms
      };
      admins.forEach(adminId => {
          io.to(adminId).emit('admin-data-update', stats);
      });
  }

  // **********************************************
  // ***** FINE LOGICA ADMIN **********************
  // **********************************************

  socket.on('send-message', (roomId, senderNickname, message) => {
    socket.to(roomId).emit('new-message', senderNickname, message);
  });

  socket.on('send-private-message', (roomId, recipientId, senderNickname, message) => {
    io.to(recipientId).emit('new-private-message', senderNickname, message);
  });

  socket.on('wb-draw', (roomId, data) => {
      if (!whiteboardHistory[roomId]) whiteboardHistory[roomId] = [];
      whiteboardHistory[roomId].push(data);
      socket.to(roomId).emit('wb-draw', data);
  });

  socket.on('wb-clear', (roomId) => {
      whiteboardHistory[roomId] = []; 
      io.to(roomId).emit('wb-clear'); 
  });

  socket.on('wb-undo', (roomId) => {
      if (whiteboardHistory[roomId] && whiteboardHistory[roomId].length > 0) {
          whiteboardHistory[roomId].pop(); 
          io.to(roomId).emit('wb-history', whiteboardHistory[roomId]);
      }
  });
  
  socket.on('wb-request-history', (roomId) => {
      if (whiteboardHistory[roomId] && whiteboardHistory[roomId].length > 0) {
          socket.emit('wb-history', whiteboardHistory[roomId]);
      }
  });

  socket.on('offer', (toId, offer) => { io.to(toId).emit('offer', socket.id, offer); });
  socket.on('answer', (toId, answer) => { io.to(toId).emit('answer', socket.id, answer); });
  socket.on('candidate', (toId, candidate) => { io.to(toId).emit('candidate', socket.id, candidate); });
  socket.on('audio-status-changed', (room, isTalking) => { socket.to(room).emit('audio-status-changed', socket.id, isTalking); });
  socket.on('stream-type-changed', (room, newRatio) => { socket.to(room).emit('remote-stream-type-changed', socket.id, newRatio); });

  socket.on('disconnect', () => {
   // Rimuovi dagli admin se era un admin
   if (admins.has(socket.id)) admins.delete(socket.id);

   let roomId = null;
   let disconnectedNickname = 'Un utente';

   for (const id in rooms) {
    if (rooms[id][socket.id]) {
     roomId = id;
     disconnectedNickname = rooms[id][socket.id];
     delete rooms[id][socket.id];

     if (Object.keys(rooms[id]).length === 0) {
      delete rooms[id];
      delete whiteboardHistory[id]; 
     }
     break;
    }
   }

   if (roomId) {
    socket.to(roomId).emit('peer-left', socket.id, disconnectedNickname);
   }
   broadcastAdminUpdate(); // Aggiorna admin
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
 console.log(`Server Socket.IO e WebRTC in ascolto sulla porta ${PORT}`);
});