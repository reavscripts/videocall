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
const roomMessages = {}; // { roomId: [ {sender, text, id, timestamp} ] }
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
        // 1. CONTROLLO BAN
		if (bannedIPs.has(clientIp)) {
            socket.emit('error-message', 'Sei bannato.');
            return;
        }

        // --- LOGICA ADMIN STANZA (@) ---
        let isRoomCreator = false;
        // Se la stanza non esiste o è vuota, chi entra è il Creatore
        if (!rooms[roomId] || Object.keys(rooms[roomId]).length === 0) {
            isRoomCreator = true;
        }

        // Rimuoviamo eventuali @ messe dall'utente per evitare falsi admin
        let finalNickname = nickname.replace(/^@/, ''); 
        
        // Se è il creatore, aggiungiamo la @
        if (isRoomCreator) {
            finalNickname = '@' + finalNickname;
        }

        // Creazione Config se non esiste
        if (!roomConfigs[roomId]) {
            roomConfigs[roomId] = { 
				password: password, 
                isLocked: false,
                topic: "",
                nameColor: "#00b8ff" // Default Ciano
            };
            if(password) logToAdmin(`Stanza ${roomId} creata con password.`);
        }
        const config = roomConfigs[roomId];

        // Controlli Accesso (Lock & Password)
        if (config.isLocked) { socket.emit('error-message', 'Stanza bloccata.'); return; }
        if (config.password && config.password !== password) { socket.emit('error-message', 'Password errata.'); return; }

        socket.join(roomId);
        if (!rooms[roomId]) rooms[roomId] = {};
        
        // Controllo Nickname Duplicato
        const nicknameExists = Object.values(rooms[roomId]).some(n => n.toLowerCase() === finalNickname.toLowerCase());
        if (nicknameExists) {
            socket.emit('nickname-in-use', `Il nickname '${finalNickname}' è già in uso.`);
            return;
        }

        // Salvataggio Utente
        rooms[roomId][socket.id] = finalNickname;
        logToAdmin(`User joined: ${finalNickname} -> ${roomId}`);

        // Lista Utenti per il Client
        const peers = Object.entries(rooms[roomId])
            .filter(([id]) => id !== socket.id)
            .map(([id, nick]) => ({ id, nickname: nick }));

        // 1. Avvisa gli ALTRI che sono entrato
        socket.to(roomId).emit('peer-joined', socket.id, finalNickname);
        
        // 2. Invia il BENVENUTO a ME (Configurazione completa)
        socket.emit('welcome', 
            socket.id, 
            finalNickname, 
            peers, 
            config.topic, 
            !!config.password, 
            config.nameColor 
        );
        
        // 3. Invio Storico Chat (Se presente)
        if (roomMessages[roomId] && roomMessages[roomId].length > 0) {
            socket.emit('chat-history', roomMessages[roomId]);
        }
        
        // 4. Salva messaggio "È entrato" nel DB (senza inviarlo live, ci pensa peer-joined/welcome)
        if (!roomMessages[roomId]) roomMessages[roomId] = [];
        roomMessages[roomId].push({
            sender: 'Sistema',
            text: `${finalNickname} è entrato.`,
            id: 'sys_' + Date.now(),
            timestamp: Date.now(),
            type: 'system'
        });

        broadcastAdminUpdate();
    });

	// --- GESTIONE OPERATORE STANZA (@) ---
    socket.on('op-update-settings', (roomId, newTopic, newPassword, newColor) => {
        
        // 1. Sicurezza: L'utente esiste nella stanza?
        if (!rooms[roomId] || !rooms[roomId][socket.id]) return;

        // 2. Sicurezza: L'utente ha la @ nel nickname?
        const currentNick = rooms[roomId][socket.id];
        if (!currentNick.startsWith('@')) {
            socket.emit('error-message', "Non hai i permessi di Operatore (@).");
            return;
        }

        if (roomConfigs[roomId]) {
            // --- A. CATTURA STATO PRECEDENTE (Fondamentale per il confronto) ---
            const oldTopic = roomConfigs[roomId].topic || "";
            const oldHasPassword = !!roomConfigs[roomId].password; // Converti in booleano (true/false)
            const oldColor = roomConfigs[roomId].nameColor;

            // --- B. APPLICA LE NUOVE MODIFICHE ---
            roomConfigs[roomId].topic = newTopic || "";
            roomConfigs[roomId].password = newPassword || ""; 
            roomConfigs[roomId].nameColor = newColor || "#00b8ff"; 

            // --- C. CALCOLA LE DIFFERENZE ---
            const newHasPassword = !!newPassword; // Stato attuale della password
            
            const topicChanged = (oldTopic !== (newTopic || ""));
            const colorChanged = (oldColor !== newColor);

            let passwordAction = null; // 'added', 'removed', o null
            if (!oldHasPassword && newHasPassword) passwordAction = 'added';
            else if (oldHasPassword && !newHasPassword) passwordAction = 'removed';
            
            // Log Admin
            logToAdmin(`OP ${currentNick} update ${roomId}: Topic=${topicChanged}, Pass=${passwordAction}, Color=${newColor}`);

            // --- D. AVVISA TUTTI ---
            io.to(roomId).emit('room-info-updated', 
                newTopic, 
                newHasPassword, 
                topicChanged, 
                passwordAction,
                newColor 
            );
            
            socket.emit('op-settings-saved');
            broadcastAdminUpdate();
        }
    });
	
// --- GLOBAL MEETING TRANSCRIPTION ---

    // 1. Toggle: Qualcuno avvia/ferma la registrazione globale
    socket.on('toggle-global-transcription', (roomId, isActive) => {
        console.log(`[SERVER-TRANSCRIPT] Toggle stato nella stanza ${roomId}: ${isActive}`);
        
        // Avvisa TUTTI nella stanza (incluso chi ha cliccato)
        io.to(roomId).emit('global-transcription-status', isActive);
    });

    // 2. Data: Qualcuno ha parlato, invia il testo a TUTTI
    socket.on('global-transcript-chunk', (roomId, data) => {
        // data = { nickname, text, timestamp }
        
        // Log di debug per vedere se il server riceve il testo
        console.log(`[SERVER-TRANSCRIPT] Ricevuto testo da ${data.nickname} (${roomId}): "${data.text.substring(0, 20)}..."`);

        // IMPORTANTE: Usiamo io.to(roomId) e NON socket.to(roomId).
        // io.to manda il messaggio a TUTTI, incluso chi ha parlato.
        // Questo serve perché nel client (app.js) non aggiungiamo il testo subito,
        // ma aspettiamo che il server ce lo rimandi indietro per essere sicuri che sia salvato.
        io.to(roomId).emit('receive-global-transcript', data);
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
    // User A chiede a User B di iniziare a trascriversi
    socket.on('request-transcription', (targetId, requesterId, enable) => {
        io.to(targetId).emit('transcription-request', requesterId, enable);
    });

    // User B invia il testo trascritto a User A
    socket.on('transcription-result', (targetId, text, isFinal) => {
        io.to(targetId).emit('transcription-data', socket.id, text, isFinal);
    });
	
	socket.on('send-message', (r, s, m, msgId) => {
        const finalId = msgId || Date.now().toString(); 
        
        if (!roomMessages[r]) roomMessages[r] = [];
        
        roomMessages[r].push({
            sender: s,
            text: m,
            id: finalId,
            timestamp: Date.now(),
            type: 'public' // <--- Aggiunto il tipo
        });

        if (roomMessages[r].length > 100) roomMessages[r].shift();

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
        
        let roomId = null;
        let nickname = null; // Variabile per salvare il nome

        for (const id in rooms) {
            if (rooms[id][socket.id]) {
                roomId = id;
                nickname = rooms[id][socket.id]; // 1. SALVIAMO IL NICKNAME
                
                delete rooms[id][socket.id];
                
                // 2. SALVA MESSAGGIO "USCITO" NELLO STORICO
                if (roomMessages[id]) {
                    roomMessages[id].push({
                        sender: 'Sistema',
                        text: `${nickname} è uscito.`,
                        id: 'sys_' + Date.now(),
                        timestamp: Date.now(),
                        type: 'system'
                    });
                }

                // Se vuota cancella tutto
                if (Object.keys(rooms[id]).length === 0) {
                    delete rooms[id];
                    delete roomConfigs[id];  
                }
                break;
            }
        }
        
        // 3. INVIA IL NICKNAME AL CLIENT (peer-left ora invia 2 argomenti)
        if (roomId) socket.to(roomId).emit('peer-left', socket.id, nickname);
        
        broadcastAdminUpdate();
    });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));