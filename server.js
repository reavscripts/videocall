// Server di Segnalazione WebRTC con Node.js, Express e Socket.IO

const express = require('express');
const app = express();
const http = require('http').Server(app);

// Prepara la variabile CLIENT_URL rimuovendo la barra finale se presente
let allowedOrigin = process.env.CLIENT_URL;
if (allowedOrigin && allowedOrigin.endsWith('/')) {
  allowedOrigin = allowedOrigin.slice(0, -1);
}

// Configura l'opzione CORS per Socket.IO
const corsOptions = {
  origin: allowedOrigin || "*",
  methods: ["GET", "POST"]
};

if (allowedOrigin && allowedOrigin !== '*') {
  corsOptions.origin = [
    allowedOrigin, 
    `${allowedOrigin}/`
  ];
}


const io = require('socket.io')(http, {
  cors: corsOptions
});

const PORT = process.env.PORT || 3000;

const rooms = {};

// Endpoint di controllo dello stato
app.get('/', (req, res) => {
  res.send('Server di segnalazione Socket.IO attivo e pronto per WebRTC!');
});


// --- LOGICA SOCKET.IO ---
io.on('connection', (socket) => {
  console.log('Nuovo utente connesso:', socket.id);

  // Gestione della richiesta di unione a una stanza
  socket.on('join-room', (roomId, nickname) => {
    socket.join(roomId);
   
    rooms[roomId] = rooms[roomId] || [];
   
    const existingUsers = rooms[roomId].map(u => ({ socketId: u.id, nickname: u.nickname }));
   
    rooms[roomId].push({ id: socket.id, nickname: nickname });

    socket.emit('users-in-room', existingUsers, socket.id);

    socket.to(roomId).emit('user-joined', socket.id, nickname);
   
    console.log(`Utente ${nickname} (${socket.id}) si è unito alla stanza ${roomId}`);
  });
  
  // ✅ NUOVA LOGICA: Gestione e Broadcast dei Messaggi di Chat
  socket.on('chat-message', (message) => {
    // Trova la stanza a cui è unito l'utente (è l'unica oltre al suo socket.id)
    const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
    // Ottieni il nickname dall'handshake, come fatto durante il join
    const nickname = socket.handshake.query.nickname || 'Ospite';

    if (roomId) {
      // Usa socket.to(roomId).emit() per inviare a tutti nella stanza ESCLUSO il mittente.
      socket.to(roomId).emit('chat-message', socket.id, nickname, message);
    }
  });
  // -----------------------------------------------------------------

  // Inoltra l'Offer SDP
  socket.on('offer', (id, message) => {
    socket.to(id).emit('offer', socket.id, message);
  });

  // Inoltra l'Answer SDP
  socket.on('answer', (id, message) => {
    socket.to(id).emit('answer', socket.id, message);
  });

  // Inoltra i candidati ICE
  socket.on('candidate', (id, message) => {
    socket.to(id).emit('candidate', socket.id, message);
  });

  // Gestione della disconnessione di un utente
  socket.on('disconnect', () => {
    console.log('Utente disconnesso:', socket.id);
   
    for (const roomId in rooms) {
      let userLeft = false;
      rooms[roomId] = rooms[roomId].filter(user => {
        if (user.id === socket.id) {
          userLeft = true;
          return false;
        }
        return true;
      });

      if (userLeft) {
        socket.to(roomId).emit('user-left', socket.id);
      }
    }
  });
});
// --- FINE LOGICA SOCKET.IO ---


http.listen(PORT, () => {
  console.log(`Server di segnalazione in ascolto sulla porta ${PORT}`);
});