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
const roomIdInput = document.getElementById('room-id-input'); 

// Elementi DOM per il focus e i controlli
const mainVideoFeed = document.getElementById('main-video-feed');
const mainMuteBtn = document.getElementById("main-mute-btn");
const remoteVideoPlaceholder = document.getElementById('remote-video-placeholder');
const toggleAudioButton = document.getElementById('toggle-audio-button');
const toggleVideoButton = document.getElementById('toggle-video-button');
const disconnectButton = document.getElementById('disconnect-button');
const roomNameDisplay = document.getElementById('room-name-display');

// Elementi DOM per i pannelli e la chat
const participantsPanel = document.getElementById('participants-panel'); 
const chatPanel = document.getElementById('chat-panel'); 
const showParticipantsBtn = document.getElementById('show-participants-btn'); 
const showChatBtn = document.getElementById('show-chat-btn'); 
const chatMessageInput = document.getElementById('chat-message-input');
const sendChatButton = document.getElementById('send-chat-button');
const messagesContainer = document.getElementById('messages-container');

// Variabili di stato
let socket = null;
let localStream = null;
let currentRoomId = null;
let localNickname = null;
let focusedPeerId = 'local'; // 'local' per il video locale, altrimenti l'ID del peer remoto
const peerConnections = {}; // Mappa di tutte le connessioni RTCPeerConnection (socketId -> RTCPeerConnection)
const remoteNicknames = {}; // Mappa dei nickname dei peer remoti (socketId -> nickname)

// ==============================================================================
// GESTIONE INGRESSO E CONNESSIONE
// ==============================================================================

/**
 * Avvia la connessione a Socket.IO e alla stanza.
 */
function joinRoom(roomId, nickname) {
    currentRoomId = roomId;
    localNickname = nickname;
    roomNameDisplay.textContent = `Stanza: ${roomId}`; // Aggiorna il nome della stanza nell'header

    // 1. Inizializza Socket.IO (connessione al server di segnalazione)
    socket = io(RENDER_SERVER_URL, {
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });

    // 2. Ottiene l'accesso a microfono e videocamera
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            localStream = stream;
            
            // 3. Mostra il video locale nell'area principale
            setLocalVideo(stream);
            
            // 4. Esegue il login nella stanza sul server di segnalazione
            socket.emit('join', roomId, nickname);
            
            // 5. Nasconde l'overlay e mostra l'interfaccia della conferenza
            nicknameOverlay.classList.add('hidden');
            conferenceContainer.classList.remove('hidden');

            // 6. Configura i listener Socket.IO e i controlli
            setupSocketListeners();
            setupMediaControls();
            
        })
        .catch(error => {
            console.error('Errore nell\'accesso ai media (microfono/videocamera):', error);
            alert(`Impossibile accedere ai media: ${error.message}. Assicurati di aver dato i permessi.`);
        });
}

/**
 * Imposta il video feed locale nell'area principale.
 */
function setLocalVideo(stream) {
    const videoEl = mainVideoFeed.querySelector('video');
    videoEl.srcObject = stream;
    // La label locale è "Tu" per impostazione predefinita
    mainVideoFeed.querySelector('.video-label').textContent = `${localNickname} (Tu)`;
}

// ==============================================================================
// GESTIONE ELEMENTI DOM E UTILITY
// ==============================================================================

/**
 * Aggiunge un peer all'interfaccia utente (video e lista partecipanti).
 */
function addPeerToUI(socketId, nickname, stream = null) {
    remoteNicknames[socketId] = nickname;
    remoteVideoPlaceholder.classList.add('hidden'); // Nasconde il placeholder

    // 1. Aggiorna la lista partecipanti
    const liTemplate = document.getElementById('participant-item-template');
    const newLi = liTemplate.content.cloneNode(true).querySelector('li');
    newLi.id = `list-${socketId}`;
    newLi.dataset.peerId = socketId;
    newLi.querySelector('.participant-name').textContent = nickname;
    
    // 1.1 Listener per il focus al click sulla lista
    newLi.addEventListener('click', () => setMainVideo(socketId));

    participantsList.appendChild(newLi);

    // 2. Aggiunge il video feed remoto (anche se lo stream è ancora null)
    const videoTemplate = document.getElementById('remote-video-template');
    const newFeed = videoTemplate.content.cloneNode(true).querySelector('.remote-feed');
    newFeed.dataset.peerId = socketId;
    newFeed.id = `feed-${socketId}`;
    newFeed.querySelector('.video-label').textContent = nickname;
    
    // 2.1 Listener per il focus al click sul video
    newFeed.addEventListener('click', () => setMainVideo(socketId));

    if (stream) {
        newFeed.querySelector('video').srcObject = stream;
    }
    
    remoteVideosContainer.appendChild(newFeed);
    
    updateParticipantCount();
    
    // Imposta il focus sul primo peer che entra
    if (focusedPeerId === 'local') {
        setMainVideo(socketId);
    }
}

/**
 * Sposta il video di un peer (locale o remoto) nell'area principale.
 */
function setMainVideo(peerId) {
    if (peerId === focusedPeerId) return; // Già in focus

    // 1. Trova gli elementi video/feed
    const mainVideoEl = mainVideoFeed.querySelector('video');
    const mainLabelEl = mainVideoFeed.querySelector('.video-label');
    const newPeerFeed = document.getElementById(`feed-${peerId}`) || mainVideoFeed; // Se 'local', usa mainVideoFeed stesso

    // 2. Rimuove lo stato di focus dal peer precedentemente focalizzato
    document.getElementById(`list-${focusedPeerId}`)?.classList.remove('participant-focused');
    document.getElementById(`feed-${focusedPeerId}`)?.classList.remove('is-focused');

    // 3. Salva lo stream corrente (che sta per essere spostato)
    const currentStream = mainVideoEl.srcObject;
    const currentPeerId = focusedPeerId;
    const currentNickname = currentPeerId === 'local' ? localNickname : remoteNicknames[currentPeerId];

    // 4. Imposta il nuovo focus
    focusedPeerId = peerId;

    // 5. Sposta lo stream del NUOVO peer nell'area principale
    mainVideoEl.srcObject = newPeerFeed.querySelector('video').srcObject;
    mainVideoEl.muted = (peerId === 'local'); // Muta sempre il video locale nell'area principale
    mainMuteBtn.style.display = (peerId !== 'local' ? 'block' : 'none');
    mainLabelEl.textContent = peerId === 'local' ? `${localNickname} (Tu)` : remoteNicknames[peerId];
    
    // 6. Sposta lo stream del VECCHIO peer nell'area delle miniature
    const oldFeed = document.getElementById(`feed-${currentPeerId}`);
    if (oldFeed) {
        // Se il vecchio era remoto, ripristina la sua miniatura
        oldFeed.querySelector('video').srcObject = currentStream;
        oldFeed.querySelector('.video-label').textContent = currentNickname;
    } else {
        // Se il vecchio era locale, lo stream torna alla miniatura locale 
        // L'elemento locale non ha un proprio feed nella sezione miniature, quindi questa operazione non è necessaria
        // Lo stream locale rimane su mainVideoEl per comodità e viene mutato
    }
    
    // 7. Aggiunge lo stato di focus al nuovo peer
    document.getElementById(`list-${peerId}`)?.classList.add('participant-focused');
    document.getElementById(`feed-${peerId}`)?.classList.add('is-focused');
}


/**
 * Aggiorna il contatore dei partecipanti.
 */
function updateParticipantCount() {
    // +1 per l'utente locale
    const count = Object.keys(peerConnections).length + 1; 
    participantCountSpan.textContent = count;
}

// ==============================================================================
// CHAT
// ==============================================================================

/**
 * Aggiunge un nuovo messaggio alla chat.
 */
function addChatMessage(sender, message, isLocal = false) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message';
    if (isLocal) {
        messageEl.classList.add('self');
        sender = localNickname;
    }

    messageEl.innerHTML = `<span class="sender">${sender}:</span> ${message}`;
    messagesContainer.appendChild(messageEl);
    
    // Scrolla in basso
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function handleSendMessage() {
    const message = chatMessageInput.value.trim();
    if (message) {
        addChatMessage(localNickname, message, true);
        socket.emit('chat', currentRoomId, message);
        chatMessageInput.value = '';
    }
}

// ==============================================================================
// GESTIONE CONTROLLI MEDIA E MOBILE 
// ==============================================================================

/**
 * Funzione per gestire l'apertura/chiusura dei pannelli mobili/laterali.
 * * Sfrutta il CSS per nascondere/mostrare a seconda della dimensione dello schermo:
 * - PC: Mostra il pannello lateralmente (l'area video si adatta)
 * - Mobile: Mostra il pannello a schermo intero (l'area video viene nascosta dal CSS)
 */
function toggleMobilePanel(panel) {
    // 1. Controlla se il pannello target è già attivo
    const isActive = panel.classList.contains('active');

    // 2. Nascondi tutti i pannelli
    participantsPanel.classList.remove('active');
    chatPanel.classList.remove('active');

    // 3. Se non era attivo, attivalo (altrimenti, l'azione è stata nasconderlo)
    if (!isActive) {
        panel.classList.add('active');

        // Focus sull'input della chat se il pannello è la chat
        if (panel === chatPanel) {
             setTimeout(() => chatMessageInput.focus(), 50); 
        }
    }
    
    // Su mobile, il CSS si occuperà di nascondere o mostrare l'area video 
    // in base alla presenza della classe 'active' sul pannello.
}

/**
 * Configura i listener per i controlli media.
 */
function setupMediaControls() {
    // 1. Audio
    toggleAudioButton.addEventListener('click', () => {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            toggleAudioButton.textContent = audioTrack.enabled ? '🔊' : '🔇';
            toggleAudioButton.classList.toggle('danger', !audioTrack.enabled);
        }
    });

    // 2. Video
    toggleVideoButton.addEventListener('click', () => {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            toggleVideoButton.textContent = videoTrack.enabled ? '📹' : '⬜';
            toggleVideoButton.classList.toggle('danger', !videoTrack.enabled);
        }
    });
    
    // 3. Disconnessione
    disconnectButton.addEventListener('click', () => {
        disconnect();
    });
    
    // 4. Mute video principale remoto
    mainMuteBtn.addEventListener("click", () => {
        const videoEl = mainVideoFeed.querySelector("video");
        videoEl.muted = !videoEl.muted;
        mainMuteBtn.textContent = videoEl.muted ? "🔇" : "🔊";
    });
    
    // 5. Chat
    sendChatButton.addEventListener('click', handleSendMessage);
    chatMessageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    });

    // 6. Pannelli Mobile
    // Usa la funzione di toggle pulita
    showParticipantsBtn.addEventListener('click', () => {
        toggleMobilePanel(participantsPanel);
    });

    showChatBtn.addEventListener('click', () => {
        toggleMobilePanel(chatPanel); 
    });
}

/**
 * Termina lo stream, chiude le connessioni e ricarica la pagina.
 */
function disconnect() {
    // Chiude lo stream
    localStream.getTracks().forEach(track => track.stop());
    
    // Chiude tutte le connessioni P2P
    Object.values(peerConnections).forEach(pc => pc.close());

    // Chiude la connessione Socket.IO
    if (socket) {
        socket.disconnect();
    }
    
    // Ritorna all'overlay di ingresso
    window.location.reload(); 
}

// ==============================================================================
// GESTIONE SOCKET.IO (Segnalazione)
// ==============================================================================

/**
 * Configura i listener principali di Socket.IO.
 */
function setupSocketListeners() {
    // 1. Nuovi utenti che sono già nella stanza (per iniziare la connessione P2P)
    socket.on('welcome', (newPeerId, nickname, usersInRoom) => {
        console.log(`Un nuovo utente (${nickname}) si è unito. Devo chiamare!`);
        remoteNicknames[newPeerId] = nickname;
        
        // Inizia le chiamate per tutti gli utenti già presenti
        usersInRoom.forEach(peerToCallId => {
            if (peerToCallId !== socket.id) {
                // Inizializza RTCPeerConnection e crea l'Offer
                createPeerConnection(newPeerId, true);
            }
        });
    });

    // 2. Utenti che si uniscono (per ricevere l'Offer)
    socket.on('user-joined', (newPeerId, nickname) => {
        console.log(`Nuovo utente ${nickname} entrato! In attesa di Offer.`);
        remoteNicknames[newPeerId] = nickname;
        // Inizializza RTCPeerConnection in attesa dell'Offer
        createPeerConnection(newPeerId, false);
    });

    // 3. Ricezione di una Offer SDP
    socket.on('offer', (fromSocketId, description) => {
        handleOffer(fromSocketId, description);
    });

    // 4. Ricezione di una Answer SDP
    socket.on('answer', (fromSocketId, description) => {
        handleAnswer(fromSocketId, description);
    });

    // 5. Ricezione di un candidato ICE
    socket.on('candidate', (fromSocketId, candidate) => {
        handleCandidate(fromSocketId, candidate);
    });

    // 6. Utente disconnesso
    socket.on('user-left', (socketId) => {
        console.log(`Utente ${socketId} ha lasciato la stanza.`);
        removePeer(socketId);
        updateParticipantCount();
    });
    
    // 7. Ricezione messaggio chat
    socket.on('chat', (senderId, message) => {
        const senderNickname = remoteNicknames[senderId] || `Utente ${senderId.substring(0, 4)}`;
        addChatMessage(senderNickname, message, false);
    });

    // 8. Aggiornamento lista partecipanti (per chi si unisce)
    socket.on('update-participants', (participantsData) => {
        participantsList.innerHTML = ''; // Pulisce la lista
        remoteVideosContainer.innerHTML = ''; // Pulisce le miniature

        participantsData.forEach(p => {
            if (p.id !== socket.id) {
                // Non creare la connessione qui, solo aggiornare la UI se necessario
                addPeerToUI(p.id, p.nickname);
            }
        });
        
        // Riapplica il focus
        if (focusedPeerId !== 'local' && !remoteNicknames[focusedPeerId]) {
            // Se l'utente focalizzato è uscito, sposta il focus
             const remainingPeerIds = Object.keys(peerConnections);
            if (remainingPeerIds.length > 0) {
                setMainVideo(remainingPeerIds[0]);
            } else {
                setMainVideo('local');
            }
        }
        
        // Aggiorna contatore e placeholder
        updateParticipantCount();
        if (participantsData.length <= 1) {
            remoteVideoPlaceholder.classList.remove('hidden');
        } else {
             remoteVideoPlaceholder.classList.add('hidden');
        }
    });
}

// ==============================================================================
// GESTIONE WEBRTC (RTCPeerConnection)
// ==============================================================================

/**
 * Crea una RTCPeerConnection per un peer specifico.
 */
function getOrCreatePeerConnection(socketId) {
    if (peerConnections[socketId]) {
        return peerConnections[socketId];
    }
    
    // Configurazione ICE servers (STUN/TURN)
    const pc = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ]
    });

    // 1. Aggiunge lo stream locale alla connessione
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    // 2. Gestione dei candidati ICE
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', socketId, event.candidate);
        }
    };
    
    // 3. Gestione della traccia remota (quando il peer remoto aggiunge lo stream)
    pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        console.log(`Ricevuto stream remoto da ${socketId}`);
        // Aggiorna il feed video con lo stream
        const remoteFeed = document.getElementById(`feed-${socketId}`);
        if (remoteFeed) {
             remoteFeed.querySelector('video').srcObject = remoteStream;
             // Se il peer è attualmente focalizzato, aggiorna anche il video principale
             if (focusedPeerId === socketId) {
                 mainVideoFeed.querySelector('video').srcObject = remoteStream;
             }
             
             // Aggiunge il peer all'interfaccia utente se non è già lì
             const nickname = remoteNicknames[socketId];
             const listItem = document.getElementById(`list-${socketId}`);
             if (!listItem) {
                 addPeerToUI(socketId, nickname, remoteStream);
             }
             
        } else {
            // Caso in cui il peer non è ancora stato aggiunto alla UI dal server (dovrebbe essere raro)
            addPeerToUI(socketId, remoteNicknames[socketId], remoteStream);
        }
        
    };

    // 4. Gestione dello stato della connessione (opzionale)
    pc.oniceconnectionstatechange = () => {
        console.log(`Stato connessione P2P con ${socketId}: ${pc.iceConnectionState}`);
    };
    
    peerConnections[socketId] = pc;
    return pc;
}

/**
 * Crea la RTCPeerConnection, Offer SDP e la invia al server.
 */
async function createPeerConnection(socketId, isCaller) {
    const pc = getOrCreatePeerConnection(socketId);
    
    // 1. Se è il Caller (colui che inizia la connessione)
    if (isCaller) {
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('offer', socketId, pc.localDescription);
        } catch (error) {
            console.error('Errore nella creazione dell\'Offer:', error);
        }
    }
}

/**
 * Gestisce l'Offer SDP in arrivo e risponde con l'Answer SDP.
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
 * Gestisce l'Answer SDP in arrivo.
 */
async function handleAnswer(socketId, description) {
    const pc = getOrCreatePeerConnection(socketId);
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(description));
    } catch (error) {
        console.error('Errore nella gestione dell\'Answer:', error);
    }
}

/**
 * Gestisce i candidati ICE in arrivo.
 */
async function handleCandidate(socketId, candidate) {
    try {
        const pc = peerConnections[socketId];
        if (pc && pc.remoteDescription && candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    } catch (error) {
        // Ignora gli errori di ICE (spesso è un candidato già gestito o non valido)
    }
}

/**
 * Pulisce la connessione e l'interfaccia utente quando un utente lascia.
 */
function removePeer(socketId, isExternalEvent = true) {
    // 1. Chiude la connessione P2P
    const pc = peerConnections[socketId];
    if (pc && isExternalEvent) {
        pc.close();
    }
    delete peerConnections[socketId];
    delete remoteNicknames[socketId];

    // 2. Rimuovi gli elementi dal DOM
    remoteVideosContainer.querySelector(`.remote-feed[data-peer-id=\"${socketId}\"]`)?.remove();
    document.getElementById(`list-${socketId}`)?.remove();

    // 3. LOGICA PER IL FOCUS: se il peer che ha lasciato era in focus, sposta il focus
    if (focusedPeerId === socketId) {
        const remainingPeerIds = Object.keys(peerConnections);
        if (remainingPeerIds.length > 0) {
            setMainVideo(remainingPeerIds[0]);
        } else {
            setMainVideo('local');
        }
    }

    // 4. Aggiorna contatore e placeholder
    updateParticipantCount();
    if (Object.keys(peerConnections).length === 0) {
        remoteVideoPlaceholder.classList.remove('hidden');
    }
}

// ==============================================================================
// INIZIALIZZAZIONE
// ==============================================================================

// Listener per il pulsante 'Entra'
joinButton.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    const roomId = roomIdInput.value.trim();

    if (roomId.length === 0) {
        alert('Il nome della stanza non può essere vuoto.');
        return;
    }
    if (nickname.length === 0) {
        alert('Il nickname non può essere vuoto.');
        return;
    }
    
    // Nasconde l'overlay e avvia la conferenza
    joinRoom(roomId, nickname);
});