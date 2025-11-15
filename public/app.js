// ==============================================================================
// CONFIGURAZIONE WEB RTC E SOCKET.IO
// ==============================================================================
// NB: Assicurati che questo URL sia quello corretto per il tuo server di segnalazione!
const RENDER_SERVER_URL = "https://videocall-webrtc-signaling-server.onrender.com";

// --- ELEMENTI DOM ---
const localVideo = document.getElementById('local-video');
const remoteVideosContainer = document.getElementById('remote-videos-container');
const nicknameOverlay = document.getElementById('nickname-overlay');
const conferenceContainer = document.getElementById('conference-container');
const participantsList = document.getElementById('participants-list');
const participantCountSpan = document.getElementById('participant-count'); 
const joinButton = document.getElementById('join-button');
const nicknameInput = document.getElementById('nickname-input');

// Nuovi elementi DOM per il focus e i controlli
const mainVideoFeed = document.getElementById('main-video-feed');
const remoteVideoPlaceholder = document.getElementById('remote-video-placeholder');
const toggleAudioButton = document.getElementById('toggle-audio-button');
const toggleVideoButton = document.getElementById('toggle-video-button');
const disconnectButton = document.getElementById('disconnect-button');


// --- VARIABILI DI STATO ---
let socket = null;
let localStream = null;
let userNickname = 'Ospite';
// ID fisso della stanza
const roomId = 'mia_stanza_video';
const peerConnections = {}; // Mappa per RTCPeerConnection: { socketId: RTCPeerConnection }
const remoteNicknames = {}; // Mappa per i nickname remoti
// Contiene l'ID del socket il cui video è attualmente mostrato nel mainVideoFeed ('local' o 'socketId')
let focusedPeerId = 'local'; 


// Configurazione STUN (Server Traversal Utilities for NAT)
const iceConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

// ==============================================================================
// FUNZIONI DI BASE DELL'INTERFACCIA UTENTE
// ==============================================================================

function showStatusMessage(message) {
    console.warn(`[AVVISO UI] ${message}`);
}

function updateParticipantCount() {
    if (participantCountSpan) {
        participantCountSpan.textContent = 1 + Object.keys(peerConnections).length;
    }
}

/**
 * Aggiorna la lista dei partecipanti nel pannello laterale e aggiunge il listener per il focus.
 */
function updateParticipantList(id, nickname, isLocal = false) {
    let li = document.getElementById(`list-${id}`);
    if (!li) {
        li = document.createElement('li');
        li.id = `list-${id}`;
        li.dataset.peerId = id; // Assicura che l'ID sia nel dataset
        li.innerHTML = `<span class="participant-name">${nickname}</span> <span class="status-indicator">•</span>`;
        participantsList.appendChild(li);

        // Listener per mettere il video in focus cliccando sulla lista
        li.addEventListener('click', () => {
             setMainVideo(id);
             // Aggiorna la classe CSS nella lista per l'evidenziazione
             document.querySelectorAll('#participants-list li').forEach(el => el.classList.remove('participant-focused'));
             li.classList.add('participant-focused');
        });
    }
    
    // Aggiorna il testo per l'utente locale
    if (isLocal) {
        li.querySelector('.participant-name').textContent = nickname + " (Tu)";
    }
    
    // Imposta il focus iniziale sull'utente locale nella lista
    if (id === focusedPeerId) {
         li.classList.add('participant-focused');
    }

    updateParticipantCount(); 
}


// ==============================================================================
// GESTIONE FOCUS VIDEO
// ==============================================================================

/**
 * Sposta lo stream del peer specificato nel mainVideoFeed.
 * @param {string} peerId - ID del socket del peer (o 'local' per il tuo video).
 */
function setMainVideo(peerId) {
    // 1. Determina lo stream e il nickname
    let stream, nickname, isLocal = false;

    if (peerId === 'local') {
        stream = localStream;
        nickname = userNickname + " (Tu)";
        isLocal = true;
    } else {
        const remoteVideoElement = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${peerId}"]`);
        
        if (!remoteVideoElement) {
            console.error(`Impossibile trovare l'elemento video per ID: ${peerId}`);
            return;
        }
        
        stream = remoteVideoElement.querySelector('video').srcObject;
        nickname = remoteNicknames[peerId];
    }
    
    if (!stream) {
        mainVideoFeed.innerHTML = `<div class="video-placeholder">Stream non disponibile per ${nickname}</div>`;
        return;
    }
    
    // 2. Sposta lo stream nel contenitore principale
    
    // Cerca o crea l'elemento video nel main feed
    let videoEl = mainVideoFeed.querySelector('video');
    if (!videoEl) {
        videoEl = document.createElement('video');
        videoEl.autoplay = true;
        videoEl.playsinline = true;
    }
    
    // Muta se è locale, altrimenti no
    videoEl.muted = isLocal;

    // Collega il nuovo stream
    videoEl.srcObject = stream;

    // Aggiorna il contenitore principale
    mainVideoFeed.innerHTML = ''; // Pulisce il vecchio contenuto
    mainVideoFeed.appendChild(videoEl);

    // Aggiungi l'etichetta
    const videoLabel = document.createElement('div');
    videoLabel.className = 'video-label';
    videoLabel.textContent = nickname;
    mainVideoFeed.appendChild(videoLabel);
    
    focusedPeerId = peerId;


    // 3. Reimposta il focus visivo: lista partecipanti e miniature
    document.querySelectorAll('#participants-list li').forEach(el => el.classList.remove('participant-focused'));
    const focusedLi = document.getElementById(`list-${peerId}`);
    if (focusedLi) focusedLi.classList.add('participant-focused');

    document.querySelectorAll('.remote-feed').forEach(el => el.classList.remove('is-focused'));
    if (!isLocal) {
        const remoteFeed = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${peerId}"]`);
        if (remoteFeed) remoteFeed.classList.add('is-focused');
    }
}


// ==============================================================================
// GESTIONE INGRESSO UTENTE E MEDIA
// ==============================================================================

joinButton.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    if (nickname) {
        userNickname = nickname;
        
        // Avvia la webcam e poi inizializza la connessione di rete
        startLocalMedia()
            .then(() => {
                nicknameOverlay.classList.add('hidden');
                conferenceContainer.classList.remove('hidden');
                initializeSocket();
            })
            .catch(error => {
                console.error("Non è stato possibile avviare la webcam:", error.name, error);
                showStatusMessage(`Impossibile avviare la webcam. Controlla i permessi. Errore: ${error.name}`);
                nicknameOverlay.classList.remove('hidden');
                conferenceContainer.classList.add('hidden');
            });
    } else {
        showStatusMessage('Per favore, inserisci un nickname.');
    }
});


async function startLocalMedia() {
    const constraints = {
        audio: true,
        video: true
    };

    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Imposta il tuo video come video principale di default
        setMainVideo('local'); 

        return localStream;
    } catch (error) {
        throw error;
    }
}

// ==============================================================================
// GESTIONE CONTROLLI MEDIA
// ==============================================================================

toggleAudioButton.addEventListener('click', () => {
    const audioTrack = localStream?.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const icon = audioTrack.enabled ? '🎤' : '🔇';
        toggleAudioButton.textContent = icon;
    }
});

toggleVideoButton.addEventListener('click', () => {
    const videoTrack = localStream?.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        const icon = videoTrack.enabled ? '📹' : '⬛';
        toggleVideoButton.textContent = icon;
    }
});

disconnectButton.addEventListener('click', () => {
    // 1. Chiudi lo stream locale
    localStream?.getTracks().forEach(track => track.stop());
    
    // 2. Chiudi tutte le RTCPeerConnections
    Object.keys(peerConnections).forEach(socketId => {
        peerConnections[socketId].close();
        delete peerConnections[socketId];
        // Rimuovi anche dalla UI
        removePeer(socketId, false); // Il server gestirà l'avviso
    });
    
    // 3. Disconnetti da Socket.IO
    if (socket) {
        socket.disconnect();
    }
    
    // 4. Ripristina l'interfaccia utente
    nicknameOverlay.classList.remove('hidden');
    conferenceContainer.classList.add('hidden');
    mainVideoFeed.innerHTML = `<video id="local-video" autoplay muted playsinline></video><div class="video-label">Tu</div>`; // Reimposta l'elemento locale
    remoteVideosContainer.innerHTML = `<div id="remote-video-placeholder" class="video-placeholder">In attesa di altri partecipanti...</div>`;
    participantsList.innerHTML = '';
    focusedPeerId = 'local';
    updateParticipantCount();
    
    console.log("Conferenza lasciata.");
});


// ==============================================================================
// FUNZIONI SOCKET.IO (Segnalazione)
// ==============================================================================

function initializeSocket() {
    socket = io(RENDER_SERVER_URL);

    socket.on('connect', () => {
        console.log('Connesso al server di segnalazione.');
        socket.emit('join-room', roomId, userNickname);
    });

    socket.on('users-in-room', (userList) => {
        updateParticipantList(socket.id, userNickname, true);
        remoteVideoPlaceholder?.classList.add('hidden');

        userList.forEach(user => {
            if (user.socketId !== socket.id) {
                remoteNicknames[user.socketId] = user.nickname;
                updateParticipantList(user.socketId, user.nickname);
                callUser(user.socketId, true); // Caller
            }
        });
    });

    socket.on('user-joined', (newSocketId, newNickname) => {
        console.log(`Nuovo utente ${newNickname} unito: ${newSocketId}`);
        remoteNicknames[newSocketId] = newNickname;
        callUser(newSocketId, false); // Callee (aspetta l'Offer)
        updateParticipantList(newSocketId, newNickname);
        remoteVideoPlaceholder?.classList.add('hidden');
    });

    socket.on('offer', (id, description) => {
        handleOffer(id, description);
    });

    socket.on('answer', (id, description) => {
        handleAnswer(id, description);
    });

    socket.on('candidate', (id, candidate) => {
        handleCandidate(id, candidate);
    });

    socket.on('user-left', (leavingSocketId) => {
        removePeer(leavingSocketId, true);
    });

    socket.on('disconnect', () => {
        console.log('Disconnesso dal server. Prova a ricaricare la pagina.');
    });
}


// ==============================================================================
// FUNZIONI WEBRTC
// ==============================================================================

function addLocalTracks(pc) {
    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }
}

/**
 * Crea o recupera la RTCPeerConnection per un peer specifico.
 */
function getOrCreatePeerConnection(socketId) {
    if (peerConnections[socketId]) {
        return peerConnections[socketId];
    }

    const pc = new RTCPeerConnection(iceConfiguration);
    addLocalTracks(pc);

    // GESTIONE DELLA RICEZIONE DEL VIDEO REMOTO (ONTRAK)
    pc.ontrack = (event) => {
        console.log(`Ricevuto track da ${socketId}`);

        let remoteVideoItem = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"]`);

        if (!remoteVideoItem) {
            remoteVideoItem = createRemoteVideoElement(socketId, event.streams[0]);
            remoteVideosContainer.appendChild(remoteVideoItem);
            
            // Se è il primo remoto, mettilo subito in focus
            if (Object.keys(peerConnections).length === 1 && focusedPeerId === 'local') {
                setMainVideo(socketId);
            }

        } else {
            const video = remoteVideoItem.querySelector('video');
            if (video && !video.srcObject) {
                video.srcObject = event.streams[0];
            }
        }
    };

    // GESTIONE DELLO SCAMBIO DEI CANDIDATI ICE
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', socketId, event.candidate);
        }
    };
    
    pc.oniceconnectionstatechange = () => {
        console.log(`Stato di connessione per ${socketId}: ${pc.iceConnectionState}`);
    };

    peerConnections[socketId] = pc;
    return pc;
}

/**
 * Funzione helper per creare l'elemento video remoto nel DOM (Miniatura).
 */
function createRemoteVideoElement(socketId, stream) {
    const