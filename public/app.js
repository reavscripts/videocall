// ==============================================================================
// CONFIGURAZIONE WEB RTC E SOCKET.IO (estratto rilevante)
// ==============================================================================
const RENDER_SERVER_URL = "https://videocall-webrtc-signaling-server.onrender.com";

// --- ELEMENTI DOM ---
const remoteVideosContainer = document.getElementById('remote-videos-container');
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

// Join overlay elements (se presenti nella pagina)
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
// MOBILE CHAT TOGGLE
// ==============================================================================
function toggleChatOnMobile() {
    const mobileBreakpoint = 900;
    if (window.innerWidth >= mobileBreakpoint) {
        // On desktop chat is always visible: do nothing
        return;
    }

    const isVisible = chatPanel.classList.contains('show');
    if (isVisible) {
        chatPanel.classList.remove('show');
        videoArea?.classList.remove('hidden');
        showChatBtn?.setAttribute('aria-expanded', 'false');
    } else {
        chatPanel.classList.add('show');
        videoArea?.classList.add('hidden');
        showChatBtn?.setAttribute('aria-expanded', 'true');
        // move focus to input for accessibility
        setTimeout(() => chatMessageInput?.focus(), 50);
    }
}

showChatBtn?.addEventListener('click', toggleChatOnMobile);

// allow clicking on the chat overlay background (panel container) to close (mobile)
function hideChatOnBackdropClick(e) {
    if (chatPanel.classList.contains('show') && e.target === chatPanel) {
        toggleChatOnMobile();
    }
}
chatPanel?.addEventListener('click', hideChatOnBackdropClick);

// ensure correct state on resize/load
function ensureChatResponsiveState() {
    const mobileBreakpoint = 900;
    if (window.innerWidth >= mobileBreakpoint) {
        chatPanel?.classList.remove('show');
        videoArea?.classList.remove('hidden');
        showChatBtn?.setAttribute('aria-expanded', 'false');
    } else {
        chatPanel?.classList.remove('show');
        videoArea?.classList.remove('hidden');
        showChatBtn?.setAttribute('aria-expanded', 'false');
    }
}
window.addEventListener('resize', ensureChatResponsiveState);
window.addEventListener('load', ensureChatResponsiveState);

// ==============================================================================
// (Resto delle funzioni WebRTC / Socket.IO rimangono invariate — non toccate)
// ==============================================================================
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
                // callUser(user.socketId, true); // lasciare la logica che avevi
            }
        });
    });

    socket.on('user-joined', (newSocketId, newNickname) => {
        remoteNicknames[newSocketId] = newNickname;
        // callUser(newSocketId, false);
    });

    socket.on('chat-message', (senderId, nickname, message) => appendMessage(nickname, message, false));

    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('candidate', handleCandidate);
    socket.on('user-left', removePeer);
    socket.on('disconnect', () => console.log('Disconnesso dal server.'));
}

// Mantieni il resto del tuo file (callUser, handleOffer, handleAnswer, handleCandidate, removePeer) senza modifiche.