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

/**
 * Funzione helper per mostrare un messaggio di stato/errore nella console.
 * @param {string} message
 */
function showStatusMessage(message) {
    console.warn(`[AVVISO UI] ${message}`);
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
    let li = document.getElementById(`list-${id}`);
    if (!li) {
        li = document.createElement('li');
        li.id = `list-${id}`;
        li.dataset.peerId = id; 
        li.innerHTML = `<span class="participant-name">${nickname}</span> <span class="status-indicator">•</span>`;
        participantsList.appendChild(li);

        // Listener per mettere il video in focus cliccando sulla lista
        li.addEventListener('click', () => {
             setMainVideo(id); 
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
        
        if (!remoteVideoElement) {
            console.error(`Impossibile trovare l'elemento video per ID: ${peerId}`);
            return;
        }
        
        // Lo stream dovrebbe essere disponibile sull'elemento video della miniatura
        stream = remoteVideoElement.querySelector('video').srcObject;
        nickname = remoteNicknames[peerId];
    }
    
    if (!stream) {
        mainVideoFeed.innerHTML = `<div class="video-placeholder">Stream non disponibile per ${nickname}</div>`;
        return;
    }
    
    // 2. Sposta lo stream nel contenitore principale
    
    let videoEl = mainVideoFeed.querySelector('video');
    if (!videoEl) {
        videoEl = document.createElement('video');
        videoEl.autoplay = true;
        videoEl.playsinline = true;
    }
    
    videoEl.muted = isLocal; // Muta solo se è il video locale
    videoEl.srcObject = stream;

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
        console.log(`Audio locale: ${audioTrack.enabled ? 'Attivato' : 'Disattivato'}`);
    }
});

toggleVideoButton.addEventListener('click', () => {
    const videoTrack = localStream?.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        const icon = videoTrack.enabled ? '📹' : '⬛';
        toggleVideoButton.textContent = icon;
        console.log(`Video locale: ${videoTrack.enabled ? 'Attivato' : 'Disattivato'}`);
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
        // Rimuovi anche dalla UI senza avvisare il server (lo fa la disconnessione socket)
        removePeer(socketId, false); 
    });
    
    // 3. Disconnetti da Socket.IO
    if (socket) {
        socket.disconnect();
    }
    
    // 4. Ripristina l'interfaccia utente
    nicknameOverlay.classList.remove('hidden');
    conferenceContainer.classList.add('hidden');
    // Reimposta il main feed al suo stato iniziale (locale)
    mainVideoFeed.innerHTML = `<video id="local-video" autoplay muted playsinline></video><div class="video-label">Tu</div>`; 
    // Reimposta il contenitore remoto al suo placeholder
    remoteVideosContainer.innerHTML = `<div id="remote-video-placeholder" class="video-placeholder">In attesa di altri partecipanti...</div>`;
    participantsList.innerHTML = '';
    
    // Pulisci le mappe e resetta lo stato
    Object.keys(peerConnections).forEach(key => delete peerConnections[key]);
    Object.keys(remoteNicknames).forEach(key => delete remoteNicknames[key]);
    focusedPeerId = 'local';
    
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
        // Invia il nickname al server al momento dell'unione alla stanza
        socket.emit('join-room', roomId, userNickname);
    });

    // 1. Ricevi la lista degli utenti già presenti (il nuovo utente chiama loro)
    socket.on('users-in-room', (userList) => {
        updateParticipantList(socket.id, userNickname, true);

        // Nasconde il placeholder
        if (userList.length > 1) { // 1 (locale) + N remoti
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
            // Se l'elemento non esiste, crealo e collegaci lo stream
            remoteVideoItem = createRemoteVideoElement(socketId, event.streams[0]);
            remoteVideosContainer.appendChild(remoteVideoItem);
            
            // LOGICA FOCUS: Se è il primo remoto, mettilo subito in focus
            if (Object.keys(peerConnections).length === 1 && focusedPeerId === 'local') {
                setMainVideo(socketId);
            }

        } else {
            // Collega lo stream a un video già esistente, se necessario
            const video = remoteVideoItem.querySelector('video');
            if (video && !video.srcObject) {
                video.srcObject = event.streams[0];
            }
        }
    };

    // GESTIONE DELLO SCAMBIO DEI CANDIDATI ICE
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            // Invia il candidato all'altro peer tramite il server di segnalazione
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
            console.log(`Creazione Offer per ${socketId}`);
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            await pc.setLocalDescription(offer);
            // Invia l'Offer SDP all'altro peer tramite il server
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
        // Invia l'Answer SDP al Caller tramite il server
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
        // L'Answer viene impostata come descrizione remota
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
            // Aggiunge il candidato ricevuto alla connessione
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
    // Chiude la connessione P2P (se non è già chiusa)
    const pc = peerConnections[socketId];
    if (pc && isExternalEvent) {
        pc.close();
    }
    delete peerConnections[socketId];

    // Rimuovi gli elementi dal DOM
    const videoElement = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"]`);
    if (videoElement) {
        videoElement.remove();
    }

    const liElement = document.getElementById(`list-${socketId}`);
    if (liElement) {
        liElement.remove();
    }
    delete remoteNicknames[socketId];

    // LOGICA PER IL FOCUS: se il peer che ha lasciato era in focus, sposta il focus
    if (focusedPeerId === socketId) {
        const remainingPeerIds = Object.keys(peerConnections);
        if (remainingPeerIds.length > 0) {
            // Metti in focus il primo peer rimasto
            setMainVideo(remainingPeerIds[0]);
        } else {
            // Torna al video locale
            setMainVideo('local');
            // Mostra il placeholder se non ci sono più peer remoti
            remoteVideoPlaceholder?.classList.remove('hidden');
        }
    }

    // Aggiorna il contatore
    updateParticipantCount();

    console.log(`Utente ${socketId} rimosso.`);
}