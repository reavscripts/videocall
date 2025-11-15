// ==============================================================================
// CONFIGURAZIONE WEB RTC E SOCKET.IO
// ==============================================================================

// !!! IMPORTANTE: SOSTITUISCI CON IL TUO URL DI RENDER EFFETTIVO !!!
const RENDER_SERVER_URL = "https://videocall-webrtc-signaling-server.onrender.com/"; 

// --- ELEMENTI DOM ---
const localVideo = document.getElementById('local-video');
const remoteVideosContainer = document.getElementById('remote-videos-container');
const nicknameOverlay = document.getElementById('nickname-overlay');
const conferenceContainer = document.getElementById('conference-container');
const participantsList = document.getElementById('participants-list');

// --- VARIABILI DI STATO ---
let socket = null;
let localStream = null;
let userNickname = 'Ospite';
const roomId = 'mia_stanza_video'; // ID fisso della stanza per il test
const peerConnections = {}; // Mappa per RTCPeerConnection: { socketId: RTCPeerConnection }
const remoteNicknames = {}; // Mappa per i nickname remoti

// Configurazione STUN (Server Traversal Utilities for NAT)
const iceConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
    ]
};

// ==============================================================================
// FUNZIONI DI BASE DELL'INTERFACCIA UTENTE
// ==============================================================================

/**
 * Gestisce il click sul pulsante "Entra" e avvia il processo.
 */
document.getElementById('join-button').addEventListener('click', () => {
    const nickname = document.getElementById('nickname-input').value.trim();
    if (nickname) {
        userNickname = nickname;
        nicknameOverlay.classList.add('hidden');
        conferenceContainer.classList.remove('hidden');

        // Avvia la webcam e poi inizializza la connessione di rete
        startLocalMedia()
            .then(() => {
                initializeSocket();
            })
            .catch(error => {
                console.error("Non è stato possibile avviare la webcam:", error);
                alert("Non è stato possibile avviare la webcam. Controlla i permessi e riprova.");
                // Ritorna all'overlay in caso di errore
                nicknameOverlay.classList.remove('hidden');
                conferenceContainer.classList.add('hidden');
            });
    } else {
        alert('Per favore, inserisci un nickname.');
    }
});

/**
 * Aggiorna la lista dei partecipanti nel pannello laterale.
 */
function updateParticipantList(id, nickname, isLocal = false) {
    let li = document.getElementById(id);
    if (!li) {
        li = document.createElement('li');
        li.id = id;
        participantsList.appendChild(li);
    }
    li.textContent = nickname + (isLocal ? " (Tu)" : "");
}


// ==============================================================================
// FUNZIONI ACQUISIZIONE MEDIA (WEBCAM)
// ==============================================================================

/**
 * Avvia la webcam e il microfono e mostra lo stream locale.
 * @returns {Promise<MediaStream>} Il flusso media locale.
 */
async function startLocalMedia() {
    // Restrizioni MINIMALI per aumentare la compatibilità
    const constraints = {
        audio: true,
        video: true // Chiede semplicemente la prima videocamera disponibile
    };
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints); 
        localVideo.srcObject = localStream;
        return localStream; 
    } catch (error) {
        // Se non funziona neanche questo, controlla il nome dell'errore
        throw error; 
    }
}


// ==============================================================================
// FUNZIONI SOCKET.IO (Segnalazione)
// ==============================================================================

/**
 * Inizializza la connessione con il server di segnalazione (Render).
 */
function initializeSocket() {
    // Si connette all'URL del server Render
    socket = io(RENDER_SERVER_URL);

    socket.on('connect', () => {
        console.log('Connesso al server di segnalazione.');
        // Unisciti alla stanza non appena connesso e notifica il tuo nickname
        socket.emit('join-room', roomId, userNickname);
    });

    // 1. Ricevi la lista degli utenti già presenti (il nuovo utente chiama loro)
    socket.on('users-in-room', (userList, socketIdCaller) => {
        updateParticipantList(socket.id, userNickname, true); 
        
        userList.forEach(user => {
            if (user.socketId !== socket.id) {
                remoteNicknames[user.socketId] = user.nickname;
                // Inizia la chiamata (come Caller)
                callUser(user.socketId, true);
                updateParticipantList(user.socketId, user.nickname);
            }
        });
    });

    // 2. Ricevi un nuovo utente (loro chiamano te)
    socket.on('user-joined', (newSocketId, newNickname) => {
        console.log(`Nuovo utente ${newNickname} unito: ${newSocketId}`);
        remoteNicknames[newSocketId] = newNickname;
        // Inizializza la connessione con il nuovo utente
        callUser(newSocketId, false);
        updateParticipantList(newSocketId, newNickname);
    });

    // 3. Ricevi l'Offer SDP dal Caller
    socket.on('offer', (id, description) => {
        handleOffer(id, description);
    });

    // 4. Ricevi l'Answer SDP dal Callee
    socket.on('answer', (id, description) => {
        handleAnswer(id, description);
    });

    // 5. Ricevi i candidati ICE
    socket.on('candidate', (id, candidate) => {
        handleCandidate(id, candidate);
    });

    // 6. Gestione disconnessione utente
    socket.on('user-left', (leavingSocketId) => {
        removePeer(leavingSocketId);
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnesso dal server.');
    });
}


// ==============================================================================
// FUNZIONI WEBRTC
// ==============================================================================

/**
 * Crea o recupera la RTCPeerConnection per un peer specifico.
 * @param {string} socketId - ID del socket dell'altro peer.
 * @returns {RTCPeerConnection} La connessione P2P.
 */
function getOrCreatePeerConnection(socketId) {
    if (peerConnections[socketId]) {
        return peerConnections[socketId];
    }

    const pc = new RTCPeerConnection(iceConfiguration);

    // Aggiungi tutti i track locali alla nuova connessione
    if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }
    
    // GESTIONE DELLA RICEZIONE DEL VIDEO REMOTO (ONTRAK)
    pc.ontrack = (event) => {
        console.log(`Ricevuto track da ${socketId}`);
        // Impedisce di aggiungere lo stesso stream due volte
        if (remoteVideosContainer.querySelector(`[data-peer-id="${socketId}"] video`)) return;
        
        const remoteStream = event.streams[0];
        const remoteVideoItem = createRemoteVideoElement(socketId, remoteStream);
        remoteVideosContainer.appendChild(remoteVideoItem);
    };

    // GESTIONE DELLO SCAMBIO DEI CANDIDATI ICE
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            // Invia il candidato all'altro peer tramite il server di segnalazione
            socket.emit('candidate', socketId, event.candidate);
        }
    };
    
    // Salva la connessione
    peerConnections[socketId] = pc;
    return pc;
}

/**
 * Funzione helper per creare l'elemento video remoto nel DOM.
 */
function createRemoteVideoElement(socketId, stream) {
    const remoteVideoItem = document.createElement('div');
    remoteVideoItem.className = 'remote-video-item';
    remoteVideoItem.dataset.peerId = socketId; 

    const remoteVideo = document.createElement('video');
    remoteVideo.autoplay = true;
    remoteVideo.srcObject = stream;
    
    const videoLabel = document.createElement('div');
    videoLabel.className = 'video-label';
    videoLabel.textContent = remoteNicknames[socketId] || `Peer ${socketId.substring(0, 4)}...`; 

    remoteVideoItem.appendChild(remoteVideo);
    remoteVideoItem.appendChild(videoLabel);
    return remoteVideoItem;
}


/** * Invia la chiamata (Offer SDP) - Viene chiamato sia dal Caller che dal Callee (se isCaller=false, attende l'Offer)
 */
async function callUser(socketId, isCaller) {
    const pc = getOrCreatePeerConnection(socketId);

    if (isCaller) {
        try {
            console.log(`Creazione Offer per ${socketId}`);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            // Invia l'Offer SDP all'altro peer tramite il server
            socket.emit('offer', socketId, pc.localDescription);
        } catch (error) {
            console.error('Errore nella creazione dell\'Offer:', error);
        }
    }
    // Se non è il Caller, aspetta di ricevere l'Offer (handleOffer)
}

/** * Gestisce la ricezione dell'Offer e risponde con l'Answer.
 */
async function handleOffer(socketId, description) {
    const pc = getOrCreatePeerConnection(socketId);
    
    // Imposta l'Offer ricevuta come descrizione remota
    await pc.setRemoteDescription(description);

    // Crea l'Answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    // Invia l'Answer SDP al Caller tramite il server
    socket.emit('answer', socketId, pc.localDescription);
}

/** * Gestisce la ricezione dell'Answer.
 */
async function handleAnswer(socketId, description) {
    const pc = getOrCreatePeerConnection(socketId);
    await pc.setRemoteDescription(description);
    console.log(`Connessione WebRTC stabilita con ${socketId}`);
}

/** * Aggiunge i Candidati ICE ricevuti per stabilire la connettività di rete.
 */
async function handleCandidate(socketId, candidate) {
    try {
        const pc = peerConnections[socketId];
        if (pc && candidate) {
            // Aggiunge il candidato ricevuto alla connessione
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    } catch (error) {
        console.error('Errore nell\'aggiunta del candidato ICE:', error);
    }
}

/**
 * Pulisce la connessione e l'interfaccia utente quando un utente lascia.
 */
function removePeer(socketId) {
    const pc = peerConnections[socketId];
    if (pc) {
        pc.close();
        delete peerConnections[socketId];
    }
    
    // Rimuovi l'elemento video dal DOM
    const videoElement = remoteVideosContainer.querySelector(`[data-peer-id="${socketId}"]`);
    if (videoElement) {
        videoElement.remove();
    }
    
    // Rimuovi dalla lista partecipanti
    const liElement = document.getElementById(socketId);
    if (liElement) {
        liElement.remove();
    }
    
    console.log(`Utente ${socketId} rimosso.`);
}