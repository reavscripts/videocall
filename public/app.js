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

// Controlli principali
const mainVideoFeed = document.getElementById('main-video-feed');
const mainMuteBtn = document.getElementById("main-mute-btn");
const remoteVideoPlaceholder = document.getElementById('remote-video-placeholder');
const toggleAudioButton = document.getElementById('toggle-audio-button');
const toggleVideoButton = document.getElementById('toggle-video-button');
const disconnectButton = document.getElementById('disconnect-button');
const roomNameDisplay = document.getElementById('room-name-display'); 
const shareRoomLinkInput = document.getElementById('share-room-link'); 

// ==============================================================================
// VARIABILI DI STATO
// ==============================================================================
let socket = null;
let localStream = null;
let userNickname = 'Ospite';
let currentRoomId = null; 
const peerConnections = {}; 
const remoteNicknames = {}; 
const remoteMuteStates = {}; // stato mute per peer remoto
let focusedPeerId = 'local'; 

const iceConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

// ==============================================================================
// CARICA STANZA DA URL
// ==============================================================================
function loadRoomFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');

    if (roomFromUrl && roomIdInput) {
        roomIdInput.value = roomFromUrl;
        nicknameInput.focus(); 
    }
}
loadRoomFromUrl();

// ==============================================================================
// FUNZIONI INTERFACCIA
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
        li.addEventListener('click', () => { setMainVideo(id); });
        participantsList.appendChild(li);
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
// GESTIONE FOCUS VIDEO E MUTE
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
            console.warn(`Stream non pronto per ID: ${peerId}. Torno a locale.`);
            if (focusedPeerId === 'local') return; 
            setMainVideo('local');
            return;
        }
        stream = remoteVideoElement.querySelector('video').srcObject;
        nickname = remoteNicknames[peerId];
    }
    
    const videoEl = mainVideoFeed.querySelector('video'); 
    const labelEl = mainVideoFeed.querySelector('.video-label'); 

    if (!videoEl || !labelEl) {
        console.error("Elementi video o label non trovati.");
        return; 
    }

	if (stream) {
		videoEl.srcObject = stream;
		labelEl.textContent = nickname;

		if (isLocal) {
            videoEl.muted = true;
			mainMuteBtn.style.display = "none"; 
		} else {
            videoEl.muted = remoteMuteStates[peerId] ?? false;
			mainMuteBtn.style.display = "block"; 
			mainMuteBtn.textContent = videoEl.muted ? "🔇" : "🔊"; 
		}
	}

    focusedPeerId = peerId;
    updateParticipantList(peerId, isLocal ? userNickname : remoteNicknames[peerId], isLocal); 

    document.querySelectorAll('.remote-feed').forEach(el => el.classList.remove('is-focused'));
    const focusedFeed = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${peerId}"]`);
    if (focusedFeed) focusedFeed.classList.add('is-focused');
}

mainMuteBtn.addEventListener("click", () => {
    const videoEl = mainVideoFeed.querySelector("video");
    if (!videoEl) return;

    videoEl.muted = !videoEl.muted;
    mainMuteBtn.textContent = videoEl.muted ? "🔇" : "🔊";

    if (focusedPeerId !== 'local') remoteMuteStates[focusedPeerId] = videoEl.muted;
});

// ==============================================================================
// INGRESSO UTENTE E MEDIA
// ==============================================================================
joinButton.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    const roomId = roomIdInput.value.trim(); 
    
    if (nickname && roomId) {
        userNickname = nickname;
        currentRoomId = roomId;
        roomNameDisplay.textContent = currentRoomId;

        if (shareRoomLinkInput) {
            shareRoomLinkInput.value = `${window.location.origin}${window.location.pathname}?room=${currentRoomId}`;
        }

        startLocalMedia()
            .then(() => {
                nicknameOverlay.classList.add('hidden');
                conferenceContainer.classList.remove('hidden');
                initializeSocket();
            })
            .catch(error => {
                console.error("Errore webcam:", error.name, error);
                alert(`Impossibile avviare la webcam. Errore: ${error.name}`);
            });
    } else {
        alert('Inserisci nickname e stanza.');
    }
});

async function startLocalMedia() {
    const constraints = { audio: true, video: true };
    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        createLocalVideoElement(); 
        setMainVideo('local'); 
        return localStream;
    } catch (error) { throw error; }
}

// ==============================================================================
// CONDIVISIONE LINK
// ==============================================================================
shareRoomLinkInput.addEventListener('click', () => {
    shareRoomLinkInput.select();
    shareRoomLinkInput.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(shareRoomLinkInput.value).then(() => {
        const originalText = shareRoomLinkInput.value;
        shareRoomLinkInput.value = "Link copiato!";
        setTimeout(() => { shareRoomLinkInput.value = originalText; }, 800);
    }).catch(err => console.error('Errore copia:', err));
});

// ==============================================================================
// CONTROLLI MEDIA
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
// SOCKET.IO
// ==============================================================================
function initializeSocket() {
    socket = io(RENDER_SERVER_URL, { query: { nickname: userNickname } });

    socket.on('connect', () => {
        console.log('Connesso al server.');
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

    socket.on('offer', (id, description) => handleOffer(id, description));
    socket.on('answer', (id, description) => handleAnswer(id, description));
    socket.on('candidate', (id, candidate) => handleCandidate(id, candidate));

    socket.on('user-left', (leavingSocketId) => removePeer(leavingSocketId, true));
    socket.on('disconnect', () => console.log('Disconnesso dal server.'));
}

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

function createLocalVideoElement() {
    if (remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="local"]`)) return;
    const template = document.getElementById('remote-video-template');
    if (!template) return;
    
    const localFeed = template.content.cloneNode(true).firstElementChild;
    localFeed.dataset.peerId = 'local';
    localFeed.classList.add('local-feed');

    const video = localFeed.querySelector('video');
    const label = localFeed.querySelector('.video-label');
    video.srcObject = localStream;
    video.muted = true;
    label.textContent = userNickname + " (Tu)";
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
        const label = remoteVideoItem.querySelector('.video-label');
        label.textContent = remoteNicknames[socketId] || `Peer ${socketId.substring(0,4)}...`;
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
    } catch (error) { console.error('Errore handleOffer:', error); }
}

async function handleAnswer(socketId, description) {
    const pc = getOrCreatePeerConnection(socketId);
    try { await pc.setRemoteDescription(new RTCSessionDescription(description)); } 
    catch (error) { console.error('Errore handleAnswer:', error); }
}

async function handleCandidate(socketId, candidate) {
    try {
        const pc = peerConnections[socketId];
        if (pc && pc.remoteDescription && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {}
}

function removePeer(socketId, isExternalEvent = true) {
    const pc = peerConnections[socketId];
    if (pc && isExternalEvent) pc.close();
    delete peerConnections[socketId];
    delete remoteNicknames[socketId];
    delete remoteMuteStates[socketId];

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
