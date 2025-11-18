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

// CORREZIONE MUTE: Il listener agisce sul video attualmente in #main-video-feed
mainMuteBtn.addEventListener("click", () => {
    const videoEl = mainVideoFeed.querySelector("video");
    videoEl.muted = !videoEl.muted;
    mainMuteBtn.textContent = videoEl.muted ? "🔇" : "🔊"; // Aggiorna l'icona
});

const remoteVideoPlaceholder = document.getElementById('remote-video-placeholder');
const toggleAudioButton = document.getElementById('toggle-audio-button');
const toggleVideoButton = document.getElementById('toggle-video-button');
const disconnectButton = document.getElementById('disconnect-button');

// --- ELEMENTI DOM CHAT/PANEL --- 
const chatPanel = document.getElementById('chat-panel');
const messagesContainer = document.getElementById('messages-container');
const chatMessageInput = document.getElementById('chat-message-input');
const sendChatButton = document.getElementById('send-chat-button');
const showChatBtn = document.getElementById('show-chat-btn'); 
const showParticipantsBtn = document.getElementById('show-participants-btn');
const participantsPanel = document.getElementById('participants-panel'); 


// --- VARIABILI GLOBALI ---
let socket = null;
let localStream = null;
let localNickname = '';
let roomId = '';
let peerConnections = {}; // Mappa: { socketId: RTCPeerConnection }
let remoteNicknames = {}; // Mappa: { socketId: nickname }
let focusedPeerId = 'local'; // 'local' o socketId del peer in primo piano
let audioTrackEnabled = true;
let videoTrackEnabled = true;

// ==============================================================================
// GESTIONE CHAT
// ==============================================================================

/**
 * Funzione per creare e visualizzare un nuovo messaggio nella chat.
 */
function appendMessage(sender, message, isSelf = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    if (isSelf) {
        messageDiv.classList.add('self');
    }
    
    const senderName = isSelf ? "Tu" : sender;
    
    messageDiv.innerHTML = `<span class="sender">${senderName}:</span> ${message}`;
    messagesContainer.appendChild(messageDiv);
    
    // Scorrere in fondo
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Gestisce l'invio del messaggio di chat.
 */
function sendChatMessage() {
    const message = chatMessageInput.value.trim();
    if (message) {
        // Invia il messaggio al server con il nickname locale
        socket.emit('chatMessage', { nickname: localNickname, message: message });
        
        // Visualizza immediatamente il tuo messaggio
        appendMessage(localNickname, message, true);
        
        // Pulisce l'input
        chatMessageInput.value = '';
    }
}

// Event Listeners per l'invio
if (sendChatButton) sendChatButton.addEventListener('click', sendChatMessage);
if (chatMessageInput) chatMessageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

// ==============================================================================
// LOGICA PULSANTI MOBILE CHAT/PARTECIPANTI
// ==============================================================================

if (showChatBtn) showChatBtn.addEventListener('click', () => {
    // 1. Alterna la visibilità del pannello chat
    if (chatPanel) chatPanel.classList.toggle('hidden');
    // 2. Assicurati che il pannello partecipanti sia nascosto
    if (participantsPanel) participantsPanel.classList.add('hidden'); 
    
    // Scorrere in fondo alla chat quando si apre
    if (chatPanel && messagesContainer && !chatPanel.classList.contains('hidden')) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
});

if (showParticipantsBtn) showParticipantsBtn.addEventListener('click', () => {
    // 1. Alterna la visibilità del pannello partecipanti
    if (participantsPanel) participantsPanel.classList.toggle('hidden');
    // 2. Assicurati che il pannello chat sia nascosto
    if (chatPanel) chatPanel.classList.add('hidden');
});

// ==============================================================================
// GESTIONE UTENTE E STREAM LOCALE
// ==============================================================================

/**
 * Ottiene il flusso locale della videocamera e del microfono.
 */
async function getLocalStream() {
    try {
        // Richiedi sia audio che video
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        // Inizializza il video feed locale
        const localVideo = mainVideoFeed.querySelector('video');
        localVideo.srcObject = localStream;

        // Inizializza lo stato dei controlli
        audioTrackEnabled = localStream.getAudioTracks().length > 0 ? localStream.getAudioTracks()[0].enabled : false;
        videoTrackEnabled = localStream.getVideoTracks().length > 0 ? localStream.getVideoTracks()[0].enabled : false;
        
        toggleAudioButton.textContent = audioTrackEnabled ? '🔊' : '🔇';
        toggleVideoButton.textContent = videoTrackEnabled ? '📹' : '⬛';

        // Dopo aver acquisito lo stream, impostalo come video principale
        setMainVideo('local'); 

    } catch (error) {
        console.error("Errore nell'ottenere il flusso locale:", error);
        alert("Non è stato possibile accedere alla fotocamera o al microfono. Assicurati che i permessi siano concessi.");
    }
}

/**
 * Avvia la chiamata: ottiene lo stream locale e si connette al server di segnalazione.
 */
async function startCall() {
    localNickname = nicknameInput.value.trim();
    roomId = roomIdInput.value.trim(); // Ottieni l'ID della stanza

    if (!localNickname || !roomId) {
        alert("Per favore, inserisci un nickname e un nome per la stanza validi.");
        return;
    }

    await getLocalStream();
    if (!localStream) return;

    // Connetti al server di segnalazione
    socket = io(RENDER_SERVER_URL);

    // Gestione eventi Socket.IO
    socket.on('connect', () => {
        console.log('Connesso al server di segnalazione. Socket ID:', socket.id);

        // Nascondi l'overlay e mostra l'area della conferenza
        nicknameOverlay.classList.add('hidden');
        conferenceContainer.classList.remove('hidden');

        // Aggiorna l'header della stanza
        document.getElementById('room-name-display').textContent = roomId;
        document.getElementById('share-room-link').value = window.location.origin + '?room=' + roomId;

        // Iscriviti alla stanza
        socket.emit('joinRoom', { roomId, nickname: localNickname });
    });

    socket.on('roomUsers', ({ users }) => {
        updateParticipantsList(users);
    });

    socket.on('userJoined', ({ id, nickname }) => {
        console.log(`Utente ${nickname} (${id}) si è unito.`);
        remoteNicknames[id] = nickname;
        createPeerConnection(id, true);
        
        // Rimuovi il placeholder se non è più necessario
        remoteVideoPlaceholder.classList.add('hidden');
    });

    socket.on('offer', async (data) => {
        await handleOffer(data.id, data.offer);
    });

    socket.on('answer', async (data) => {
        await handleAnswer(data.id, data.answer);
    });

    socket.on('candidate', async (data) => {
        await handleCandidate(data.id, data.candidate);
    });

    socket.on('userLeft', ({ id }) => {
        console.log(`Utente ${remoteNicknames[id] || id} ha lasciato.`);
        removePeer(id);
    });

    // Ascolta i messaggi di chat in arrivo
    socket.on('chatMessage', ({ nickname, message }) => {
        appendMessage(nickname, message, false);
    });
}

// ==============================================================================
// GESTIONE MEDIA LOCALI
// ==============================================================================

toggleAudioButton.addEventListener('click', () => {
    if (!localStream) return;
    audioTrackEnabled = !audioTrackEnabled;
    localStream.getAudioTracks().forEach(track => track.enabled = audioTrackEnabled);
    toggleAudioButton.textContent = audioTrackEnabled ? '🔊' : '🔇';
    
    // Invia lo stato aggiornato ai peer remoti
    socket.emit('trackStatus', { type: 'audio', enabled: audioTrackEnabled });
});

toggleVideoButton.addEventListener('click', () => {
    if (!localStream) return;
    videoTrackEnabled = !videoTrackEnabled;
    localStream.getVideoTracks().forEach(track => track.enabled = videoTrackEnabled);
    toggleVideoButton.textContent = videoTrackEnabled ? '📹' : '⬛';

    // Invia lo stato aggiornato ai peer remoti
    socket.emit('trackStatus', { type: 'video', enabled: videoTrackEnabled });
});

disconnectButton.addEventListener('click', () => {
    // Chiude tutte le connessioni P2P
    Object.values(peerConnections).forEach(pc => pc.close());
    peerConnections = {};

    // Chiude lo stream locale
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    // Disconnessione dal server di segnalazione
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    // Pulisce l'interfaccia utente
    window.location.reload(); 
});

// ==============================================================================
// LOGICA WEB RTC
// ==============================================================================

const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

/**
 * Crea una nuova RTCPeerConnection.
 */
function createPeerConnection(socketId, isInitiator) {
    const pc = new RTCPeerConnection(config);
    peerConnections[socketId] = pc;

    // Aggiungi le tracce locali al peer remoto
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    // Gestione dei candidati ICE
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', {
                candidate: event.candidate,
                to: socketId
            });
        }
    };

    // Gestione della ricezione dello stream remoto
    pc.ontrack = (event) => {
        if (remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"]`)) {
            // Se l'elemento esiste già, imposta solo lo stream
            const videoEl = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"] video`);
            if (videoEl) videoEl.srcObject = event.streams[0];
        } else {
            // Altrimenti, crea un nuovo elemento video feed
            addRemoteVideo(socketId, event.streams[0]);
        }
        updateParticipantAudioStatus(socketId, event.streams[0]);
    };

    // Quando la connessione viene stabilita, crea l'offerta
    if (isInitiator) {
        createOffer(socketId, pc);
    }
}

/**
 * Crea e invia un'offerta WebRTC.
 */
async function createOffer(socketId, pc) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit('offer', {
        offer: pc.localDescription,
        to: socketId
    });
}

/**
 * Gestisce l'offerta ricevuta, imposta la descrizione remota e crea la risposta.
 */
async function handleOffer(socketId, offer) {
    const pc = createPeerConnection(socketId, false);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('answer', {
        answer: pc.localDescription,
        to: socketId
    });
}

/**
 * Gestisce la risposta ricevuta (answer).
 */
async function handleAnswer(socketId, answer) {
    const pc = peerConnections[socketId];
    if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
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
            // Metti in focus il primo peer rimasto
            setMainVideo(remainingPeerIds[0]); 
        } else {
            // Torna al video locale
            setMainVideo('local');
        }
    }

    // 4. Se tutti i peer sono stati rimossi, mostra il placeholder
    if (Object.keys(peerConnections).length === 0) {
        remoteVideoPlaceholder.classList.remove('hidden');
    }
}

// ==============================================================================
// GESTIONE INTERFACCIA UTENTE
// ==============================================================================

/**
 * Aggiunge un video feed remoto al DOM.
 */
function addRemoteVideo(socketId, stream) {
    // Rimuove il placeholder se stiamo aggiungendo il primo video remoto
    remoteVideoPlaceholder.classList.add('hidden');
    
    const template = document.getElementById('remote-video-template');
    const remoteFeed = template.content.cloneNode(true).querySelector('.remote-feed');
    remoteFeed.setAttribute('data-peer-id', socketId);
    remoteFeed.id = `remote-feed-${socketId}`;
    
    const videoEl = remoteFeed.querySelector('video');
    videoEl.srcObject = stream;
    videoEl.muted = true; // Inizia sempre con audio muto per l'autoplay

    const labelEl = remoteFeed.querySelector('.video-label');
    labelEl.textContent = remoteNicknames[socketId] || `Utente ${socketId}`;

    remoteFeed.addEventListener('click', () => {
        setMainVideo(socketId);
    });

    remoteVideosContainer.appendChild(remoteFeed);

    // Metti in focus il nuovo video (solo se è il primo remoto)
    if (Object.keys(peerConnections).length === 1 && focusedPeerId === 'local') {
         setMainVideo(socketId);
    }
}

/**
 * Sposta un video feed nella posizione principale.
 */
function setMainVideo(socketId) {
    // Rimuovi la classe di focus da tutti
    document.getElementById('main-video-feed').classList.remove('is-focused');
    const focusedFeeds = document.querySelectorAll('.remote-feed.is-focused');
    focusedFeeds.forEach(feed => feed.classList.remove('is-focused'));


    focusedPeerId = socketId;
    const mainVideoEl = mainVideoFeed.querySelector('video');
    const mainLabelEl = mainVideoFeed.querySelector('.video-label');
    
    // SAFETY CHECK: Se l'elemento video non è trovato, esci
    if (!mainVideoEl) {
        console.error("Main video element not found.");
        return;
    }

    // Gestione video locale
    if (socketId === 'local') {
        // Usa la variabile globale localStream
        if (localStream) {
            mainVideoEl.srcObject = localStream; 
        }
        mainVideoEl.muted = true;
        mainVideoEl.style.objectFit = 'cover';
        mainLabelEl.textContent = "Tu";
        mainMuteBtn.classList.add('hidden'); // Nasconde il pulsante mute su video locale
        document.getElementById('main-video-feed').classList.add('is-focused');
    } 
    // Gestione video remoto
    else {
        const remoteFeed = document.querySelector(`.remote-feed[data-peer-id="${socketId}"]`);
        if (remoteFeed) {
            const remoteVideoEl = remoteFeed.querySelector('video');
            const remoteLabelEl = remoteFeed.querySelector('.video-label');

            mainVideoEl.srcObject = remoteVideoEl.srcObject;
            mainVideoEl.muted = false; // Rimuove il muto quando in focus
            mainVideoEl.style.objectFit = 'contain'; // Adatta video remoto

            mainLabelEl.textContent = remoteLabelEl.textContent;
            mainMuteBtn.classList.remove('hidden'); // Mostra il pulsante mute per video remoto
            mainMuteBtn.textContent = mainVideoEl.muted ? "🔇" : "🔊"; // Aggiorna l'icona
            remoteFeed.classList.add('is-focused');
        }
    }
}


/**
 * Aggiorna la lista dei partecipanti.
 */
function updateParticipantsList(users) {
    participantsList.innerHTML = '';
    
    // Aggiungi l'utente locale
    addParticipantToDOM('local', localNickname, { audio: audioTrackEnabled, video: videoTrackEnabled });

    // Aggiungi gli utenti remoti
    users.forEach(user => {
        if (user.id !== socket.id) {
            remoteNicknames[user.id] = user.nickname;
            addParticipantToDOM(user.id, user.nickname, user.mediaStatus);
        }
    });

    participantCountSpan.textContent = users.length;
}

/**
 * Aggiunge un partecipante alla lista nel DOM.
 */
function addParticipantToDOM(id, nickname, mediaStatus) {
    const template = document.getElementById('participant-item-template');
    const listItem = template.content.cloneNode(true).querySelector('li');
    listItem.id = `list-${id}`;
    
    listItem.querySelector('.participant-name').textContent = nickname;
    const indicator = listItem.querySelector('.status-indicator');
    
    indicator.textContent = (mediaStatus.audio ? '🔊' : '🔇') + (mediaStatus.video ? '📹' : '⬛');
    
    listItem.addEventListener('click', () => {
        if (id !== 'local') {
            setMainVideo(id);
        } else {
            setMainVideo('local');
        }
    });

    participantsList.appendChild(listItem);
}

/**
 * Aggiorna lo stato audio/video di un partecipante remoto nella lista.
 */
function updateParticipantAudioStatus(socketId, remoteStream) {
    const listItem = document.getElementById(`list-${socketId}`);
    if (listItem) {
        const indicator = listItem.querySelector('.status-indicator');
        // Usiamo un controllo più robusto per lo stato delle tracce
        const audioEnabled = remoteStream.getAudioTracks().some(track => track.enabled);
        const videoEnabled = remoteStream.getVideoTracks().some(track => track.enabled);
        indicator.textContent = (audioEnabled ? '🔊' : '🔇') + (videoEnabled ? '📹' : '⬛');
    }
}


// ==============================================================================
// INIZIALIZZAZIONE
// ==============================================================================

joinButton.addEventListener('click', startCall);
nicknameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        startCall();
    }
});
roomIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        startCall();
    }
});

// Gestione dell'ID della stanza dall'URL (se presente)
const urlParams = new URLSearchParams(window.location.search);
const urlRoomId = urlParams.get('room');
if (urlRoomId) {
    roomIdInput.value = urlRoomId;
}
// Rimosso il blocco document.addEventListener('DOMContentLoaded', ...) che causava l'errore