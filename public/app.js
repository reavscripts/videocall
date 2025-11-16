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

// Elementi DOM per il focus e i controlli
const mainVideoFeed = document.getElementById('main-video-feed');
const mainVideoElement = mainVideoFeed.querySelector('video'); // Riferimento al video nel main feed
const mainVideoLabel = mainVideoFeed.querySelector('.video-label'); // Riferimento alla label nel main feed
const remoteVideoPlaceholder = document.getElementById('remote-video-placeholder');
const toggleAudioButton = document.getElementById('toggle-audio-button');
const toggleVideoButton = document.getElementById('toggle-video-button');
const disconnectButton = document.getElementById('disconnect-button');


// --- VARIABILI DI STATO ---
let socket = null;
let localStream = null;
let userNickname = 'Ospite';
let peerConnections = {}; // Mappa: socketId -> RTCPeerConnection
let remoteNicknames = {}; // Mappa: socketId -> nickname
let focusedPeerId = 'local'; // 'local' o socketId del peer in focus

// ==============================================================================
// LOGICA FRONT-END E UI
// ==============================================================================

/**
 * Gestisce l'aggiornamento del video principale (il video grande).
 * Stile Zoom/Broadcast: il video principale prende lo stream, ma la miniatura resta nella galleria.
 * @param {string} peerId - L'ID del peer (o 'local') da mettere in focus.
 */
function setMainVideo(peerId) {
    // 1. Rimuovi l'evidenziazione da TUTTE le miniature
    const allFeeds = remoteVideosContainer.querySelectorAll('.remote-feed');
    allFeeds.forEach(feed => feed.classList.remove('is-focused'));
    
    // 2. Aggiorna lo stato del focus
    focusedPeerId = peerId;

    if (peerId === 'local') {
        // --- CASO: Video Locale in Focus ---
        
        mainVideoElement.srcObject = localStream;
        mainVideoElement.muted = true; 
        mainVideoLabel.textContent = userNickname;
        
        // Evidenzia la miniatura locale nella galleria
        const localFeed = remoteVideosContainer.querySelector('.remote-feed.local-feed');
        if (localFeed) {
            localFeed.classList.add('is-focused');
        }

    } else {
        // --- CASO: Peer Remoto in Focus ---

        const remoteFeed = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${peerId}"]`);
        
        if (remoteFeed) {
            // Collega il main feed allo stesso stream del peer remoto
            const remoteVideoElement = remoteFeed.querySelector('video');
            mainVideoElement.srcObject = remoteVideoElement.srcObject;
            mainVideoElement.muted = false; // Non muto il remoto
            
            // Aggiorna la label con il nickname
            const nickname = remoteNicknames[peerId] || 'Utente Remoto';
            mainVideoLabel.textContent = nickname;

            // Evidenzia la miniatura remota
            remoteFeed.classList.add('is-focused');
        }
    }
}


/**
 * Aggiunge un nuovo elemento video remoto al DOM (galleria miniature)
 * @param {string} socketId - ID del socket remoto.
 * @param {MediaStream} stream - Lo stream video da mostrare.
 * @param {string} nickname - Nickname dell'utente remoto.
 */
function addRemotePeer(socketId, stream, nickname) {
    // 1. Crea la miniatura usando il template
    const template = document.getElementById('remote-video-template');
    const remoteFeed = template.content.cloneNode(true).firstElementChild;
    remoteFeed.dataset.peerId = socketId;
    
    const videoElement = remoteFeed.querySelector('video');
    videoElement.srcObject = stream;

    const labelElement = remoteFeed.querySelector('.video-label');
    labelElement.textContent = nickname;

    // 2. Rimuove il placeholder se è presente
    if (remoteVideoPlaceholder) {
        remoteVideoPlaceholder.classList.add('hidden');
    }

    // 3. Aggiunge la miniatura alla galleria
    remoteVideosContainer.appendChild(remoteFeed);

    // 4. Aggiunge alla lista dei partecipanti
    const liTemplate = document.getElementById('participant-item-template');
    const liElement = liTemplate.content.cloneNode(true).firstElementChild;
    liElement.id = `list-${socketId}`;
    liElement.dataset.peerId = socketId;
    liElement.querySelector('.participant-name').textContent = nickname;
    participantsList.appendChild(liElement);

    // 5. Aggiorna il contatore
    updateParticipantCount();

    // 6. LOGICA PER IL FOCUS: Imposta il focus sul nuovo peer se è il primo remoto
    if (focusedPeerId === 'local') {
        setMainVideo(socketId);
    }
    
    // 7. Aggiunge l'event listener per cambiare il focus al click sulla miniatura
    remoteFeed.addEventListener('click', () => setMainVideo(socketId));
}

/**
 * Rimuove gli elementi dal DOM quando un peer lascia la conferenza.
 * @param {string} socketId - ID del socket remoto.
 * @param {boolean} isExternalEvent - True se l'evento arriva dal server (user-left).
 */
function removePeer(socketId, isExternalEvent = true) {
    // 1. Chiude la connessione P2P (se non è già chiusa)
    const pc = peerConnections[socketId];
    if (pc && isExternalEvent) {
        pc.close();
    }
    delete peerConnections[socketId];

    // 2. Rimuovi gli elementi dal DOM (Miniatura)
    const videoElement = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id=\"${socketId}\"]`);
    if (videoElement) {
        videoElement.remove();
    }

    // 3. Rimuovi gli elementi dal DOM (Lista Partecipanti)
    const liElement = document.getElementById(`list-${socketId}`);
    if (liElement) {
        liElement.remove();
    }
    delete remoteNicknames[socketId];

    // 4. LOGICA PER IL FOCUS: se il peer che ha lasciato era in focus, sposta il focus
    if (focusedPeerId === socketId) {
        const remainingPeerIds = Object.keys(peerConnections);
        if (remainingPeerIds.length > 0) {
            // Metti in focus il primo peer rimasto
            setMainVideo(remainingPeerIds[0]);
        } else {
            // Torna al video locale
            setMainVideo('local');
        }
    }

    // 5. Se non ci sono più remote, mostra il placeholder
    if (Object.keys(peerConnections).length === 0 && remoteVideoPlaceholder) {
        remoteVideoPlaceholder.classList.remove('hidden');
    }

    // 6. Aggiorna il contatore
    updateParticipantCount();
}

/**
 * Inizializza la miniatura locale e la aggiunge alla lista dei partecipanti e alla galleria.
 */
function initializeLocalFeed() {
    // 1. Aggiunge alla lista dei partecipanti
    const liTemplate = document.getElementById('participant-item-template');
    const liElement = liTemplate.content.cloneNode(true).firstElementChild;
    liElement.id = `list-local`;
    liElement.dataset.peerId = 'local';
    liElement.querySelector('.participant-name').textContent = `${userNickname} (Tu)`;
    participantsList.prepend(liElement); // Aggiunge in cima alla lista

    // 2. Crea la miniatura locale nella galleria (solo per l'UI)
    const template = document.getElementById('remote-video-template');
    const localFeed = template.content.cloneNode(true).firstElementChild;
    localFeed.dataset.peerId = 'local';
    localFeed.classList.add('local-feed'); // Classe CSS per l'evidenziazione locale
    
    // Lo stream sarà già attivo su mainVideoElement
    const videoElement = localFeed.querySelector('video');
    videoElement.srcObject = localStream;
    videoElement.muted = true; // Locale sempre muto

    const labelElement = localFeed.querySelector('.video-label');
    labelElement.textContent = userNickname;

    remoteVideosContainer.appendChild(localFeed);

    // 3. Imposta il focus iniziale sul video locale
    setMainVideo('local');
    
    // 4. Aggiunge l'event listener per cambiare il focus al click sulla miniatura locale
    localFeed.addEventListener('click', () => setMainVideo('local'));
}


function updateParticipantCount() {
    const totalCount = Object.keys(remoteNicknames).length + 1; // +1 per l'utente locale
    participantCountSpan.textContent = totalCount;
}

// ==============================================================================
// GESTIONE MEDIA E CONTROLLI
// ==============================================================================

async function startLocalVideo() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        // Collega lo stream al main video feed e alla miniatura locale (tramite initializeLocalFeed)
        mainVideoElement.srcObject = localStream; 
        
        // Inizializza la miniatura locale nella galleria
        initializeLocalFeed();

    } catch (error) {
        console.error("Errore nell'accesso ai media locali:", error);
        alert("Non è stato possibile accedere a videocamera e microfono. Assicurati di aver dato i permessi.");
    }
}

// Funzione per inviare l'offerta a tutti i peer esistenti
function sendOffersToExistingPeers(newPeerSocketId) {
    // Seleziona se inviare solo al nuovo peer o a tutti (a seconda della necessità)
    const peersToSendTo = newPeerSocketId ? [newPeerSocketId] : Object.keys(peerConnections);

    peersToSendTo.forEach(peerSocketId => {
        // ... (Logica per creare e inviare l'offerta - omessa per brevità ma presente nel tuo file originale)
        // ...
        createOffer(peerSocketId, localStream);
    });
}

function toggleAudio() {
    localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        toggleAudioButton.textContent = track.enabled ? '🎤' : '🔇';
    });
}

function toggleVideo() {
    localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
        toggleVideoButton.textContent = track.enabled ? '📹' : '📷';
    });
}

// ==============================================================================
// GESTIONE SOCKETS E INGRESSO
// ==============================================================================

function setupSocketEvents() {
    // ... (Logica di connessione, ricezione 'welcome', 'user-joined', 'user-left', ICE, SDP - omessa per brevità ma presente nel tuo file originale)
    // ...
    socket.on('welcome', (peerSocketId, nickname) => {
        console.log(`Un nuovo utente (${nickname}) si è unito: ${peerSocketId}`);
        remoteNicknames[peerSocketId] = nickname;
        createPeerConnection(peerSocketId);
        // Quando un nuovo peer entra, inviagli l'offerta
        sendOffersToExistingPeers(peerSocketId);
    });
    
    socket.on('user-left', (peerSocketId) => {
        console.log(`Utente disconnesso: ${peerSocketId}`);
        removePeer(peerSocketId);
    });
    
    // ... (ALTRI EVENTI SOCKET: 'offer', 'answer', 'ice-candidate')
}

// ==============================================================================
// INIZIALIZZAZIONE
// ==============================================================================

// Gestione dell'interfaccia utente all'ingresso
joinButton.addEventListener('click', async () => {
    userNickname = nicknameInput.value.trim();
    if (!userNickname) {
        alert("Inserisci un nickname valido.");
        return;
    }

    // 1. Nasconde l'overlay
    nicknameOverlay.classList.add('hidden');
    conferenceContainer.classList.remove('hidden');

    // 2. Avvia la webcam e il microfono
    await startLocalVideo();

    // 3. Connette al Signaling Server
    socket = io(RENDER_SERVER_URL, {
        query: {
            nickname: userNickname
        }
    });
    setupSocketEvents();
});


// Gestione Controlli
toggleAudioButton.addEventListener('click', toggleAudio);
toggleVideoButton.addEventListener('click', toggleVideo);
disconnectButton.addEventListener('click', () => {
    if (socket) {
        socket.disconnect();
    }
    window.location.reload(); // Ricarica la pagina per uscire
});

// ==============================================================================
// (OMESSO: Implementazione RTCPeerConnection, createOffer, createAnswer, ecc.)
// ... DEVI INCOLLARE QUI IL CODICE P2P DAL TUO FILE ORIGINALE ...
// ==============================================================================

/**
 * Funzione di placeholder per la logica P2P. 
 * Assicurati di copiare qui tutte le tue funzioni: 
 * createPeerConnection, createOffer, createAnswer, handleIceCandidate, handleTrack, ecc.
 */
function createPeerConnection(peerId) {
    // ... (Il tuo codice RTCPeerConnection) ...
    const pc = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
        ]
    });

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate, peerId);
        }
    };

    pc.ontrack = (event) => {
        handleRemoteTrack(event.streams[0], peerId);
    };

    // Aggiungi tracce locali
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    peerConnections[peerId] = pc;
    return pc;
}

function handleRemoteTrack(stream, peerId) {
    const nickname = remoteNicknames[peerId] || 'Utente Remoto';
    // Assicurati che lo stream sia aggiunto una sola volta e gestisci l'UI
    addRemotePeer(peerId, stream, nickname);
}

function createOffer(peerId, stream) {
    const pc = peerConnections[peerId];
    if (!pc) return;

    pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
            socket.emit('offer', pc.localDescription, peerId);
        })
        .catch(error => console.error('Error creating offer:', error));
}

function createAnswer(offer, peerId) {
    const pc = peerConnections[peerId];
    if (!pc) return;

    pc.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => pc.createAnswer())
        .then(answer => pc.setLocalDescription(answer))
        .then(() => {
            socket.emit('answer', pc.localDescription, peerId);
        })
        .catch(error => console.error('Error creating answer:', error));
}