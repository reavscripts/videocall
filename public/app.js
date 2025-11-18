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
const shareRoomLinkInput = document.getElementById('share-room-link'); 
const chatPanel = document.getElementById('chat-panel');
const chatMessageInput = document.getElementById('chat-message-input');
const sendChatButton = document.getElementById('send-chat-button');
const messagesContainer = document.getElementById('messages-container');
const showChatBtn = document.getElementById('show-chat-btn');
const joinButton = document.getElementById('join-button');
const nicknameInput = document.getElementById('nickname-input');
const roomIdInput = document.getElementById('room-id-input'); 
const mediaControls = document.getElementById('media-controls');

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
// UTILITY
// ==============================================================================
function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    let color = '#';
    for (let i = 0; i < 3; i++) color += ('00' + ((hash >> (i * 8)) & 0xFF).toString(16)).slice(-2);
    return color;
}

// ==============================================================================
// INIZIALIZZAZIONE STANZA DA URL
// ==============================================================================
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        roomIdInput.value = roomParam;
        currentRoomId = roomParam;
        shareRoomLinkInput.value = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(currentRoomId)}`;
    }
});

// ==============================================================================
// ROOM LINK
// ==============================================================================
function setupRoomLink() {
    const roomUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(currentRoomId)}`;
    shareRoomLinkInput.value = roomUrl;
    shareRoomLinkInput.addEventListener('click', () => {
        shareRoomLinkInput.select();
        navigator.clipboard.writeText(roomUrl).then(() => {
            const original = shareRoomLinkInput.value;
            shareRoomLinkInput.value = original + ' (Link copiato)';
            setTimeout(() => shareRoomLinkInput.value = original, 1500);
        });
    });
}

// ==============================================================================
// CHAT
// ==============================================================================
function appendMessage(nickname, message, isLocal = false) {
    const div = document.createElement('div');
    div.classList.add('message');
    if (isLocal) div.classList.add('self');

    const sender = document.createElement('span');
    sender.classList.add('sender');
    sender.textContent = isLocal ? 'Tu' : nickname;
    sender.style.color = stringToColor(nickname);

    const timestamp = document.createElement('span');
    timestamp.classList.add('timestamp');
    timestamp.textContent = ` (${new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})})`;

    div.appendChild(sender);
    div.appendChild(timestamp);
    div.appendChild(document.createTextNode(`: ${message}`));
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendChatMessage() {
    const msg = chatMessageInput.value.trim();
    if (msg && socket) {
        appendMessage(userNickname, msg, true);
        socket.emit('chat-message', msg);
        chatMessageInput.value = '';
        chatMessageInput.focus();
    }
}

sendChatButton.addEventListener('click', sendChatMessage);
chatMessageInput.addEventListener('keypress', e => { if (e.key === 'Enter') sendChatMessage(); });

// ==============================================================================
// MOBILE CHAT
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
        
        mediaControls.style.display = 'none';
        mainVideoFeed.style.display = 'none';
        remoteVideosContainer.style.display = 'none';

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

        mediaControls.style.display = 'flex';
        mainVideoFeed.style.display = '';
        remoteVideosContainer.style.display = '';
    }
}
showChatBtn.addEventListener('click', toggleMobileChat);

// ==============================================================================
// JOIN STANZA
// ==============================================================================
joinButton.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    const roomId = roomIdInput.value.trim(); 
    if (nickname && roomId) {
        userNickname = nickname;
        currentRoomId = roomId;
        setupRoomLink();

        startLocalMedia()
            .then(() => {
                nicknameOverlay.classList.add('hidden');
                conferenceContainer.classList.remove('hidden');
                if (window.matchMedia("(max-width: 900px)").matches) chatPanel.classList.add('hidden');
                initializeSocket();
            })
            .catch(err => {
                console.error("Errore avvio webcam:", err);
                alert(`Impossibile avviare la webcam: ${err.name}`);
            });
    } else {
        alert('Inserisci nickname e nome stanza.');
    }
});

// ==============================================================================
// STREAM LOCALE
// ==============================================================================
async function startLocalMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        createLocalVideoElement();
        setMainVideo('local');
        return localStream;
    } catch (err) { throw err; }
}

// ==============================================================================
// SET MAIN VIDEO
// ==============================================================================
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

    videoEl.srcObject = stream;
    videoEl.muted = isLocal;
    labelEl.textContent = nickname;
    mainMuteBtn.style.display = isLocal ? "none" : "block";
    mainMuteBtn.textContent = videoEl.muted ? "🔇" : "🔊";

    focusedPeerId = peerId;
}

mainMuteBtn.addEventListener("click", () => {
    const videoEl = mainVideoFeed.querySelector("video");
    videoEl.muted = !videoEl.muted;
    mainMuteBtn.textContent = videoEl.muted ? "🔇" : "🔊";
});

// ==============================================================================
// CREAZIONE VIDEO ELEMENT
// ==============================================================================
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
// WEBRTC
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

// ==============================================================================
// SOCKET.IO
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
        } catch (error) { console.error('Errore Offer:', error); }
    }
}

async function handleOffer(socketId, description) {
    const pc = getOrCreatePeerConnection(socketId);
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(description));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', socketId, pc.localDescription);
    } catch (error) { console.error('Errore Offer:', error); }
}

async function handleAnswer(socketId, description) {
    const pc = getOrCreatePeerConnection(socketId);
    try { await pc.setRemoteDescription(new RTCSessionDescription(description)); }
    catch (error) { console.error('Errore Answer:', error); }
}

async function handleCandidate(socketId, candidate) {
    try {
        const pc = peerConnections[socketId];
        if (pc && pc.remoteDescription && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {}
}

function removePeer(socketId) {
    const pc = peerConnections[socketId];
    if (pc) pc.close();
    delete peerConnections[socketId];
    delete remoteNicknames[socketId];
    remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"]`)?.remove();

    if (focusedPeerId === socketId) {
        const remainingPeerIds = Object.keys(peerConnections);
        setMainVideo(remainingPeerIds.length > 0 ? remainingPeerIds[0] : 'local');
    }
}
