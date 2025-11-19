// server.js - server WebRTC locale HTTP
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);

const io = require('socket.io')(server, {
  cors: { origin: "*" } // consenti richieste da localhost
});

const PORT = 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: __dirname + '/public' });
});

const rooms = {};

io.on('connection', socket => {
  console.log('Nuovo utente connesso:', socket.id);

  socket.on('join-room', (roomId, nickname) => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push({ id: socket.id, nickname });
    
    // invia la lista degli utenti già presenti
    const usersInRoom = rooms[roomId].filter(u => u.id !== socket.id);
    socket.emit('welcome', socket.id, nickname, usersInRoom);

    // notifica gli altri
    socket.to(roomId).emit('peer-joined', socket.id, nickname);
    console.log(`${nickname} si è unito a ${roomId}`);
  });

  // La logica per 'raise-hand' è stata rimossa qui.

  socket.on('offer', (id, message) => socket.to(id).emit('offer', socket.id, message));
  socket.on('answer', (id, message) => socket.to(id).emit('answer', socket.id, message));
  socket.on('candidate', (id, message) => socket.to(id).emit('candidate', socket.id, message));

  socket.on('send-message', (roomId, senderNickname, message) => {
    socket.to(roomId).emit('new-message', senderNickname, message);
  });

  socket.on('disconnect', () => {
    console.log('Utente disconnesso:', socket.id);
    // Rimuovi l'utente dalla stanza e notifica gli altri
    for (const roomId in rooms) {
      const index = rooms[roomId].findIndex(user => user.id === socket.id);
      if (index !== -1) {
        const [user] = rooms[roomId].splice(index, 1);
        socket.to(roomId).emit('peer-left', socket.id);
        console.log(`${user.nickname} ha lasciato ${roomId}`);
        break;
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server in ascolto su http://localhost:${PORT}`);
});