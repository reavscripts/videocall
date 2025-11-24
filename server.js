// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "reav_123";

const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(express.static(path.join(__dirname, 'public')));

// DATI IN MEMORIA
const rooms = {}; // { roomId: { socketId: nickname } }
// Nuove strutture dati
const roomConfigs = {}; // { roomId: { password: '...', isLocked: false } }
const bannedIPs = new Set(); // Set di stringhe IP
const admins = new Set(); 

// Helper per ottenere IP (funziona anche su Render/Heroku)
function getClientIp(socket) {
    const header = socket.handshake.headers['x-forwarded-for'];
    if (header) return header.split(',')[0].trim();
    return socket.handshake.address;
}

// Helper Log Admin
function logToAdmin(message) {
    const time = new Date().toLocaleTimeString();
    const logMsg = `[${time}] ${message}`;
    console.log(logMsg); // Log server console
    // Invia a tutti gli admin connessi
    admins.forEach(adminId => {
        io.to(adminId).emit('admin-log', logMsg);
    });
}

io.on('connection', (socket) => {
    const clientIp = getClientIp(socket);
    
    // 1. CONTROLLO BAN IP ALLA CONNESSIONE
    if (bannedIPs.has(clientIp)) {
        socket.emit('kicked-by-admin', 'Il tuo indirizzo IP è stato bannato da questo server.');
        socket.disconnect(true);
        return; // Stop execution
    }

    logToAdmin(`Nuova connessione: ${socket.id} (IP: ${clientIp})`);

    socket.on('join-room', (roomId, nickname, password = "") => {
        // 2. CONTROLLO BAN (Doppio check per sicurezza)
		if (bannedIPs.has(clientIp)) {
            socket.emit('error-message', 'Sei bannato.');
            return;
        }

        if (!roomConfigs[roomId]) {
            // Se la stanza non esiste, la creo usando la password fornita dall'utente
            roomConfigs[roomId] = { 
                password: password, // <--- ASSEGNA LA PASSWORD QUI
                isLocked: false 
            };
            
            if(password) {
                logToAdmin(`Stanza ${roomId} creata con password.`);
            }
        }
        const config = roomConfigs[roomId];

        // 3. CONTROLLO ROOM LOCK
        if (config.isLocked) {
            socket.emit('error-message', 'Questa stanza è bloccata momentaneamente.');
            return;
        }

        // 4. CONTROLLO PASSWORD
        if (config.password && config.password !== password) {
            socket.emit('error-message', 'Password della stanza errata.');
            return;
        }

        socket.join(roomId);

        if (!rooms[roomId]) rooms[roomId] = {};
        
        // Controllo nickname duplicato
        const nicknameExists = Object.values(rooms[roomId]).some(n => n.toLowerCase() === nickname.toLowerCase());
        if (nicknameExists) {
            socket.emit('nickname-in-use', `Il nickname '${nickname}' è già in uso.`);
            return;
        }

        rooms[roomId][socket.id] = nickname;
        
        logToAdmin(`User joined: ${nickname} -> ${roomId}`);

        const peers = Object.entries(rooms[roomId])
            .filter(([id]) => id !== socket.id)
            .map(([id, nick]) => ({ id, nickname: nick }));

        socket.emit('welcome', socket.id, nickname, peers);
        socket.to(roomId).emit('peer-joined', socket.id, nickname);
        
        broadcastAdminUpdate();
    });

    // *** LOGICA ADMIN AGGIORNATA ***

    socket.on('admin-login', (password) => {
        if (password === ADMIN_PASSWORD) {
            admins.add(socket.id);
            socket.emit('admin-login-success');
            sendAdminData(socket.id);
            logToAdmin(`Admin loggato: ${socket.id}`);
        } else {
            socket.emit('admin-login-fail');
            logToAdmin(`Tentativo login admin fallito da IP: ${clientIp}`);
        }
    });

    socket.on('admin-ban-ip', (targetSocketId) => {
        if (!admins.has(socket.id)) return;
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
            const targetIp = getClientIp(targetSocket);
            bannedIPs.add(targetIp);
            targetSocket.emit('kicked-by-admin', "Sei stato bannato permanentemente.");
            targetSocket.disconnect(true);
            logToAdmin(`BAN IP Eseguito su ${targetIp}`);
            broadcastAdminUpdate();
        }
    });

    socket.on('admin-toggle-lock', (roomId) => {
        if (!admins.has(socket.id) || !roomConfigs[roomId]) return;
        roomConfigs[roomId].isLocked = !roomConfigs[roomId].isLocked;
        logToAdmin(`Stanza ${roomId} Lock: ${roomConfigs[roomId].isLocked}`);
        broadcastAdminUpdate();
    });

    socket.on('admin-set-password', (roomId, newPass) => {
        if (!admins.has(socket.id) || !roomConfigs[roomId]) return;
        roomConfigs[roomId].password = newPass;
        logToAdmin(`Stanza ${roomId} Password impostata.`);
        broadcastAdminUpdate();
    });

    // Kick e Close (Esistenti)
    socket.on('admin-kick-user', (targetSocketId) => {
        if (!admins.has(socket.id)) return;
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
            targetSocket.emit('kicked-by-admin', "Espulso dall'admin.");
            targetSocket.disconnect(true);
            logToAdmin(`Kick utente ${targetSocketId}`);
        }
        broadcastAdminUpdate();
    });

    socket.on('admin-close-room', (targetRoomId) => {
        if (!admins.has(socket.id)) return;
        io.in(targetRoomId).fetchSockets().then(sockets => {
            sockets.forEach(s => { s.emit('room-closed-by-admin'); s.disconnect(true); });
        });
        delete rooms[targetRoomId];
        delete roomConfigs[targetRoomId]; // Pulisci config
        logToAdmin(`Stanza chiusa: ${targetRoomId}`);
        broadcastAdminUpdate();
    });

    socket.on('admin-refresh', () => {
        if(admins.has(socket.id)) sendAdminData(socket.id);
    });

    function sendAdminData(adminSocketId) {
        const stats = {
            totalUsers: io.engine.clientsCount,
            rooms: rooms,
            configs: roomConfigs, // Inviamo anche le config
            bannedCount: bannedIPs.size
        };
        io.to(adminSocketId).emit('admin-data-update', stats);
    }

    function broadcastAdminUpdate() {
        if (admins.size === 0) return;
        const stats = {
            totalUsers: io.engine.clientsCount,
            rooms: rooms,
            configs: roomConfigs,
            bannedCount: bannedIPs.size
        };
        admins.forEach(adminId => io.to(adminId).emit('admin-data-update', stats));
    }

    // ... Gestione Messaggi, WebRTC, Whiteboard invariata ...
	socket.on('send-message', (r, s, m, msgId) => {
        // Se il client non invia ID (vecchie versioni), ne generiamo uno noi, ma meglio che lo faccia il client
        const finalId = msgId || Date.now().toString(); 
        socket.to(r).emit('new-message', s, m, finalId);
    });
	socket.on('msg-read', (roomId, messageId, readerNickname) => {
        // Invia a tutti nella stanza (incluso chi l'ha inviato) che questo messaggio è stato letto
        io.to(roomId).emit('msg-read-update', messageId, readerNickname);
    });
    socket.on('send-private-message', (r, rid, s, m) => io.to(rid).emit('new-private-message', s, m));
    socket.on('wb-draw', (r, d) => socket.to(r).emit('wb-draw', d));
    socket.on('wb-clear', (r) => io.to(r).emit('wb-clear'));
    socket.on('wb-undo', (r) => io.to(r).emit('wb-undo')); // Semplificato per brevità
    socket.on('wb-request-history', (r) => {}); // Gestione history qui se serve
    socket.on('offer', (id, o) => io.to(id).emit('offer', socket.id, o));
    socket.on('answer', (id, a) => io.to(id).emit('answer', socket.id, a));
    socket.on('candidate', (id, c) => io.to(id).emit('candidate', socket.id, c));
    socket.on('audio-status-changed', (r, t) => socket.to(r).emit('audio-status-changed', socket.id, t));
    socket.on('stream-type-changed', (r, ratio) => socket.to(r).emit('remote-stream-type-changed', socket.id, ratio));

    socket.on('disconnect', () => {
        if (admins.has(socket.id)) admins.delete(socket.id);
        // Logica rimozione user...
        let roomId = null;
        for (const id in rooms) {
            if (rooms[id][socket.id]) {
                roomId = id;
                delete rooms[id][socket.id];
                if (Object.keys(rooms[id]).length === 0) {
                    delete rooms[id];
                    delete roomConfigs[id]; // Pulisci config se stanza vuota
                }
                break;
            }
        }
        if (roomId) socket.to(roomId).emit('peer-left', socket.id);
        broadcastAdminUpdate();
    });
	// Gestione Trascrizione / Sottotitoli
	socket.on('send-transcript', (roomId, nickname, text, isFinal) => {
		// Invia a tutti gli altri nella stanza (tranne chi parla)
		socket.to(roomId).emit('receive-transcript', socket.id, nickname, text, isFinal);
	});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));