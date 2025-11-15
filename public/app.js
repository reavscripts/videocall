// CONFIGURAZIONE GLOBALE
const RENDER_SERVER_URL = "https://videocall-webrtc-signaling-server.onrender.com"; 

// VARIABILI GLOBALI
let localStream = null;
let socket = null;
let peerConnections = {}; // Mappa: { socketId: RTCPeerConnection }
let currentRoomId = null;
let currentNickname = null;
let currentFocusId = null; // ID del socket o 'local' attualmente in focus

// Riferimenti DOM
const conferenceContainer = document.getElementById('conference-container');
const nicknameOverlay = document.getElementById('nickname-overlay');
const mainVideoFeed = document.getElementById('main-video-feed');
const remoteVideosContainer = document.getElementById('remote-videos-container');
const participantsList = document.getElementById('participants-list');
const joinForm = document.getElementById('join-form');
const nicknameInput = document.getElementById('nickname-input');
const roomInput = document.getElementById('room-input');
const muteButton = document.getElementById('mute-button');
const videoButton = document.getElementById('video-button');
const disconnectButton = document.getElementById('disconnect-button');
const roomIdDisplay = document.getElementById('room-id-display');

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
    ]
};

// Mappa per associare ID socket a nickname
const userNicknames = {}; 


// --- FUNZIONI UTILITY ---

/** Mostra un messaggio all'utente */
function displayMessage(message, type = 'info') {
    console.warn(message);
    // Implementazione di un semplice div di notifica, NON alert()
    const notificationDiv = document.createElement('div');
    notificationDiv.textContent = message;
    notificationDiv.className = `fixed top-4 right-4 p-3 rounded-lg shadow-xl z-50 ${type === 'error' ? 'bg-red-500' : 'bg-yellow-500'} text-white`;
    document.body.appendChild(notificationDiv);
    
    setTimeout(() => {
        notificationDiv.remove();
    }, 5000);
}

/**
 * Crea e gestisce la visualizzazione di un video nel DOM.
 * @param {string} id ID del socket o 'local'
 * @param {string} nickname Nome utente
 * @param {MediaStream} stream Stream video da assegnare
 * @param {boolean} isLocal Indica se è lo stream locale
 */
function addVideoElement(id, nickname, stream, isLocal = false) {
    // 1. Aggiungi il nickname alla mappa
    userNicknames[id] = nickname;
    
    const containerId = `video-container-${id}`;
    
    // Controlla se il container esiste già per evitare duplicati
    let container = document.getElementById(containerId);
    if (container) return; 

    // 2. Crea l'elemento video container (Remote Video Item)
    container = document.createElement('div');
    container.id = containerId;
    container.className = 'remote-video-item'; 

    // Elemento video
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = isLocal; // Muta lo stream locale
    video.srcObject = stream;
    
    // Etichetta Nickname
    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = isLocal ? `${nickname} (Tu)` : nickname;

    container.appendChild(video);
    container.appendChild(label);
    
    // Aggiunge il listener per il click
    container.addEventListener('click', () => {
        setFocus(id);
    });

    // Lo aggiunge alla galleria iniziale
    remoteVideosContainer.appendChild(container);
    
    // 3. Aggiungi alla lista partecipanti (Sidebar)
    addParticipantToList(id, isLocal ? `${nickname} (Tu)` : nickname);

    // Se è il video locale, lo mettiamo subito a fuoco
    if (isLocal) {
        setFocus(id);
    }
}

/**
 * Aggiunge un elemento alla lista dei partecipanti nella sidebar.
 * @param {string} id ID del socket
 * @param {string} nickname Nome utente
 */
function addParticipantToList(id, nickname) {
    let listItem = document.getElementById(`list-item-${id}`);
    if (listItem) return;
    
    listItem = document.createElement('li');
    listItem.id = `list-item-${id}`;
    listItem.textContent = nickname;
    listItem.setAttribute('data-id', id);

    // Aggiunge la funzionalità di focus al click sulla lista
    listItem.addEventListener('click', () => {
        setFocus(id);
    });

    participantsList.appendChild(listItem);
}

/**
 * Rimuove un elemento dalla lista partecipanti.
 * @param {string} id ID del socket da rimuovere
 */
function removeParticipantFromList(id) {
    const listItem = document.getElementById(`list-item-${id}`);
    if (listItem) {
        participantsList.removeChild(listItem);
    }
}

/**
 * Sposta un video selezionato nell'area di focus principale.
 * @param {string} targetId ID del socket o 'local' da mettere a fuoco
 */
function setFocus(targetId) {
    if (currentFocusId === targetId) return; 

    const targetContainerId = `video-container-${targetId}`;
    const targetElement = document.getElementById(targetContainerId);
    
    if (!targetElement) {
        console.error("Elemento video non trovato per l'ID:", targetId);
        return;
    }
    
    // 1. Sposta il video attualmente in focus (se esiste) nella galleria
    if (currentFocusId) {
        const oldFocusContainerId = `video-container-${currentFocusId}`;
        const oldFocusEl = document.getElementById(oldFocusContainerId);
        
        if (oldFocusEl) {
            // Rimuove la classe video-container dal focus-feed
            oldFocusEl.classList.remove('video-container'); 
            
            // Lo rimette nell'area remota
            remoteVideosContainer.appendChild(oldFocusEl);
            oldFocusEl.classList.add('remote-video-item');
            
            // Rimuove highlight dalla lista
            document.getElementById(`list-item-${currentFocusId}`)?.classList.remove('participant-focused');
        }
    }
    
    // Pulisce l'area di focus principale
    mainVideoFeed.innerHTML = ''; 

    // 2. Sposta il nuovo video selezionato nell'area di focus principale
    
    // Rimuove l'elemento dalla sua posizione attuale
    if (targetElement.parentNode) {
         targetElement.parentNode.removeChild(targetElement);
    }

    // Lo aggiunge all'area di focus
    mainVideoFeed.appendChild(targetElement);
    targetElement.classList.remove('remote-video-item');
    targetElement.classList.add('video-container'); // Applica lo stile del feed principale
    
    // 3. Aggiorna lo stato e l'highlight
    currentFocusId = targetId;
    document.getElementById(`list-item-${targetId}`)?.classList.add('participant-focused');
}

/**
 * Rimuove un elemento video dal DOM e la lista.
 * @param {string} id ID del socket da rimuovere
 */
function removeVideoElement(id) {
    const containerId = `video-container-${id}`;
    const container = document.getElementById(containerId);
    
    if (container) {
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
    }
    
    removeParticipantFromList(id);
    delete userNicknames[id];
    
    // Se l'utente che sta lasciando è in focus, resetta il focus
    if (currentFocusId === id) {
        mainVideoFeed.innerHTML = '<div id="main-video-placeholder">Seleziona un partecipante per vederlo qui.</div>';
        currentFocusId = null;
    }
}

/**
 * Avvia l'acquisizione del media locale (webcam/microfono).
 * @returns {Promise<MediaStream>}
 */
async function startLocalMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        
        // Aggiunge subito il proprio video locale al DOM (in focus)
        addVideoElement('local', currentNickname, localStream, true);
        
        console.log('Webcam e microfono avviati con successo.');
        return localStream;
    } catch (error) {
        console.error("Non è stato possibile avviare la webcam:", error);
        displayMessage("Errore: Non è stato possibile avviare la webcam. Controlla i permessi e riprova.", 'error');
        throw error;
    }
}

// --- LOGICA WEBRTC ---

function createPeerConnection(targetSocketId) {
    if (peerConnections[targetSocketId]) return;

    const peer = new RTCPeerConnection(ICE_SERVERS);
    peerConnections[targetSocketId] = peer;
    
    // Aggiunge lo stream locale alla connessione
    localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

    // Gestisce la ricezione dei candidati ICE
    peer.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', targetSocketId, event.candidate);
        }
    };

    // Gestisce la ricezione dei track remoti
    peer.ontrack = (event) => {
        const remoteStream = event.streams[0];
        console.log(`Ricevuto stream remoto da ${targetSocketId}`);
        
        const nickname = userNicknames[targetSocketId] || targetSocketId;

        addVideoElement(targetSocketId, nickname, remoteStream, false);
    };

    peer.onconnectionstatechange = (event) => {
        console.log(`Stato connessione con ${targetSocketId}: ${peer.connectionState}`);
    };
}

async function createOffer(targetSocketId) {
    const peer = peerConnections[targetSocketId];
    if (!peer) return;

    try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit('offer', targetSocketId, peer.localDescription);
    } catch (error) {
        console.error("Errore nella creazione dell'Offer:", error);
    }
}

async function createAnswer(targetSocketId, offer) {
    const peer = peerConnections[targetSocketId];
    if (!peer) return;

    try {
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit('answer', targetSocketId, peer.localDescription);
    } catch (error) {
        console.error("Errore nella creazione dell'Answer:", error);
    }
}


// --- INIZIALIZZAZIONE SOCKET.IO E GESTIONE EVENTI ---

function initializeSocket() {
    console.log("Inizializzazione Socket.IO con URL:", RENDER_SERVER_URL);
    socket = io(RENDER_SERVER_URL);

    socket.on('connect', () => {
        console.log('Connesso al server di segnalazione:', socket.id);
        socket.emit('join-room', currentRoomId, currentNickname);
    });

    socket.on('users-in-room', (existingUsers) => {
        console.log('Utenti esistenti nella stanza:', existingUsers);
        
        existingUsers.forEach(user => {
            // Salva i nickname prima di creare le connessioni
            userNicknames[user.socketId] = user.nickname;
            
            createPeerConnection(user.socketId);
            createOffer(user.socketId);
        });
    });

    socket.on('user-joined', (newSocketId, nickname) => {
        console.log(`Nuovo utente ${nickname} si è unito: ${newSocketId}`);
        userNicknames[newSocketId] = nickname;
        
        // Il nuovo utente invierà l'Offer (chiamante)
        createPeerConnection(newSocketId);
    });

    socket.on('offer', (senderId, offer) => {
        createPeerConnection(senderId); 
        createAnswer(senderId, offer);
    });

    socket.on('answer', (senderId, answer) => {
        const peer = peerConnections[senderId];
        if (peer && peer.signalingState !== 'closed') {
            peer.setRemoteDescription(new RTCSessionDescription(answer));
        }
    });

    socket.on('candidate', (senderId, candidate) => {
        const peer = peerConnections[senderId];
        if (peer && candidate) {
            peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error('Errore nell\'aggiunta del candidato ICE:', e));
        }
    });

    socket.on('user-left', (socketId) => {
        console.log('Utente disconnesso:', socketId);
        
        if (peerConnections[socketId]) {
            peerConnections[socketId].close();
            delete peerConnections[socketId];
        }
        
        removeVideoElement(socketId);
    });
}
        
// --- CONTROLLI MEDIA E GESTIONE UI ---
        
/** Funzione di Mute/Unmute */
muteButton.addEventListener('click', () => {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        const enabled = !audioTrack.enabled;
        audioTrack.enabled = enabled;
        
        // Aggiorna l'icona
        const icon = enabled ? 'mic' : 'mic-off';
        muteButton.innerHTML = `<i data-lucide="${icon}"></i>`;
        
        // Nota: la logica di colore è gestita dal CSS se si usano classi (qui potremmo usare stili in linea)
        // Per semplicità, ci affidiamo all'icona.
        
        lucide.createIcons();
    }
});

/** Funzione Attiva/Disattiva Video */
videoButton.addEventListener('click', () => {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        const enabled = !videoTrack.enabled;
        videoTrack.enabled = enabled;
        
        // Aggiorna l'icona
        const icon = enabled ? 'video' : 'video-off';
        videoButton.innerHTML = `<i data-lucide="${icon}"></i>`;
        lucide.createIcons();

        // Nasconde/mostra l'elemento video per mostrare un placeholder se spento
        const localVideoElement = document.getElementById('video-container-local')?.querySelector('video');
        if (localVideoElement) {
            localVideoElement.style.display = enabled ? 'block' : 'none';
        }
    }
});
        
/** Disconnessione */
disconnectButton.addEventListener('click', () => {
    // Chiudi tutte le connessioni peer
    Object.values(peerConnections).forEach(peer => peer.close());
    peerConnections = {};

    // Interrompi lo stream locale
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    // Disconnetti Socket.IO
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    
    // Pulisci l'interfaccia
    remoteVideosContainer.innerHTML = '';
    participantsList.innerHTML = '';
    mainVideoFeed.innerHTML = '<div id="main-video-placeholder">Seleziona un partecipante per vederlo qui.</div>';
    roomIdDisplay.textContent = 'N/D';
    currentFocusId = null;
    
    // Mostra il form e nascondi i controlli
    nicknameOverlay.classList.remove('hidden');
    conferenceContainer.classList.add('hidden');
});


// --- ENTRY POINT ---

// Gestione del form di unione alla stanza
joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const nickname = nicknameInput.value.trim();
    const roomId = roomInput.value.trim();
    
    if (!nickname || !roomId) {
        displayMessage('Nickname e ID Stanza sono richiesti.', 'error');
        return;
    }

    currentNickname = nickname;
    currentRoomId = roomId;

    // Nascondi il form di join, mostra l'interfaccia della conferenza
    nicknameOverlay.classList.add('hidden');
    conferenceContainer.classList.remove('hidden');
    roomIdDisplay.textContent = currentRoomId;

    // Inizia il processo: 1. Acquisisci media locale, 2. Connettiti a Socket.IO
    startLocalMedia()
        .then(() => {
            initializeSocket();
        })
        .catch(() => {
            // Fallimento nell'avvio media - ripristina l'UI
            nicknameOverlay.classList.remove('hidden');
            conferenceContainer.classList.add('hidden');
        });
});

// Inizializza le icone Lucide all'avvio
window.onload = () => {
     lucide.createIcons();
};