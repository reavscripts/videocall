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

 let roomId = null; // Memorizza l'ID della stanza per l'uso in disconnect

 socket.on('join-room', (roomIdReq, nickname) => {
  
  if (!rooms[roomIdReq]) rooms[roomIdReq] = {};

  // **************************************************
  // *** NUOVO CONTROLLO: Verifica Nickname Duplicato ***
  const nicknamesInRoom = Object.values(rooms[roomIdReq]);
  if (nicknamesInRoom.includes(nickname)) {
    // Rifiuta la connessione e invia un errore specifico al client
    socket.emit('nickname-in-use', `Il nickname '${nickname}' è già in uso nella stanza ${roomIdReq}.`);
    return; // BLOCCA l'unione alla stanza
  }
  // **************************************************
  
  // Prosegui con l'unione alla stanza
  roomId = roomIdReq; 
  socket.join(roomId);

  rooms[roomId][socket.id] = nickname;

  // Avvisa chi era già nella stanza
  const peers = Object.entries(rooms[roomId])
   .filter(([id]) => id !== socket.id)
   .map(([id, nick]) => ({ id, nickname: nick }));

  socket.emit('welcome', socket.id, nickname, peers);

  // Avvisa gli altri peer
  socket.to(roomId).emit('peer-joined', socket.id, nickname);

  console.log(`Utente ${nickname} (${socket.id}) si è unito alla stanza ${roomId}`);
 });

 // ******************************************************
 // ***** Gestione Chat Pubblica *****
 // ******************************************************
 socket.on('send-message', (roomId, senderNickname, message) => {
  // Inoltra il messaggio a tutti i client nella stanza, escluso il mittente
  socket.to(roomId).emit('new-message', senderNickname, message);
 });
 
 // ******************************************************
 // ***** Gestione Messaggi Privati (DM) *****
 // ******************************************************
  socket.on('send-private-message', (roomId, recipientId, senderNickname, message) => {
    // Inoltra il messaggio SOLO al socket ID specifico del destinatario
    // 'io.to(recipientId)' invia l'evento 'new-private-message' solo al client destinatario.
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

  socket.on('stream-type-changed', (room, newRatio) => {
   socket.to(room).emit('remote-stream-type-changed', socket.id, newRatio);
  });

  // Gestione Mute/Unmute Remoto
  socket.on('toggle-remote-mute', (targetId) => {
    io.to(targetId).emit('remote-mute-toggled', socket.id);
  });
  
  // Gestione Microfono/Video Status
  socket.on('update-status', (roomId, isAudioEnabled, isVideoEnabled) => {
    socket.to(roomId).emit('peer-status-updated', socket.id, isAudioEnabled, isVideoEnabled);
  });

  socket.on('disconnect', () => {
   console.log('Client disconnesso', socket.id);
   
   if (rooms[roomId]) {
    const disconnectedNickname = rooms[roomId][socket.id];
    delete rooms[roomId][socket.id];
    
    // Rimuovi la stanza se non ci sono più peer
    if (Object.keys(rooms[roomId]).length === 0) {
     delete rooms[roomId];
     console.log(`Stanza ${roomId} chiusa.`);
    } else {
     // Avvisa gli altri peer della disconnessione
     socket.to(roomId).emit('peer-disconnected', socket.id, disconnectedNickname);
    }
   }
  });
});

// Avvio del server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
 console.log(`Server di segnalazione in ascolto sulla porta ${PORT}`);
});