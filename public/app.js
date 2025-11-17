// ======================================================================
// app.js — versione migliorata
// - Genera link stanza condivisibile
// - Auto-join via URL (se presente nickname + room)
// - Copy link con feedback
// - Toggle pannello partecipanti per mobile
// - Mantiene tutte le funzionalità WebRTC esistenti
// ======================================================================

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
const shareRoomLinkInput = document.getElementById('share-room-link');
const roomNameDisplay = document.getElementById('room-name-display');

// Controls
const mainVideoFeed = document.getElementById('main-video-feed');
const mainMuteBtn = document.getElementById('main-mute-btn');
const toggleAudioButton = document.getElementById('toggle-audio-button');
const toggleVideoButton = document.getElementById('toggle-video-button');
const disconnectButton = document.getElementById('disconnect-button');

// responsive helper: create participants toggle for small screens
let participantsToggleBtn = null;

// State
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

// -------------------------
// Utility: URL params
// -------------------------
function getUrlParams(){
    const params = new URLSearchParams(window.location.search);
    return Object.fromEntries(params.entries());
}

function updateUrlRoom(room){
    try{
        const url = new URL(window.location.href);
        url.searchParams.set('room', room);
        // Non aggiungiamo nickname all'URL per privacy
        window.history.replaceState({}, '', url.toString());
    }catch(e){ /* ignore */ }
}

function buildShareLink(room){
    const url = new URL(window.location.href);
    url.search = ''; // pulito
    url.searchParams.set('room', room);
    return url.toString();
}

// -------------------------
// UI helpers
// -------------------------
function updateParticipantCount(){
    if (participantCountSpan) participantCountSpan.textContent = 1 + Object.keys(remoteNicknames).length;
}

function updateParticipantList(id, nickname, isLocal=false){
    let li = document.getElementById(`list-${id}`);
    const liTemplate = document.getElementById('participant-item-template');

    if (!li && liTemplate){
        li = liTemplate.content.cloneNode(true).firstElementChild;
        li.id = `list-${id}`;
        li.dataset.peerId = id;

        const nameEl = li.querySelector('.participant-name');
        if (nameEl) nameEl.textContent = isLocal ? `${nickname} (Tu)` : nickname;

        li.addEventListener('click', ()=> setMainVideo(id));
        participantsList.appendChild(li);
    }

    if (li){
        const nameEl = li.querySelector('.participant-name');
        if (nameEl) nameEl.textContent = isLocal ? `${nickname} (Tu)` : nickname;
        document.querySelectorAll('#participants-list li').forEach(el => el.classList.remove('participant-focused'));
        if (id === focusedPeerId) li.classList.add('participant-focused');
    }

    updateParticipantCount();
}

// -------------------------
// Focus main video
// -------------------------
function setMainVideo(peerId){
    let stream, nickname, isLocal=false;
    if (peerId === 'local'){
        stream = localStream;
        nickname = userNickname + ' (Tu)';
        isLocal = true;
    }else{
        const remoteVideoElement = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${peerId}"]`);
        if (!remoteVideoElement || !remoteVideoElement.querySelector('video').srcObject){
            console.warn('Stream non pronto per', peerId);
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

    if (stream){
        videoEl.srcObject = stream;
        videoEl.muted = isLocal;
        labelEl.textContent = nickname;

        if (isLocal) mainMuteBtn.style.display = 'none';
        else { mainMuteBtn.style.display = 'block'; mainMuteBtn.textContent = videoEl.muted ? '🔇' : '🔊'; }
    }

    focusedPeerId = peerId;
    updateParticipantList(peerId, isLocal ? userNickname : remoteNicknames[peerId], isLocal);

    document.querySelectorAll('.remote-feed').forEach(el => el.classList.remove('is-focused'));
    const focusedFeed = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${peerId}"]`);
    if (focusedFeed) focusedFeed.classList.add('is-focused');
}

// -------------------------
// Media handling
// -------------------------
async function startLocalMedia(){
    const constraints = { audio: true, video: true };
    try{
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        createLocalVideoElement();
        setMainVideo('local');
        return localStream;
    }catch(err){ throw err; }
}

// Toggle buttons
mainMuteBtn?.addEventListener('click', ()=>{
    const videoEl = mainVideoFeed.querySelector('video');
    if (!videoEl) return;
    videoEl.muted = !videoEl.muted;
    mainMuteBtn.textContent = videoEl.muted ? '🔇' : '🔊';
});

toggleAudioButton?.addEventListener('click', ()=>{
    const audioTrack = localStream?.getAudioTracks()[0];
    if (audioTrack){
        audioTrack.enabled = !audioTrack.enabled;
        toggleAudioButton.textContent = audioTrack.enabled ? '🎤' : '🔇';
    }
});

toggleVideoButton?.addEventListener('click', ()=>{
    const videoTrack = localStream?.getVideoTracks()[0];
    if (videoTrack){
        videoTrack.enabled = !videoTrack.enabled;
        toggleVideoButton.textContent = videoTrack.enabled ? '📹' : '⬛';
    }
});

disconnectButton?.addEventListener('click', ()=>{
    localStream?.getTracks().forEach(t => t.stop());
    Object.keys(peerConnections).forEach(id => peerConnections[id]?.close());
    if (socket) socket.disconnect();
    window.location.href = window.location.pathname; // torna alla root senza param
});

// Touch-friendly: add touchstart fallback
[toggleAudioButton, toggleVideoButton, disconnectButton, mainMuteBtn].forEach(btn => {
    if (!btn) return;
    btn.addEventListener('touchstart', (e)=>{ e.preventDefault(); btn.dispatchEvent(new Event('click')); });
});

// -------------------------
// Socket + WebRTC (segnalazione)
// -------------------------
function initializeSocket(){
    socket = io(RENDER_SERVER_URL, { query: { nickname: userNickname } });

    socket.on('connect', ()=>{
        console.log('Connesso a segnalazione');
        socket.emit('join-room', currentRoomId, userNickname);
    });

    socket.on('users-in-room', (userList)=>{
        userList.forEach(user => {
            if (user.socketId !== socket.id){
                remoteNicknames[user.socketId] = user.nickname;
                updateParticipantList(user.socketId, user.nickname);
                callUser(user.socketId, true);
            }
        });
        if (userList.length > 0) document.getElementById('remote-video-placeholder')?.classList.add('hidden');
        updateParticipantList(socket.id, userNickname, true);
    });

    socket.on('user-joined', (newSocketId, newNickname)=>{
        remoteNicknames[newSocketId] = newNickname;
        updateParticipantList(newSocketId, newNickname);
        callUser(newSocketId, false);
        document.getElementById('remote-video-placeholder')?.classList.add('hidden');
    });

    socket.on('offer', (id, description)=> handleOffer(id, description));
    socket.on('answer', (id, description)=> handleAnswer(id, description));
    socket.on('candidate', (id, candidate)=> handleCandidate(id, candidate));
    socket.on('user-left', (leavingSocketId)=> removePeer(leavingSocketId, true));
    socket.on('disconnect', ()=> console.log('Disconnesso segnalazione'));
}

function getOrCreatePeerConnection(socketId){
    if (peerConnections[socketId]) return peerConnections[socketId];
    const pc = new RTCPeerConnection(iceConfiguration);
    if (localStream) localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = (event)=>{
        createRemoteVideoElement(socketId, event.streams[0]);
    };

    pc.onicecandidate = (event)=>{ if (event.candidate) socket.emit('candidate', socketId, event.candidate); };

    peerConnections[socketId] = pc;
    return pc;
}

async function callUser(socketId, isCaller){
    const pc = getOrCreatePeerConnection(socketId);
    if (isCaller){
        try{
            const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
            await pc.setLocalDescription(offer);
            socket.emit('offer', socketId, pc.localDescription);
        }catch(e){ console.error('Offer error', e); }
    }
}

async function handleOffer(socketId, description){
    const pc = getOrCreatePeerConnection(socketId);
    try{
        await pc.setRemoteDescription(new RTCSessionDescription(description));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', socketId, pc.localDescription);
    }catch(e){ console.error('Handle offer error', e); }
}

async function handleAnswer(socketId, description){
    const pc = getOrCreatePeerConnection(socketId);
    try{ await pc.setRemoteDescription(new RTCSessionDescription(description)); }
    catch(e){ console.error('Handle answer error', e); }
}

async function handleCandidate(socketId, candidate){
    try{
        const pc = peerConnections[socketId];
        if (pc && pc.remoteDescription && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }catch(e){ /* silence common ICE errors */ }
}

function removePeer(socketId, isExternalEvent=true){
    const pc = peerConnections[socketId];
    if (pc && isExternalEvent) pc.close();
    delete peerConnections[socketId];
    delete remoteNicknames[socketId];

    remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"]`)?.remove();
    document.getElementById(`list-${socketId}`)?.remove();

    if (focusedPeerId === socketId){
        const remaining = Object.keys(peerConnections);
        if (remaining.length > 0) setMainVideo(remaining[0]); else setMainVideo('local');
    }

    updateParticipantCount();
    if (Object.keys(peerConnections).length === 0) document.getElementById('remote-video-placeholder')?.classList.remove('hidden');
}

// -------------------------
// DOM creation helpers
// -------------------------
function createLocalVideoElement(){
    if (remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="local"]`)) return;
    const template = document.getElementById('remote-video-template');
    if (!template) return;

    const localFeed = template.content.cloneNode(true).firstElementChild;
    const remoteVideo = localFeed.querySelector('video');
    const videoLabel = localFeed.querySelector('.video-label');

    localFeed.dataset.peerId = 'local';
    localFeed.classList.add('local-feed');
    remoteVideo.srcObject = localStream;
    remoteVideo.muted = true;
    videoLabel.textContent = userNickname;

    localFeed.addEventListener('click', ()=> setMainVideo('local'));
    remoteVideosContainer.prepend(localFeed);
}

function createRemoteVideoElement(socketId, stream){
    let remoteVideoItem = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"]`);
    const template = document.getElementById('remote-video-template');
    if (!template) return;

    if (!remoteVideoItem){
        remoteVideoItem = template.content.cloneNode(true).firstElementChild;
        remoteVideoItem.dataset.peerId = socketId;
        const videoLabel = remoteVideoItem.querySelector('.video-label');
        videoLabel.textContent = remoteNicknames[socketId] || `Peer ${socketId.substring(0,4)}...`;
        remoteVideoItem.addEventListener('click', ()=> setMainVideo(socketId));
        remoteVideosContainer.appendChild(remoteVideoItem);
    }

    const remoteVideo = remoteVideoItem.querySelector('video');
    if (remoteVideo && !remoteVideo.srcObject) remoteVideo.srcObject = stream;

    if (Object.keys(peerConnections).length === 1 && focusedPeerId === 'local') setMainVideo(socketId);
}

// -------------------------
// Join flow + link handling
// -------------------------
joinButton.addEventListener('click', async ()=>{
    const nickname = nicknameInput.value.trim();
    const roomId = roomIdInput.value.trim();
    if (nickname && roomId){
        userNickname = nickname;
        currentRoomId = roomId;
        roomNameDisplay.textContent = currentRoomId;
        updateUrlRoom(currentRoomId);
        shareRoomLinkInput.value = buildShareLink(currentRoomId);

        try{
            await startLocalMedia();
            nicknameOverlay.classList.add('hidden');
            conferenceContainer.classList.remove('hidden');
            initializeSocket();
        }catch(error){
            console.error('Impossibile avviare media', error);
            alert(`Impossibile avviare la webcam. Errore: ${error?.name || error}`);
        }
    }else{
        alert('Per favore inserisci nickname e nome stanza.');
    }
});

// Auto prefill / auto join from URL
(function handleInitialUrl(){
    const params = getUrlParams();
    if (params.room) roomIdInput.value = params.room;
    if (params.nick) nicknameInput.value = params.nick; // optional

    // auto join only if both room and nick present
    if (params.room && params.nick){
        // slight delay to allow UI to be ready
        setTimeout(()=> joinButton.click(), 300);
    }
})();

// Copy share link on focus/click
if (shareRoomLinkInput){
    shareRoomLinkInput.addEventListener('click', async ()=>{
        if (!shareRoomLinkInput.value) return;
        try{
            await navigator.clipboard.writeText(shareRoomLinkInput.value);
            // feedback temporaneo
            const old = shareRoomLinkInput.value;
            shareRoomLinkInput.value = 'Link copiato!';
            setTimeout(()=> shareRoomLinkInput.value = old, 1200);
        }catch(e){
            // fallback: select
            shareRoomLinkInput.select();
            document.execCommand('copy');
        }
    });
}

// -------------------------
// Responsive: toggle participants on mobile
// -------------------------
function ensureParticipantsToggle(){
    const panel = document.getElementById('participants-panel');
    if (!panel) return;

    const needToggle = window.innerWidth <= 900;
    if (needToggle && !participantsToggleBtn){
        participantsToggleBtn = document.createElement('button');
        participantsToggleBtn.className = 'participants-toggle';
        participantsToggleBtn.textContent = '☰';
        participantsToggleBtn.title = 'Mostra/Nascondi partecipanti';
        participantsToggleBtn.style.position = 'absolute';
        participantsToggleBtn.style.left = '12px';
        participantsToggleBtn.style.top = '12px';
        participantsToggleBtn.style.zIndex = 300;
        participantsToggleBtn.style.width = '44px';
        participantsToggleBtn.style.height = '44px';
        participantsToggleBtn.style.borderRadius = '8px';
        participantsToggleBtn.style.border = 'none';
        participantsToggleBtn.style.background = 'rgba(0,0,0,0.6)';
        participantsToggleBtn.style.color = '#fff';
        participantsToggleBtn.style.fontSize = '18px';

        participantsToggleBtn.addEventListener('click', ()=>{
            if (panel.style.display === 'none' || getComputedStyle(panel).display === 'none'){
                panel.style.display = 'block';
            }else{
                panel.style.display = 'none';
            }
        });

        document.body.appendChild(participantsToggleBtn);
    }

    if (!needToggle && participantsToggleBtn){
        participantsToggleBtn.remove();
        participantsToggleBtn = null;
        panel.style.display = '';
    }
}

window.addEventListener('resize', ensureParticipantsToggle);
ensureParticipantsToggle();

// -------------------------
// On unload: clean resources
// -------------------------
window.addEventListener('beforeunload', ()=>{
    try{ localStream?.getTracks().forEach(t => t.stop()); }catch(e){}
});

// End of file
