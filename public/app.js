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
const roomNameDisplay = document.getElementById('room-name-display'); 
const shareRoomLinkInput = document.getElementById('share-room-link'); 

// Pannelli e pulsanti mobile
const participantsPanel = document.getElementById('participants-panel'); 
const chatPanel = document.getElementById('chat-panel'); 
const showParticipantsBtn = document.getElementById('show-participants-btn'); 
const showChatBtn = document.getElementById('show-chat-btn'); 

// Chat
const chatMessageInput = document.getElementById('chat-message-input');
const sendChatButton = document.getElementById('send-chat-button');
const messagesContainer = document.getElementById('messages-container');

mainMuteBtn.addEventListener("click", () => {
    const videoEl = mainVideoFeed.querySelector("video");
    videoEl.muted = !videoEl.muted;
    mainMuteBtn.textContent = videoEl.muted ? "🔇" : "🔊";
});

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
// POPOLAMENTO AUTOMATICO CAMPO STANZA DA URL
// ==============================================================================
const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = urlParams.get('room');
if (roomFromUrl) {
    roomIdInput.value = roomFromUrl;
}

// ==============================================================================
// FUNZIONI UI
// ==============================================================================
function updateParticipantCount() {
    if (participantCountSpan) {
        participantCountSpan.textContent = 1 + Object.keys(remoteNicknames).length;
    }
}

function updateParticipantList(id, nickname, isLocal = false) {
    let li = document.getElementById(`list-${id}`);
    const liTemplate = document.getElementById('participant-item-template');

    if (!li && liTemplate) {
        li = liTemplate.content.cloneNode(true).firstElementChild;
        li.id = `list-${id}`;
        li.dataset.peerId = id; 
        const nameEl = li.querySelector('.participant-name');
        if (nameEl) {
             nameEl.textContent = isLocal ? `${nickname} (Tu)` : nickname;
        }
        participantsList.appendChild(li);
        li.addEventListener('click', () => setMainVideo(id));
    }
    
    if (li) {
        const nameEl = li.querySelector('.participant-name');
        if (nameEl) nameEl.textContent = isLocal ? `${nickname} (Tu)` : nickname;
        document.querySelectorAll('#participants-list li').forEach(el => el.classList.remove('participant-focused'));
        if (id === focusedPeerId) li.classList.add('participant-focused');
    }

    updateParticipantCount(); 
}

// ==============================================================================
// GESTIONE FOCUS VIDEO
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

    if (stream) {
        videoEl.srcObject = stream;
        videoEl.muted = isLocal;
        labelEl.textContent = nickname;

        const muteBtn = document.getElementById("main-mute-btn");
        muteBtn.style.display = isLocal ? "none" : "block";
        muteBtn.textContent = videoEl.muted ? "🔇" : "🔊";
    }

    focusedPeerId = peerId;
    updateParticipantList(peerId, isLocal ? userNickname : remoteNicknames[peerId], isLocal); 

    document.querySelectorAll('.remote-feed').forEach(el => el.classList.remove('is-focused'));
    const focusedFeed = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${peerId}"]`);
    if (focusedFeed) focusedFeed.classList.add('is-focused');
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
        roomNameDisplay.textContent = currentRoomId; 
        
        startLocalMedia()
            .then(() => {
                nicknameOverlay.classList.add('hidden');
                conferenceContainer.classList.remove('hidden');
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

function setupRoomLink() {
    const roomUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(currentRoomId)}`;
    shareRoomLinkInput.value = roomUrl;
    shareRoomLinkInput.addEventListener('click', () => {
        shareRoomLinkInput.select();
        document.execCommand('copy');
        alert('Link della stanza copiato negli appunti!');
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
    timeSpan.textContent = ` (${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;

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
// CONTROLLI MOBILE
// ==============================================================================
function toggleMobilePanel(panel, otherPanel) {
    const videoArea = document.getElementById('video-area');
    otherPanel.classList.add('hidden');

    const isHidden = panel.classList.contains('hidden');

    if (isHidden) {
        panel.classList.remove('hidden');
        panel.style.position = 'fixed';
        panel.style.inset = '0';
        panel.style.width = '100%';
        panel.style.height = '100%';
        panel.style.background = 'var(--background-dark)';
        panel.style.zIndex = '150';
        panel.style.display = 'flex';
        videoArea.style.display = 'none';
        
        if (panel === chatPanel) setTimeout(() => chatMessageInput.focus(), 50);
    } else {
        panel.classList.add('hidden');
        panel.style.position = '';
        panel.style.inset = '';
        panel.style.width = '';
        panel.style.height = '';
        panel.style.background = '';
        panel.style.zIndex = '';
        panel.style.display = '';
        videoArea.style.display = 'flex';
    }
}

showParticipantsBtn.addEventListener('click', () => toggleMobilePanel(participantsPanel, chatPanel));
showChatBtn.addEventListener('click', () => toggleMobilePanel(chatPanel, participantsPanel));

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
// ADATTAMENTO CHAT MOBILE CON TASTIERA
// ==============================================================================
if (window.matchMedia("(max-width: 900px)").matches) {
    function adjustChatPanel() {
        const vh = window.innerHeight;
        const inputHeight = chatMessageInput.offsetHeight + 16;
        const panelPadding = 20;
        const availableHeight = vh - inputHeight - panelPadding;

        messagesContainer.style.height = availableHeight + 'px';
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    window.addEventListener('resize', adjustChatPanel);
    chatMessageInput.addEventListener('focus', adjustChatPanel);
    chatMessageInput.addEventListener('blur', adjustChatPanel);

    showChatBtn.addEventListener('click', () => {
        setTimeout(adjustChatPanel, 100);
    });
}

// ==============================================================================
// SOCKET.IO E WEBRTC
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
                updateParticipantList(user.socketId, user.nickname);
                callUser(user.socketId, true);
            }
        });
        if (userList.length > 0) remoteVideoPlaceholder?.classList.add('hidden');
        updateParticipantList(socket.id, userNickname, true);
    });

    socket.on('user-joined', (newSocketId, newNickname) => {
        remoteNicknames[newSocketId] = newNickname;
        updateParticipantList(newSocketId, newNickname);
        callUser(newSocketId, false);
        remoteVideoPlaceholder?.classList.add('hidden');
    });

    socket.on('chat-message', (senderId, nickname, message) => appendMessage(nickname, message, false));

    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('candidate', handleCandidate);
    socket.on('user-left', removePeer);
    socket.on('disconnect', () => console.log('Disconnesso dal server.'));
}

// ==============================================================================
// WEBRTC FUNCTIONS
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
    if (pc) pc.close();
    delete peerConnections[socketId];
    delete remoteNicknames[socketId];
    remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"]`)?.remove();
    document.getElementById(`list-${socketId}`)?.remove();

    if (focusedPeerId === socketId) {
        const remainingPeerIds = Object.keys(peerConnections);
        setMainVideo(remainingPeerIds.length > 0 ? remainingPeerIds[0] : 'local');
    }

    updateParticipantCount();
    if (Object.keys(peerConnections).length === 0) remoteVideoPlaceholder?.classList.remove('hidden');
}
