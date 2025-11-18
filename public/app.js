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

// Mobile
const showChatBtn = document.getElementById('show-chat-btn');
const showVideoBtn = document.getElementById('show-video-btn');

// Join overlay
const joinButton = document.getElementById('join-button');
const nicknameInput = document.getElementById('nickname-input');
const roomIdInput = document.getElementById('room-id-input'); 

// ==============================================================================
// VARIABILI DI STATO
// ==============================================================================
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
// FUNZIONI UI
// ==============================================================================
mainMuteBtn.addEventListener("click", () => {
    const videoEl = mainVideoFeed.querySelector("video");
    videoEl.muted = !videoEl.muted;
    mainMuteBtn.textContent = videoEl.muted ? "🔇" : "🔊";
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
joinButton.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    const roomId = roomIdInput.value.trim(); 

    if (nickname && roomId) {
        userNickname = nickname;
        currentRoomId = roomId; 
        shareRoomLinkInput.value = getRoomUrl();

        startLocalMedia()
            .then(() => {
                nicknameOverlay.classList.add('hidden');
                conferenceContainer.classList.remove('hidden');
                if (window.matchMedia("(max-width: 900px)").matches) {
                    chatPanel.classList.add('hidden');
                }
                initializeSocket();
            })
            .catch(error => {
                console.error("Non è stato possibile avviare la webcam:", error.name, error);
                alert(`Impossibile avviare la webcam. Controlla i permessi. Errore: ${error.name}`);
            });
    } else {
        alert('Per favore, inserisci un nickname e il nome della stanza.');
    }
});

// Controlla se URL ha ?room=
window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) roomIdInput.value = room;
});

async function startLocalMedia() {
    const constraints = { audio: true, video: true };
    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        createLocalVideoElement(); 
        setMainVideo('local'); 
        return localStream;
    } catch (error) {
        throw error;
    }
}

// ==============================================================================
// ROOM LINK
// ==============================================================================
function getRoomUrl() {
    return `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(currentRoomId)}`;
}

shareRoomLinkInput.addEventListener('click', () => {
    shareRoomLinkInput.select();
    document.execCommand('copy');
    shareRoomLinkInput.value = getRoomUrl() + ' (Link copiato)';
    setTimeout(() => shareRoomLinkInput.value = getRoomUrl(), 1500);
});

// ==============================================================================
// CHAT
// ==============================================================================
function appendMessage(nickname, message, isLocal = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    if (isLocal) messageDiv.classList.add('self');

    const senderSpan = document.createElement('span');
    senderSpan.classList.add('sender');
    senderSpan.style.color = isLocal ? '#4caf50' : '#ff9800'; // Colori diversi
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

sendChatButton.addEventListener('click', sendChatMessage);
chatMessageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });

// ==============================================================================
// MOBILE CHAT TOGGLE
// ==============================================================================
function toggleMobileChat() {
    const isHidden = chatPanel.classList.contains('hidden');

    if (isHidden) {
        chatPanel.classList.remove('hidden');
        chatPanel.style.display = 'flex';
        chatPanel.style.position = 'fixed';
        chatPanel.style.inset = '0';
        chatPanel.style.width = '100%';
        chatPanel.style.height = '100%';
        chatPanel.style.background = 'var(--background-dark)';
        chatPanel.style.flexDirection = 'column';
        chatPanel.style.zIndex = '200';

        mainVideoFeed.style.display = 'none';
        remoteVideosContainer.style.display = 'none';
        document.getElementById('media-controls').style.display = 'none';

        showVideoBtn.style.display = 'block';
        setTimeout(() => chatMessageInput.focus(), 50);
    } else {
        chatPanel.classList.add('hidden');
        chatPanel.style.display = '';
        chatPanel.style.position = '';
        chatPanel.style.inset = '';
        chatPanel.style.width = '';
        chatPanel.style.height = '';
        chatPanel.style.background = '';
        chatPanel.style.flexDirection = '';
        chatPanel.style.zIndex = '';

        mainVideoFeed.style.display = '';
        remoteVideosContainer.style.display = '';
        document.getElementById('media-controls').style.display = 'flex';

        showVideoBtn.style.display = 'none';
    }
}

showChatBtn.addEventListener('click', toggleMobileChat);
showVideoBtn.addEventListener('click', toggleMobileChat);

// ==============================================================================
// CONTROLLI AUDIO/VIDEO/DISCONNECT
// ==============================================================================
toggleAudioButton.addEventListener('click', () => {
    const audioTrack = localStream?.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        toggleAudioButton.textContent = audioTrack.enabled ? '🎤' : '🔇';
    }
});

toggleVideoButton.addEventListener('click', () => {
    const videoTrack = localStream?.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        toggleVideoButton.textContent = videoTrack.enabled ? '📹' : '⬛';
    }
});

disconnectButton.addEventListener('click', () => {
    localStream?.getTracks().forEach(track => track.stop());
    Object.values(peerConnections).forEach(pc => pc.close());
    socket?.disconnect();
    window.location.reload(); 
});

// ==============================================================================
// WEBRTC E SOCKET.IO
// ==============================================================================
// [Qui rimane tutta la logica WebRTC / Socket.IO come nel tuo codice originale, senza modifiche]
