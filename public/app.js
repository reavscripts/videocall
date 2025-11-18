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

// Partecipanti (NUOVI)
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
let isMobileParticipantsPanelVisible = false;

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

    // Rimuovi focus da tutti e applica al nuovo
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
                
                // Inizializza la lista partecipanti
                addParticipantToDOM('local', userNickname + " (Tu)");
                updateParticipantCount();

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

// ==============================================================================
// GESTIONE PARTECIPANTI
// ==============================================================================
function updateParticipantList(userList) {
    participantsList.innerHTML = ''; // Pulisce la lista
    
    // Aggiungi l'utente locale
    addParticipantToDOM('local', userNickname + " (Tu)"); 

    // Aggiungi gli utenti remoti
    userList.filter(u => u.socketId !== socket.id).forEach(user => {
        addParticipantToDOM(user.socketId, user.nickname);
    });

    updateParticipantCount();
}

function addParticipantToDOM(id, nickname) {
    // Evita duplicati
    if (participantsList.querySelector(`li[data-peer-id="${id}"]`)) return;

    const template = document.getElementById('participant-item-template');
    if (!template) return;
    
    const listItem = template.content.cloneNode(true).firstElementChild;
    listItem.dataset.peerId = id;
    
    const nameSpan = listItem.querySelector('.participant-name');
    if (nameSpan) nameSpan.textContent = nickname;
    
    participantsList.appendChild(listItem);
    updateParticipantCount();
}

function removeParticipantFromDOM(socketId) {
    participantsList.querySelector(`li[data-peer-id="${socketId}"]`)?.remove();
    updateParticipantCount();
}

function updateParticipantCount() {
    participantCount.textContent = participantsList.children.length;
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

sendChatButton.addEventListener('click', sendChatMessage);
chatMessageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });

// ==============================================================================
// CONTROLLI MOBILE
// ==============================================================================
function toggleMobileChat() {
    const videoArea = document.getElementById('video-area');
    
    // Se i partecipanti sono aperti, chiudili
    if (participantsPanel.classList.contains('show-mobile')) {
        participantsPanel.classList.remove('show-mobile');
    }

    const isHidden = !chatPanel.classList.contains('show'); 

    if (isHidden) {
        // Mostra Chat
        chatPanel.classList.add('show');
        videoArea.classList.add('hidden'); 
        setTimeout(() => chatMessageInput.focus(), 50);
        adjustChatForKeyboard();
    } else {
        // Nascondi Chat
        chatPanel.classList.remove('show');
        videoArea.classList.remove('hidden');
    }
}

function toggleMobileParticipants() {
    const videoArea = document.getElementById('video-area');
    
    // Se la chat è aperta, chiudila
    if (chatPanel.classList.contains('show')) {
        chatPanel.classList.remove('show');
    }

    const isHidden = !participantsPanel.classList.contains('show-mobile');
    
    if (isHidden) {
        // Mostra Partecipanti
        participantsPanel.classList.add('show-mobile');
        videoArea.classList.add('hidden');
    } else {
        // Nascondi Partecipanti
        participantsPanel.classList.remove('show-mobile');
        videoArea.classList.remove('hidden');
    }
}

showChatBtn.addEventListener('click', toggleMobileChat);
showParticipantsBtn.addEventListener('click', toggleMobileParticipants);

// ==============================================================================
// ADATTAMENTO CHAT MOBILE CON TASTIERA
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
    const audioTrack = localStream?.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        toggleAudioButton.textContent = audioTrack.enabled ? '🎤' : '🔇';
        // Non è necessario inviare il segnale mute agli altri, ma è una buona pratica
        // per aggiornare la visualizzazione locale.
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
// WEBRTC FUNZIONI
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
        updateParticipantList(userList); // Aggiorna la lista partecipanti
        if (userList.length > 0) document.getElementById('remote-video-placeholder')?.classList.add('hidden');
    });

    socket.on('user-joined', (newSocketId, newNickname) => {
        remoteNicknames[newSocketId] = newNickname;
        callUser(newSocketId, false);
        addParticipantToDOM(newSocketId, newNickname); // Aggiungi il nuovo utente alla lista
        document.getElementById('remote-video-placeholder')?.classList.add('hidden');
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
    if (pc) pc.close();
    delete peerConnections[socketId];
    delete remoteNicknames[socketId];
    remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"]`)?.remove();
    
    removeParticipantFromDOM(socketId); // Rimuovi l'utente dalla lista

    if (focusedPeerId === socketId) {
        const remainingPeerIds = Object.keys(peerConnections);
        setMainVideo(remainingPeerIds.length > 0 ? remainingPeerIds[0] : 'local');
    }

    if (Object.keys(peerConnections).length === 0) document.getElementById('remote-video-placeholder')?.classList.remove('hidden');
}