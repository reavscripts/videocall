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
// Assumendo che esista un elemento con questo ID nell'HTML aggiornato
const participantCountSpan = document.getElementById('participant-count'); 
const joinButton = document.getElementById('join-button');
const nicknameInput = document.getElementById('nickname-input');


// --- VARIABILI DI STATO ---
let socket = null;
let localStream = null;
let userNickname = 'Ospite';
// ID fisso della stanza
const roomId = 'mia_stanza_video';
const peerConnections = {}; // Mappa per RTCPeerConnection: { socketId: RTCPeerConnection }
const remoteNicknames = {}; // Mappa per i nickname remoti

// Configurazione STUN (Server Traversal Utilities for NAT)
const iceConfiguration = {
    // Si possono aggiungere altri STUN/TURN per maggiore robustezza
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
        // La lista include l'utente locale, quindi il conteggio è: 1 (locale) + numero di peer
        participantCountSpan.textContent = 1 + Object.keys(peerConnections).length;
    }
}

/**
 * Aggiorna la lista dei partecipanti nel pannello laterale.
 */
function updateParticipantList(id, nickname, isLocal = false) {
    let li = document.getElementById(`list-${id}`);
    if (!li) {
        li = document.createElement('li');
        li.id = `list-${id}`;
        // Aggiunge un indicatore di stato
        li.innerHTML = `<span class="participant-name">${nickname}</span> <span class="status-indicator">•</span>`;
        participantsList.appendChild(li);
    }
    // Aggiorna il testo per l'utente locale
    if (isLocal) {
        li.querySelector('.participant-name').textContent = nickname + " (Tu)";
    }
    updateParticipantCount(); // Aggiorna il contatore ogni volta che la lista cambia
}


/**
 * Gestisce il click sul pulsante "Entra" e avvia il processo.
 */
joinButton.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
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
                // Gestione dell'errore
                console.error("Non è stato possibile avviare la webcam:", error.name, error);
                showStatusMessage(`Impossibile avviare la webcam. Controlla i permessi. Errore: ${error.name}`);

                // Ritorna all'overlay in caso di errore
                nicknameOverlay.classList.remove('hidden');
                conferenceContainer.classList.add('hidden');
            });
    } else {
        showStatusMessage('Per favore, inserisci un nickname.');
    }
});


// ==============================================================================
// FUNZIONI ACQUISIZIONE MEDIA (WEBCAM)
// ==============================================================================

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
        // Usa playsinline per compatibilità iOS
        localVideo.setAttribute('playsinline', '');
        localVideo.srcObject = localStream;
        return localStream;
    } catch (error) {
        throw error;
    }
}

/**
 * Aggiunge i track del flusso locale alla connessione RTCPeerConnection.
 * @param {RTCPeerConnection} pc
 */
function addLocalTracks(pc) {
    if (localStream) {
        localStream.getTracks().forEach(track => {
            // Usa addTrack al posto di addStream (deprecato)
            pc.addTrack(track, localStream);
        });
    }
}


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

        // Nasconde il placeholder quando ci sono peer remoti
        document.getElementById('remote-video-placeholder')?.classList.add('hidden');

        userList.forEach(user => {
            if (user.socketId !== socket.id) {
                remoteNicknames[user.socketId] = user.nickname;
                updateParticipantList(user.socketId, user.nickname);
                // Inizia la chiamata (come Caller)
                callUser(user.socketId, true);
            }
        });
    });

    // 2. Ricevi un nuovo utente (loro chiamano te)
    socket.on('user-joined', (newSocketId, newNickname) => {
        console.log(`Nuovo utente ${newNickname} unito: ${newSocketId}`);
        remoteNicknames[newSocketId] = newNickname;
        // Inizializza la connessione con il nuovo utente (aspetterà l'Offer)
        callUser(newSocketId, false);
        updateParticipantList(newSocketId, newNickname);
        // Nasconde il placeholder
        document.getElementById('remote-video-placeholder')?.classList.add('hidden');
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
        // Mostra il placeholder se non ci sono più peer
        if (Object.keys(peerConnections).length === 0) {
            document.getElementById('remote-video-placeholder')?.classList.remove('hidden');
        }
    });

    socket.on('disconnect', () => {
        console.log('Disconnesso dal server. Prova a ricaricare la pagina.');
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

    // Aggiungi i track locali
    addLocalTracks(pc);

    // GESTIONE DELLA RICEZIONE DEL VIDEO REMOTO (ONTRAK)
    pc.ontrack = (event) => {
        console.log(`Ricevuto track da ${socketId}`);

        // Trova o crea l'elemento video remoto
        let remoteVideoItem = remoteVideosContainer.querySelector(`[data-peer-id="${socketId}"]`);

        if (!remoteVideoItem) {
             // Utilizza la funzione che ora usa un template (se hai aggiornato l'HTML)
             remoteVideoItem = createRemoteVideoElement(socketId, event.streams[0]);
             remoteVideosContainer.appendChild(remoteVideoItem);
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
    
    // GESTIONE CAMBIO DI STATO DI CONNESSIONE (utile per debug/UI)
    pc.oniceconnectionstatechange = () => {
        console.log(`Stato di connessione per ${socketId}: ${pc.iceConnectionState}`);
        // Implementare UI status qui (es. un puntino verde/rosso nella lista)
    };

    // Salva la connessione
    peerConnections[socketId] = pc;
    return pc;
}

/**
 * Funzione helper per creare l'elemento video remoto nel DOM.
 * Utilizza la logica di clonazione del template (se l'HTML è stato aggiornato)
 */
function createRemoteVideoElement(socketId, stream) {
    const template = document.getElementById('remote-video-template');
    let remoteVideoItem;

    if (template) {
        // Usa il template se disponibile
        remoteVideoItem = template.content.cloneNode(true).firstElementChild;
        const remoteVideo = remoteVideoItem.querySelector('video');
        const videoLabel = remoteVideoItem.querySelector('.video-label');

        remoteVideoItem.dataset.peerId = socketId;
        // Usa playsinline per compatibilità iOS
        remoteVideo.setAttribute('playsinline', '');
        remoteVideo.srcObject = stream;
        videoLabel.textContent = remoteNicknames[socketId] || `Peer ${socketId.substring(0, 4)}...`;

    } else {
        // Fallback al tuo codice originale se non usi il template
        remoteVideoItem = document.createElement('div');
        remoteVideoItem.className = 'remote-video-item';
        remoteVideoItem.dataset.peerId = socketId;

        const remoteVideo = document.createElement('video');
        remoteVideo.autoplay = true;
        remoteVideo.setAttribute('playsinline', '');
        remoteVideo.srcObject = stream;

        const videoLabel = document.createElement('div');
        videoLabel.className = 'video-label';
        videoLabel.textContent = remoteNicknames[socketId] || `Peer ${socketId.substring(0, 4)}...`;

        remoteVideoItem.appendChild(remoteVideo);
        remoteVideoItem.appendChild(videoLabel);
    }
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
            // Usa 'offerToReceiveAudio' e 'offerToReceiveVideo' per indicare che si vuole ricevere.
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
        // Imposta l'Offer ricevuta come descrizione remota
        await pc.setRemoteDescription(new RTCSessionDescription(description));

        // Crea l'Answer
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
        // Spesso si verifica un "rollback" logico se un candidato arriva prima dell'SDP.
        // WebRTC lo gestisce internamente, ma è bene loggarlo.
        console.error('Errore nell\'aggiunta del candidato ICE. Potrebbe essere gestito internamente:', error);
    }
}

/**
 * Pulisce la connessione e l'interfaccia utente quando un utente lascia.
 */
function removePeer(socketId) {
    const pc = peerConnections[socketId];
    if (pc) {
        // Chiude la connessione P2P
        pc.close();
        delete peerConnections[socketId];
    }

    // Rimuovi l'elemento video dal DOM
    const videoElement = remoteVideosContainer.querySelector(`[data-peer-id="${socketId}"]`);
    if (videoElement) {
        videoElement.remove();
    }

    // Rimuovi dalla lista partecipanti
    const liElement = document.getElementById(`list-${socketId}`);
    if (liElement) {
        liElement.remove();
    }
    delete remoteNicknames[socketId];

    // Aggiorna il contatore
    updateParticipantCount();

    console.log(`Utente ${socketId} rimosso.`);
}