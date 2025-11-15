// Server di Segnalazione WebRTC con Node.js, Express e Socket.IO

const express = require('express');
const app = express();
const http = require('http').Server(app);

// Prepara la variabile CLIENT_URL rimuovendo la barra finale se presente
// Questo assicura che corrisponda all'origin inviato dal browser.
let allowedOrigin = process.env.CLIENT_URL;
if (allowedOrigin && allowedOrigin.endsWith('/')) {
  allowedOrigin = allowedOrigin.slice(0, -1);
}

// Configura l'opzione CORS per Socket.IO
const corsOptions = {
  // Se allowedOrigin è definito (da Render), lo usiamo.
  // Altrimenti, usiamo la wildcard per il testing locale.
  // Nota: Socket.IO accetta un array di origini per una configurazione più rigorosa.
  origin: allowedOrigin || "*",
  methods: ["GET", "POST"]
};

// Se allowedOrigin è definito, rendiamo l'origin un array per includere sia la versione con che senza slash
if (allowedOrigin && allowedOrigin !== '*') {
  corsOptions.origin = [
    allowedOrigin, // https://videocall.reav.space (senza slash)
    `${allowedOrigin}/` // https://videocall.reav.space/ (con slash, per sicurezza)
  ];
}


const io = require('socket.io')(http, {
  cors: corsOptions
});

// Usa la porta fornita dall'ambiente (Render) o la porta 3000 come fallback locale
const PORT = process.env.PORT || 3000;

// Struttura per tracciare le stanze e i partecipanti
const rooms = {};

// Endpoint di controllo dello stato (per verificare che il server sia attivo)
app.get('/', (req, res) => {
  res.send('Server di segnalazione Socket.IO attivo e pronto per WebRTC!');
});


// --- LOGICA SOCKET.IO ---
io.on('connection', (socket) => {
  console.log('Nuovo utente connesso:', socket.id);

  // Gestione della richiesta di unione a una stanza
  socket.on('join-room', (roomId, nickname) => {
    socket.join(roomId);
   
    // Inizializza la stanza se non esiste
    rooms[roomId] = rooms[roomId] || [];
   
    // Prepara la lista degli utenti già presenti (da inviare al nuovo utente)
    const existingUsers = rooms[roomId].map(u => ({ socketId: u.id, nickname: u.nickname }));
   
    // Aggiungi il nuovo utente alla lista della stanza
    rooms[roomId].push({ id: socket.id, nickname: nickname });

    // 1. Invia la lista degli utenti esistenti al nuovo utente (lui chiamerà loro)
    // Il nuovo utente userà 'users-in-room' per creare le Offer
    socket.emit('users-in-room', existingUsers, socket.id);

    // 2. Notifica tutti gli altri utenti nella stanza che è arrivato qualcuno (loro chiameranno lui)
    // Gli altri utenti useranno 'user-joined' per creare le Offer
    socket.to(roomId).emit('user-joined', socket.id, nickname);
   
    console.log(`Utente ${nickname} (${socket.id}) si è unito alla stanza ${roomId}`);
  });

  // Inoltra l'Offer SDP dal Caller al Callee
  socket.on('offer', (id, message) => {
    // Inoltra il messaggio (Offer) all'ID socket specificato
    socket.to(id).emit('offer', socket.id, message);
  });

  // Inoltra l'Answer SDP dal Callee al Caller
  socket.on('answer', (id, message) => {
    // Inoltra il messaggio (Answer) all'ID socket specificato
    socket.to(id).emit('answer', socket.id, message);
  });

  // Inoltra i candidati ICE (informazioni di rete)
  socket.on('candidate', (id, message) => {
    // Inoltra il candidato ICE all'ID socket specificato
    socket.to(id).emit('candidate', socket.id, message);
  });

  // Gestione della disconnessione di un utente
  socket.on('disconnect', () => {
    console.log('Utente disconnesso:', socket.id);
   
    // Trova e rimuovi l'utente dalla stanza
    for (const roomId in rooms) {
      let userLeft = false;
      // Filtra l'utente disconnesso dalla lista
      rooms[roomId] = rooms[roomId].filter(user => {
        if (user.id === socket.id) {
          userLeft = true;
          return false; // Rimuovi questo utente
        }
        return true;
      });

      // Se l'utente era in questa stanza, notifica gli altri
      if (userLeft) {
        socket.to(roomId).emit('user-left', socket.id);
      }
    }
  });
});
// --- FINE LOGICA SOCKET.IO ---


// Il server HTTP inizia ad ascoltare
http.listen(PORT, () => {
  console.log(`Server di segnalazione in ascolto sulla porta ${PORT}`);
});