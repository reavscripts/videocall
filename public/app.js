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

const participantsPanel = document.getElementById('participants-panel'); 
const chatPanel = document.getElementById('chat-panel'); 
const showParticipantsBtn = document.getElementById('show-participants-btn'); 
const showChatBtn = document.getElementById('show-chat-btn'); 

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

const iceConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

// ==============================================================================
// FUNZIONI DI BASE DELL'INTERFACCIA UTENTE
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
        if (nameEl) nameEl.textContent = isLocal ? `${nickname} (Tu)` : nickname;
        participantsList.appendChild(li);
        li.addEventListener('click', () => { setMainVideo(id); });
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
		if (isLocal) muteBtn.style.display = "none";
		else { muteBtn.style.display = "block"; muteBtn.textContent = videoEl.muted ? "🔇" : "🔊"; }
	}

    focusedPeerId = peerId;
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
        startLocalMedia().then(() => {
            nicknameOverlay.classList.add('hidden');
            conferenceContainer.classList.remove('hidden');
            if (window.matchMedia("(max-width: 900px)").matches) {
                participantsPanel.classList.add('hidden');
                chatPanel.classList.add('hidden');
            }
            initializeSocket();
            setupRoomLink(); 
        }).catch(error => {
            console.error("Non è stato possibile avviare la webcam:", error);
            alert(`Impossibile avviare la webcam. Controlla i permessi.`);
        });
    } else alert('Per favore, inserisci un nickname e il nome della stanza.');
});

async function startLocalMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio:true, video:true });
        createLocalVideoElement(); 
        setMainVideo('local'); 
        return localStream;
    } catch (error) { throw error; }
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
// GESTIONE CHAT
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
    timeSpan.textContent = ` (${new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})})`;

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

// ==============================================================================
// GESTIONE CONTROLLI MOBILE
// ==============================================================================
function toggleMobilePanel(panel, otherPanel) {
    const videoArea = document.getElementById('video-area');

    if (!otherPanel.classList.contains('hidden')) {
        otherPanel.classList.add('hidden');
        otherPanel.style.position = '';
        otherPanel.style.inset = '';
        otherPanel.style.width = '';
        otherPanel.style.background = '';
        otherPanel.style.zIndex = '';
    }

    const isHidden = panel.classList.contains('hidden');

    if (isHidden) {
        panel.classList.remove('hidden');
        panel.style.position = 'fixed';
        panel.style.inset = '0';
        panel.style.width = '100%';
        panel.style.background = 'var(--background-dark)';
        panel.style.zIndex = '150';
        videoArea.style.display = 'none';
        if (panel === chatPanel) setTimeout(() => chatMessageInput.focus(), 50);
    } else {
        panel.classList.add('hidden');
        panel.style.position = '';
        panel.style.inset = '';
        panel.style.width = '';
        panel.style.background = '';
        panel.style.zIndex = '';
        videoArea.style.display = '';
    }
}

sendChatButton.addEventListener('click', sendChatMessage);
chatMessageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });
showParticipantsBtn.addEventListener('click', () => { toggleMobilePanel(participantsPanel, chatPanel); });
showChatBtn.addEventListener('click', () => { toggleMobilePanel(chatPanel, participantsPanel); });

// ==============================================================================
// CONTROLLI AUDIO/VIDEO
// ==============================================================================
toggleAudioButton.addEventListener('click', () => {
    const track = localStream?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; toggleAudioButton.textContent = track.enabled?'🎤':'🔇'; }
});
toggleVideoButton.addEventListener('click', () => {
    const track = localStream?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; toggleVideoButton.textContent = track.enabled?'📹':'⬛'; }
});
disconnectButton.addEventListener('click', () => {
    localStream?.getTracks().forEach(t => t.stop());
    Object.values(peerConnections).forEach(pc => pc?.close());
    socket?.disconnect();
    window.location.reload(); 
});

// ==============================================================================
// FUNZIONI SOCKET.IO
// ==============================================================================
function initializeSocket() {
    socket = io(RENDER_SERVER_URL, { query:{ nickname:userNickname } });

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

    socket.on('user-joined', (id, nickname) => {
        remoteNicknames[id] = nickname;
        updateParticipantList(id, nickname);
        callUser(id, false);
        remoteVideoPlaceholder?.classList.add('hidden');
    });

    socket.on('chat-message', (senderId, nickname, message) => { appendMessage(nickname, message, false); });
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('candidate', handleCandidate);
    socket.on('user-left', removePeer);
    socket.on('disconnect', () => { console.log('Disconnesso dal server.'); });
}

// ==============================================================================
// FUNZIONI WEBRTC
// ==============================================================================
function getOrCreatePeerConnection(socketId) {
    if (peerConnections[socketId]) return peerConnections[socketId];
    const pc = new RTCPeerConnection(iceConfiguration);
    if (localStream) localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    pc.ontrack = (event) => { createRemoteVideoElement(socketId, event.streams[0]); };
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
    const videoLabel = localFeed.querySelector('.video-label');
    remoteVideo.srcObject = localStream;
    remoteVideo.muted = true;
    videoLabel.textContent = userNickname;
    localFeed.addEventListener('click', () => { setMainVideo('local'); });
    remoteVideosContainer.prepend(localFeed);
}

function createRemoteVideoElement(socketId, stream) {
    let remoteVideoItem = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"]`);
    const template = document.getElementById('remote-video-template');
    if (!template) return;
    if (!remoteVideoItem) {
        remoteVideoItem = template.content.cloneNode(true).firstElementChild;
        remoteVideoItem.dataset.peerId = socketId;
        const videoLabel = remoteVideoItem.querySelector('.video-label');
        videoLabel.textContent = remoteNicknames[socketId] || `Peer ${socketId.substring(0,4)}...`;
        remoteVideoItem.addEventListener('click', () => { setMainVideo(socketId); });
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
            const offer = await pc.createOffer({ offerToReceiveAudio:true, offerToReceiveVideo:true });
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

function removePeer(socketId, isExternalEvent=true) {
    const pc = peerConnections[socketId];
    if (pc && isExternalEvent) pc.close();
    delete peerConnections[socketId];
    delete remoteNicknames[socketId];
    remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"]`)?.remove();
    document.getElementById(`list-${socketId}`)?.remove();
    if (focusedPeerId === socketId) {
        const remaining = Object.keys(peerConnections);
        if (remaining.length > 0) setMainVideo(remaining[0]);
        else setMainVideo('local');
    }
    updateParticipantCount();
    if (Object.keys(peerConnections).length === 0) remoteVideoPlaceholder?.classList.remove('hidden');
}
