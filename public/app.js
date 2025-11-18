// ==============================================================================
// public/app.js - versione robusta per garantire visibilità chat su desktop (FIXED TIMING)
// ==============================================================================
const RENDER_SERVER_URL = "https://videocall-webrtc-signaling-server.onrender.com";

// --- ELEMENTI DOM ---
const remoteVideosContainer = document.getElementById('remote-videos-container');
const nicknameOverlay = document.getElementById('nickname-overlay');
const conferenceContainer = document.getElementById('conference-container');
const mainVideoFeed = document.getElementById('main-video-feed');
const mainMuteBtn = document.getElementById("main-mute-btn");
const toggleAudioButton = document.getElementById('toggle-audio-button');
const toggleVideoButton = document.getElementById('toggle-video-button');
const disconnectButton = document.getElementById('disconnect-button');
const roomNameDisplay = document.getElementById('room-name-display');
const shareRoomLinkInput = document.getElementById('share-room-link');

// Chat
const chatPanel = document.getElementById('chat-panel');
const chatMessageInput = document.getElementById('chat-message-input');
const sendChatButton = document.getElementById('send-chat-button');
const messagesContainer = document.getElementById('messages-container');

// Mobile
const videoArea = document.getElementById('video-area');
const showChatBtn = document.getElementById('show-chat-btn');
const showVideoBtn = document.getElementById('show-video-btn');

// Join overlay
const joinButton = document.getElementById('join-button');
const nicknameInput = document.getElementById('nickname-input');
const roomIdInput = document.getElementById('room-id-input');

// ==============================================================================
// VARIABILI DI STATO
let socket = null;
let localStream = null;
let userNickname = 'Ospite';
let currentRoomId = null;
const peerConnections = {};
const remoteNicknames = {};
let focusedPeerId = 'local';

const iceConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

// ==============================================================================
// UTILITY: Forza la rimozione della classe 'hidden' sul pannello chat
// ==============================================================================
function forceShowChatPanelOnce() {
    if (!chatPanel) return;
    chatPanel.classList.remove('hidden');
    // rimuove eventuale display inline che nasconde
    if (chatPanel.style && chatPanel.style.display === 'none') chatPanel.style.display = '';
}

// Esegui subito e ripeti per i primi istanti per coprire inizializzazioni asincrone
(function ensureChatVisibleImmediately() {
    // immediato
    forceShowChatPanelOnce();
    // ripeti un paio di volte nei successivi 2 secondi (protezione contro script che settano 'hidden' dopo)
    let tries = 0;
    const maxTries = 8;
    const intervalId = setInterval(() => {
        tries++;
        forceShowChatPanelOnce();
        if (tries >= maxTries) clearInterval(intervalId);
    }, 250);
    // anche una rimozione ritardata più lunga (ultimo tentativo)
    setTimeout(() => forceShowChatPanelOnce(), 2500);
})();

// MutationObserver: se qualche script ri-aggiunge 'hidden', lo rimuoviamo immediatamente
if (chatPanel && typeof MutationObserver !== 'undefined') {
    try {
        const mo = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'attributes' && m.attributeName === 'class') {
                    if (chatPanel.classList.contains('hidden')) {
                        chatPanel.classList.remove('hidden');
                    }
                }
            }
        });
        mo.observe(chatPanel, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {
        console.warn('MutationObserver non disponibile o fallita la registrazione:', e);
    }
}

// ==============================================================================
// FUNZIONI UI E HELPERS
// ==============================================================================
mainMuteBtn?.addEventListener("click", () => {
    const videoEl = mainVideoFeed.querySelector("video");
    if (videoEl) {
        videoEl.muted = !videoEl.muted;
        mainMuteBtn.textContent = videoEl.muted ? "🔇" : "🔊";
    }
});

function setMainVideo(peerId) {
    let stream, nickname, isLocal = false;
    if (peerId === 'local') {
        stream = localStream;
        nickname = userNickname + " (Tu)";
        isLocal = true;
    } else {
        const remoteVideoElement = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${peerId}"]`);
        if (!remoteVideoElement || !remoteVideoElement.querySelector('video').srcObject) {
            if (focusedPeerId === 'local') return;
            setMainVideo('local');
            return;
        }
        stream = remoteVideoElement.querySelector('video').srcObject;
        nickname = remoteNicknames[peerId];
    }

    const videoEl = mainVideoFeed.querySelector('video');
    const labelEl = mainVideoFeed.querySelector('.video-label');
    if (!videoEl || !labelEl) return;

    document.querySelectorAll('.remote-feed.is-focused').forEach(el => el.classList.remove('is-focused'));
    if (peerId !== 'local') {
        remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${peerId}"]`)?.classList.add('is-focused');
    }

    if (stream) {
        videoEl.srcObject = stream;
        videoEl.muted = isLocal;
        labelEl.textContent = nickname;
        mainMuteBtn.style.display = isLocal ? "none" : "block";
        mainMuteBtn.textContent = videoEl.muted ? "🔇" : "🔊";
    }

    focusedPeerId = peerId;
}

// ==============================================================================
// GESTIONE INGRESSO UTENTE
// ==============================================================================
joinButton?.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    const roomId = roomIdInput.value.trim();

    if (nickname && roomId) {
        userNickname = nickname;
        currentRoomId = roomId;
        if (roomNameDisplay) roomNameDisplay.textContent = currentRoomId;

        startLocalMedia()
            .then(() => {
                nicknameOverlay?.classList.add('hidden');
                conferenceContainer?.classList.remove('hidden');
                createLocalVideoElement();
                setMainVideo('local');
                initializeSocket();
                setupRoomLink();
            })
            .catch(error => {
                console.error("Non è stato possibile avviare la webcam:", error?.name ?? error, error);
                alert(`Impossibile avviare la webcam. Controlla i permessi. Errore: ${error?.name ?? error}`);
            });
    } else {
        alert('Per favore, inserisci un nickname e il nome della stanza.');
    }
});

async function startLocalMedia() {
    const constraints = { audio: true, video: true };
    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        return localStream;
    } catch (error) {
        throw error;
    }
}

// ==============================================================================
// ROOM LINK
// ==============================================================================
function setupRoomLink() {
    const roomUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(currentRoomId)}`;
    if (shareRoomLinkInput) {
        shareRoomLinkInput.value = roomUrl;
        shareRoomLinkInput.addEventListener('click', () => {
            shareRoomLinkInput.select();
            document.execCommand('copy');
            shareRoomLinkInput.value = roomUrl + ' (Link copiato)';
            setTimeout(() => shareRoomLinkInput.value = roomUrl, 1500);
        });
    }
}

// ==============================================================================
// CHAT
// ==============================================================================
function appendMessage(nickname, message, isLocal = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    if (isLocal) messageDiv.classList.add('self');

    const senderSpan = document.createElement('span');
    senderSpan.classList.add('sender');
    senderSpan.textContent = isLocal ? 'Tu' : nickname;

    const timeSpan = document.createElement('span');
    timeSpan.classList.add('timestamp');
    timeSpan.textContent = ` (${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })})`;

    messageDiv.appendChild(senderSpan);
    messageDiv.appendChild(timeSpan);
    messageDiv.appendChild(document.createTextNode(`: ${message}`));
    messagesContainer?.appendChild(messageDiv);
    if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendChatMessage() {
    const message = chatMessageInput?.value.trim();
    if (message && socket) {
        appendMessage(userNickname, message, true);
        socket.emit('chat-message', message);
        chatMessageInput.value = '';
        chatMessageInput.focus();
    }
}

sendChatButton?.addEventListener('click', sendChatMessage);
chatMessageInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });

// ==============================================================================
// MOBILE/DESKTOP CHAT (LOGICA UNIFICATA E STATO RESPONSIVO)
// ==============================================================================
function ensureChatResponsiveState() {
    const mobileBreakpoint = 900;
    
    // Forziamo rimozione 'hidden' (la usiamo solo per il toggle)
    if (chatPanel) chatPanel.classList.remove('hidden');

    if (window.innerWidth >= mobileBreakpoint) {
        // Desktop: Chat visibile per default (il CSS lo fa), inizializziamo lo stato a 'aperto'
        if (chatPanel) {
            // Se non ha la classe 'show' (che usiamo come indicatore di stato), la aggiungiamo e assicuriamo 'flex'
            if (!chatPanel.classList.contains('show')) {
                 chatPanel.style.display = 'flex';
                 chatPanel.classList.add('show');
            }
            // Aggiorna il pulsante per lo stato "chiudi"
            if (showChatBtn) showChatBtn.textContent = '❌ Chiudi Chat';
            showChatBtn?.setAttribute('aria-expanded', 'true');
        }
        if (videoArea) videoArea.classList.remove('hidden');
        
    } else {
        // Mobile: default chiuso (aperto solo con .show)
        if (chatPanel) {
            // Su mobile, la classe 'show' è usata per aprirla
            chatPanel.classList.remove('show');
            chatPanel.style.display = ''; // Rimuovi lo style inline per far funzionare le media query
        }
        if (videoArea) videoArea.classList.remove('hidden');
        // Aggiorna il pulsante per lo stato "apri"
        if (showChatBtn) showChatBtn.textContent = '💬 Chat';
        showChatBtn?.setAttribute('aria-expanded', 'false');
    }
}

window.addEventListener('resize', ensureChatResponsiveState);
window.addEventListener('load', ensureChatResponsiveState);
document.addEventListener('DOMContentLoaded', ensureChatResponsiveState);

// Funzione unificata per il toggle della chat su tutte le risoluzioni
function toggleChat() {
    const mobileBreakpoint = 900;
    const isVisible = chatPanel?.classList.contains('show');

    if (isVisible) {
        // NASCONDI CHAT
        chatPanel?.classList.remove('show');
        showChatBtn?.setAttribute('aria-expanded', 'false');
        
        if (window.innerWidth >= mobileBreakpoint) {
            // Desktop: nascondi e cambia testo
            chatPanel.style.display = 'none';
            if (showChatBtn) showChatBtn.textContent = '💬 Mostra Chat';
        } else {
            // Mobile: lascia che il CSS gestisca la chiusura e mostra la video area
            videoArea?.classList.remove('hidden');
            if (showChatBtn) showChatBtn.textContent = '💬 Chat';
        }

    } else {
        // MOSTRA CHAT
        chatPanel?.classList.add('show');
        showChatBtn?.setAttribute('aria-expanded', 'true');
        setTimeout(() => chatMessageInput?.focus(), 50);

        if (window.innerWidth >= mobileBreakpoint) {
            // Desktop: mostra e cambia testo
            chatPanel.style.display = 'flex';
            if (showChatBtn) showChatBtn.textContent = '❌ Chiudi Chat';
        } else {
            // Mobile: nascondi la video area e cambia testo
            videoArea?.classList.add('hidden');
            if (showChatBtn) showChatBtn.textContent = '🎥 Torna a Video';
        }
    }
}
showChatBtn?.addEventListener('click', toggleChat);

function hideChatOnBackdropClick(e) {
    if (chatPanel?.classList.contains('show') && e.target === chatPanel) {
        toggleChat();
    }
}

// Bottone mobile "torna alla webcam" (se presente)
showVideoBtn?.addEventListener('click', () => {
    if (window.innerWidth < 900) {
        chatPanel?.classList.remove('show');
        videoArea?.classList.remove('hidden');
        if (showChatBtn) showChatBtn.textContent = '💬 Chat';
        showChatBtn?.setAttribute('aria-expanded', 'false');
    }
});

// ==============================================================================
// CONTROLLI AUDIO/VIDEO/DISCONNECT
// ==============================================================================
toggleAudioButton?.addEventListener('click', () => {
    const audioTrack = localStream?.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        toggleAudioButton.textContent = audioTrack.enabled ? '🔊' : '🔇';
    }
});

toggleVideoButton?.addEventListener('click', () => {
    const videoTrack = localStream?.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        toggleVideoButton.textContent = videoTrack.enabled ? '📹' : '❌';
    }
});

disconnectButton?.addEventListener('click', () => {
    localStream?.getTracks().forEach(track => track.stop());
    Object.values(peerConnections).forEach(pc => { try { if (pc && pc.close) pc.close(); } catch(e) {} });
    socket?.disconnect();
    window.location.reload();
});

// ==============================================================================
// WEBRTC / SOCKET.IO (mantieni il resto del tuo codice esistente)
// ==============================================================================
function getOrCreatePeerConnection(socketId) {
    if (peerConnections[socketId]) return peerConnections[socketId];
    const pc = new RTCPeerConnection(iceConfiguration);
    if (localStream) localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    pc.ontrack = (event) => createRemoteVideoElement(socketId, event.streams[0]);
    pc.onicecandidate = (event) => { if (event.candidate) socket.emit('candidate', socketId, event.candidate); };
    peerConnections[socketId] = pc;
    return pc;
}

function createLocalVideoElement() {
    if (remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="local"]`)) return;
    const template = document.getElementById('remote-video-template');
    if (!template) return;
    const localFeed = template.content.cloneNode(true).firstElementChild;
    localFeed.dataset.peerId = 'local';
    localFeed.classList.add('local-feed');
    const remoteVideo = localFeed.querySelector('video');
    remoteVideo.srcObject = localStream;
    remoteVideo.muted = true;
    localFeed.querySelector('.video-label').textContent = userNickname;
    localFeed.addEventListener('click', () => setMainVideo('local'));
    remoteVideosContainer.prepend(localFeed);
}

function createRemoteVideoElement(socketId, stream) {
    let remoteVideoItem = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"]`);
    const template = document.getElementById('remote-video-template');
    if (!template) return;

    if (!remoteVideoItem) {
        remoteVideoItem = template.content.cloneNode(true).firstElementChild;
        remoteVideoItem.dataset.peerId = socketId;
        remoteVideoItem.querySelector('.video-label').textContent = remoteNicknames[socketId] || `Peer ${socketId.substring(0, 4)}...`;
        remoteVideoItem.addEventListener('click', () => setMainVideo(socketId));
        remoteVideosContainer.appendChild(remoteVideoItem);
    }

    const remoteVideo = remoteVideoItem.querySelector('video');
    if (remoteVideo && !remoteVideo.srcObject) remoteVideo.srcObject = stream;
    if (Object.keys(peerConnections).length === 1 && focusedPeerId === 'local') setMainVideo(socketId);
}

function initializeSocket() {
    socket = io(RENDER_SERVER_URL, { query: { nickname: userNickname } });

    socket.on('connect', () => {
        console.log('Connesso al server di segnalazione.');
        socket.emit('join-room', currentRoomId, userNickname);
    });

    socket.on('users-in-room', (userList) => {
        userList.forEach(user => {
            if (user.socketId !== socket.id) {
                remoteNicknames[user.socketId] = user.nickname;
                callUser(user.socketId, true);
            }
        });
    });

    socket.on('user-joined', (newSocketId, newNickname) => {
        remoteNicknames[newSocketId] = newNickname;
        callUser(newSocketId, false);
    });

    socket.on('chat-message', (senderId, nickname, message) => appendMessage(nickname, message, false));

    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('candidate', handleCandidate);
    socket.on('user-left', removePeer);
    socket.on('disconnect', () => console.log('Disconnesso dal server.'));
}

async function callUser(socketId, isCaller) {
    const pc = getOrCreatePeerConnection(socketId);
    if (isCaller) {
        try {
            const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
            await pc.setLocalDescription(offer);
            socket.emit('offer', socketId, pc.localDescription);
        } catch (error) { console.error('Errore nella creazione dell\'Offer:', error); }
    }
}

async function handleOffer(socketId, description) {
    const pc = getOrCreatePeerConnection(socketId);
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(description));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', socketId, pc.localDescription);
    } catch (error) { console.error('Errore nella gestione dell\'Offer:', error); }
}

async function handleAnswer(socketId, description) {
    const pc = getOrCreatePeerConnection(socketId);
    try { await pc.setRemoteDescription(new RTCSessionDescription(description)); }
    catch (error) { console.error('Errore nella gestione dell\'Answer:', error); }
}

async function handleCandidate(socketId, candidate) {
    try {
        const pc = peerConnections[socketId];
        if (pc && pc.remoteDescription && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {}
}

function removePeer(socketId) {
    const pc = peerConnections[socketId];
    if (pc) {
        try { pc.close(); } catch (e) {}
    }
    delete peerConnections[socketId];
    delete remoteNicknames[socketId];
    remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"]`)?.remove();

    if (focusedPeerId === socketId) {
        const remainingPeerIds = Object.keys(peerConnections);
        setMainVideo(remainingPeerIds.length > 0 ? remainingPeerIds[0] : 'local');
    }
}

// ==============================================================================
// INIZIALIZZAZIONE FINALE - **FIXED TIMING**
// ==============================================================================

// Rimuovi le chiamate dirette alla fine del file per prevenire l'esecuzione troppo anticipata
// forceShowChatPanelOnce();
// ensureChatResponsiveState();

// Esegui la logica di visibilità solo dopo che tutti gli elementi DOM sono caricati.
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded: Assicurazione finale visibilità chat.');
    forceShowChatPanelOnce();
    ensureChatResponsiveState();
});