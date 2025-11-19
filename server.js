// Server di Segnalazione WebRTC con Node.js, Express e Socket.IO
const express = require('express');
const app = express();

// -----------------------------------------------------------
// 🚀 CONFIGURAZIONE HTTPS (Necessaria per getUserMedia su localhost)
// IMPORTANTE: Assicurati che i file key.pem e cert.pem siano nella stessa cartella di server.js.
const https = require('https');
const http = require('http');
const fs = require('fs'); 

// 1. Configurazione dei certificati
const options = {
  key: fs.readFileSync('key.pem'), 
  cert: fs.readFileSync('cert.pem')
};

// 2. Creazione del server HTTPS
const server = https.createServer(options, app);
// ------------------FINE LOCAL-----------------------------------------

// server.js (Configurazione standard per ambiente Live/Produzione)
//const http = require('http'); // Usiamo HTTP standard
//const server = http.createServer(app); // Crea server HTTP
// ...

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


// 3. Socket.IO utilizza ora il server HTTPS
const io = require('socket.io')(server, {
  cors: corsOptions
});

const PORT = process.env.PORT || 3000;

const rooms = {};

// ----------------------------------------------------------------------
// 4. CONFIGURAZIONE FILE STATICI DA CARTELLA 'public'
// Ora Express sa che i file come app.js, style.css, e le immagini sono in public/
app.use(express.static('public')); 
// ----------------------------------------------------------------------


// 5. Endpoint di controllo dello stato e invio di index.html
// Poiché il browser cerca index.html nella radice, lo inviamo dalla cartella 'public'.
app.get('/', (req, res) => {
  // 🎯 res.sendFile cerca il file nella directory 'public', grazie all'argomento 'root'
  res.sendFile('index.html', { root: __dirname + '/public' }); 
});


// --- LOGICA SOCKET.IO ---
io.on('connection', (socket) => {
  console.log('Nuovo utente connesso:', socket.id);

  // Gestione della richiesta di unione a una stanza
  socket.on('join-room', (roomId, nickname) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }
    
    // Controlla se l'utente è già presente
    const isPresent = rooms[roomId].some(user => user.id === socket.id);

    if (!isPresent) {
        rooms[roomId].push({ id: socket.id, nickname: nickname });
    }

    // Invia al nuovo utente la lista degli utenti già presenti
    const usersInRoom = rooms[roomId].filter(user => user.id !== socket.id);
    socket.emit('users-in-room', usersInRoom);

    // Notifica tutti gli altri utenti della stanza del nuovo arrivato
    socket.to(roomId).emit('user-joined', socket.id, nickname);
    
    console.log(`Utente ${nickname} (${socket.id}) si è unito alla stanza: ${roomId}`);
  });

  // Gestione dei messaggi di chat
  socket.on('chat-message', (message) => {
    // Trova la stanza in cui si trova l'utente.
    const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
    const nickname = socket.handshake.query.nickname || 'Ospite';

    if (roomId) {
      // Invia a tutti nella stanza ESCLUSO il mittente.
      socket.to(roomId).emit('chat-message', socket.id, nickname, message);
    }
  });

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
          return false; // Rimuovi l'utente dalla lista
        }
        return true;
      });

      if (userLeft) {
        // Notifica la stanza che l'utente ha lasciato
        socket.to(roomId).emit('user-left', socket.id);
        
        // Rimuovi la stanza se è vuota
        if (rooms[roomId].length === 0) {
          delete rooms[roomId];
        }
        break; 
      }
    }
  });
});

// Avvia il server HTTPS sulla PORTA
server.listen(PORT, () => {
  console.log(`Server di segnalazione Socket.IO attivo su: https://localhost:${PORT}`);
  console.log('Per testare la webcam, devi accedere con HTTPS e accettare l\'avviso di sicurezza nel browser.');
});