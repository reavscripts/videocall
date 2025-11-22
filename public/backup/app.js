// app.js 

//const RENDER_SERVER_URL = "https://videocall-webrtc-signaling-server.onrender.com"; 
const RENDER_SERVER_URL = "http://localhost:3000";

// ---------- DOM & Controlli ----------
const nicknameOverlay = document.getElementById('nickname-overlay');
const joinButton = document.getElementById('join-button');
const nicknameInput = document.getElementById('nickname-input');
const roomIdInput = document.getElementById('room-id-input');
const videosGrid = document.getElementById('videos-grid'); 
const localVideoEl = document.getElementById('local-video');
const localFeedEl = document.getElementById('local-feed'); 

// Controlli Media (Globali)
const toggleAudioButton = document.getElementById('toggle-audio-button');
const toggleVideoButton = document.getElementById('toggle-video-button');
const disconnectButton = document.getElementById('disconnect-button');
const localMicStatusIcon = document.getElementById('local-mic-status'); 
const shareScreenButton = document.getElementById('share-screen-button');
const shareRoomLinkButton = document.getElementById('share-room-link'); 
const recordButton = document.getElementById('record-button'); 

// ** CONTROLLI FILE TRANSFER **
const transferFileButton = document.getElementById('transfer-file-button');
const fileInput = document.getElementById('file-input');
const fileTransferContainer = document.getElementById('file-transfer-container');

// ** CONTROLLI WHITEBOARD **
const toggleWhiteboardButton = document.getElementById('toggle-whiteboard-button');
const whiteboardContainer = document.getElementById('whiteboard-container');
const canvas = document.getElementById('whiteboard-canvas');
const wbUndoBtn = document.getElementById('wb-undo-btn');
const wbClearBtn = document.getElementById('wb-clear-btn');
const wbCloseBtn = document.getElementById('wb-close-btn');
const wbColors = document.querySelectorAll('.color-btn');

// Controlli Chat
const chatPanel = document.getElementById('chat-panel');
const messagesContainer = document.getElementById('messages-container');
const chatMessageInput = document.getElementById('chat-message-input');
const sendChatButton = document.getElementById('send-chat-button');
const showChatBtn = document.getElementById('show-chat-btn');

// Controlli Menu Contestuale
const contextMenuEl = document.getElementById('remote-context-menu');
const menuDmUser = document.getElementById('menu-dm-user');
const menuMuteUser = document.getElementById('menu-mute-user');

// ** CONTROLLI IMPOSTAZIONI (NUOVI) **
const settingsModal = document.getElementById('settings-modal');
const settingsBtnOverlay = document.getElementById('settings-btn-overlay');
const settingsBtnRoom = document.getElementById('settings-btn-room');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const themeToggle = document.getElementById('theme-toggle');

// ** CONTROLLI ADMIN **
const openAdminLoginBtn = document.getElementById('open-admin-login');
const adminPanel = document.getElementById('admin-panel');
const closeAdminBtn = document.getElementById('close-admin-btn');
const adminLoginView = document.getElementById('admin-login-view');
const adminDashboardView = document.getElementById('admin-dashboard-view');
const adminPasswordInput = document.getElementById('admin-password-input');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminMsg = document.getElementById('admin-msg');
const adminRoomsList = document.getElementById('admin-rooms-list');
const adminTotalUsers = document.getElementById('admin-total-users');
const adminRefreshBtn = document.getElementById('admin-refresh-btn');
const roomPasswordInput = document.getElementById('room-password-input');
const adminLogsConsole = document.getElementById('admin-logs-console');
const adminBannedCount = document.getElementById('admin-banned-count');

let socket = null;
let localStream = null;
let userNickname = 'Ospite';
let currentRoomId = null;
let currentRoomPassword = '';
const peerConnections = {};
const remoteNicknames = {};
let focusedPeerId = 'local'; 
let screenStream = null; 
const videoSenders = {}; 
let isAudioEnabled = true;
let isVideoEnabled = true;
const iceCandidateQueues = {};

// Variabili Registrazione
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false; 

// ** VARIABILI WHITEBOARD **
let isDrawing = false;
let currentX = 0;
let currentY = 0;
let currentColor = '#ffffff';
let ctx = null;
let localWhiteboardHistory = []; 

// ** VARIABILI FILE TRANSFER **
const dataChannels = {}; 
const fileChunks = {}; 
const fileMetadata = {}; 
const CHUNK_SIZE = 16384; 

// Variabili Focus/Parlato
let isManualFocus = false; 
let currentSpeakerId = null; 
const AUTO_FOCUS_COOLDOWN = 3000; 
let autoFocusTimer = null; 
let audioContext = null;
let analyser = null;
let talkingInterval = null;
const AUDIO_THRESHOLD = -40; 
let isLocalTalking = false; 

// Variabile Mute Remoto
const manuallyMutedPeers = {}; 
let contextTargetPeerId = null; 

const iceConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// ---------- Helpers ----------
function log(...args){ console.log('[APP]',...args); }

function showOverlay(show){
  if(show){
    nicknameOverlay.classList.remove('hidden');
    settingsBtnOverlay.classList.remove('hidden'); // Mostra il tasto impostazioni
    document.getElementById('conference-container').classList.add('hidden');
  } else {
    nicknameOverlay.classList.add('hidden');
    settingsBtnOverlay.classList.add('hidden'); // Nascondi il tasto overlay quando sei in stanza
    document.getElementById('conference-container').classList.remove('hidden');
  }
}

function resetAndShowOverlay() {
    videosGrid.innerHTML = '';
    localFeedEl.classList.add('hidden');
    messagesContainer.innerHTML = ''; 
    document.getElementById('room-name-display').textContent = '';

    showOverlay(true);
    userNickname = 'Ospite';
    currentRoomId = null;
    
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    localStream = null;
    if (screenStream) screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
    
    toggleAudioButton.querySelector('.material-icons').textContent = 'mic';
    toggleVideoButton.querySelector('.material-icons').textContent = 'videocam';
    shareScreenButton.classList.remove('active');
    shareScreenButton.querySelector('.material-icons').textContent = 'screen_share';
    isAudioEnabled = true;
    isVideoEnabled = true;

    whiteboardContainer.classList.add('hidden');
    toggleWhiteboardButton.classList.remove('active');
    toggleWhiteboardButton.classList.remove('has-notification'); 
    if(ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    localWhiteboardHistory = []; // Reset history

    if(fileTransferContainer) fileTransferContainer.innerHTML = '';
    for(const k in dataChannels) delete dataChannels[k];

    if (isRecording) stopRecording(); 
    if (recordButton) {
        recordButton.classList.remove('active');
        recordButton.querySelector('.material-icons').textContent = 'fiber_manual_record';
        isRecording = false;
    }
    
    Object.values(peerConnections).forEach(pc => pc.close());
    for (const key in peerConnections) delete peerConnections[key];
    for (const key in remoteNicknames) delete remoteNicknames[key];
    for (const key in iceCandidateQueues) delete iceCandidateQueues[key];
    for (const key in videoSenders) delete videoSenders[key];
    for (const key in manuallyMutedPeers) delete manuallyMutedPeers[key];
    
    isManualFocus = false;
    currentSpeakerId = null;
    if (autoFocusTimer) clearTimeout(autoFocusTimer);
    autoFocusTimer = null;
    monitorLocalAudio(false); 

    const placeholder = document.createElement('div');
    placeholder.id = 'remote-video-placeholder';
    placeholder.className = 'video-placeholder';
    placeholder.textContent = 'In attesa di altri partecipanti...';
    videosGrid.insertBefore(placeholder, localFeedEl);
    
    localFeedEl.classList.remove('is-focused', 'is-talking');
    nicknameInput.value = '';
    roomIdInput.value = '';
}

async function startLocalMedia(){
  try{
    localStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
    updateLocalVideo();
    toggleAudioButton.querySelector('.material-icons').textContent = 'mic';
    toggleVideoButton.querySelector('.material-icons').textContent = 'videocam';
    localFeedEl.classList.add('ratio-4-3'); 
    localFeedEl.classList.remove('ratio-16-9'); 
    monitorLocalAudio(true); 
  }catch(err){ 
    console.error('getUserMedia error',err); 
    alert('Controlla webcam/microfono'); 
  }
}

function updateLocalVideo(){
  if(localVideoEl){
    localVideoEl.srcObject = screenStream || localStream; 
    localVideoEl.muted = true;
    localVideoEl.playsInline = true;
    localFeedEl.classList.remove('hidden'); 
  }
}

function monitorLocalAudio(start = true) {
    if (!localStream || !isAudioEnabled) {
        if (talkingInterval) { clearInterval(talkingInterval); talkingInterval = null; }
         if (isLocalTalking && socket) {
             isLocalTalking = false;
             localFeedEl.classList.remove('is-talking');
             socket.emit('audio-status-changed', currentRoomId, isLocalTalking);
         }
        return;
    }
    if (start && !talkingInterval) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.minDecibels = -90;
        analyser.maxDecibels = 0;
        analyser.smoothingTimeConstant = 0.85;
        const source = audioContext.createMediaStreamSource(localStream);
        source.connect(analyser);
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        talkingInterval = setInterval(() => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for(let i = 0; i < bufferLength; i++) sum += dataArray[i];
            const average = sum / bufferLength;
            const db = 20 * Math.log10(average / 128) + 10; 
            const currentlyTalking = db > AUDIO_THRESHOLD && isAudioEnabled;
            if (currentlyTalking !== isLocalTalking) {
                isLocalTalking = currentlyTalking;
                localFeedEl.classList.toggle('is-talking', isLocalTalking);
                if (socket) socket.emit('audio-status-changed', currentRoomId, isLocalTalking);
            }
        }, 100); 
    } else if (!start && talkingInterval) {
        clearInterval(talkingInterval);
        talkingInterval = null;
    }
}

function toggleRemoteMute(peerId) {
    const isMuted = !manuallyMutedPeers[peerId];
    manuallyMutedPeers[peerId] = isMuted;
    const feed = videosGrid.querySelector(`[data-peer-id="${peerId}"]`);
    const remoteVideo = feed ? feed.querySelector('video') : null;
    if (remoteVideo) remoteVideo.muted = isMuted;
    if(contextTargetPeerId === peerId) updateContextMenuState(peerId);
}

function updateContextMenuState(peerId) {
    const isMuted = !!manuallyMutedPeers[peerId]; 
    menuMuteUser.classList.toggle('active-toggle', isMuted);
    menuMuteUser.querySelector('.material-icons').textContent = isMuted ? 'volume_up' : 'volume_off';
    menuMuteUser.querySelector('span:last-child').textContent = isMuted ? 'Riattiva Audio' : 'Silenzia Audio';
    const nickname = remoteNicknames[peerId] || 'Utente';
    menuDmUser.querySelector('span:last-child').textContent = `Messaggio Privato a ${nickname}`;
}

function showContextMenu(peerId, x, y) {
    contextTargetPeerId = peerId;
    updateContextMenuState(peerId);
    contextMenuEl.classList.remove('hidden');
    let finalX = x;
    let finalY = y;
    const menuWidth = contextMenuEl.offsetWidth;
    const menuHeight = contextMenuEl.offsetHeight;
    if (x + menuWidth > window.innerWidth) finalX = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) finalY = window.innerHeight - menuHeight - 10;
    contextMenuEl.style.left = `${finalX}px`;
    contextMenuEl.style.top = `${finalY}px`;
}
function hideContextMenu() { contextMenuEl.classList.add('hidden'); contextTargetPeerId = null; }

function setFocus(peerId, manual=false){ 
  videosGrid.querySelectorAll('.video-feed').forEach(feed => feed.classList.remove('is-focused'));
  focusedPeerId = peerId;
  isManualFocus = manual; 
  if (manual && autoFocusTimer) { clearTimeout(autoFocusTimer); autoFocusTimer = null; }
  if (peerId === 'local') localFeedEl.classList.add('is-focused');
  else if (peerId) {
      const newFocused = videosGrid.querySelector(`[data-peer-id="${focusedPeerId}"]`);
      if(newFocused) newFocused.classList.add('is-focused');
  }
}

function toggleFocus(peerId) {
    if (focusedPeerId === peerId) {
        setFocus(null, true); 
    } else {
        setFocus(peerId, true);
    }
}

function addRemoteControlListeners(feed){
    const peerId = feed.dataset.peerId;
    const contextMenuTrigger = feed.querySelector('.context-menu-trigger'); 
    const remoteVideo = feed.querySelector('video');
    if (manuallyMutedPeers[peerId]) remoteVideo.muted = true;
    else remoteVideo.muted = false;
    
    if (contextMenuTrigger) {
        contextMenuTrigger.addEventListener('click', (e) => {
            e.preventDefault(); 
            e.stopPropagation(); 
            hideContextMenu(); 
            const rect = contextMenuTrigger.getBoundingClientRect();
            showContextMenu(peerId, rect.left, rect.bottom); 
        });
        contextMenuTrigger.addEventListener('touchstart', (e) => {
            e.stopPropagation(); 
        }, {passive: false});
    }

    feed.addEventListener('contextmenu', (e) => {
        e.preventDefault(); 
        hideContextMenu(); 
        showContextMenu(peerId, e.clientX, e.clientY);
    });

    let touchTimer = null;
    let isScrolling = false;

    feed.addEventListener('touchstart', (e) => {
        if(e.touches.length > 1) return; 
        isScrolling = false;
        touchTimer = setTimeout(() => {
            if(!isScrolling) {
                navigator.vibrate?.(50); 
                hideContextMenu();
                showContextMenu(peerId, e.touches[0].clientX, e.touches[0].clientY);
            }
        }, 600);
    }, {passive: true});

    feed.addEventListener('touchmove', () => {
        isScrolling = true; 
        clearTimeout(touchTimer);
    }, {passive: true});

    feed.addEventListener('touchend', () => clearTimeout(touchTimer));
    feed.addEventListener('touchcancel', () => clearTimeout(touchTimer));
}

function ensureRemoteFeed(socketId, nickname='Utente'){
  let feed = videosGrid.querySelector(`[data-peer-id="${socketId}"]`);
  if(feed) return feed;
  const template = document.getElementById('remote-video-template');
  const div = template.content.cloneNode(true).querySelector('.video-feed');
  div.dataset.peerId = socketId; 
  div.querySelector('.remote-nickname').textContent = nickname;
  div.querySelector('.remote-mic-status').textContent = 'mic'; 
  
  addRemoteControlListeners(div); 
  
  div.addEventListener('click', (e) => {
      if(e.defaultPrevented) return;
      toggleFocus(socketId);
  }); 
  
  const placeholder = document.getElementById('remote-video-placeholder');
  if(placeholder) placeholder.remove();
  videosGrid.insertBefore(div, localFeedEl);
  return div;
}

function removeRemoteFeed(socketId){
  const el = videosGrid.querySelector(`[data-peer-id="${socketId}"]`);
  if(el) el.remove();
  if(peerConnections[socketId]) { peerConnections[socketId].close(); delete peerConnections[socketId]; }
  if (dataChannels[socketId]) { dataChannels[socketId].close(); delete dataChannels[socketId]; }
  delete fileChunks[socketId]; delete fileMetadata[socketId];
  delete remoteNicknames[socketId]; delete iceCandidateQueues[socketId];
  delete videoSenders[socketId]; delete manuallyMutedPeers[socketId]; 
  if (currentSpeakerId === socketId) currentSpeakerId = null;
  if (autoFocusTimer) { clearTimeout(autoFocusTimer); autoFocusTimer = null; }
  if(focusedPeerId === socketId) setFocus('local', false); 
  if(videosGrid.children.length === 1 && videosGrid.querySelector('#local-feed')){
    const placeholder = document.createElement('div');
    placeholder.id = 'remote-video-placeholder';
    placeholder.className = 'video-placeholder';
    placeholder.textContent = 'In attesa di altri partecipanti...';
    videosGrid.insertBefore(placeholder, localFeedEl);
  }
}
// app.js - PARTE 2

function toggleAudio(){
  isAudioEnabled = !isAudioEnabled;
  if (localStream) localStream.getAudioTracks().forEach(track => track.enabled = isAudioEnabled);
  toggleAudioButton.querySelector('.material-icons').textContent = isAudioEnabled ? 'mic' : 'mic_off';
  localMicStatusIcon.textContent = isAudioEnabled ? 'mic' : 'mic_off'; 
  monitorLocalAudio(isAudioEnabled); 
}

function toggleVideo(){
  isVideoEnabled = !isVideoEnabled;
  if (localStream) localStream.getVideoTracks().forEach(track => track.enabled = isVideoEnabled);
  toggleVideoButton.querySelector('.material-icons').textContent = isVideoEnabled ? 'videocam' : 'videocam_off';
}

function disconnect(){
  Object.values(peerConnections).forEach(pc => pc.close());
  localStream?.getTracks().forEach(track => track.stop()); localStream = null;
  screenStream?.getTracks().forEach(track => track.stop()); screenStream = null;
  if (talkingInterval) clearInterval(talkingInterval);
  if (isRecording) stopRecording(); 
  if(socket) socket.disconnect();
  location.reload();
}

async function toggleScreenShare() {
    if( /Mobi|Android/i.test(navigator.userAgent) ) { alert("Non supportato su mobile."); return; }
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop()); screenStream = null;
        updateLocalVideo(); 
        shareScreenButton.classList.remove('active'); shareScreenButton.querySelector('.material-icons').textContent = 'screen_share';
        localFeedEl.classList.add('ratio-4-3'); localFeedEl.classList.remove('ratio-16-9'); 
        socket.emit('stream-type-changed', currentRoomId, '4-3');
        localStream.getVideoTracks().forEach(newTrack => {
             Object.values(peerConnections).forEach(pc => {
                const sender = videoSenders[Object.keys(peerConnections).find(key => peerConnections[key] === pc)];
                if (sender) sender.replaceTrack(newTrack);
             });
        });
    } else {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            if (stream) {
                screenStream = stream; updateLocalVideo();
                shareScreenButton.classList.add('active'); shareScreenButton.querySelector('.material-icons').textContent = 'stop_screen_share';
                localFeedEl.classList.add('ratio-16-9'); localFeedEl.classList.remove('ratio-4-3'); 
                socket.emit('stream-type-changed', currentRoomId, '16-9');
                stream.getVideoTracks().forEach(newTrack => {
                    Object.values(peerConnections).forEach(pc => {
                        const sender = videoSenders[Object.keys(peerConnections).find(key => peerConnections[key] === pc)];
                        if (sender) sender.replaceTrack(newTrack);
                    });
                });
                stream.getVideoTracks()[0].onended = () => toggleScreenShare();
            }
        } catch (err) { console.error('Errore condivisione schermo:', err); }
    }
}

// ** FILE TRANSFER LOGIC **
transferFileButton.addEventListener('click', () => { if(Object.keys(peerConnections).length === 0) { alert("Nessun partecipante."); return; } fileInput.click(); });
fileInput.addEventListener('change', (e) => { const file = e.target.files[0]; if (!file) return; Object.keys(dataChannels).forEach(peerId => sendFile(peerId, file)); fileInput.value = ''; });

async function sendFile(peerId, file) {
    const dc = dataChannels[peerId];
    if (!dc || dc.readyState !== 'open') { console.warn(`Channel chiuso ${peerId}`); return; }
    const toast = createProgressToast(`Inviando: ${file.name}`, true);
    const metadata = { type: 'file-metadata', name: file.name, size: file.size, fileType: file.type };
    dc.send(JSON.stringify(metadata));
    const arrayBuffer = await file.arrayBuffer();
    let offset = 0;
    while (offset < file.size) {
        const chunk = arrayBuffer.slice(offset, offset + CHUNK_SIZE);
        dc.send(chunk);
        offset += chunk.byteLength;
        const percent = Math.min(100, Math.round((offset / file.size) * 100));
        updateProgressToast(toast, percent);
        if (dc.bufferedAmount > 16000000) await new Promise(resolve => setTimeout(resolve, 100));
    }
    setTimeout(() => toast.remove(), 2000);
}

function handleDataChannelMessage(peerId, event) {
    const data = event.data;
    if (typeof data === 'string') {
        try {
            const msg = JSON.parse(data);
            if (msg.type === 'file-metadata') {
                fileMetadata[peerId] = { name: msg.name, size: msg.size, type: msg.fileType, received: 0 };
                fileChunks[peerId] = [];
                fileMetadata[peerId].toast = createProgressToast(`Ricevendo: ${msg.name}`, false);
            }
        } catch (e) {}
        return;
    }
    if (fileMetadata[peerId]) {
        fileChunks[peerId].push(data);
        fileMetadata[peerId].received += data.byteLength;
        const meta = fileMetadata[peerId];
        const percent = Math.min(100, Math.round((meta.received / meta.size) * 100));
        updateProgressToast(meta.toast, percent);
        if (meta.received >= meta.size) saveReceivedFile(peerId);
    }
}

function saveReceivedFile(peerId) {
    const meta = fileMetadata[peerId];
    const blob = new Blob(fileChunks[peerId], { type: meta.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = meta.name; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a); window.URL.revokeObjectURL(url);
        meta.toast.querySelector('.file-name').textContent = `Completato: ${meta.name}`;
        setTimeout(() => meta.toast.remove(), 3000);
        delete fileChunks[peerId]; delete fileMetadata[peerId];
    }, 100);
}

function createProgressToast(title, isSending) {
    if (!fileTransferContainer) return null;
    const div = document.createElement('div');
    div.className = 'file-toast';
    div.innerHTML = `<div class="file-info"><span class="file-name">${title}</span><span class="file-percent">0%</span></div><div class="progress-bar-bg"><div class="progress-bar-fill"></div></div>`;
    fileTransferContainer.appendChild(div);
    return div;
}
function updateProgressToast(el, percent) { if(!el) return; el.querySelector('.progress-bar-fill').style.width = `${percent}%`; el.querySelector('.file-percent').textContent = `${percent}%`; }


// ** WHITEBOARD LOGIC **
function initWhiteboard() {
    if(ctx) return; 
    ctx = canvas.getContext('2d'); 
    resizeCanvas();
    
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resizeCanvas, 100);
    });
    
    canvas.addEventListener('mousedown', onMouseDown); 
    canvas.addEventListener('mousemove', throttle(onMouseMove, 10));
    canvas.addEventListener('mouseup', onMouseUp); 
    canvas.addEventListener('mouseout', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, {passive: false});
    canvas.addEventListener('touchmove', throttle(onTouchMove, 10), {passive: false});
    canvas.addEventListener('touchend', onMouseUp);
}

function resizeCanvas() { 
    canvas.width = canvas.offsetWidth || window.innerWidth; 
    canvas.height = canvas.offsetHeight || window.innerHeight;
    if(localWhiteboardHistory.length > 0) {
        localWhiteboardHistory.forEach(data => drawRemote(data, false));
    }
}

function onMouseDown(e) { isDrawing = true; currentX = e.offsetX; currentY = e.offsetY; }
function onMouseMove(e) { if (!isDrawing) return; draw(currentX, currentY, e.offsetX, e.offsetY, currentColor, true); currentX = e.offsetX; currentY = e.offsetY; }
function onMouseUp(e) { isDrawing = false; }
function onTouchStart(e) { if(e.touches.length == 1){ e.preventDefault(); const rect = canvas.getBoundingClientRect(); currentX = e.touches[0].clientX - rect.left; currentY = e.touches[0].clientY - rect.top; isDrawing = true; } }
function onTouchMove(e) { if (!isDrawing) return; e.preventDefault(); const rect = canvas.getBoundingClientRect(); const newX = e.touches[0].clientX - rect.left; const newY = e.touches[0].clientY - rect.top; draw(currentX, currentY, newX, newY, currentColor, true); currentX = newX; currentY = newY; }

function draw(x0, y0, x1, y1, color, emit){
    if(!ctx) initWhiteboard(); 
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke(); ctx.closePath();
    
    const drawData = { 
        x0: x0 / (canvas.width||window.innerWidth), 
        y0: y0 / (canvas.height||window.innerHeight), 
        x1: x1 / (canvas.width||window.innerWidth), 
        y1: y1 / (canvas.height||window.innerHeight), 
        color: color 
    };

    if (emit && socket && currentRoomId) {
        socket.emit('wb-draw', currentRoomId, drawData);
        localWhiteboardHistory.push(drawData); 
    }
}

function drawRemote(data, saveToHistory = true){
    if(!ctx) initWhiteboard();
    const w = canvas.width || window.innerWidth; 
    const h = canvas.height || window.innerHeight;
    
    ctx.beginPath(); 
    ctx.moveTo(data.x0 * w, data.y0 * h); 
    ctx.lineTo(data.x1 * w, data.y1 * h);
    ctx.strokeStyle = data.color; 
    ctx.lineWidth = 2; 
    ctx.lineCap = 'round'; 
    ctx.stroke(); 
    ctx.closePath();

    if(saveToHistory) localWhiteboardHistory.push(data);
}

function throttle(callback, delay) { let previousCall = new Date().getTime(); return function() { const time = new Date().getTime(); if ((time - previousCall) >= delay) { previousCall = time; callback.apply(null, arguments); } }; }

toggleWhiteboardButton.addEventListener('click', () => {
    const isHidden = whiteboardContainer.classList.contains('hidden');
    if (isHidden) { whiteboardContainer.classList.remove('hidden'); toggleWhiteboardButton.classList.add('active'); toggleWhiteboardButton.classList.remove('has-notification'); initWhiteboard(); resizeCanvas(); if(socket && currentRoomId) socket.emit('wb-request-history', currentRoomId); }
    else { whiteboardContainer.classList.add('hidden'); toggleWhiteboardButton.classList.remove('active'); }
});
wbCloseBtn.addEventListener('click', () => { whiteboardContainer.classList.add('hidden'); toggleWhiteboardButton.classList.remove('active'); });

wbClearBtn.addEventListener('click', () => { 
    if(confirm("Cancellare lavagna?")){ 
        ctx.clearRect(0, 0, canvas.width, canvas.height); 
        localWhiteboardHistory = [];
        if(socket && currentRoomId) socket.emit('wb-clear', currentRoomId); 
    } 
});

wbUndoBtn.addEventListener('click', () => { if(socket && currentRoomId) socket.emit('wb-undo', currentRoomId); });
wbColors.forEach(btn => { btn.addEventListener('click', (e) => { wbColors.forEach(b => b.classList.remove('active')); e.target.classList.add('active'); currentColor = e.target.dataset.color; }); });

// ** RECORDING **
function stopRecording() { if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); }
function saveRecording() { isRecording = false; recordButton.classList.remove('active'); if (recordedChunks.length === 0) return; const blob = new Blob(recordedChunks, { type: 'video/webm' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'rec.webm'; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a); }
function startRecording() {
    if (!window.MediaRecorder) {
        alert('Il tuo browser non supporta la registrazione.');
        return;
    }

    let streamToRecord = null;
    if (focusedPeerId === 'local') {
        streamToRecord = (localVideoEl.srcObject || localStream);
    } else {
        const remoteVideo = videosGrid.querySelector(`[data-peer-id="${focusedPeerId}"] video`);
        if (remoteVideo) streamToRecord = remoteVideo.srcObject;
    }

    if (!streamToRecord) {
        alert("Nessun flusso video attivo da registrare.");
        return;
    }

    const mimeTypes = [
        'video/webm; codecs=vp9',
        'video/webm; codecs=vp8',
        'video/webm; codecs=h264',
        'video/webm',
        'video/mp4' 
    ];

    let selectedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));

    if (!selectedMimeType) {
        alert("Nessun codec supportato trovato per la registrazione su questo dispositivo.");
        return;
    }

    recordedChunks = [];
    try {
        mediaRecorder = new MediaRecorder(streamToRecord, { mimeType: selectedMimeType });
        
        mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };
        
        mediaRecorder.onstop = saveRecording;
        
        mediaRecorder.start(1000); 
        isRecording = true;
        recordButton.classList.add('active');
        console.log(`Registrazione avviata con codec: ${selectedMimeType}`);

    } catch (e) {
        console.error("Errore avvio registrazione:", e);
        alert("Errore durante l'avvio della registrazione: " + e.message);
        isRecording = false;
        recordButton.classList.remove('active');
    }
}

// ** IMPOSTAZIONI UI LOGIC **
function openSettings() { settingsModal.classList.remove('hidden'); }
function closeSettings() { settingsModal.classList.add('hidden'); }

settingsBtnOverlay.addEventListener('click', openSettings);
settingsBtnRoom.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', closeSettings);

// Cambio Tema
themeToggle.addEventListener('change', (e) => {
    if(e.target.checked) {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
});

// ** ADMIN PANEL UI **
// La logica "openAdminLoginBtn" è stata spostata dentro settings, quindi:
// 1. Apri settings -> 2. Clicca "Admin Login" -> Chiude settings, apre Admin Panel
openAdminLoginBtn.addEventListener('click', () => { 
    closeSettings(); // Chiudi modale impostazioni
    adminPanel.classList.remove('hidden'); // Apri modale admin
});

closeAdminBtn.addEventListener('click', () => { adminPanel.classList.add('hidden'); });
adminLoginBtn.addEventListener('click', () => { const pwd = adminPasswordInput.value; if(!socket) initializeSocket(); socket.emit('admin-login', pwd); });
adminRefreshBtn.addEventListener('click', () => { if(socket) socket.emit('admin-refresh'); });

// ** RENDER DASHBOARD ADMIN AGGIORNATO **
function renderAdminDashboard(data) {
    adminTotalUsers.textContent = data.totalUsers;
    adminBannedCount.textContent = data.bannedCount || 0;
    
    const list = adminRoomsList;
    list.innerHTML = '';
    
    if (Object.keys(data.rooms).length === 0) { 
        list.innerHTML = '<p style="color:var(--muted); text-align:center;">Nessuna stanza attiva.</p>'; 
        return; 
    }

    // Iteriamo le stanze
    for (const [roomId, users] of Object.entries(data.rooms)) {
        const config = data.configs[roomId] || { isLocked: false, password: "" }; // Leggi config
        
        const roomCard = document.createElement('div'); 
        roomCard.className = 'admin-room-card';
        
        // Header Stanza
        const header = document.createElement('div'); 
        header.className = 'room-header';
        
        // Icone stato stanza
        let statusIcons = '';
        if (config.isLocked) statusIcons += '🔒 ';
        if (config.password) statusIcons += '🔑 ';

        header.innerHTML = `<span class="room-name">${statusIcons}${roomId}</span>`;
        
        // Container Controlli Stanza
        const controlsDiv = document.createElement('div');
        controlsDiv.style.display = 'flex';
        controlsDiv.style.gap = '5px';

        // 1. Tasto Lock/Unlock
        const lockBtn = document.createElement('button');
        lockBtn.className = `btn-admin-action btn-lock ${config.isLocked ? 'locked' : ''}`;
        lockBtn.innerHTML = `<span class="material-icons" style="font-size:1.2em;">${config.isLocked ? 'lock' : 'lock_open'}</span>`;
        lockBtn.title = config.isLocked ? "Sblocca Stanza" : "Blocca Stanza";
        lockBtn.onclick = () => socket.emit('admin-toggle-lock', roomId);

        // 2. Tasto Password
        const passBtn = document.createElement('button');
        passBtn.className = 'btn-admin-action btn-pass';
        passBtn.innerHTML = '<span class="material-icons" style="font-size:1.2em;">vpn_key</span>';
        passBtn.title = config.password ? `Cambia Pass (Attuale: ${config.password})` : "Imposta Password";
        passBtn.onclick = () => {
            const newPass = prompt("Imposta password stanza (lascia vuoto per rimuovere):", config.password);
            if (newPass !== null) socket.emit('admin-set-password', roomId, newPass);
        };

        // 3. Tasto Chiudi Stanza
        const closeBtn = document.createElement('button'); 
        closeBtn.className = 'btn-close-room'; 
        closeBtn.textContent = 'Chiudi';
        closeBtn.onclick = () => { if(confirm('Chiudere stanza e disconnettere tutti?')) socket.emit('admin-close-room', roomId); };

        controlsDiv.appendChild(lockBtn);
        controlsDiv.appendChild(passBtn);
        controlsDiv.appendChild(closeBtn);
        header.appendChild(controlsDiv);
        
        roomCard.appendChild(header);

        // Lista Utenti con BAN
        const userList = document.createElement('ul'); 
        userList.className = 'admin-user-list';
        for (const [socketId, nickname] of Object.entries(users)) {
            const li = document.createElement('li'); 
            li.className = 'admin-user-item';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = nickname;
            
            const actionsSpan = document.createElement('div');
            
            // Tasto Kick
            const kickBtn = document.createElement('button'); 
            kickBtn.className = 'btn-kick'; 
            kickBtn.textContent = 'Kick';
            kickBtn.onclick = () => { if(confirm(`Kick ${nickname}?`)) socket.emit('admin-kick-user', socketId); };
            
            // Tasto BAN IP
            const banBtn = document.createElement('button'); 
            banBtn.className = 'btn-admin-action btn-ban'; 
            banBtn.textContent = 'BAN IP';
            banBtn.title = "Banna IP Permanentemente";
            banBtn.onclick = () => { if(confirm(`ATTENZIONE: Bannare l'IP di ${nickname}? Non potrà più rientrare.`)) socket.emit('admin-ban-ip', socketId); };

            actionsSpan.appendChild(kickBtn);
            actionsSpan.appendChild(banBtn);
            
            li.appendChild(nameSpan);
            li.appendChild(actionsSpan);
            userList.appendChild(li);
        }
        roomCard.appendChild(userList); 
        list.appendChild(roomCard);
    }
}

// ** UTILS & CHAT **
function getRoomIdFromUrl(){ const urlParams = new URLSearchParams(window.location.search); return urlParams.get('room'); }
function copyRoomLink(){ 
    // Costruiamo l'URL base con la stanza
    let url = `${window.location.protocol}//${window.location.host}${window.location.pathname}?room=${encodeURIComponent(currentRoomId)}`;
    
    // Se c'è una password, la aggiungiamo all'URL
    if (currentRoomPassword) {
        url += `&pass=${encodeURIComponent(currentRoomPassword)}`;
    }

    navigator.clipboard.writeText(url).then(() => { 
        const originalText = shareRoomLinkButton.querySelector('.material-icons').textContent; // O il testo se non usi icone
        shareRoomLinkButton.classList.add('active'); // Feedback visivo opzionale
        
        // Mostra feedback "Copiato!"
        // Nota: nel tuo codice originale modificavi .value, ma il bottone contiene un'icona span. 
        // Meglio usare un tooltip o un alert temporaneo, ma qui adattiamo la logica esistente:
        alert("Link copiato negli appunti! " + (currentRoomPassword ? "(Include la password)" : ""));
    }).catch(err => {
        console.error('Errore copia:', err);
    }); 
}
function addChatMessage(sender, message, isLocal=false, type='public'){ const messageEl = document.createElement('div'); messageEl.classList.add('chat-message'); let cssClass; let senderText = sender; if (type === 'system') { cssClass = 'sender-system'; senderText = 'Sistema'; } else if (type === 'private') { cssClass = 'sender-private'; } else { cssClass = isLocal ? 'sender-me' : 'sender-remote'; } const prefix = isLocal ? `Tu${type === 'private' ? ` (DM a ${sender})` : ''}: ` : `${senderText}: `; messageEl.innerHTML = `<span class="${cssClass}">${prefix}</span>${message}`; messagesContainer.appendChild(messageEl); messagesContainer.scrollTop = messagesContainer.scrollHeight; }
function clearChatInput(){ chatMessageInput.value = ''; }
function sendMessage(){ const fullMessage = chatMessageInput.value.trim(); if (!fullMessage) return; const parts = fullMessage.split(' '); if (parts[0].toLowerCase() === '/dm' && parts.length >= 3) { const recipientNickname = parts[1]; const messageContent = parts.slice(2).join(' '); if (recipientNickname.toLowerCase() === userNickname.toLowerCase()) { addChatMessage('Sistema', 'No DM a te stesso.', true, 'system'); clearChatInput(); return; } const recipientId = Object.keys(remoteNicknames).find(key => remoteNicknames[key] && remoteNicknames[key].toLowerCase() === recipientNickname.toLowerCase()); if (recipientId) { sendPrivateMessage(recipientId, recipientNickname, messageContent); clearChatInput(); } else { addChatMessage('Sistema', `Utente "${recipientNickname}" non trovato.`, true, 'system'); } return; } if (socket && currentRoomId) { socket.emit('send-message', currentRoomId, userNickname, fullMessage); addChatMessage(userNickname, fullMessage, true, 'public'); clearChatInput(); } }
function sendPrivateMessage(recipientId, recipientNickname, message) { if (!message || !recipientId) return; if (socket && currentRoomId) { socket.emit('send-private-message', currentRoomId, recipientId, userNickname, message); addChatMessage(recipientNickname, message, true, 'private'); } }
function openChatPanelMobile(callback) { if (chatPanel.classList.contains('active') && !chatPanel.classList.contains('hidden')) { if (callback) callback(); return; } chatPanel.classList.remove('hidden'); setTimeout(() => { chatPanel.classList.add('active'); let closeBtn = document.getElementById('close-chat-btn'); if (!closeBtn) { closeBtn = document.createElement('button'); closeBtn.textContent = '← Torna alle webcam'; closeBtn.id = 'close-chat-btn'; closeBtn.style.cssText = `position: relative; width: calc(100% - 20px); padding: 10px; margin: 10px; border: none; background: var(--primary-color); color: #fff; font-weight: bold; cursor: pointer; border-radius: 6px;`; const chatHeader = chatPanel.querySelector('h3'); if(chatHeader) chatPanel.insertBefore(closeBtn, chatHeader); closeBtn.addEventListener('click', () => { chatPanel.classList.remove('active'); setTimeout(() => { chatPanel.classList.add('hidden'); closeBtn.remove(); }, 300); }); } setTimeout(callback, 350); }, 10); }

// ** SOCKET IO **
function initializeSocket(){
  if(socket) return; 
  socket = io(RENDER_SERVER_URL);
  socket.on('error-message', (msg) => {
      alert("ERRORE: " + msg);
      resetAndShowOverlay(); // Torna alla home
      if(socket) socket.disconnect();
      socket = null;
  });
  socket.on('kicked-by-admin', (msg) => {
      alert(msg); // Messaggio personalizzato (es. "Sei bannato")
      location.reload();
  });

  // ** ADMIN EVENTS **
  socket.on('admin-log', (msg) => {
      const div = document.createElement('div');
      div.className = 'log-entry';
      div.textContent = msg;
      adminLogsConsole.appendChild(div);
      adminLogsConsole.scrollTop = adminLogsConsole.scrollHeight;
  });

  socket.on('admin-data-update', (data) => { renderAdminDashboard(data); });
  socket.on('connect', ()=> log('Connesso', socket.id));

  socket.on('nickname-in-use', (msg) => { alert(msg); resetAndShowOverlay(); if (socket) socket.disconnect(); socket = null; });
  socket.on('welcome', (newPeerId, nickname, peers=[])=>{ remoteNicknames[newPeerId] = nickname; addChatMessage(userNickname, `Benvenuto in ${currentRoomId}!`, false, 'system'); peers.forEach(peer=>{ if(peer.id !== socket.id) { remoteNicknames[peer.id] = peer.nickname; createPeerConnection(peer.id); } }); setFocus('local', false); });
  
  // Whiteboard events
  socket.on('wb-draw', (data) => { if (whiteboardContainer.classList.contains('hidden')) toggleWhiteboardButton.classList.add('has-notification'); drawRemote(data); });
  socket.on('wb-clear', () => { if(ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); localWhiteboardHistory = []; });
  socket.on('wb-history', (history) => { 
      if(!ctx) initWhiteboard(); 
      ctx.clearRect(0, 0, canvas.width, canvas.height); 
      localWhiteboardHistory = []; 
      history.forEach(item => drawRemote(item)); 
      if (whiteboardContainer.classList.contains('hidden') && history.length > 0) toggleWhiteboardButton.classList.add('has-notification'); 
  });

  // Standard events
  socket.on('peer-joined', (peerId,nickname)=>{ remoteNicknames[peerId] = nickname; createPeerConnection(peerId); addChatMessage('Sistema', `${nickname} entrato.`, false, 'system'); });
  socket.on('peer-left', (peerId)=>{ removeRemoteFeed(peerId); addChatMessage('Sistema', `Utente uscito.`, false, 'system'); });
  socket.on('new-message', (s, m)=>{ addChatMessage(s, m, false, 'public'); });
  socket.on('new-private-message', (s, m) => { addChatMessage(`Privato da ${s}`, m, false, 'private'); });
  socket.on('audio-status-changed', (pid, talk) => { const f = videosGrid.querySelector(`[data-peer-id="${pid}"]`); if(f) { f.classList.toggle('is-talking', talk); f.querySelector('.remote-mic-status').textContent = talk ? 'mic' : 'mic_off'; } });
  socket.on('remote-stream-type-changed', (pid, ratio) => { const f = videosGrid.querySelector(`[data-peer-id="${pid}"]`); if(f){ f.classList.remove('ratio-4-3', 'ratio-16-9'); f.classList.add(`ratio-${ratio}`); } });
  
  // WebRTC Signaling
  socket.on('offer', async (fid, o)=>{ const pc = createPeerConnection(fid); if(pc.signalingState !== 'stable') return; await pc.setRemoteDescription(new RTCSessionDescription(o)); if (iceCandidateQueues[fid]) { iceCandidateQueues[fid].forEach(c => pc.addIceCandidate(new RTCIceCandidate(c))); iceCandidateQueues[fid] = []; } const a = await pc.createAnswer(); await pc.setLocalDescription(a); socket.emit('answer', fid, pc.localDescription); });
  socket.on('answer', async (fid, a)=>{ const pc = peerConnections[fid]; if(pc && pc.signalingState === 'have-local-offer') { await pc.setRemoteDescription(new RTCSessionDescription(a)); if (iceCandidateQueues[fid]) { iceCandidateQueues[fid].forEach(c => pc.addIceCandidate(new RTCIceCandidate(c))); iceCandidateQueues[fid] = []; } } });
  socket.on('candidate', async (fid, c)=>{ const pc = peerConnections[fid]; if(pc && c) { if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(c)); else { if (!iceCandidateQueues[fid]) iceCandidateQueues[fid] = []; iceCandidateQueues[fid].push(c); } } });

  // Admin events
  socket.on('admin-login-success', () => { adminLoginView.classList.add('hidden'); adminDashboardView.classList.remove('hidden'); adminMsg.textContent = ''; });
  socket.on('admin-login-fail', () => { adminMsg.textContent = 'Password errata.'; });
  socket.on('admin-data-update', (data) => { renderAdminDashboard(data); });
  socket.on('kicked-by-admin', () => { alert("Sei stato espulso."); location.reload(); });
  socket.on('room-closed-by-admin', () => { alert("Stanza chiusa."); location.reload(); });
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const passParam = params.get('pass');

    // Se c'è il parametro ?room=... nell'URL
    if (roomParam) {
        roomIdInput.value = roomParam;
        // Disabilita o rendi readonly l'input se vuoi che non lo cambino, oppure lascialo modificabile
        // roomIdInput.readOnly = true; 
    }

    // Se c'è il parametro &pass=... nell'URL
    if (passParam) {
        roomPasswordInput.value = passParam;
    }

    // Se abbiamo la stanza, spostiamo il focus direttamente sul Nickname per velocizzare
    if (roomParam) {
        nicknameInput.focus();
    }
});

function createPeerConnection(socketId){
  if(peerConnections[socketId]) return peerConnections[socketId];
  const pc = new RTCPeerConnection(iceConfiguration);
  peerConnections[socketId] = pc;
  iceCandidateQueues[socketId] = []; 
  if(localStream) { localStream.getTracks().forEach(track => { const sender = pc.addTrack(track, localStream); if(track.kind === 'video') videoSenders[socketId] = sender; }); }
  
  // Data Channel logic
  const shouldCreateOffer = (socket.id < socketId); 
  if (shouldCreateOffer) { const dc = pc.createDataChannel("fileTransfer"); setupDataChannel(dc, socketId); } 
  else { pc.ondatachannel = (event) => { setupDataChannel(event.channel, socketId); }; }

  pc.onicecandidate = event=>{ if(event.candidate) socket.emit('candidate', socketId, event.candidate); };
  pc.ontrack = event=>{ const feed = ensureRemoteFeed(socketId, remoteNicknames[socketId]); const video = feed.querySelector('video'); if(video && event.streams.length > 0) { video.srcObject = event.streams[0]; if (manuallyMutedPeers[socketId]) video.muted = true; } };
  pc.onnegotiationneeded = async ()=>{ if(shouldCreateOffer && pc.signalingState === 'stable'){ try{ const offer = await pc.createOffer(); await pc.setLocalDescription(offer); socket.emit('offer', socketId, pc.localDescription); }catch(err){ console.error('Offer err', err); } } };
  return pc;
}

function setupDataChannel(dc, peerId) { dc.onopen = () => { dataChannels[peerId] = dc; }; dc.onclose = () => { delete dataChannels[peerId]; }; dc.onmessage = (event) => handleDataChannelMessage(peerId, event); }

// Listeners UI
joinButton.addEventListener('click', async ()=>{
  const nickname = nicknameInput.value.trim();
  const roomId = roomIdInput.value.trim();
  const password = document.getElementById('room-password-input').value.trim();

  if(!nickname || !roomId){ alert('Dati mancanti'); return; }
  
  userNickname = nickname; 
  currentRoomId = roomId;
  currentRoomPassword = password; // <--- SALVIAMO LA PASSWORD QUI
  
  await startLocalMedia(); 
  initializeSocket();
  
  // INVIAMO ANCHE LA PASSWORD
  socket.emit('join-room', currentRoomId, userNickname, password); 
  
  document.getElementById('room-name-display').textContent = roomId;
  showOverlay(false); 
  setFocus('local', false);
});

localFeedEl.addEventListener('click', () => {
    toggleFocus('local');
});

toggleAudioButton.addEventListener('click', toggleAudio); toggleVideoButton.addEventListener('click', toggleVideo); disconnectButton.addEventListener('click', disconnect); shareScreenButton.addEventListener('click', toggleScreenShare); shareRoomLinkButton.addEventListener('click', copyRoomLink); if (recordButton) recordButton.addEventListener('click', () => { if (isRecording) stopRecording(); else startRecording(); }); showChatBtn.addEventListener('click', () => { if(window.innerWidth <= 768){ openChatPanelMobile(); } else { chatPanel.classList.toggle('hidden'); } }); sendChatButton.addEventListener('click', sendMessage); chatMessageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); }); document.addEventListener('click', (e) => { if (!contextMenuEl.classList.contains('hidden') && !contextMenuEl.contains(e.target) && !e.target.closest('.video-feed')) { hideContextMenu(); } }); document.addEventListener('contextmenu', (e) => { if (contextMenuEl && !e.target.closest('.video-feed') && !contextMenuEl.contains(e.target)) { hideContextMenu(); } }); menuMuteUser.addEventListener('click', () => { if (contextTargetPeerId) { toggleRemoteMute(contextTargetPeerId); hideContextMenu(); } }); menuDmUser.addEventListener('click', () => { if (contextTargetPeerId) { if (contextTargetPeerId === socket.id) { hideContextMenu(); addChatMessage('Sistema', 'No DM a te stesso.', true, 'system'); return; } const nickname = remoteNicknames[contextTargetPeerId] || 'Utente'; hideContextMenu(); const focusAndSetDM = () => { chatMessageInput.value = `/dm ${nickname} `; chatMessageInput.focus(); if(window.innerWidth <= 768) { setTimeout(() => { chatMessageInput.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, 50); } }; if (window.innerWidth <= 768) openChatPanelMobile(focusAndSetDM); else focusAndSetDM(); } });