// Esempio server.js (Node.js + Socket.IO)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
// Configura CORS per permettere al tuo frontend di connettersi
const io = new Server(server, {
    cors: {
        origin: "*", // Permetti tutte le origini (o specifica il dominio del tuo frontend)
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log(`Utente connesso: ${socket.id}`);

    // --- LOGICA DI SEGNALAZIONE (WEBRTC) ---

    // Un utente si unisce a una stanza
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`Utente ${socket.id} si è unito alla stanza ${roomId}`);
        // Invia notifica a tutti gli altri nella stanza
        socket.to(roomId).emit('user-connected', socket.id);
    });

    // Inoltro delle Offerte SDP
    socket.on('sdp-offer', (data) => {
        // Inoltra l'offerta all'utente target nella stanza
        socket.to(data.targetId).emit('sdp-offer', { senderId: socket.id, offer: data.offer });
    });

    // Inoltro delle Risposte SDP
    socket.on('sdp-answer', (data) => {
        // Inoltra la risposta all'utente target
        socket.to(data.targetId).emit('sdp-answer', { senderId: socket.id, answer: data.answer });
    });

    // Inoltro dei Candidati ICE
    socket.on('ice-candidate', (data) => {
        // Inoltra il candidato all'utente target
        socket.to(data.targetId).emit('ice-candidate', { senderId: socket.id, candidate: data.candidate });
    });

    // --- LOGICA CHAT INTEGRATA ---
    socket.on('chatMessage', (msg) => {
        // Aggiungi l'ID del mittente per differenziare i messaggi
        const messageWithSender = { ...msg, user: socket.id.substring(0, 4) }; 
        // Inoltra il messaggio a tutti nella stanza (incluso il mittente per visualizzazione locale)
        io.to(msg.room).emit('chatMessage', messageWithSender); 
    });

    // --- DISCONNESSIONE ---
    socket.on('disconnect', () => {
        console.log(`Utente disconnesso: ${socket.id}`);
        // Logica per notificare gli altri peer che questo utente ha lasciato
        // (es: io.emit('user-disconnected', socket.id);)
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server Socket.IO in ascolto sulla porta ${PORT}`);
});