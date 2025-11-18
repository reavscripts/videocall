
// ===================================
// CONFIGURAZIONE
// ===================================

// ** SOSTITUISCI CON L'URL DEL TUO BACKEND RENDER **
const SERVER_URL = "https://videocall-webrtc-signaling-server.onrender.com";
const socket = io(SERVER_URL);
const ROOM_ID = 'mia_stanza_video'; // ID fisso della stanza per semplicità

const localVideo = document.getElementById('localVideo');
const remoteVideosContainer = document.getElementById('video-grid');
const messagesContainer = document.getElementById('messages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');

// Configurazione base per WebRTC (usa STUN pubblico di Google)
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

let localStream;
// Mappa per tenere traccia delle connessioni RTCPeerConnection (un oggetto per ogni utente remoto)
const peerConnections = {};

// ===================================
// 1. GESTIONE MEDIA E INIZIALIZZAZIONE
// ===================================

/** Avvia l'accesso a videocamera e microfono */
async function startMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        
        // Dopo aver ottenuto il media, unisciti alla stanza
        socket.emit('join-room', ROOM_ID);
    } catch (error) {
        console.error('Errore nell\'accesso a media:', error);
        alert('Impossibile accedere a videocamera/microfono. Controlla i permessi.');
    }
}

// ===================================
// 2. GESTIONE SOCKET.IO (Segnalazione)
// ===================================

socket.on('connect', () => {
    console.log('Connesso al server Socket.IO');
    startMedia();
});

// Evento: Un nuovo utente si è connesso alla stanza
socket.on('user-connected', (userId) => {
    console.log(`Nuovo utente connesso: ${userId}. Avvio la creazione dell'offerta (Offer).`);
    // Crea la connessione e invia l'offerta al nuovo peer
    createPeerConnection(userId, true);
});

// Evento: Ricezione di un'offerta (dal peer che ha avviato la chiamata)
socket.on('sdp-offer', async ({ senderId, offer }) => {
    console.log(`Ricevuta offerta da ${senderId}`);
    // Crea la connessione e imposta l'offerta
    createPeerConnection(senderId, false);
    const pc = peerConnections[senderId];

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    
    // Genera la risposta (Answer) e inviala
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('sdp-answer', { 
        targetId: senderId, 
        answer: pc.localDescription,
        room: ROOM_ID 
    });
});

// Evento: Ricezione della risposta (Answer)
socket.on('sdp-answer', async ({ senderId, answer }) => {
    console.log(`Ricevuta risposta da ${senderId}`);
    const pc = peerConnections[senderId];
    // Il peer che ha inviato l'offerta imposta la risposta
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

// Evento: Ricezione di un candidato ICE
socket.on('ice-candidate', async ({ senderId, candidate }) => {
    try {
        const pc = peerConnections[senderId];
        if (pc && candidate) {
             // Aggiunge il candidato alla connessione
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    } catch (e) {
        console.error('Errore nell\'aggiunta del candidato ICE:', e);
    }
});

// ===================================
// 3. LOGICA WEBRTC CORE
// ===================================

/** Crea e configura la RTCPeerConnection */
function createPeerConnection(userId, isInitiator) {
    if (peerConnections[userId]) return; // Connessione già esistente

    const pc = new RTCPeerConnection(iceServers);
    peerConnections[userId] = pc;
    
    // Aggiungi il media stream locale a tutti i peer
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    // A. Gestione Candidati ICE
    pc.onicecandidate = event => {
        if (event.candidate) {
            // Invia il candidato ICE all'altro peer tramite Socket.IO
            socket.emit('ice-candidate', { 
                targetId: userId, 
                candidate: event.candidate,
                room: ROOM_ID
            });
        }
    };

    // B. Ricezione dello Stream Remoto
    pc.ontrack = event => {
        if (document.getElementById(`remote-${userId}`)) return; // Già aggiunto

        console.log(`Stream remoto ricevuto da ${userId}`);
        const remoteVideoDiv = document.createElement('div');
        remoteVideoDiv.className = 'video-container';
        remoteVideoDiv.innerHTML = `<h2>Utente Remoto (${userId.substring(0, 4)}...)</h2>`;

        const remoteVideo = document.createElement('video');
        remoteVideo.id = `remote-${userId}`;
        remoteVideo.autoplay = true;
        remoteVideo.srcObject = event.streams[0];
        
        remoteVideoDiv.appendChild(remoteVideo);
        remoteVideosContainer.appendChild(remoteVideoDiv);
    };

    // C. Generazione dell'Offerta (solo se è l'iniziatore)
    if (isInitiator) {
        pc.onnegotiationneeded = async () => {
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                
                // Invia l'offerta al server Socket.IO
                socket.emit('sdp-offer', { 
                    targetId: userId, 
                    offer: pc.localDescription, 
                    room: ROOM_ID 
                });
            } catch (e) {
                console.error('Errore nella creazione dell\'offerta:', e);
            }
        };
    }
}

// ===================================
// 4. CHAT INTEGRATA (via Socket.IO)
// ===================================

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

function sendMessage() {
    const text = chatInput.value.trim();
    if (text) {
        const messageData = {
            user: socket.id.substring(0, 4), // Usa ID tronco come username
            text: text,
            room: ROOM_ID
        };
        // 1. Invia il messaggio al server
        socket.emit('chatMessage', messageData);
        // 2. Pulisci l'input
        chatInput.value = '';
    }
}

// Ricezione del messaggio dal server (che lo ha inoltrato)
socket.on('chatMessage', (msg) => {
    const p = document.createElement('p');
    p.className = 'message';
    
    // Mostra "Tu" se il messaggio è nostro, altrimenti il nome utente
    const userDisplay = msg.user === socket.id.substring(0, 4) ? '<strong>Tu</strong>' : `<strong>${msg.user}</strong>`;
    
    p.innerHTML = `${userDisplay}: ${msg.text}`;
    messagesContainer.appendChild(p);

    // Scorri fino all'ultimo messaggio
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});