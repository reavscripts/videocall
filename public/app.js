// ==============================================================================
// CONFIGURAZIONE WEB RTC E SOCKET.IO
// ==============================================================================
// NB: Assicurati che questo URL sia quello corretto per il tuo server di segnalazione!
const RENDER_SERVER_URL = "https://videocall-webrtc-signaling-server.onrender.com";

// --- ELEMENTI DOM ---
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
    
    if (!template) {
        console.error("ERRORE: Template 'remote-video-template' non trovato nel DOM.");
        return; 
    }
    
    const remoteFeed = template.content.cloneNode(true).firstElementChild;
    remoteFeed.dataset.peerId = socketId;
    
    const videoElement = remoteFeed.querySelector('video');
    videoElement.srcObject = stream;
    // Rimuoviamo il muted se è remoto, lo stream locale non ha bisogno di muted
    // dato che il local stream non viene mostrato qui direttamente.
    videoElement.muted = false; 

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
    if (liTemplate) {
        const liElement = liTemplate.content.cloneNode(true).firstElementChild;
        liElement.id = `list-${socketId}`;
        liElement.dataset.peerId = socketId;
        liElement.querySelector('.participant-name').textContent = nickname;
        participantsList.appendChild(liElement);
    }

    // 5. Aggiorna il contatore
    updateParticipantCount();

    // 6. LOGICA PER IL FOCUS: Imposta il focus sul nuovo peer se è il primo remoto
    if (focusedPeerId === 'local' && Object.keys(peerConnections).length === 1) {
         setMainVideo(socketId);
    }
    
    // 7. Aggiunge l'event listener per cambiare il focus al click sulla miniatura
    remoteFeed.addEventListener('click', () => setMainVideo(socketId));
}

/**
 * Rimuove gli elementi dal DOM quando un peer lascia la conferenza.
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
        // Cerchiamo il primo peer rimasto
        const remainingPeerIds = Object.keys(peerConnections).filter(id => id !== socket.id); 
        
        if (remainingPeerIds.length > 0) {
            // Metti in focus il primo peer remoto rimasto
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
    if (liTemplate) {
        const liElement = liTemplate.content.cloneNode(true).firstElementChild;
        liElement.id = `list-local`;
        liElement.dataset.peerId = 'local';
        liElement.querySelector('.participant-name').textContent = `${userNickname} (Tu)`;
        participantsList.prepend(liElement); // Aggiunge in cima alla lista
    }

    // 2. Crea la miniatura locale nella galleria (solo per l'UI)
    const template = document.getElementById('remote-video-template');
    
    if (!template) {
        console.error("ERRORE: Template 'remote-video-template' non trovato nel DOM.");
        return; 
    }
    
    const localFeed = template.content.cloneNode(true).firstElementChild;
    localFeed.dataset.peerId = 'local';
    localFeed.classList.add('local-feed'); // Classe CSS per l'evidenziazione locale
    
    const videoElement = localFeed.querySelector('video');
    videoElement.srcObject = localStream;
    videoElement.muted = true; // Locale sempre muto (eco)

    const labelElement = localFeed.querySelector('.video-label');
    labelElement.textContent = userNickname;

    remoteVideosContainer.appendChild(localFeed);

    // 3. Imposta il focus iniziale sul video locale e lo evidenzia
    setMainVideo('local');
    
    // 4. Aggiunge l'event listener per cambiare il focus al click sulla miniatura locale
    localFeed.addEventListener('click', () => setMainVideo('local'));
}


function updateParticipantCount() {
    // Contiamo i peer remoti + 1 per l'utente locale
    const totalCount = Object.keys(remoteNicknames).length + 1; 
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

        // Collega lo stream al main video feed e alla miniatura locale
        mainVideoElement.srcObject = localStream; 
        
        // Inizializza la miniatura locale nella galleria
        initializeLocalFeed();

    } catch (error) {
        console.error("Errore nell'accesso ai media locali:", error);
        alert("Non è stato possibile accedere a videocamera e microfono. Assicurati di aver dato i permessi.");
    }
}

function toggleAudio() {
    if (!localStream) return;
    localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        toggleAudioButton.textContent = track.enabled ? '🎤' : '🔇';
    });
}

function toggleVideo() {
    if (!localStream) return;
    localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
        toggleVideoButton.textContent = track.enabled ? '📹' : '📷';
    });
}

// ==============================================================================
// FUNZIONI WEBRTC P2P
// ==============================================================================

function createPeerConnection(peerId) {
    // Se la connessione esiste già, la restituisce
    if (peerConnections[peerId]) return peerConnections[peerId];
    
    const pc = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
        ]
    });

    // 1. Invio candidati ICE
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate, peerId);
        }
    };

    // 2. Ricezione stream remoto
    pc.ontrack = (event) => {
        handleRemoteTrack(event.streams[0], peerId);
    };

    // 3. Aggiunta tracce locali (video e audio)
    if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    peerConnections[peerId] = pc;
    return pc;
}

function handleRemoteTrack(stream, peerId) {
    const nickname = remoteNicknames[peerId] || 'Utente Remoto';
    // Aggiunge la miniatura alla galleria
    addRemotePeer(peerId, stream, nickname);
}

function createOffer(peerId) {
    const pc = peerConnections[peerId];
    if (!pc) {
        console.error(`Impossibile creare offerta: PeerConnection per ${peerId} non trovata.`);
        return;
    }

    pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
            // Emette l'offerta al peer specificato
            socket.emit('offer', pc.localDescription, peerId); 
        })
        .catch(error => console.error(`Error creating offer for ${peerId}:`, error));
}

function createAnswer(offer, peerId) {
    const pc = peerConnections[peerId];
    if (!pc) {
        console.error(`Impossibile creare risposta: PeerConnection per ${peerId} non trovata.`);
        return;
    }

    // 1. Imposta l'offerta ricevuta come descrizione remota
    pc.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => pc.createAnswer()) // 2. Crea la risposta
        .then(answer => pc.setLocalDescription(answer)) // 3. Imposta la risposta come descrizione locale
        .then(() => {
            // 4. Emette la risposta al peer specificato
            socket.emit('answer', pc.localDescription, peerId); 
        })
        .catch(error => console.error(`Error creating answer for ${peerId}:`, error));
}


// ==============================================================================
// GESTIONE SOCKETS E INGRESSO (CORRETTA)
// ==============================================================================

function setupSocketEvents() {
    
    // 1. GESTIONE DELL'ARRIVO DI UN NUOVO PEER ('welcome')
    // L'utente che è già in conferenza riceve 'welcome' e deve inviare l'offerta al nuovo arrivato.
    socket.on('welcome', (peerSocketId, nickname) => {
        console.log(`Un nuovo utente (${nickname}) si è unito: ${peerSocketId}`);
        remoteNicknames[peerSocketId] = nickname;
        
        createPeerConnection(peerSocketId); 
        createOffer(peerSocketId); // L'utente "vecchio" che riceve welcome inizia la chiamata
    });

    // 2. GESTIONE DELL'INIZIALIZZAZIONE DELLA STANZA ('init')
    // L'utente appena connesso riceve la lista dei peer già presenti.
    socket.on('init', (peersInRoom) => {
        console.log("Ricevuta lista peer esistenti:", peersInRoom);
        
        peersInRoom.forEach(([peerId, nickname]) => {
            if (peerId !== socket.id) {
                // Per ogni peer remoto, prepariamo la connessione
                remoteNicknames[peerId] = nickname;
                createPeerConnection(peerId);
                // Non è necessario inviare l'offerta qui, perché il peer "vecchio" la invierà a noi tramite 'welcome'.
            }
        });
        updateParticipantCount(); 
    });

    // 3. GESTIONE DELL'ARRIVO DI UN'OFFERTA DA UN PEER
    socket.on('offer', (offer, peerSocketId) => {
        console.log(`Ricevuta OFFERTA da: ${peerSocketId}`);
        
        // Assicuriamo che la PeerConnection esista, altrimenti la creiamo
        if (!peerConnections[peerSocketId]) {
            remoteNicknames[peerSocketId] = remoteNicknames[peerSocketId] || 'Utente Remoto'; 
            createPeerConnection(peerSocketId);
        }
        
        // Creiamo la risposta (Answer)
        createAnswer(offer, peerSocketId);
    });

    // 4. GESTIONE DELLA RISPOSTA (Answer)
    socket.on('answer', (answer, peerSocketId) => {
        const pc = peerConnections[peerSocketId];
        if (pc) {
            pc.setRemoteDescription(new RTCSessionDescription(answer))
                .catch(e => console.error('Error setting remote answer:', e));
        }
    });

    // 5. GESTIONE DEI CANDIDATI ICE
    socket.on('ice-candidate', (candidate, peerSocketId) => {
        const pc = peerConnections[peerSocketId];
        // Controlliamo che la descrizione remota sia stata impostata
        if (pc && pc.remoteDescription) { 
            pc.addIceCandidate(new RTCIceCandidate(candidate))
                .catch(e => console.error('Error adding ICE candidate:', e));
        }
    });

    // 6. GESTIONE DELLA DISCONNESSIONE
    socket.on('user-left', (peerSocketId) => {
        console.log(`Utente disconnesso: ${peerSocketId}`);
        removePeer(peerSocketId);
    });
}


// ==============================================================================
// INIZIALIZZAZIONE GLOBALE
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
    // Rimuove tutte le connessioni P2P aperte
    Object.values(peerConnections).forEach(pc => pc.close());
    window.location.reload(); // Ricarica la pagina per uscire
});