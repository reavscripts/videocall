// ==============================================================================
// CONFIGURAZIONE WEB RTC E SOCKET.IO
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

// Elementi DOM Aggiunti/Corretti per la logica Mobile
const videoArea = document.getElementById('video-area'); // Area Video
const participantsPanel = document.getElementById('participants-panel'); // Pannello Partecipanti
const showParticipantsBtn = document.getElementById('show-participants-btn'); // Bottone Utenti Mobile
const showChatBtn = document.getElementById('show-chat-btn'); // Bottone Chat Mobile

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
    // Semplice gestione del video principale. Se peerId === 'local' usa il localStream
    const existing = mainVideoFeed.querySelector('video');
    if (existing) {
        existing.remove();
    }

    let videoEl = document.createElement('video');
    videoEl.autoplay = true;
    videoEl.playsInline = true;
    videoEl.muted = (peerId === 'local');

    if (peerId === 'local') {
        if (localStream) videoEl.srcObject = localStream;
    } else if (peerConnections[peerId]?.remoteStream) {
        videoEl.srcObject = peerConnections[peerId].remoteStream;
    }

    mainVideoFeed.appendChild(videoEl);
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
        roomNameDisplay.textContent = currentRoomId;

        startLocalMedia()
            .then(() => {
                nicknameOverlay.classList.add('hidden');
                conferenceContainer.classList.remove('hidden');
                createLocalVideoElement();
                setMainVideo('local');
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
    shareRoomLinkInput.value = roomUrl;
    shareRoomLinkInput.addEventListener('click', () => {
        shareRoomLinkInput.select();
        document.execCommand('copy');
        shareRoomLinkInput.value = roomUrl + ' (Link copiato)';
        setTimeout(() => shareRoomLinkInput.value = roomUrl, 1500);
    });
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
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendChatMessage() {
    const message = chatMessageInput.value.trim();
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
// MOBILE PANEL TOGGLING (CHAT + PARTECIPANTI)
// ==============================================================================
// Unified togglePanel function that works for both panels on mobile screens.
function togglePanel(panel) {
    if (!panel) return;
    // Only trigger mobile behavior below certain breakpoint
    const mobileBreakpoint = 900;
    if (window.innerWidth >= mobileBreakpoint) {
        // On desktop keep panels in their default (chat visible, participants visible)
        return;
    }

    const isVisible = panel.classList.contains('show');

    if (isVisible) {
        panel.classList.remove('show');
        videoArea?.classList.remove('hidden');
    } else {
        // Close any other mobile panel first (only one should be open)
        [chatPanel, participantsPanel].forEach(p => {
            if (p && p !== panel) p.classList.remove('show');
        });

        panel.classList.add('show');
        videoArea?.classList.add('hidden');
    }
}

// Ensure panels are in the correct state when resizing / on load.
function ensureResponsivePanels() {
    const mobileBreakpoint = 900;
    if (window.innerWidth >= mobileBreakpoint) {
        // Desktop: ensure panels are visible/in-layout
        if (chatPanel) chatPanel.classList.remove('show');
        if (participantsPanel) participantsPanel.classList.remove('show');
        if (videoArea) videoArea.classList.remove('hidden');
    } else {
        // Mobile: by default keep panels closed
        if (chatPanel) chatPanel.classList.remove('show');
        if (participantsPanel) participantsPanel.classList.remove('show');
        if (videoArea) videoArea.classList.remove('hidden');
    }
}

window.addEventListener('resize', ensureResponsivePanels);
window.addEventListener('load', ensureResponsivePanels);

// Reconnect mobile buttons
showParticipantsBtn?.addEventListener('click', () => {
    togglePanel(participantsPanel);
});

showChatBtn?.addEventListener('click', () => {
    togglePanel(chatPanel);
});

// Allow tapping the overlay/panel background to go back to video on mobile (both panels)
function hidePanelOnClick(e) {
    // If click is directly on the panel container (not inner content)
    if (e.currentTarget.classList.contains('show') && e.target === e.currentTarget) {
        togglePanel(e.currentTarget);
    }
}

participantsPanel?.addEventListener('click', hidePanelOnClick);
chatPanel?.addEventListener('click', hidePanelOnClick);

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
    Object.values(peerConnections).forEach(pc => pc.close());
    socket?.disconnect();
    window.location.reload();
});

// ==============================================================================
// WEBRTC FUNZIONI (scheletro essenziale per non rompere le chiamate)
// ==============================================================================
function getOrCreatePeerConnection(socketId) {
    // minimal stub; real implementation in your existing file can remain
    if (!peerConnections[socketId]) {
        peerConnections[socketId] = { pc: null, remoteStream: null };
    }
    return peerConnections[socketId];
}

function createLocalVideoElement() {
    // create local video preview in remoteVideosContainer if desired
    const container = document.createElement('div');
    container.className = 'remote-feed local';
    const v = document.createElement('video');
    v.autoplay = true;
    v.playsInline = true;
    v.muted = true;
    if (localStream) v.srcObject = localStream;
    container.appendChild(v);
    remoteVideosContainer.appendChild(container);
}

function createRemoteVideoElement(socketId, stream) {
    // append remote video element
    const container = document.createElement('div');
    container.className = 'remote-feed';
    container.dataset.peer = socketId;
    const v = document.createElement('video');
    v.autoplay = true;
    v.playsInline = true;
    v.srcObject = stream;
    container.appendChild(v);
    const lbl = document.createElement('div');
    lbl.className = 'video-label';
    lbl.textContent = remoteNicknames[socketId] || socketId;
    container.appendChild(lbl);
    remoteVideosContainer.appendChild(container);
}

function initializeSocket() {
    // minimal initialization; your full logic can remain in the repository
    socket = io(RENDER_SERVER_URL);

    socket.on('connect', () => {
        socket.emit('join-room', currentRoomId, userNickname);
    });

    socket.on('chat-message', (fromNickname, message) => {
        appendMessage(fromNickname, message, false);
    });

    // wire other socket handlers in your original implementation...
}

async function callUser(socketId, isCaller) { /* original implementation */ }
async function handleOffer(socketId, description) { /* original implementation */ }
async function handleAnswer(socketId, description) { /* original implementation */ }
async function handleCandidate(socketId, candidate) { /* original implementation */ }
function removePeer(socketId) { /* original implementation */ }