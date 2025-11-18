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
const shareRoomLinkInput = document.getElementById('share-room-link'); 

// Pannelli e pulsanti mobile
const participantsPanel = document.getElementById('participants-panel'); 
const chatPanel = document.getElementById('chat-panel'); 
const showParticipantsBtn = document.getElementById('show-participants-btn'); 
const showChatBtn = document.getElementById('show-chat-btn'); 

// Nuovi elementi Chat AGGIUNTI
const chatMessageInput = document.getElementById('chat-message-input');
const sendChatButton = document.getElementById('send-chat-button');
const messagesContainer = document.getElementById('messages-container');


mainMuteBtn.addEventListener("click", () => {
    const videoEl = mainVideoFeed.querySelector("video");
    videoEl.muted = !videoEl.muted;
    mainMuteBtn.textContent = videoEl.muted ? "🔇" : "🔊";
});


// --- VARIABILI DI STATO ---
let socket = null;
let localStream = null;
let userNickname = 'Ospite';
let currentRoomId = null; 
const peerConnections = {}; 
const remoteNicknames = {}; 
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
 * Aggiorna il contatore dei partecipanti.
 */
function updateParticipantCount() {
    if (participantCountSpan) {
        // La lista include l'utente locale (1) + il numero di peer
        participantCountSpan.textContent = 1 + Object.keys(remoteNicknames).length;
    }
}

/**
 * Aggiorna la lista dei partecipanti nel pannello laterale.
 */
function updateParticipantList(id, nickname, isLocal = false) {
    let li = document.getElementById(`list-${id}`);
    const liTemplate = document.getElementById('participant-item-template');

    if (!li && liTemplate) {
        // Se l'elemento NON esiste, lo creiamo dal template
        li = liTemplate.content.cloneNode(true).firstElementChild;
        li.id = `list-${id}`;
        li.dataset.peerId = id; 
        
        const nameEl = li.querySelector('.participant-name');
        if (nameEl) {
             nameEl.textContent = isLocal ? `${nickname} (Tu)` : nickname;
        }

        participantsList.appendChild(li);

        // Listener per mettere il video in focus cliccando sulla lista
        li.addEventListener('click', () => {
             setMainVideo(id); 
        });
    }
    
    // Aggiorna il testo
    if (li) {
        const nameEl = li.querySelector('.participant-name');
        if (nameEl) {
             nameEl.textContent = isLocal ? `${nickname} (Tu)` : nickname;
        }

        // Rimuove e ri-aggiunge la classe di focus
        document.querySelectorAll('#participants-list li').forEach(el => el.classList.remove('participant-focused'));
        if (id === focusedPeerId) {
             li.classList.add('participant-focused');
        }
    }

    updateParticipantCount(); 
}

// ==============================================================================
// GESTIONE FOCUS VIDEO
// ==============================================================================

/**
 * Sposta lo stream del peer specificato nel mainVideoFeed.
 */
function setMainVideo(peerId) {
    let stream, nickname, isLocal = false;

    // 1. Determina stream e nickname
    if (peerId === 'local') {
        stream = localStream;
        nickname = userNickname + " (Tu)";
        isLocal = true;
    } else {
        // Se è un peer remoto, cerchiamo la sua miniatura per prendere lo stream
        const remoteVideoElement = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${peerId}"]`);
        
        if (!remoteVideoElement || !remoteVideoElement.querySelector('video').srcObject) {
            console.warn(`Stream non pronto o elemento non trovato per ID: ${peerId}. Torno a locale.`);
            // Se lo stream remoto non è ancora arrivato, manteniamo il focus attuale o torniamo al locale
            if (focusedPeerId === 'local') return; 
            
            setMainVideo('local');
            return;
        }
        
        stream = remoteVideoElement.querySelector('video').srcObject;
        nickname = remoteNicknames[peerId];
    }
    
    // 2. Aggiorna il video principale
    const videoEl = mainVideoFeed.querySelector('video'); // RICERCA AFFIDABILE
    const labelEl = mainVideoFeed.querySelector('.video-label'); // RICERCA AFFIDABILE

    // Non ricreare l'HTML, assumi che esista da index.html
    if (!videoEl || !labelEl) {
        console.error("Elementi video o label non trovati in #main-video-feed.");
        return; 
    }

	if (stream) {
		videoEl.srcObject = stream;
		videoEl.muted = isLocal; // muta solo se è il video locale
		labelEl.textContent = nickname;

		// aggiorna lo stato del pulsante mute per remoti
		const muteBtn = document.getElementById("main-mute-btn");

		if (isLocal) {
			muteBtn.style.display = "none";      // non mostrare mute per te stesso
		} else {
			muteBtn.style.display = "block";     // mostra mute per remoto
			muteBtn.textContent = videoEl.muted ? "🔇" : "🔊";
		}
	}

    focusedPeerId = peerId;

    // 3. Reimposta il focus visivo: lista partecipanti e miniature
    updateParticipantList(peerId, isLocal ? userNickname : remoteNicknames[peerId], isLocal); 

    document.querySelectorAll('.remote-feed').forEach(el => el.classList.remove('is-focused'));
    const focusedFeed = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${peerId}"]`);
    if (focusedFeed) focusedFeed.classList.add('is-focused');
}


// ==============================================================================
// GESTIONE INGRESSO UTENTE E MEDIA
// ==============================================================================

joinButton.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    const roomId = roomIdInput.value.trim(); 
    
    if (nickname && roomId) {
        userNickname = nickname;
        currentRoomId = roomId; 
        roomNameDisplay.textContent = currentRoomId; 
        
        startLocalMedia()
            .then(() => {
                nicknameOverlay.classList.add('hidden');
                conferenceContainer.classList.remove('hidden');
                
                // 🚀 MODIFICA PER MOBILE: Assicurati che i pannelli siano nascosti all'inizio
                // Quando si entra nella stanza su mobile, i pannelli laterali devono essere nascosti.
                if (window.matchMedia("(max-width: 900px)").matches) {
                    participantsPanel.classList.add('hidden');
                    chatPanel.classList.add('hidden');
                }
                
                initializeSocket();
                setupRoomLink(); 
            })
            .catch(error => {
                console.error("Non è stato possibile avviare la webcam:", error.name, error);
                alert(`Impossibile avviare la webcam. Controlla i permessi. Errore: ${error.name}`);
            });
    } else {
        alert('Per favore, inserisci un nickname e il nome della stanza.');
    }
});

/**
 * Avvia la webcam e il microfono e mostra lo stream locale.
 */
async function startLocalMedia() {
    const constraints = {
        audio: true,
        video: true
    };

    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Prima di tutto, crea la miniatura locale e imposta il focus
        createLocalVideoElement(); 
        setMainVideo('local'); 

        return localStream;
    } catch (error) {
        throw error;
    }
}

/**
 * Gestisce la visualizzazione e la copia del link della stanza.
 */
function setupRoomLink() {
    // L'URL sarà: https://tuodominio.com/?room=NomeStanza
    const roomUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(currentRoomId)}`;
    shareRoomLinkInput.value = roomUrl;

    // Aggiungi listener per la copia
    shareRoomLinkInput.addEventListener('click', () => {
        shareRoomLinkInput.select();
        document.execCommand('copy');
        
        alert('Link della stanza copiato negli appunti!');
    });
}


// ==============================================================================
// GESTIONE CHAT (NUOVE FUNZIONI AGGIUNTE)
// ==============================================================================

/**
 * Aggiunge un messaggio alla chat.
 */
function appendMessage(nickname, message, isLocal = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    if (isLocal) {
        messageDiv.classList.add('self');
    }

    const senderSpan = document.createElement('span');
    senderSpan.classList.add('sender');
    senderSpan.textContent = isLocal ? 'Tu' : nickname;
    
    // Aggiunge la data/ora
    const timeSpan = document.createElement('span');
    timeSpan.classList.add('timestamp');
    timeSpan.textContent = ` (${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })})`;

    messageDiv.appendChild(senderSpan);
    messageDiv.appendChild(timeSpan);
    
    // Sanifica il messaggio base (semplice)
    const textNode = document.createTextNode(`: ${message}`);
    messageDiv.appendChild(textNode);

    messagesContainer.appendChild(messageDiv);
    
    // Scroll automatico in basso
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Gestisce l'invio del messaggio e l'emissione tramite Socket.
 */
function sendChatMessage() {
    const message = chatMessageInput.value.trim();
    if (message && socket) {
        // 1. Visualizza localmente
        appendMessage(userNickname, message, true);
        
        // 2. Invia agli altri peer (il server aggiungerà il nickname del mittente)
        socket.emit('chat-message', message);
        
        // 3. Pulisci l'input
        chatMessageInput.value = '';
        
        // 4. Ri-focus l'input per continuare a scrivere (utile su desktop)
        chatMessageInput.focus(); 
    }
}


// ==============================================================================
// GESTIONE CONTROLLI MEDIA E MOBILE 
// ==============================================================================

/**
 * Funzione per gestire l'apertura/chiusura dei pannelli mobili.
 */
function toggleMobilePanel(panel, otherPanel) {
    const videoArea = document.getElementById('video-area');

    // 1. PRIMA: Nascondi l'altro pannello e ripristina i suoi stili se necessario
    if (!otherPanel.classList.contains('hidden')) {
        otherPanel.classList.add('hidden');
        // ✅ AGGIUNTA PER RIPRISTINARE LO STILE DEL PANNELLO CHIUSO
        otherPanel.style.position = '';
        otherPanel.style.inset = '';
        otherPanel.style.width = '';
        otherPanel.style.background = '';
        otherPanel.style.zIndex = '';
    }
    
    // 2. Dopo: Inverti lo stato del pannello corrente
    const isNowHidden = panel.classList.toggle('hidden');
    
    
    // Logica di layout solo per mobile (max-width: 900px, come da CSS)
    if (window.matchMedia("(max-width: 900px)").matches) {
        
        // Quando un pannello è aperto (non nascosto)
        if (!isNowHidden) {
            videoArea.style.display = 'none';

            // Forza il pannello aperto a occupare tutto lo spazio (solo su mobile)
             panel.style.position = 'fixed';
             panel.style.inset = '0';
             panel.style.width = '100%';
             panel.style.background = 'var(--background-dark)';
             panel.style.zIndex = '150';
             
             // SOLUZIONE MOBILE: Focus sull'input della chat dopo che il pannello è visibile
             if (panel === chatPanel) {
                 // Aspetta un frame per assicurarsi che il pannello sia visibile nel DOM
                 setTimeout(() => chatMessageInput.focus(), 50); 
             }


        } else {
            // Se entrambi i pannelli sono nascosti, mostra la video-area
            videoArea.style.display = 'flex';
            
            // Ripristina gli stili del pannello chiuso
             panel.style.position = '';
             panel.style.inset = '';
             panel.style.width = '';
             panel.style.background = '';
             panel.style.zIndex = '';
        }
    } else {
        // Logica desktop: i pannelli sono già gestiti dal CSS
        videoArea.style.display = 'grid';
    }
}

// Listener per la chat (AGGIUNTI)
sendChatButton.addEventListener('click', sendChatMessage);

chatMessageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});


// Listener esistenti
showParticipantsBtn.addEventListener('click', () => {
    toggleMobilePanel(participantsPanel, chatPanel);
});

showChatBtn.addEventListener('click', () => {
    toggleMobilePanel(chatPanel, participantsPanel); 
});

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
    // Chiude lo stream, le connessioni e ricarica (soluzione più pulita)
    localStream?.getTracks().forEach(track => track.stop());
    Object.keys(peerConnections).forEach(socketId => {
        if (peerConnections[socketId]) peerConnections[socketId].close();
    });
    if (socket) socket.disconnect();
    window.location.reload(); 
});


// ==============================================================================
// FUNZIONI SOCKET.IO (Segnalazione)
// ==============================================================================

/**
 * Inizializza la connessione con il server di segnalazione.
 */
function initializeSocket() {
    socket = io(RENDER_SERVER_URL, {
        query: {
            nickname: userNickname 
        }
    });

    socket.on('connect', () => {
        console.log('Connesso al server di segnalazione.');
        // Unisciti alla stanza, ORA USA currentRoomId
        socket.emit('join-room', currentRoomId, userNickname);
    });

    // 1. Ricevi la lista degli utenti già presenti (il nuovo utente chiama loro)
    socket.on('users-in-room', (userList) => {
        userList.forEach(user => {
            if (user.socketId !== socket.id) {
                remoteNicknames[user.socketId] = user.nickname;
                updateParticipantList(user.socketId, user.nickname);
                callUser(user.socketId, true); // CHIAMANTE (invia Offer)
            }
        });

        // Nasconde il placeholder se ci sono altri peer
        if (userList.length > 0) { 
             remoteVideoPlaceholder?.classList.add('hidden');
        }
        updateParticipantList(socket.id, userNickname, true); // Aggiorna lista locale
    });

    // 2. Ricevi un nuovo utente (loro aspettano la tua Offer)
    socket.on('user-joined', (newSocketId, newNickname) => {
        console.log(`Nuovo utente ${newNickname} unito: ${newSocketId}`);
        remoteNicknames[newSocketId] = newNickname;
        updateParticipantList(newSocketId, newNickname);
        callUser(newSocketId, false); // RICEVENTE (crea PC e attende l'Offer)
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
    
    // NUOVO: Ricezione messaggi di chat
    // Il server dovrebbe inviare: ID del mittente, Nickname del mittente, Messaggio
    socket.on('chat-message', (senderId, nickname, message) => {
        appendMessage(nickname, message, false);
    });

    socket.on('user-left', (leavingSocketId) => {
        removePeer(leavingSocketId, true);
    });

    socket.on('disconnect', () => {
        console.log('Disconnesso dal server.');
    });
}


// ==============================================================================
// FUNZIONI WEBRTC
// ==============================================================================

/**
 * Crea o recupera la RTCPeerConnection per un peer specifico.
 */
function getOrCreatePeerConnection(socketId) {
    if (peerConnections[socketId]) {
        return peerConnections[socketId];
    }

    const pc = new RTCPeerConnection(iceConfiguration);
    
    // Aggiunge i track locali
    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }

    // GESTIONE DELLA RICEZIONE DEL VIDEO REMOTO (ONTRAK)
    pc.ontrack = (event) => {
        console.log(`Ricevuto stream da ${socketId}`);

        // Aggiunge la miniatura remota (o aggiorna lo stream se già esistente)
        createRemoteVideoElement(socketId, event.streams[0]);
    };

    // GESTIONE DELLO SCAMBIO DEI CANDIDATI ICE
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', socketId, event.candidate);
        }
    };

    peerConnections[socketId] = pc;
    return pc;
}

/**
 * Funzione helper per creare la miniatura locale nel DOM.
 */
function createLocalVideoElement() {
    // 1. Controlla se la miniatura locale esiste già per evitare duplicati
    if (remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="local"]`)) return;

    const template = document.getElementById('remote-video-template');
    if (!template) return;
    
    const localFeed = template.content.cloneNode(true).firstElementChild;
    const remoteVideo = localFeed.querySelector('video');
    const videoLabel = localFeed.querySelector('.video-label');

    localFeed.dataset.peerId = 'local';
    localFeed.classList.add('local-feed'); // Classe per distinguere il locale
    remoteVideo.srcObject = localStream;
    remoteVideo.muted = true; // Locale sempre muto
    videoLabel.textContent = userNickname;

    // Listener per mettere il video in focus cliccando sulla miniatura
    localFeed.addEventListener('click', () => {
        setMainVideo('local');
    });

    remoteVideosContainer.prepend(localFeed); // Metti il tuo video in cima alla galleria
}

/**
 * Funzione helper per creare l'elemento video remoto nel DOM (Miniatura).
 */
function createRemoteVideoElement(socketId, stream) {
    let remoteVideoItem = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"]`);
    const template = document.getElementById('remote-video-template');
    if (!template) return;

    if (!remoteVideoItem) {
        remoteVideoItem = template.content.cloneNode(true).firstElementChild;
        remoteVideoItem.dataset.peerId = socketId;
        
        const videoLabel = remoteVideoItem.querySelector('.video-label');
        videoLabel.textContent = remoteNicknames[socketId] || `Peer ${socketId.substring(0, 4)}...`;

        // Listener per mettere il video in focus cliccando sulla miniatura
        remoteVideoItem.addEventListener('click', () => {
            setMainVideo(socketId);
        });
        remoteVideosContainer.appendChild(remoteVideoItem);
    }
    
    // Aggiorna lo stream
    const remoteVideo = remoteVideoItem.querySelector('video');
    if (remoteVideo && !remoteVideo.srcObject) {
        remoteVideo.srcObject = stream;
    }
    
    // LOGICA FOCUS: Se è il primo remoto, mettilo subito in focus
    if (Object.keys(peerConnections).length === 1 && focusedPeerId === 'local') {
        setMainVideo(socketId);
    }
}

/**
 * Invia la chiamata (Offer SDP) o prepara la connessione (se non è chiamante).
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
            console.log(`Inviata OFFER a ${socketId}`);
        } catch (error) {
            console.error('Errore nella creazione dell\'Offer:', error);
        }
    }
    // Se isCaller è false, il PC è stato creato e i track sono stati aggiunti. Ora attende l'Offer.
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
        console.log(`Inviata ANSWER a ${socketId}`);
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
        console.log(`Connessione WebRTC SDP completata con ${socketId}`);
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
    remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"]`)?.remove();
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

    // 4. Aggiorna il contatore e il placeholder remoto
    updateParticipantCount();
    if (Object.keys(peerConnections).length === 0) {
        remoteVideoPlaceholder?.classList.remove('hidden');
    }

    console.log(`Utente ${socketId} rimosso.`);
}