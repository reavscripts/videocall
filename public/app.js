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

// Partecipanti
const participantCount = document.getElementById('participant-count');
const participantsList = document.getElementById('participants-list');
const participantsPanel = document.getElementById('participants-panel');

// Chat
const chatPanel = document.getElementById('chat-panel');
const chatMessageInput = document.getElementById('chat-message-input');
const sendChatButton = document.getElementById('send-chat-button');
const messagesContainer = document.getElementById('messages-container');

// Mobile
const showChatBtn = document.getElementById('show-chat-btn');
const showParticipantsBtn = document.getElementById('show-participants-btn');

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
        { urls: 'stun:stun1.l.google.com:19302' }
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
        const remoteVideoElement = remoteVideosContainer.querySelector(
            `.remote-feed[data-peer-id="${peerId}"]`
        );
        if (!remoteVideoElement || !remoteVideoElement.querySelector('video').srcObject) {
            if (focusedPeerId !== 'local') setMainVideo('local');
            return;
        }
        stream = remoteVideoElement.querySelector('video').srcObject;
        nickname = remoteNicknames[peerId];
    }

    const videoEl = mainVideoFeed.querySelector('video');
    const labelEl = mainVideoFeed.querySelector('.video-label');

    if (!videoEl || !labelEl) return;

    document.querySelectorAll('.remote-feed.is-focused')
        .forEach(el => el.classList.remove('is-focused'));

    if (!isLocal)
        remoteVideosContainer.querySelector(
            `.remote-feed[data-peer-id="${peerId}"]`
        )?.classList.add('is-focused');

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

    if (!nickname || !roomId) {
        alert("Per favore, inserisci un nickname e una stanza.");
        return;
    }

    userNickname = nickname;
    currentRoomId = roomId;
    roomNameDisplay.textContent = currentRoomId;

    startLocalMedia()
        .then(() => {
            nicknameOverlay.classList.add('hidden');
            conferenceContainer.classList.remove('hidden');

            addParticipantToDOM('local', userNickname + " (Tu)");
            updateParticipantCount();

            initializeSocket();
            setupRoomLink();
        })
        .catch(error => {
            alert("Impossibile avviare la webcam.");
            console.error(error);
        });
});

async function startLocalMedia() {
    const constraints = { audio: true, video: true };
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    createLocalVideoElement();
    setMainVideo('local');
    return localStream;
}

// ==============================================================================
// GESTIONE PARTECIPANTI
// ==============================================================================
function updateParticipantList(userList) {
    participantsList.innerHTML = "";
    addParticipantToDOM('local', userNickname + " (Tu)");
    userList
        .filter(u => u.socketId !== socket.id)
        .forEach(u => addParticipantToDOM(u.socketId, u.nickname));
    updateParticipantCount();
}

function addParticipantToDOM(id, nickname) {
    if (participantsList.querySelector(`li[data-peer-id="${id}"]`)) return;

    const template = document.getElementById('participant-item-template');
    const entry = template.content.cloneNode(true).firstElementChild;

    entry.dataset.peerId = id;
    entry.querySelector('.participant-name').textContent = nickname;

    participantsList.appendChild(entry);
    updateParticipantCount();
}

function removeParticipantFromDOM(id) {
    participantsList.querySelector(`li[data-peer-id="${id}"]`)?.remove();
    updateParticipantCount();
}

function updateParticipantCount() {
    participantCount.textContent = participantsList.children.length;
}

// ==============================================================================
// ROOM LINK
// ==============================================================================
function setupRoomLink() {
    const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(currentRoomId)}`;
    shareRoomLinkInput.value = url;

    shareRoomLinkInput.addEventListener('click', () => {
        shareRoomLinkInput.select();
        document.execCommand('copy');
        shareRoomLinkInput.value = url + " (copiato)";
        setTimeout(() => shareRoomLinkInput.value = url, 1500);
    });
}

// ==============================================================================
// CHAT
// ==============================================================================
function appendMessage(nickname, message, local = false) {
    const wrap = document.createElement('div');
    wrap.classList.add('message');
    if (local) wrap.classList.add('self');

    wrap.innerHTML = `
        <span class="sender">${local ? 'Tu' : nickname}</span>
        <span class="timestamp"> (${new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})})</span>
        : ${message}
    `;

    messagesContainer.appendChild(wrap);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendChatMessage() {
    const msg = chatMessageInput.value.trim();
    if (!msg) return;

    appendMessage(userNickname, msg, true);
    socket.emit('chat-message', msg);
    chatMessageInput.value = "";
}

sendChatButton.addEventListener('click', sendChatMessage);
chatMessageInput.addEventListener('keypress', e => {
    if (e.key === "Enter") sendChatMessage();
});

// ==============================================================================
// CONTROLLI MOBILE — VERSIONE CORRETTA
// ==============================================================================

// Chat mobile
function toggleMobileChat() {
    if (window.innerWidth > 900) return;

    const open = chatPanel.classList.contains('show');

    participantsPanel.classList.remove('show-mobile');

    if (open) chatPanel.classList.remove('show');
    else {
        chatPanel.classList.add('show');
        setTimeout(() => chatMessageInput.focus(), 50);
    }
}

// Partecipanti mobile
function toggleMobileParticipants() {
    if (window.innerWidth > 900) return;

    const open = participantsPanel.classList.contains('show-mobile');

    chatPanel.classList.remove('show');

    if (open) participantsPanel.classList.remove('show-mobile');
    else participantsPanel.classList.add('show-mobile');
}

showChatBtn.addEventListener('click', toggleMobileChat);
showParticipantsBtn.addEventListener('click', toggleMobileParticipants);

// ==============================================================================
// ADATTAMENTO CHAT MOBILE CON TASTIERA — VERSIONE CORRETTA
// ==============================================================================
if (window.matchMedia("(max-width: 900px)").matches) {
    function adjustChatForKeyboard() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    window.addEventListener('resize', () => {
        if (chatPanel.classList.contains('show')) adjustChatForKeyboard();
    });

    chatMessageInput.addEventListener('focus', adjustChatForKeyboard);
    chatMessageInput.addEventListener('blur', adjustChatForKeyboard);
}

// ==============================================================================
// CONTROLLI AUDIO/VIDEO/DISCONNECT
// ==============================================================================
toggleAudioButton.addEventListener('click', () => {
    const track = localStream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    toggleAudioButton.textContent = track.enabled ? "🎤" : "🔇";
});

toggleVideoButton.addEventListener('click', () => {
    const track = localStream?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    toggleVideoButton.textContent = track.enabled ? "📹" : "⬛";
});

disconnectButton.addEventListener('click', () => {
    localStream?.getTracks().forEach(t => t.stop());
    Object.values(peerConnections).forEach(pc => pc.close());
    socket?.disconnect();
    location.reload();
});

// ==============================================================================
// WEBRTC FUNZIONI
// ==============================================================================
function getOrCreatePeerConnection(id) {
    if (peerConnections[id]) return peerConnections[id];

    const pc = new RTCPeerConnection(iceConfiguration);

    localStream?.getTracks().forEach(t => pc.addTrack(t, localStream));

    pc.ontrack = e => createRemoteVideoElement(id, e.streams[0]);

    pc.onicecandidate = e => {
        if (e.candidate) socket.emit('candidate', id, e.candidate);
    };

    peerConnections[id] = pc;
    return pc;
}

function createLocalVideoElement() {
    if (remoteVideosContainer.querySelector('[data-peer-id="local"]')) return;

    const tpl = document.getElementById('remote-video-template');
    const el = tpl.content.cloneNode(true).firstElementChild;

    el.dataset.peerId = "local";
    el.classList.add("local-feed");

    const video = el.querySelector("video");
    video.srcObject = localStream;
    video.muted = true;

    el.querySelector('.video-label').textContent = userNickname;
    el.addEventListener('click', () => setMainVideo('local'));

    remoteVideosContainer.prepend(el);
}

function createRemoteVideoElement(id, stream) {
    let el = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${id}"]`);

    const tpl = document.getElementById('remote-video-template');

    if (!el) {
        el = tpl.content.cloneNode(true).firstElementChild;
        el.dataset.peerId = id;
        el.querySelector('.video-label').textContent =
            remoteNicknames[id] || ("Peer " + id.substring(0, 4));
        el.addEventListener('click', () => setMainVideo(id));
        remoteVideosContainer.appendChild(el);
    }

    const video = el.querySelector('video');
    if (!video.srcObject) video.srcObject = stream;

    if (Object.keys(peerConnections).length === 1 && focusedPeerId === 'local')
        setMainVideo(id);
}

// ==============================================================================
// SOCKET.IO
// ==============================================================================
function initializeSocket() {
    socket = io(RENDER_SERVER_URL, { query: { nickname: userNickname } });

    socket.on('connect', () => {
        socket.emit('join-room', currentRoomId, userNickname);
    });

    socket.on('users-in-room', list => {
        list.forEach(u => {
            if (u.socketId !== socket.id) {
            remoteNicknames[u.socketId] = u.nickname;
                callUser(u.socketId, true);
            }
        });
        updateParticipantList(list);
    });

    socket.on('user-joined', (id, name) => {
        remoteNicknames[id] = name;
        callUser(id, false);
        addParticipantToDOM(id, name);
    });

    socket.on('chat-message', (id, nick, msg) => {
        appendMessage(nick, msg, false);
    });

    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('candidate', handleCandidate);
    socket.on('user-left', removePeer);
}

async function callUser(id, caller) {
    const pc = getOrCreatePeerConnection(id);

    if (!caller) return;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', id, pc.localDescription);
}

async function handleOffer(id, desc) {
    const pc = getOrCreatePeerConnection(id);
    await pc.setRemoteDescription(new RTCSessionDescription(desc));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', id, pc.localDescription);
}

async function handleAnswer(id, desc) {
    const pc = getOrCreatePeerConnection(id);
    await pc.setRemoteDescription(new RTCSessionDescription(desc));
}

async function handleCandidate(id, cand) {
    const pc = peerConnections[id];
    if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
    }
}

function removePeer(id) {
    peerConnections[id]?.close();
    delete peerConnections[id];
    delete remoteNicknames[id];

    remoteVideosContainer.querySelector(
        `.remote-feed[data-peer-id="${id}"]`
    )?.remove();

    removeParticipantFromDOM(id);

    if (focusedPeerId === id) {
        const remaining = Object.keys(peerConnections);
        setMainVideo(remaining[0] || 'local');
    }
}
