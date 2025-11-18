// ==============================================================================
// CONFIGURAZIONE WEB RTC E SOCKET.IO
// ==============================================================================
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
const mainVideoFeed = document.getElementById('main-video-feed');
const mainMuteBtn = document.getElementById("main-mute-btn");
const remoteVideoPlaceholder = document.getElementById('remote-video-placeholder');
const toggleAudioButton = document.getElementById('toggle-audio-button');
const toggleVideoButton = document.getElementById('toggle-video-button');
const disconnectButton = document.getElementById('disconnect-button');
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
let peerConnections = {}; // { socketId: RTCPeerConnection }
let remoteNicknames = {}; // { socketId: nickname }
let remoteStreamStatus = {}; // { socketId: {audio: bool, video: bool} }
let focusedPeerId = 'local';
let audioTrackEnabled = true;
let videoTrackEnabled = true;

// ==============================================================================
// GESTIONE CHAT
// ==============================================================================
function appendMessage(sender, message, isSelf = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    if (isSelf) messageDiv.classList.add('self');
    messageDiv.innerHTML = `<span class="sender">${isSelf ? "Tu" : sender}:</span> ${message}`;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendChatMessage() {
    const message = chatMessageInput.value.trim();
    if (message) {
        socket.emit('chatMessage', { nickname: localNickname, message });
        appendMessage(localNickname, message, true);
        chatMessageInput.value = '';
    }
}

sendChatButton?.addEventListener('click', sendChatMessage);
chatMessageInput?.addEventListener('keypress', e => {
    if (e.key === 'Enter') sendChatMessage();
});

// Toggle pannelli chat/partecipanti (mobile)
showChatBtn?.addEventListener('click', () => {
    chatPanel?.classList.toggle('hidden');
    participantsPanel?.classList.add('hidden');
    if (!chatPanel.classList.contains('hidden')) messagesContainer.scrollTop = messagesContainer.scrollHeight;
});
showParticipantsBtn?.addEventListener('click', () => {
    participantsPanel?.classList.toggle('hidden');
    chatPanel?.classList.add('hidden');
});

// ==============================================================================
// STREAM LOCALE E AVVIO CHIAMATA
// ==============================================================================
async function getLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const localVideo = mainVideoFeed.querySelector('video');
        localVideo.srcObject = localStream;
        audioTrackEnabled = localStream.getAudioTracks()[0]?.enabled ?? false;
        videoTrackEnabled = localStream.getVideoTracks()[0]?.enabled ?? false;
        toggleAudioButton.textContent = audioTrackEnabled ? '🔊' : '🔇';
        toggleVideoButton.textContent = videoTrackEnabled ? '📹' : '⬛';
        setMainVideo('local');
    } catch (err) {
        console.error("Errore nell'accesso a microfono/fotocamera:", err);
        alert("Non è stato possibile accedere alla fotocamera o al microfono.");
    }
}

async function startCall() {
    localNickname = nicknameInput.value.trim();
    roomId = roomIdInput.value.trim();
    if (!localNickname || !roomId) return alert("Inserisci un nickname e ID stanza validi.");

    await getLocalStream();
    if (!localStream) return;

    socket = io(RENDER_SERVER_URL);

    socket.on('connect', () => {
        console.log('Connesso al server di segnalazione:', socket.id);
        nicknameOverlay.classList.add('hidden');
        conferenceContainer.classList.remove('hidden');
        document.getElementById('room-name-display').textContent = roomId;
        document.getElementById('share-room-link').value = window.location.origin + '?room=' + roomId;
        socket.emit('joinRoom', { roomId, nickname: localNickname });
    });

    socket.on('roomUsers', ({ users }) => updateParticipantsList(users));
    socket.on('userJoined', ({ id, nickname }) => {
        remoteNicknames[id] = nickname;
        createPeerConnection(id, true);
        remoteVideoPlaceholder.classList.add('hidden');
    });
    socket.on('offer', async data => await handleOffer(data.id, data.offer));
    socket.on('answer', async data => await handleAnswer(data.id, data.answer));
    socket.on('candidate', async data => await handleCandidate(data.id, data.candidate));
    socket.on('userLeft', ({ id }) => removePeer(id));
    socket.on('chatMessage', ({ nickname, message }) => appendMessage(nickname, message));
}

// ==============================================================================
// GESTIONE MEDIA LOCALI
// ==============================================================================
toggleAudioButton?.addEventListener('click', () => {
    if (!localStream) return;
    audioTrackEnabled = !audioTrackEnabled;
    localStream.getAudioTracks().forEach(t => t.enabled = audioTrackEnabled);
    toggleAudioButton.textContent = audioTrackEnabled ? '🔊' : '🔇';
    socket?.emit('trackStatus', { type: 'audio', enabled: audioTrackEnabled });
});

toggleVideoButton?.addEventListener('click', () => {
    if (!localStream) return;
    videoTrackEnabled = !videoTrackEnabled;
    localStream.getVideoTracks().forEach(t => t.enabled = videoTrackEnabled);
    toggleVideoButton.textContent = videoTrackEnabled ? '📹' : '⬛';
    socket?.emit('trackStatus', { type: 'video', enabled: videoTrackEnabled });
});

disconnectButton?.addEventListener('click', () => {
    Object.values(peerConnections).forEach(pc => pc.close());
    peerConnections = {};
    localStream?.getTracks().forEach(track => track.stop());
    localStream = null;
    socket?.disconnect();
    socket = null;
    window.location.reload();
});

// ==============================================================================
// WEBRTC CORE
// ==============================================================================
const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

function createPeerConnection(socketId, isInitiator) {
    if (peerConnections[socketId]) return peerConnections[socketId]; // già esistente
    const pc = new RTCPeerConnection(config);
    pc.candidateQueue = [];
    peerConnections[socketId] = pc;

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.onicecandidate = e => {
        if (e.candidate) socket.emit('candidate', { candidate: e.candidate, to: socketId });
    };

    pc.ontrack = e => {
        if (remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"]`)) {
            const videoEl = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"] video`);
            if (videoEl) videoEl.srcObject = e.streams[0];
        } else {
            addRemoteVideo(socketId, e.streams[0]);
        }
        updateParticipantAudioStatus(socketId, e.streams[0]);
    };

    if (isInitiator) createOffer(socketId, pc);

    return pc;
}

async function createOffer(socketId, pc) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', { offer: pc.localDescription, to: socketId });
}

async function handleOffer(socketId, offer) {
    const pc = createPeerConnection(socketId, false);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', { answer: pc.localDescription, to: socketId });
    if (pc.candidateQueue.length) {
        pc.candidateQueue.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)));
        pc.candidateQueue = [];
    }
}

async function handleAnswer(socketId, answer) {
    const pc = peerConnections[socketId];
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    if (pc?.candidateQueue.length) {
        pc.candidateQueue.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)));
        pc.candidateQueue = [];
    }
}

async function handleCandidate(socketId, candidate) {
    try {
        const pc = peerConnections[socketId];
        if (!pc) return;
        if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        else pc.candidateQueue.push(candidate);
    } catch {}
}

function removePeer(socketId) {
    peerConnections[socketId]?.close();
    delete peerConnections[socketId];
    delete remoteNicknames[socketId];
    delete remoteStreamStatus[socketId];
    remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"]`)?.remove();
    document.getElementById(`list-${socketId}`)?.remove();
    if (focusedPeerId === socketId) {
        const remaining = Object.keys(peerConnections);
        setMainVideo(remaining[0] || 'local');
    }
    if (!Object.keys(peerConnections).length) remoteVideoPlaceholder.classList.remove('hidden');
}

// ==============================================================================
// INTERFACCIA UTENTE
// ==============================================================================
function addRemoteVideo(socketId, stream) {
    remoteVideoPlaceholder.classList.add('hidden');
    const template = document.getElementById('remote-video-template');
    const remoteFeed = template.content.cloneNode(true).querySelector('.remote-feed');
    remoteFeed.setAttribute('data-peer-id', socketId);
    remoteFeed.id = `remote-feed-${socketId}`;

    const videoEl = remoteFeed.querySelector('video');
    videoEl.srcObject = stream;
    videoEl.muted = true;
    videoEl.onloadedmetadata = () => videoEl.play();

    const labelEl = remoteFeed.querySelector('.video-label');
    labelEl.textContent = remoteNicknames[socketId] || `Utente ${socketId}`;

    remoteFeed.addEventListener('click', () => setMainVideo(socketId));
    remoteVideosContainer.appendChild(remoteFeed);

    if (Object.keys(peerConnections).length === 1 && focusedPeerId === 'local') setMainVideo(socketId);
}

function setMainVideo(socketId) {
    document.getElementById('main-video-feed').classList.remove('is-focused');
    document.querySelectorAll('.remote-feed.is-focused').forEach(f => f.classList.remove('is-focused'));

    focusedPeerId = socketId;
    const mainVideoEl = mainVideoFeed.querySelector('video');
    const mainLabelEl = mainVideoFeed.querySelector('.video-label');
    if (!mainVideoEl) return;

    if (socketId === 'local') {
        mainVideoEl.srcObject = localStream;
        mainVideoEl.muted = true;
        mainVideoEl.style.objectFit = 'cover';
        mainLabelEl.textContent = "Tu";
        mainMuteBtn.classList.add('hidden');
        mainVideoFeed.classList.add('is-focused');
    } else {
        const remoteFeed = document.querySelector(`.remote-feed[data-peer-id="${socketId}"]`);
        if (remoteFeed) {
            const remoteVideoEl = remoteFeed.querySelector('video');
            const remoteLabelEl = remoteFeed.querySelector('.video-label');
            mainVideoEl.srcObject = remoteVideoEl.srcObject;
            mainVideoEl.muted = false;
            mainVideoEl.style.objectFit = 'contain';
            mainLabelEl.textContent = remoteLabelEl.textContent;
            mainMuteBtn.classList.remove('hidden');
            mainMuteBtn.textContent = mainVideoEl.muted ? "🔇" : "🔊";
            remoteFeed.classList.add('is-focused');
        }
    }
}

function updateParticipantsList(users) {
    participantsList.innerHTML = '';
    addParticipantToDOM('local', localNickname, { audio: audioTrackEnabled, video: videoTrackEnabled });
    users.forEach(user => {
        if (user.id !== socket.id) {
            remoteNicknames[user.id] = user.nickname;
            addParticipantToDOM(user.id, user.nickname, user.mediaStatus);
        }
    });
    participantCountSpan.textContent = users.length;
}

function addParticipantToDOM(id, nickname, mediaStatus) {
    const template = document.getElementById('participant-item-template');
    const listItem = template.content.cloneNode(true).querySelector('li');
    listItem.id = `list-${id}`;
    listItem.querySelector('.participant-name').textContent = nickname;
    const indicator = listItem.querySelector('.status-indicator');
    indicator.textContent = (mediaStatus.audio ? '🔊' : '🔇') + (mediaStatus.video ? '📹' : '⬛');
    listItem.addEventListener('click', () => setMainVideo(id));
    participantsList.appendChild(listItem);
}

function updateParticipantAudioStatus(socketId, remoteStream) {
    const audioEnabled = remoteStream.getAudioTracks().some(t => t.enabled);
    const videoEnabled = remoteStream.getVideoTracks().some(t => t.enabled);
    remoteStreamStatus[socketId] = { audio: audioEnabled, video: videoEnabled };
    const listItem = document.getElementById(`list-${socketId}`);
    if (listItem) listItem.querySelector('.status-indicator').textContent = (audioEnabled ? '🔊' : '🔇') + (videoEnabled ? '📹' : '⬛');
}

// ==============================================================================
// INIZIALIZZAZIONE
// ==============================================================================
mainMuteBtn?.addEventListener("click", () => {
    const videoEl = mainVideoFeed.querySelector("video");
    videoEl.muted = !videoEl.muted;
    mainMuteBtn.textContent = videoEl.muted ? "🔇" : "🔊";
});

joinButton?.addEventListener('click', startCall);
nicknameInput?.addEventListener('keypress', e => { if (e.key === 'Enter') startCall(); });
roomIdInput?.addEventListener('keypress', e => { if (e.key === 'Enter') startCall(); });

const urlRoomId = new URLSearchParams(window.location.search).get('room');
if (urlRoomId) roomIdInput.value = urlRoomId;
