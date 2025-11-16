```javascript
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
// [NUOVI ELEMENTI DOM]
const roomidInput = document.getElementById('roomid-input'); 
const shareLinkButton = document.getElementById('share-link-button'); 

const mainVideoFeed = document.getElementById('main-video-feed');
const remoteVideoPlaceholder = document.getElementById('remote-video-placeholder');
const toggleAudioButton = document.getElementById('toggle-audio-button');
const toggleVideoButton = document.getElementById('toggle-video-button');
const disconnectButton = document.getElementById('disconnect-button');


// --- VARIABILI DI STATO ---
let socket = null;
let localStream = null;
let userNickname = 'Ospite';
// [VARIABILE ROOMID ORA DINAMICA]
let roomId = null; 
const peerConnections = {}; // Mappa per RTCPeerConnection: { socketId: RTCPeerConnection }
const remoteNicknames = {}; // Mappa per i nickname remoti
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

/**
 * Funzione helper per mostrare un messaggio di stato/errore nella console.
 * @param {string} message
 */
function showStatusMessage(message) {
    console.warn(`[AVVISO UI] ${message}`);
}

/**
 * Genera un ID stanza casuale leggibile.
 * Esempio: "chat-4g8h"
 */
function generateRoomId() {
    return 'stanza-' + Math.random().toString(36).substring(2, 6) + '-' + Math.random().toString(36).substring(2, 6);
}

/**
 * Aggiorna il contatore dei partecipanti.
 */
function updateParticipantCount() {
    if (participantCountSpan) {
        // La lista include l'utente locale (1) + il numero di peer
        participantCountSpan.textContent = 1 + Object.keys(peerConnections).length;
    }
}

/**
 * Aggiorna la lista dei partecipanti nel pannello laterale e aggiunge il listener per il focus.
 */
function updateParticipantList(id, nickname, isLocal = false) {
    // 1. Cerchiamo l'elemento esistente tramite l'ID
    let li = document.getElementById(`list-${id}`);

    if (!li) {
        // 2. Se l'elemento NON esiste, lo creiamo
        li = document.createElement('li');
        li.id = `list-${id}`;
        li.dataset.peerId = id; 
        
        // Impostiamo il contenuto iniziale
        li.innerHTML = `<span class="participant-name">${nickname}</span> <span class="status-indicator">•</span>`;
        participantsList.appendChild(li);

        // 3. Listener per mettere il video in focus cliccando sulla lista
        li.addEventListener('click', () => {
             // Chiama la funzione di focus con l'ID del peer cliccato
             setMainVideo(id); 
        });
    }
    
    // 4. Aggiorna il testo e lo stato
    if (isLocal) {
        // Se è l'utente locale, aggiorna il testo per includere "(Tu)"
        li.querySelector('.participant-name').textContent = nickname + " (Tu)";
    } else {
        // Aggiorna il nickname remoto (utile se il server invia aggiornamenti)
        li.querySelector('.participant-name').textContent = nickname;
    }
    
    // 5. Imposta il focus visivo se è il peer attualmente in focus
    if (id === focusedPeerId) {
         li.classList.add('participant-focused');
    } else {
         li.classList.remove('participant-focused');
    }

    updateParticipantCount(); 
}


// ==============================================================================
// GESTIONE FOCUS VIDEO
// ==============================================================================

/**
 * Sposta lo stream del peer specificato nel mainVideoFeed.
 * Gestisce l'aggiornamento dello stato di focus su tutti gli elementi UI.
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
        
        // FIX: Controlliamo che l'elemento remoto esista prima di procedere
        if (!remoteVideoElement) {
            console.error(`Impossibile trovare l'elemento video o lo stream per ID: ${peerId}. Tornando al focus locale.`);
            setMainVideo('local');
            return;
        }
        
        stream = remoteVideoElement.querySelector('video').srcObject;
        nickname = remoteNicknames[peerId];
    }
    
    if (!stream) {
        mainVideoFeed.innerHTML = `<div class="video-placeholder">Stream non disponibile per ${nickname}</div>`;
        focusedPeerId = peerId;
    } else {
        // 2. Sposta lo stream nel contenitore principale
        let videoEl = mainVideoFeed.querySelector('video');
        if (!videoEl) {
            videoEl = document.createElement('video');
            videoEl.autoplay = true;
            videoEl.playsinline = true;
            mainVideoFeed.innerHTML = ''; // Pulisce il vecchio contenuto
            mainVideoFeed.appendChild(videoEl);
        }
        
        videoEl.muted = isLocal; // Muta solo se è il video locale
        videoEl.srcObject = stream;

        // Rimuoviamo il vecchio label se esiste
        mainVideoFeed.querySelector('.video-label')?.remove();

        // Aggiungi l'etichetta
        const videoLabel = document.createElement('div');
        videoLabel.className = 'video-label';
        videoLabel.textContent = nickname;
        mainVideoFeed.appendChild(videoLabel);
    }
    
    focusedPeerId = peerId;


    // 3. Reimposta il focus visivo: lista partecipanti e miniature
    
    // Rimuove il focus da tutti gli elementi della lista
    document.querySelectorAll('#participants-list li').forEach(el => el.classList.remove('participant-focused'));
    // Imposta il focus sull'elemento corretto della lista
    const focusedLi = document.getElementById(`list-${peerId}`);
    if (focusedLi) focusedLi.classList.add('participant-focused');

    // Rimuove il focus da tutte le miniature
    document.querySelectorAll('.remote-feed').forEach(el => el.classList.remove('is-focused'));
    // Imposta il focus sulla miniatura corretta, solo se non è locale
    if (!isLocal) {
        const remoteFeed = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${peerId}"]`);
        if (remoteFeed) remoteFeed.classList.add('is-focused');
    }
}


// ==============================================================================
// GESTIONE INGRESSO UTENTE E MEDIA
// ==============================================================================

/**
 * Analizza l'URL per pre-impostare nickname e ID stanza.
 */
function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const urlRoomId = params.get('room');
    const urlNickname = params.get('nick');
    
    if (urlRoomId) {
        roomidInput.value = urlRoomId;
    }
    
    if (urlNickname) {
        nicknameInput.value = urlNickname;
    }
    
    // NEW: Se l'ID stanza è fornito nell'URL, lo impostiamo come roomId iniziale
    if (urlRoomId) {
        roomId = urlRoomId;
    }
}

// [NUOVO HANDLER PER IL PULSANTE DI CONDIVISIONE]
shareLinkButton.addEventListener('click', () => {
    // Crea il link completo con roomid e nickname come parametri URL
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}&nick=${encodeURIComponent(userNickname)}`;
    
    // Usa l'API Clipboard se disponibile, altrimenti usa un vecchio metodo
    if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl).then(() => {
            shareLinkButton.textContent = 'Link Copiato! ✅';
            setTimeout(() => shareLinkButton.textContent = 'Condividi Link 🔗', 2000);
        }).catch(err => {
            console.error('Impossibile copiare il testo: ', err);
            prompt('Copia manualmente questo link:', shareUrl);
        });
    } else {
         prompt('Copia manualmente questo link:', shareUrl);
    }
});


joinButton.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    let requestedRoomId = roomidInput.value.trim();

    if (!nickname) {
        showStatusMessage('Per favore, inserisci un nickname.');
        return;
    }

    // [LOGICA ROOMID DINAMICA]
    // 1. Controlla se l'utente ha inserito un ID stanza
    if (requestedRoomId) {
        roomId = requestedRoomId;
    } 
    // 2. Altrimenti, controlla se era già impostato tramite URL
    else if (!roomId) { 
        // 3. Se non è fornito dall'utente NÉ dall'URL, genera un nuovo ID stanza
        roomId = generateRoomId();
        console.log(`Creazione di una nuova stanza con ID: ${roomId}`);
    }
    // else: usa l'ID stanza già impostato dalla funzione checkUrlParams()

    userNickname = nickname;
    
    startLocalMedia()
        .then(() => {
            // [AGGIORNAMENTO INTERFACCIA UTENTE]
            nicknameOverlay.classList.add('hidden');
            conferenceContainer.classList.remove('hidden');
            // Assicurati che il pulsante sia nel contenitore visibile
            // shareLinkButton.classList.remove('hidden'); 
            
            // Se il pulsante è nel participants-panel, la riga sopra è sufficiente.
            // Se fosse nel nickname-overlay, la riga sopra non funzionerebbe!
            const panelButton = document.getElementById('share-link-button');
            if (panelButton) panelButton.classList.remove('hidden');

            initializeSocket();
            
            // [AGGIORNA L'URL] Aggiorna l'URL del browser senza ricaricare la pagina
            const newUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
            window.history.pushState({ path: newUrl }, '', newUrl);

        })
        .catch(error => {
            console.error("Non è stato possibile avviare la webcam:", error.name, error);
            showStatusMessage(`Impossibile avviare la webcam. Controlla i permessi. Errore: ${error.name}`);
            nicknameOverlay.classList.remove('hidden');
            conferenceContainer.classList.add('hidden');
        });
});

/**
 * Avvia la webcam e il microfono e mostra lo stream locale.
 * @returns {Promise<MediaStream>} Il flusso media locale.
 */
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
    
    // 2. Chiudi tutte le RTCPeerConnections e pulisci le mappe/UI
    Object.keys(peerConnections).forEach(socketId => {
        if (peerConnections[socketId]) {
            peerConnections[socketId].close();
        }
        removePeer(socketId, false); 
    });
    
    // 3. Disconnetti da Socket.IO
    if (socket) {
        socket.disconnect();
    }
    
    // 4. Ripristina l'interfaccia utente (PULIZIA FINALE)
    nicknameOverlay.classList.remove('hidden');
    conferenceContainer.classList.add('hidden');
    
    const panelButton = document.getElementById('share-link-button');
    if (panelButton) panelButton.classList.add('hidden');
    
    mainVideoFeed.innerHTML = `<video id="local-video" autoplay muted playsinline></video><div class="video-label">Tu</div>`; 
    remoteVideosContainer.innerHTML = `<div id="remote-video-placeholder" class="video-placeholder">In attesa di altri partecipanti...</div>`;
    participantsList.innerHTML = '';
    
    // Pulisci le mappe e resetta lo stato
    Object.keys(peerConnections).forEach(key => delete peerConnections[key]);
    Object.keys(remoteNicknames).forEach(key => delete remoteNicknames[key]);
    focusedPeerId = 'local';
    roomId = null; // Resetta l'ID stanza

    // Resetta anche l'URL del browser
    window.history.pushState({ path: window.location.pathname }, '', window.location.pathname);
    
    // Rimuove i valori inseriti nei campi
    roomidInput.value = '';
    nicknameInput.value = '';

    // Rilancia la logica dei parametri URL in caso di ricarica
    checkUrlParams(); 

    console.log("Conferenza lasciata.");
});


// ==============================================================================
// FUNZIONI SOCKET.IO (Segnalazione)
// ==============================================================================

/**
 * Inizializza la connessione con il server di segnalazione.
 */
function initializeSocket() {
    socket = io(RENDER_SERVER_URL);

    socket.on('connect', () => {
        console.log('Connesso al server di segnalazione.');
        // Usa la variabile roomId aggiornata
        socket.emit('join-room', roomId, userNickname); 
    });

    // 1. Ricevi la lista degli utenti già presenti (il nuovo utente chiama loro)
    socket.on('users-in-room', (userList) => {
        updateParticipantList(socket.id, userNickname, true);

        // Nasconde il placeholder
        if (userList.length > 1) { 
             remoteVideoPlaceholder?.classList.add('hidden');
        }

        userList.forEach(user => {
            if (user.socketId !== socket.id) {
                remoteNicknames[user.socketId] = user.nickname;
                updateParticipantList(user.socketId, user.nickname);
                callUser(user.socketId, true); // Inizia la chiamata (Caller)
            }
        });
    });

    // 2. Ricevi un nuovo utente (loro chiamano te)
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

/**
 * Aggiunge i track del flusso locale alla connessione RTCPeerConnection.
 * @param {RTCPeerConnection} pc
 */
function addLocalTracks(pc) {
    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }
}

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
    addLocalTracks(pc);

    // GESTIONE DELLA RICEZIONE DEL VIDEO REMOTO (ONTRAK)
    pc.ontrack = (event) => {
        console.log(`Ricevuto track da ${socketId}`);

        let remoteVideoItem = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"]`);

        if (!remoteVideoItem) {
            remoteVideoItem = createRemoteVideoElement(socketId, event.streams[0]);
            remoteVideosContainer.appendChild(remoteVideoItem);
            
            // LOGICA FOCUS: Se è il primo remoto, mettilo subito in focus
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
    const template = document.getElementById('remote-video-template');
    
    // Clona il template
    const remoteVideoItem = template.content.cloneNode(true).firstElementChild;
    const remoteVideo = remoteVideoItem.querySelector('video');
    const videoLabel = remoteVideoItem.querySelector('.video-label');

    remoteVideoItem.dataset.peerId = socketId;
    remoteVideo.srcObject = stream;
    remoteVideo.setAttribute('playsinline', '');
    videoLabel.textContent = remoteNicknames[socketId] || `Peer ${socketId.substring(0, 4)}...`;

    // Listener per mettere il video in focus cliccando sulla miniatura
    remoteVideoItem.addEventListener('click', () => {
        setMainVideo(socketId);
    });

    return remoteVideoItem;
}

/**
 * Invia la chiamata (Offer SDP) - Viene chiamato solo se isCaller è true
 */
async function callUser(socketId, isCaller) {
    const pc = getOrCreatePeerConnection(socketId);

    if (isCaller) {
        try {
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            await pc.setLocalDescription(offer);
            socket.emit('offer', socketId, pc.localDescription);
        } catch (error) {
            console.error('Errore nella creazione dell\'Offer:', error);
        }
    }
}

/**
 * Gestisce la ricezione dell'Offer e risponde con l'Answer.
 */
async function handleOffer(socketId, description) {
    const pc = getOrCreatePeerConnection(socketId);

    try {
        await pc.setRemoteDescription(new RTCSessionDescription(description));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', socketId, pc.localDescription);
    } catch (error) {
        console.error('Errore nella gestione dell\'Offer:', error);
    }
}

/**
 * Gestisce la ricezione dell'Answer.
 */
async function handleAnswer(socketId, description) {
    const pc = getOrCreatePeerConnection(socketId);
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(description));
        console.log(`Connessione WebRTC stabilita con ${socketId}`);
    } catch (error) {
        console.error('Errore nella gestione dell\'Answer:', error);
    }
}

/**
 * Aggiunge i Candidati ICE ricevuti per stabilire la connettività di rete.
 */
async function handleCandidate(socketId, candidate) {
    try {
        const pc = peerConnections[socketId];
        if (pc && candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    } catch (error) {
        console.error('Errore nell\'aggiunta del candidato ICE. Potrebbe essere gestito internamente:', error);
    }
}

/**
 * Pulisce la connessione e l'interfaccia utente quando un utente lascia.
 * @param {string} socketId - ID del socket del peer che ha lasciato.
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
    const videoElement = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"]`);
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

    // 5. Aggiorna il contatore e il placeholder remoto
    updateParticipantCount();

    if (Object.keys(peerConnections).length === 0) {
        remoteVideoPlaceholder?.classList.remove('hidden');
    }

    console.log(`Utente ${socketId} rimosso.`);
}
