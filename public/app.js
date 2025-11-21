// app.js

const RENDER_SERVER_URL = "https://videocall-webrtc-signaling-server.onrender.com"; 
//const RENDER_SERVER_URL = "http://localhost:3000";

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

let socket = null;
let localStream = null;
let userNickname = 'Ospite';
let currentRoomId = null;
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
// **************************

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
    document.getElementById('conference-container').classList.add('hidden');
  } else {
    nicknameOverlay.classList.add('hidden');
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

    // Reset whiteboard
    whiteboardContainer.classList.add('hidden');
    toggleWhiteboardButton.classList.remove('active');
    toggleWhiteboardButton.classList.remove('has-notification'); // Rimuovi notifica
    if(ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

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
        if (talkingInterval) {
            clearInterval(talkingInterval);
            talkingInterval = null;
        }
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
            for(let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
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

// --- LOGICA MUTE/DM REMOTO (Aggiornata senza icona video) ---
function toggleRemoteMute(peerId) {
    const isMuted = !manuallyMutedPeers[peerId];
    manuallyMutedPeers[peerId] = isMuted;

    const feed = videosGrid.querySelector(`[data-peer-id="${peerId}"]`);
    const remoteVideo = feed ? feed.querySelector('video') : null;
    
    // Muta effettivamente l'elemento video
    if (remoteVideo) remoteVideo.muted = isMuted;

    // Aggiorna lo stato del menu contestuale se aperto per questo utente
    if(contextTargetPeerId === peerId) {
        updateContextMenuState(peerId);
    }
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

function hideContextMenu() {
    contextMenuEl.classList.add('hidden');
    contextTargetPeerId = null;
}

function setFocus(peerId, manual=false){ 
  videosGrid.querySelectorAll('.video-feed').forEach(feed => feed.classList.remove('is-focused'));
  focusedPeerId = peerId;
  isManualFocus = manual; 
  
  if (manual && autoFocusTimer) {
      clearTimeout(autoFocusTimer);
      autoFocusTimer = null;
  }
  
  if (peerId === 'local') {
      localFeedEl.classList.add('is-focused');
  } else {
      const newFocused = videosGrid.querySelector(`[data-peer-id="${focusedPeerId}"]`);
      if(newFocused) newFocused.classList.add('is-focused');
  }
}

function addRemoteControlListeners(feed){
    const peerId = feed.dataset.peerId;
    // Rimosso riferimento a remote-mute-toggle
    const contextMenuTrigger = feed.querySelector('.context-menu-trigger'); 
    const remoteVideo = feed.querySelector('video');

    // Rimosso listener click su remoteMuteButton
    
    if (manuallyMutedPeers[peerId]) {
        remoteVideo.muted = true;
    } else {
        remoteVideo.muted = false;
    }
    
    if (contextMenuTrigger) {
        contextMenuTrigger.addEventListener('click', (e) => {
            e.preventDefault(); 
            e.stopPropagation(); 
            hideContextMenu(); 
            const rect = contextMenuTrigger.getBoundingClientRect();
            showContextMenu(peerId, rect.left, rect.bottom); 
        });
    }

    feed.addEventListener('contextmenu', (e) => {
        e.preventDefault(); 
        hideContextMenu(); 
        showContextMenu(peerId, e.clientX, e.clientY);
    });

    let touchTimeout;
    feed.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1 && !e.target.closest('.context-menu-trigger')) { 
            e.preventDefault(); 
            touchTimeout = setTimeout(() => {
                hideContextMenu();
                showContextMenu(peerId, e.touches[0].clientX, e.touches[0].clientY);
            }, 700); 
        }
    });

    feed.addEventListener('touchend', () => {
        clearTimeout(touchTimeout);
    });
    feed.addEventListener('touchcancel', () => {
        clearTimeout(touchTimeout);
    });
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
  div.addEventListener('click', ()=> setFocus(socketId, true)); 

  const placeholder = document.getElementById('remote-video-placeholder');
  if(placeholder) placeholder.remove();

  videosGrid.insertBefore(div, localFeedEl);
  return div;
}

function removeRemoteFeed(socketId){
  const el = videosGrid.querySelector(`[data-peer-id="${socketId}"]`);
  if(el) el.remove();
  
  if(peerConnections[socketId]) { peerConnections[socketId].close(); delete peerConnections[socketId]; }
  delete remoteNicknames[socketId];
  delete iceCandidateQueues[socketId];
  delete videoSenders[socketId]; 
  delete manuallyMutedPeers[socketId]; 

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

// ---------- Media Controls ----------
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
  localStream?.getTracks().forEach(track => track.stop());
  localStream = null;
  screenStream?.getTracks().forEach(track => track.stop()); 
  screenStream = null;
  if (talkingInterval) clearInterval(talkingInterval);
  if (isRecording) stopRecording(); 
  if(socket) socket.disconnect();
  location.reload();
}

async function toggleScreenShare() {
    if( /Mobi|Android/i.test(navigator.userAgent) ) {
        alert("La condivisione dello schermo non è supportata sulla maggior parte dei dispositivi mobili.");
        return;
    }
    
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
        updateLocalVideo(); 

        shareScreenButton.classList.remove('active');
        shareScreenButton.querySelector('.material-icons').textContent = 'screen_share';
        localFeedEl.classList.add('ratio-4-3'); 
        localFeedEl.classList.remove('ratio-16-9'); 
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
                screenStream = stream;
                updateLocalVideo();

                shareScreenButton.classList.add('active');
                shareScreenButton.querySelector('.material-icons').textContent = 'stop_screen_share';
                localFeedEl.classList.add('ratio-16-9'); 
                localFeedEl.classList.remove('ratio-4-3'); 
                socket.emit('stream-type-changed', currentRoomId, '16-9');

                stream.getVideoTracks().forEach(newTrack => {
                    Object.values(peerConnections).forEach(pc => {
                        const sender = videoSenders[Object.keys(peerConnections).find(key => peerConnections[key] === pc)];
                        if (sender) sender.replaceTrack(newTrack);
                    });
                });
                stream.getVideoTracks()[0].onended = () => toggleScreenShare();
            }
        } catch (err) {
            console.error('Errore durante la condivisione schermo:', err);
        }
    }
}

// *************************************************
// ************* INIZIO LOGICA WHITEBOARD **********
// *************************************************

function initWhiteboard() {
    if(ctx) return; // Inizializza solo una volta
    ctx = canvas.getContext('2d');
    resizeCanvas();
    
    window.addEventListener('resize', resizeCanvas);

    // Listener Mouse
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', throttle(onMouseMove, 10));
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseout', onMouseUp);

    // Listener Touch
    canvas.addEventListener('touchstart', onTouchStart, {passive: false});
    canvas.addEventListener('touchmove', throttle(onTouchMove, 10), {passive: false});
    canvas.addEventListener('touchend', onMouseUp);
}

function resizeCanvas() {
    // *** FIX CRUCIALE: Gestione dimensioni quando nascosto ***
    // Se il container è hidden, offsetWidth è 0. Usiamo window.innerWidth come fallback
    // dato che la whiteboard è fullscreen (inset: 0).
    canvas.width = canvas.offsetWidth || window.innerWidth;
    canvas.height = canvas.offsetHeight || window.innerHeight;
}

// Eventi Disegno Locale
function onMouseDown(e) {
    isDrawing = true;
    currentX = e.offsetX;
    currentY = e.offsetY;
}

function onMouseMove(e) {
    if (!isDrawing) return;
    draw(currentX, currentY, e.offsetX, e.offsetY, currentColor, true);
    currentX = e.offsetX;
    currentY = e.offsetY;
}

function onMouseUp(e) {
    isDrawing = false;
}

// Adattamento Touch
function onTouchStart(e) {
    if(e.touches.length == 1){
        e.preventDefault(); 
        const rect = canvas.getBoundingClientRect();
        currentX = e.touches[0].clientX - rect.left;
        currentY = e.touches[0].clientY - rect.top;
        isDrawing = true;
    }
}

function onTouchMove(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const newX = e.touches[0].clientX - rect.left;
    const newY = e.touches[0].clientY - rect.top;
    
    draw(currentX, currentY, newX, newY, currentColor, true);
    currentX = newX;
    currentY = newY;
}

// Funzione Disegno (Core)
function draw(x0, y0, x1, y1, color, emit){
    if(!ctx) initWhiteboard(); // Assicura che il contesto esista
    
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.closePath();

    if (!emit) return;

    // Normalizza le coordinate (0-1)
    // Usiamo width/height attuali o fallback a window
    const w = canvas.width || window.innerWidth;
    const h = canvas.height || window.innerHeight;

    if(socket && currentRoomId){
        socket.emit('wb-draw', currentRoomId, {
            x0: x0 / w,
            y0: y0 / h,
            x1: x1 / w,
            y1: y1 / h,
            color: color
        });
    }
}

// Funzione per disegnare dati remoti (denormalizzati)
function drawRemote(data){
    if(!ctx) initWhiteboard();

    // Ricalcola width/height in caso di resize
    const w = canvas.width || window.innerWidth;
    const h = canvas.height || window.innerHeight;
    
    // Disegna usando le percentuali relative alle dimensioni attuali del client
    draw(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color, false);
}

function throttle(callback, delay) {
    let previousCall = new Date().getTime();
    return function() {
        const time = new Date().getTime();
        if ((time - previousCall) >= delay) {
            previousCall = time;
            callback.apply(null, arguments);
        }
    };
}

// Toggle Whiteboard
toggleWhiteboardButton.addEventListener('click', () => {
    const isHidden = whiteboardContainer.classList.contains('hidden');
    
    if (isHidden) {
        // 1. Mostra la lavagna
        whiteboardContainer.classList.remove('hidden');
        toggleWhiteboardButton.classList.add('active');
        toggleWhiteboardButton.classList.remove('has-notification'); // Rimuovi pallino rosso
        
        // 2. Inizializza e ridimensiona
        initWhiteboard();
        resizeCanvas();
        
        // 3. *** FIX CRUCIALE: Richiedi la history aggiornata al server ***
        // Questo recupera tutti i disegni fatti mentre la lavagna era chiusa
        if(socket && currentRoomId) {
            console.log("Richiedo aggiornamento lavagna al server...");
            socket.emit('wb-request-history', currentRoomId);
        }

    } else {
        // Chiudi la lavagna
        whiteboardContainer.classList.add('hidden');
        toggleWhiteboardButton.classList.remove('active');
    }
});

wbCloseBtn.addEventListener('click', () => {
    whiteboardContainer.classList.add('hidden');
    toggleWhiteboardButton.classList.remove('active');
});

wbClearBtn.addEventListener('click', () => {
    if(confirm("Sei sicuro di voler cancellare tutta la lavagna per tutti?")){
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if(socket && currentRoomId) socket.emit('wb-clear', currentRoomId);
    }
});

wbUndoBtn.addEventListener('click', () => {
    if(socket && currentRoomId) socket.emit('wb-undo', currentRoomId);
});

wbColors.forEach(btn => {
    btn.addEventListener('click', (e) => {
        wbColors.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentColor = e.target.dataset.color;
    });
});

// **********************************************
// ************** FINE LOGICA WHITEBOARD ********
// **********************************************

// Funzioni Registrazione (Focus)
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        log('Registrazione interrotta. Salvataggio in corso...');
        mediaRecorder.stop();
    }
}

function saveRecording() {
    isRecording = false;
    recordButton.classList.remove('active');
    recordButton.querySelector('.material-icons').textContent = 'fiber_manual_record'; 
    recordButton.title = 'Avvia Registrazione';
    
    if (recordedChunks.length === 0) {
        addChatMessage('Sistema', 'Registrazione interrotta. Nessun dato acquisito.', true, 'system');
        return;
    }

    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    
    const now = new Date();
    const fileName = `registrazione-${now.toLocaleDateString('it-IT').replace(/\//g, '-')}-${now.toLocaleTimeString('it-IT').replace(/:/g, '-')}.webm`;
    
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    addChatMessage('Sistema', `Registrazione salvata e scaricata come "${fileName}".`, true, 'system');
}

function startRecording() {
    if (!window.MediaRecorder) {
        alert('Il tuo browser non supporta l\'API MediaRecorder.');
        return;
    }
    let streamToRecord = null;
    let nicknameToRecord = userNickname; 
    if (focusedPeerId === 'local') {
        streamToRecord = localVideoEl.srcObject || localStream;
        nicknameToRecord = userNickname;
    } else {
        const remoteFeedEl = videosGrid.querySelector(`[data-peer-id="${focusedPeerId}"]`);
        if (remoteFeedEl) {
            const remoteVideoEl = remoteFeedEl.querySelector('video');
            streamToRecord = remoteVideoEl.srcObject;
            nicknameToRecord = remoteNicknames[focusedPeerId] || 'Peer Remoto';
        }
    }
    if (!streamToRecord || !streamToRecord.getTracks().length) {
        alert('Impossibile trovare uno stream video o audio attivo da registrare.');
        return;
    }

    isRecording = true;
    recordButton.classList.add('active');
    recordButton.querySelector('.material-icons').textContent = 'stop'; 
    recordButton.title = 'Ferma Registrazione';

    recordedChunks = [];
    try {
        mediaRecorder = new MediaRecorder(streamToRecord, { mimeType: 'video/webm; codecs=vp9' });
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) recordedChunks.push(event.data);
        };
        mediaRecorder.onstop = saveRecording;
        mediaRecorder.start(1000); 
        log(`Registrazione avviata per lo stream di ${nicknameToRecord}...`);
        addChatMessage('Sistema', `Registrazione avviata per lo stream di **${nicknameToRecord}**.`, true, 'system');
    } catch(err) {
        console.error('Errore MediaRecorder:', err);
        isRecording = false;
        recordButton.classList.remove('active');
        alert('Impossibile avviare la registrazione.');
    }
}

// ---------- Utils e Chat ----------
function getRoomIdFromUrl(){
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('room');
}

function copyRoomLink(){
    const url = `${window.location.protocol}//${window.location.host}${window.location.pathname}?room=${currentRoomId}`;
    navigator.clipboard.writeText(url).then(() => {
        shareRoomLinkButton.value = 'Link Copiato!';
        setTimeout(() => { shareRoomLinkButton.value = 'Ottieni Link'; }, 3000);
    }).catch(err => {
        console.error('Errore copia link:', err);
        alert(`Copia manuale: ${url}`);
    });
}

function addChatMessage(sender, message, isLocal=false, type='public'){
    const messageEl = document.createElement('div');
    messageEl.classList.add('chat-message');
    let cssClass;
    let senderText = sender;
    if (type === 'system') { cssClass = 'sender-system'; senderText = 'Sistema'; } 
    else if (type === 'private') { cssClass = 'sender-private'; } 
    else { cssClass = isLocal ? 'sender-me' : 'sender-remote'; }

    const prefix = isLocal ? `Tu${type === 'private' ? ` (DM a ${sender})` : ''}: ` : `${senderText}: `;
    messageEl.innerHTML = `<span class="${cssClass}">${prefix}</span>${message}`;
    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function clearChatInput(){ chatMessageInput.value = ''; }

function sendMessage(){
    const fullMessage = chatMessageInput.value.trim();
    if (!fullMessage) return;
    
    const parts = fullMessage.split(' ');
    if (parts[0].toLowerCase() === '/dm' && parts.length >= 3) {
        const recipientNickname = parts[1];
        const messageContent = parts.slice(2).join(' ');
        if (recipientNickname.toLowerCase() === userNickname.toLowerCase()) {
            addChatMessage('Sistema', 'Non puoi inviare un Messaggio Privato a te stesso.', true, 'system');
            clearChatInput();
            return;
        }
        const recipientId = Object.keys(remoteNicknames).find(
            key => remoteNicknames[key] && remoteNicknames[key].toLowerCase() === recipientNickname.toLowerCase()
        );
        if (recipientId) {
            sendPrivateMessage(recipientId, recipientNickname, messageContent);
            clearChatInput();
        } else {
            addChatMessage('Sistema', `Utente privato "${recipientNickname}" non trovato.`, true, 'system');
        }
        return; 
    }

    if (socket && currentRoomId) {
        socket.emit('send-message', currentRoomId, userNickname, fullMessage);
        addChatMessage(userNickname, fullMessage, true, 'public');
        clearChatInput();
        chatMessageInput.focus();
        if(window.innerWidth <= 768) {
             setTimeout(() => { window.scrollTo(0, document.body.scrollHeight); }, 50);
        }
    } else {
        alert('Impossibile inviare il messaggio: connessione non stabilita.');
    }
}

function sendPrivateMessage(recipientId, recipientNickname, message) {
    if (!message || !recipientId) return;
    if (socket && currentRoomId) {
        socket.emit('send-private-message', currentRoomId, recipientId, userNickname, message);
        addChatMessage(recipientNickname, message, true, 'private');
    }
}

function openChatPanelMobile(callback) {
    if (chatPanel.classList.contains('active') && !chatPanel.classList.contains('hidden')) {
        if (callback) callback();
        return;
    }
    chatPanel.classList.remove('hidden');
    setTimeout(() => {
        chatPanel.classList.add('active');
        let closeBtn = document.getElementById('close-chat-btn');
        if (!closeBtn) {
            closeBtn = document.createElement('button');
            closeBtn.textContent = '← Torna alle webcam';
            closeBtn.id = 'close-chat-btn';
            closeBtn.style.cssText = `position: relative; width: calc(100% - 20px); padding: 10px; margin: 10px; border: none; background: var(--primary-color); color: var(--bg); font-weight: bold; cursor: pointer; border-radius: 6px;`; 
            const chatHeader = chatPanel.querySelector('h3');
            if(chatHeader) chatPanel.insertBefore(closeBtn, chatHeader);
            closeBtn.addEventListener('click', () => {
                chatPanel.classList.remove('active');
                setTimeout(() => { chatPanel.classList.add('hidden'); closeBtn.remove(); }, 300);
            });
        }
        setTimeout(callback, 350); 
    }, 10);
}

// ---------- Socket.IO Logic ----------
function initializeSocket(){
  socket = io(RENDER_SERVER_URL);
  socket.on('connect', ()=> log('Connesso', socket.id));

  socket.on('nickname-in-use', (errorMessage) => {
      alert(errorMessage);
      resetAndShowOverlay();
      if (socket) socket.disconnect();
  });

  socket.on('welcome', (newPeerId, nickname, peers=[])=>{
    remoteNicknames[newPeerId] = nickname;
    addChatMessage(userNickname, `Benvenuto nella stanza ${currentRoomId}!`, false, 'system');
    peers.forEach(peer=>{
      if(peer.id !== socket.id) {
        remoteNicknames[peer.id] = peer.nickname;
        createPeerConnection(peer.id); 
      }
    });
    setFocus('local', false);
  });

  // *** GESTIONE EVENTI WHITEBOARD CORRETTA ***
  socket.on('wb-draw', (data) => {
      // Se la whiteboard è chiusa, mostra la notifica
      if (whiteboardContainer.classList.contains('hidden')) {
          toggleWhiteboardButton.classList.add('has-notification');
      }
      // Disegna comunque (grazie al fix su resizeCanvas funzionerà anche nascosto)
      drawRemote(data);
  });

  socket.on('wb-clear', () => {
      if(ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  socket.on('wb-history', (history) => {
      if(!ctx) initWhiteboard();
      // Pulisci tutto prima di ridisegnare la storia
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Ridisegna ogni tratto
      history.forEach(item => drawRemote(item));
      
      // Se arriva una history e la lavagna è chiusa, notifica
      if (whiteboardContainer.classList.contains('hidden') && history.length > 0) {
           toggleWhiteboardButton.classList.add('has-notification');
      }
  });
  // *******************************************

  socket.on('peer-joined', (peerId,nickname)=>{
    remoteNicknames[peerId] = nickname;
    createPeerConnection(peerId); 
    addChatMessage('Sistema', `${nickname} è entrato.`, false, 'system');
  });

  socket.on('peer-left', (peerId)=>{
    const nickname = remoteNicknames[peerId] || 'Un utente';
    removeRemoteFeed(peerId);
    addChatMessage('Sistema', `${nickname} è uscito.`, false, 'system');
  });

  socket.on('new-message', (senderNickname, message)=>{
    addChatMessage(senderNickname, message, false, 'public');
  });
  
  socket.on('new-private-message', (senderNickname, message) => {
      addChatMessage(`Privato da ${senderNickname}`, message, false, 'private');
  });
  
  socket.on('audio-status-changed', (peerId, isTalking) => {
      const feed = videosGrid.querySelector(`[data-peer-id="${peerId}"]`);
      if(feed) {
          feed.classList.toggle('is-talking', isTalking);
          feed.querySelector('.remote-mic-status').textContent = isTalking ? 'mic' : 'mic_off';
      }
      if (isTalking) {
          currentSpeakerId = peerId;
          if (!isManualFocus) {
              if (autoFocusTimer) clearTimeout(autoFocusTimer);
              setFocus(peerId, false);
          }
      } else {
          if (peerId === currentSpeakerId && !isManualFocus) {
              if (autoFocusTimer) clearTimeout(autoFocusTimer);
              autoFocusTimer = setTimeout(() => {
                  if (peerId === focusedPeerId) setFocus('local', false);
                  autoFocusTimer = null;
              }, AUTO_FOCUS_COOLDOWN);
          }
      }
  });

  socket.on('remote-stream-type-changed', (peerId, newRatio) => {
    const feed = videosGrid.querySelector(`[data-peer-id="${peerId}"]`);
    if(feed){
        feed.classList.remove('ratio-4-3', 'ratio-16-9');
        feed.classList.add(`ratio-${newRatio}`);
    }
  });

  socket.on('offer', async (fromId, offer)=>{
    const pc = createPeerConnection(fromId); 
    if(pc.signalingState !== 'stable') return; 
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    if (iceCandidateQueues[fromId]) {
      iceCandidateQueues[fromId].forEach(candidate => { if(candidate) pc.addIceCandidate(new RTCIceCandidate(candidate)); });
      iceCandidateQueues[fromId] = [];
    }
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', fromId, pc.localDescription);
  });

  socket.on('answer', async (fromId, answer)=>{
    const pc = peerConnections[fromId];
    if(pc) {
        if(pc.signalingState !== 'have-local-offer') return;
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        if (iceCandidateQueues[fromId]) {
          iceCandidateQueues[fromId].forEach(candidate => { if(candidate) pc.addIceCandidate(new RTCIceCandidate(candidate)); });
          iceCandidateQueues[fromId] = [];
        }
    }
  });

  socket.on('candidate', async (fromId, candidate)=>{
    const pc = peerConnections[fromId];
    if(pc && candidate) {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        if (!iceCandidateQueues[fromId]) iceCandidateQueues[fromId] = [];
        iceCandidateQueues[fromId].push(candidate);
      }
    }
  });
}

function createPeerConnection(socketId){
  if(peerConnections[socketId]) return peerConnections[socketId];
  const pc = new RTCPeerConnection(iceConfiguration);
  peerConnections[socketId] = pc;
  iceCandidateQueues[socketId] = []; 

  if(localStream) {
      localStream.getTracks().forEach(track => {
        const sender = pc.addTrack(track, localStream);
        if(track.kind === 'video') videoSenders[socketId] = sender;
      });
  }

  pc.onicecandidate = event=>{ if(event.candidate) socket.emit('candidate', socketId, event.candidate); };
  pc.ontrack = event=>{
    const feed = ensureRemoteFeed(socketId, remoteNicknames[socketId]);
    const video = feed.querySelector('video');
    if(video && event.streams.length > 0) {
        video.srcObject = event.streams[0];
        if (manuallyMutedPeers[socketId]) video.muted = true;
    }
  };

  const shouldCreateOffer = (socket.id < socketId); 
  pc.onnegotiationneeded = async ()=>{
    if(shouldCreateOffer && pc.signalingState === 'stable'){
      try{
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', socketId, pc.localDescription);
      }catch(err){ console.error('Error creating/sending offer', err); }
    }
  };
  return pc;
}

document.addEventListener('DOMContentLoaded', () => {
    const urlRoomId = getRoomIdFromUrl();
    if (urlRoomId) roomIdInput.value = urlRoomId;
    if (videosGrid.children.length === 1 && videosGrid.querySelector('#local-feed')){
        const placeholder = document.createElement('div');
        placeholder.id = 'remote-video-placeholder';
        placeholder.className = 'video-placeholder';
        placeholder.textContent = 'In attesa di altri partecipanti...';
        videosGrid.insertBefore(placeholder, localFeedEl);
    }
    localFeedEl.classList.add('is-focused');
    localFeedEl.addEventListener('click', ()=> setFocus('local', true)); 
});

joinButton.addEventListener('click', async ()=>{
  const nickname = nicknameInput.value.trim();
  const roomId = roomIdInput.value.trim();
  if(!nickname || !roomId){ alert('Inserisci nickname e stanza'); return; }

  userNickname = nickname;
  currentRoomId = roomId;
  
  await startLocalMedia(); 
  initializeSocket();
  socket.emit('join-room', currentRoomId, userNickname); 
  document.getElementById('room-name-display').textContent = roomId;
  showOverlay(false);
  setFocus('local', false);
});

toggleAudioButton.addEventListener('click', toggleAudio);
toggleVideoButton.addEventListener('click', toggleVideo);
disconnectButton.addEventListener('click', disconnect);
shareScreenButton.addEventListener('click', toggleScreenShare); 
shareRoomLinkButton.addEventListener('click', copyRoomLink); 

if (recordButton) {
    recordButton.addEventListener('click', () => {
        if (isRecording) stopRecording();
        else startRecording();
    });
}

showChatBtn.addEventListener('click', () => {
    if(window.innerWidth <= 768){ 
        openChatPanelMobile();
    } else { 
        chatPanel.classList.toggle('hidden');
    }
});

sendChatButton.addEventListener('click', sendMessage);
chatMessageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
});

document.addEventListener('click', (e) => {
    if (!contextMenuEl.classList.contains('hidden') && 
        !contextMenuEl.contains(e.target) && 
        !e.target.closest('.video-feed')) {
        hideContextMenu();
    }
});

document.addEventListener('contextmenu', (e) => {
    if (contextMenuEl && !e.target.closest('.video-feed') && !contextMenuEl.contains(e.target)) {
        hideContextMenu();
    }
});

menuMuteUser.addEventListener('click', () => {
    if (contextTargetPeerId) {
        toggleRemoteMute(contextTargetPeerId);
        hideContextMenu();
    }
});

menuDmUser.addEventListener('click', () => {
    if (contextTargetPeerId) {
        if (contextTargetPeerId === socket.id) {
            hideContextMenu();
            addChatMessage('Sistema', 'Non puoi inviare un Messaggio Privato a te stesso.', true, 'system');
            return;
        }
        const nickname = remoteNicknames[contextTargetPeerId] || 'Utente';
        hideContextMenu();
        const focusAndSetDM = () => {
            chatMessageInput.value = `/dm ${nickname} `; 
            chatMessageInput.focus(); 
            if(window.innerWidth <= 768) {
                setTimeout(() => { chatMessageInput.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, 50);
            }
        };
        if (window.innerWidth <= 768) openChatPanelMobile(focusAndSetDM);
        else focusAndSetDM();
    }
});