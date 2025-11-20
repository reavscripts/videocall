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

  // *** Inizializzazione nickname e gestione esistenza stanza ***
  if (!rooms[roomId]) rooms[roomId] = {};
  
  // *** CONTROLLO UNICITÀ NICKNAME PRIMA DI AGGIUNGERLO ***
  const nicknameExists = Object.values(rooms[roomId]).some(existingNick => existingNick.toLowerCase() === nickname.toLowerCase());

  if (nicknameExists) {
    socket.emit('nickname-in-use', `Il nickname '${nickname}' è già in uso in questa stanza.`);
    socket.disconnect(true); // Disconnetti il socket immediatamente
    return;
  }
  
  rooms[roomId][socket.id] = nickname;
  
  // Avvisa chi era già nella stanza
  const peers = Object.entries(rooms[roomId])
   .filter(([id]) => id !== socket.id)
   .map(([id, nick]) => ({ id, nickname: nick }));

  socket.emit('welcome', socket.id, nickname, peers);

  // Avvisa gli altri peer
  socket.to(roomId).emit('peer-joined', socket.id, nickname);
  console.log(`${nickname} (${socket.id}) si è unito alla stanza ${roomId}`);
 });

  // ******************************************************
  // ***** CHAT PUBBLICA: Evento 'send-message' aggiunto *****
  socket.on('send-message', (roomId, senderNickname, message) => {
    // Inoltra il messaggio a tutti tranne il mittente
    socket.to(roomId).emit('new-message', senderNickname, message);
    console.log(`Messaggio Pubblico in ${roomId} da ${senderNickname}: ${message}`);
  });
  // ******************************************************

  // ******************************************************
  // ***** CHAT PRIVATA: Logica esistente *****
  socket.on('send-private-message', (roomId, recipientId, senderNickname, message) => {
    // Inoltra il messaggio SOLO al socket ID specifico del destinatario
    io.to(recipientId).emit('new-private-message', senderNickname, message);
   
    // Log opzionale sul server
    console.log(`DM inviato da ${senderNickname} (stanza ${roomId}) a socket ${recipientId}`);
  });
  // ******************************************************

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

  socket.on('audio-status-changed', (room, isTalking) => {
    socket.to(room).emit('audio-status-changed', socket.id, isTalking);
  });
  
  socket.on('stream-type-changed', (room, newRatio) => {
   socket.to(room).emit('remote-stream-type-changed', socket.id, newRatio);
  });

  socket.on('disconnect', () => {
   let roomId = null;
   let disconnectedNickname = 'Un utente';

   // Cerca la stanza e il nickname
   for (const id in rooms) {
    if (rooms[id][socket.id]) {
     roomId = id;
     disconnectedNickname = rooms[id][socket.id];
     delete rooms[id][socket.id];

     // Se la stanza è vuota, eliminala
     if (Object.keys(rooms[id]).length === 0) {
      delete rooms[id];
     }
     break;
    }
   }

   if (roomId) {
    console.log(`${disconnectedNickname} (${socket.id}) ha lasciato la stanza ${roomId}`);
    // Avvisa tutti nella stanza
    socket.to(roomId).emit('peer-left', socket.id, disconnectedNickname);
   } else {
    console.log('Client disconnesso', socket.id);
   }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
 console.log(`Server Socket.IO e WebRTC in ascolto sulla porta ${PORT}`);
});