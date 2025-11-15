// --- VARIABILI GLOBALI ---
const localVideo = document.getElementById('local-video');
const remoteVideosContainer = document.getElementById('remote-videos-container');
const nicknameOverlay = document.getElementById('nickname-overlay');
const conferenceContainer = document.getElementById('conference-container');
const participantsList = document.getElementById('participants-list');

// Variabili di Connessione WebRTC
let socket = null;
let peerConnection = null;
let localStream = null;
let userNickname = 'Ospite';
const roomId = 'mia_stanza_video'; // ID fisso della stanza
const peerConnections = {}; // Mappa per gestire più connessioni P2P (per le chiamate multi-utente)

// Configurazione STUN/TURN (necessaria per il routing attraverso NAT e Firewall)
const iceConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        // Aggiungere server TURN è consigliato per una robustezza maggiore
    ]
};

// --- FUNZIONI DI BASE ---

/** Gestisce l'ingresso dell'utente e avvia tutto. */
document.getElementById('join-button').addEventListener('click', () => {
    const nickname = document.getElementById('nickname-input').value.trim();
    if (nickname) {
        userNickname = nickname;
        nicknameOverlay.classList.add('hidden');
        conferenceContainer.classList.remove('hidden');

        // Avvia la connessione Socket.IO e la webcam
        initializeSocket();
        startLocalMedia();
    } else {
        alert('Per favore, inserisci un nickname.');
    }
});

/** Aggiunge o aggiorna un partecipante nella lista */
function updateParticipantList(nickname, isLocal = false) {
    const id = isLocal ? 'local-user' : nickname.replace(/\s/g, '-');
    let li = document.getElementById(id);
    if (!li) {
        li = document.createElement('li');
        li.id = id;
        participantsList.appendChild(li);
    }
    li.textContent = nickname + (isLocal ? " (Tu)" : "");
}

// --- FUNZIONI SOCKET.IO (Segnalazione) ---

/** Inizializza la connessione con il server di segnalazione */
function initializeSocket() {
    // La connessione Socket.IO è il canale di segnalazione
    socket = io();

    socket.on('connect', () => {
        console.log('Connesso al server di segnalazione.');
        // Unisciti alla stanza non appena connesso
        socket.emit('join-room', roomId, userNickname);
    });

    // Ricevi la lista degli utenti già presenti (per sapere chi chiamare)
    socket.on('users-in-room', (userList, socketIdCaller) => {
        updateParticipantList(userNickname, true); // Aggiorna il proprio stato
        
        // Itera sugli utenti esistenti e avvia una connessione Offer
        userList.forEach(user => {
            if (user.socketId !== socket.id) {
                // Inizia la chiamata (come Caller)
                callUser(user.socketId, true);
                updateParticipantList(user.nickname);
            }
        });
    });

    // Ricevi un nuovo utente (come Callee)
    socket.on('user-joined', (newSocketId, newNickname) => {
        console.log(`Nuovo utente ${newNickname} unito: ${newSocketId}`);
        // Inizializza la connessione con il nuovo utente
        callUser(newSocketId, false);
        updateParticipantList(newNickname);
    });

    // Ricevi l'Offer SDP dal Caller
    socket.on('offer', (id, description) => {
        handleOffer(id, description);
    });

    // Ricevi l'Answer SDP dal Callee
    socket.on('answer', (id, description) => {
        handleAnswer(id, description);
    });

    // Ricevi i candidati ICE
    socket.on('candidate', (id, candidate) => {
        handleCandidate(id, candidate);
    });

    // Gestione disconnessione utente
    socket.on('user-left', (leavingSocketId) => {
        removePeer(leavingSocketId);
    });
}

// --- FUNZIONI WEBRTC ---

/** 1. Avvia la webcam e il microfono */
async function startLocalMedia() {
    const constraints = {
        audio: true,
        video: {
            width: { ideal: 640, min: 480 },
            height: { ideal: 480, min: 360 },
        }
    };
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints); 
        localVideo.srcObject = localStream;
    } catch (error) {
        console.error('Errore nell\'accesso ai media (Webcam/Mic):', error);
        alert('Impossibile accedere alla webcam e al microfono. Controlla i permessi.');
    }
}

/** 2. Crea/Ottiene la RTCPeerConnection per un peer specifico */
function getOrCreatePeerConnection(socketId) {
    if (peerConnections[socketId]) {
        return peerConnections[socketId];
    }

    const pc = new RTCPeerConnection(iceConfiguration);

    // Aggiungi tutti i track locali alla nuova connessione
    if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }
    
    // Gestisci la ricezione del video remoto (il video dell'altro peer)
    pc.ontrack = (event) => {
        // Ignora se lo stream è già attaccato
        if (remoteVideosContainer.querySelector(`[data-peer-id="${socketId}"] video`)) return;

        const remoteStream = event.streams[0];
        
        const remoteVideoItem = document.createElement('div');
        remoteVideoItem.className = 'remote-video-item';
        remoteVideoItem.dataset.peerId = socketId; // ID del peer per la rimozione

        const remoteVideo = document.createElement('video');
        remoteVideo.autoplay = true;
        remoteVideo.srcObject = remoteStream;
        
        // Aggiungi la label (nickname remoto, se lo hai scambiato)
        const videoLabel = document.createElement('div');
        videoLabel.className = 'video-label';
        // QUI: In un'implementazione reale, useresti il nickname ricevuto dal server
        videoLabel.textContent = `Peer ${socketId.substring(0, 4)}...`; 

        remoteVideoItem.appendChild(remoteVideo);
        remoteVideoItem.appendChild(videoLabel);
        remoteVideosContainer.appendChild(remoteVideoItem);
    };

    // Gestisci lo scambio di candidati ICE (indirizzi di rete)
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

/** 3. Invia la chiamata (Offer SDP) */
async function callUser(socketId, isCaller) {
    const pc = getOrCreatePeerConnection(socketId);

    if (isCaller) {
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            // Invia l'Offer SDP all'altro peer tramite il server
            socket.emit('offer', socketId, pc.localDescription);
        } catch (error) {
            console.error('Errore nella creazione dell\'Offer:', error);
        }
    }
}

/** 4. Gestisce la ricezione dell'Offer e risponde con l'Answer */
async function handleOffer(socketId, description) {
    const pc = getOrCreatePeerConnection(socketId);
    
    await pc.setRemoteDescription(description);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    // Invia l'Answer SDP al Caller tramite il server
    socket.emit('answer', socketId, pc.localDescription);
}

/** 5. Gestisce la ricezione dell'Answer */
async function handleAnswer(socketId, description) {
    const pc = getOrCreatePeerConnection(socketId);
    await pc.setRemoteDescription(description);
    // La connessione è stabilita!
}

/** 6. Aggiunge i Candidati ICE ricevuti */
async function handleCandidate(socketId, candidate) {
    try {
        const pc = peerConnections[socketId];
        if (pc && candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    } catch (error) {
        console.error('Errore nell\'aggiunta del candidato ICE:', error);
    }
}

/** 7. Pulisce la connessione quando un utente lascia */
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
    
    // Rimuovi dalla lista partecipanti (dovresti avere un modo per mappare ID a Nickname)
    // Logica di rimozione lista...
    console.log(`Utente ${socketId} disconnesso.`);
}