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

// VARIABILI SPEECH TO TEXT
const menuToggleCC = document.getElementById('menu-toggle-cc');
let recognition = null; // Istanza SpeechRecognition (se siamo noi a parlare)
let isTranscribingLocal = false; // Se stiamo trascrivendo noi stessi per qualcuno
const activeTranscriptions = {}; // { peerId: true/false } (Chi stiamo ascoltando)
const transcriptionHistory = {}; // { peerId: "testo completo..." } per il download

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
const moreOptionsBtn = document.getElementById('more-options-btn');
const extrasMenu = document.getElementById('extras-menu');
const menuDmUser = document.getElementById('menu-dm-user');
const menuMuteUser = document.getElementById('menu-mute-user');
const menuSendFile = document.getElementById('menu-send-file');

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
let unreadMessagesCount = 0;

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
let targetFileRecipientId = null;

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

const audioAssets = {
    // Suono "Pop" leggero per la Chat
    chat: new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"), // (Stringa accorciata per leggibilità, userò una versione funzionante sotto)
    
    // Suono "Ding" per File e Whiteboard
    alert: new Audio("data:audio/mp3;base64,//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq"),
    
    // Suono "Beep-Beep" per Registrazione
    rec: new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU") 
};

// Carichiamo suoni reali (brevi beep di sistema)
// Nota: Per brevità qui uso URL dummy. 
// Sotto ti fornisco la funzione playSound con suoni generati al volo o URL stabili.
// PER SEMPLICITÀ USEREMO UN GENERATORE WEB AUDIO API (Nessun file necessario)

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playNotificationSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'chat') {
        // Suono: "Pop" acuto e veloce
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } 
    else if (type === 'file' || type === 'wb') {
        // Suono: "Ding" cristallino
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, now);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }
    else if (type === 'rec') {
        // Suono: Doppio Beep (REC start)
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, now);
        gainNode.gain.setValueAtTime(0.1, now);
        
        // Beep 1
        osc.start(now);
        osc.stop(now + 0.1);
        
        // Beep 2
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'square';
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.frequency.setValueAtTime(600, now + 0.15);
        gain2.gain.setValueAtTime(0.1, now + 0.15);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.25);
    }
}

const availableBackgrounds = [
    { id: 'default', name: 'Default', value: '' }, // Valore vuoto = usa colore tema CSS
    { id: 'grad1', name: 'Tramonto', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { id: 'grad2', name: 'Notte', value: 'linear-gradient(to top, #09203f 0%, #537895 100%)' },
    { id: 'img1', name: 'Montagna', value: 'url("https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'img2', name: 'Cyberpunk', value: 'url("https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'img3', name: 'Ufficio', value: 'url("https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'img4', name: 'Astratto', value: 'url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80")' }
];

const bgOptionsContainer = document.getElementById('background-options');

function initBackgroundSettings() {
    // 1. Carica sfondo salvato o usa default
    const savedBg = localStorage.getItem('appBackground') || 'default';
    applyBackground(savedBg);

    // 2. Genera le opzioni nel modale
    if(!bgOptionsContainer) return;
    bgOptionsContainer.innerHTML = '';

    availableBackgrounds.forEach(bg => {
        const div = document.createElement('div');
        div.className = 'bg-option';
        div.title = bg.name;
        div.dataset.bgId = bg.id;

        // Anteprima visiva
        if (bg.id === 'default') {
            div.classList.add('default-bg');
            div.innerHTML = '<span class="material-icons" style="font-size:1.5em; color:var(--muted)">block</span>';
        } else {
            div.style.background = bg.value;
            div.style.backgroundSize = 'cover';
        }

        // Gestione Click
        div.addEventListener('click', () => {
            applyBackground(bg.id);
            saveBackgroundPreference(bg.id);
            updateSelectedVisual(bg.id);
        });

        bgOptionsContainer.appendChild(div);
    });

    // Segna quello attivo visivamente
    updateSelectedVisual(savedBg);
}

function applyBackground(bgId) {
    const bgObj = availableBackgrounds.find(b => b.id === bgId);
    if (!bgObj) return;

    if (bgObj.id === 'default') {
        // Rimuovi immagine inline per lasciare il colore del tema CSS
        document.body.style.backgroundImage = '';
        document.body.style.background = ''; 
    } else {
        // Applica immagine o gradiente
        document.body.style.background = bgObj.value;
        // Re-imposta le proprietà chiave perché lo shorthand 'background' potrebbe sovrascriverle
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundAttachment = 'fixed';
    }
}

function saveBackgroundPreference(bgId) {
    localStorage.setItem('appBackground', bgId);
}

function updateSelectedVisual(bgId) {
    const options = document.querySelectorAll('.bg-option');
    options.forEach(opt => {
        if (opt.dataset.bgId === bgId) opt.classList.add('selected');
        else opt.classList.remove('selected');
    });
}

document.addEventListener('DOMContentLoaded', initBackgroundSettings);

// Funzione per inizializzare il riconoscimento vocale locale (Browser -> Testo)
function initSpeechRecognition() {
    if (recognition) return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn("Speech API non supportata su questo browser.");
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'it-IT'; // Puoi renderlo dinamico (es. navigator.language)
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        // Invia i dati a chiunque sia connesso nella stanza (semplificazione efficace)
        // O meglio: inviamo broadcast alla stanza, il server filtrerà o il client userà solo se attivo.
        // In questo caso usiamo il socket esistente per inviare a TUTTI nella stanza il testo.
        // Se vuoi inviare SOLO a chi l'ha chiesto, dovresti tenere una lista di richiedenti.
        // Per semplicità e performance: inviamo broadcast nella stanza, chi ha i CC attivi lo vede.
        
        const txt = finalTranscript || interimTranscript;
        if (txt && socket && currentRoomId) {
             // Usiamo un evento broadcast alla stanza per efficienza
             // (Nota: server.js deve essere configurato per inoltrare a to(room))
             // Modifica: usiamo l'evento specifico creato prima punto-punto o broadcast.
             // Per rispettare la richiesta "attivabile per user", inviamo a tutti, 
             // ma solo chi ha attivato la UI lo vedrà.
             Object.keys(peerConnections).forEach(peerId => {
                 socket.emit('transcription-result', peerId, txt, !!finalTranscript);
             });
        }
    };

    recognition.onerror = (event) => { console.log('Speech error:', event.error); };
    recognition.onend = () => { 
        // Riavvia se dovrebbe essere ancora attivo
        if (isTranscribingLocal) recognition.start(); 
    };
}

// ---------- Helpers ----------
function log(...args){ console.log('[APP]',...args); }

function downloadTranscription(peerId, text) {
    const nickname = remoteNicknames[peerId] || "Utente";
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Trascrizione_${nickname}_${new Date().toLocaleTimeString()}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// --- GESTIONE NOTIFICHE E LETTURA ---

function updateUnreadBadge() {
    // Rimuoviamo eventuali badge vecchi
    const oldBadge = showChatBtn.querySelector('.notification-badge');
    if (oldBadge) oldBadge.remove();

    if (unreadMessagesCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'notification-badge';
        // Mostriamo "9+" se ci sono molti messaggi
        badge.textContent = unreadMessagesCount > 9 ? '9+' : unreadMessagesCount;
        showChatBtn.appendChild(badge);
        showChatBtn.classList.add('has-notification'); 
    } else {
        showChatBtn.classList.remove('has-notification');
    }
}

function markAllAsRead() {
    // Resetta il contatore visivo
    unreadMessagesCount = 0;
    updateUnreadBadge();

    if (!socket || !currentRoomId) return;

    // Trova tutti i messaggi non ancora marcati come "letti" (processed-read)
    // Escludiamo i miei messaggi (.sender-me) e quelli di sistema
    const unreadMsgs = messagesContainer.querySelectorAll('.chat-message:not(.processed-read)');

    unreadMsgs.forEach(msg => {
        const msgId = msg.dataset.messageId;
        // Verifica ulteriore per sicurezza: non mandare lettura per i propri messaggi
        const isMyMessage = msg.querySelector('.sender-me');

        if (msgId && !isMyMessage) {
            socket.emit('msg-read', currentRoomId, msgId, userNickname);
            msg.classList.add('processed-read'); // Evita invii doppi
        }
    });
}

function showReadersDialog(msgId) {
    const msgEl = document.querySelector(`.chat-message[data-message-id="${msgId}"]`);
    if (!msgEl) return;

    // Recupera la lista dal dataset (aggiornata via socket)
    const readers = JSON.parse(msgEl.dataset.readers || "[]");

    // Crea l'overlay scuro
    const overlay = document.createElement('div');
    overlay.className = 'readers-dialog-overlay'; // Definito nel CSS
    
    // Crea il box del dialog
    const dialog = document.createElement('div');
    dialog.className = 'readers-dialog'; // Definito nel CSS
    
    let contentHtml = '';
    if (readers.length === 0) {
        contentHtml = '<p style="color:var(--muted);">Nessuno ha ancora visualizzato questo messaggio.</p>';
    } else {
        contentHtml = '<p style="margin-bottom:10px; font-weight:bold;">Letto da:</p><ul class="readers-list">';
        readers.forEach(nick => {
            contentHtml += `<li>${nick}</li>`;
        });
        contentHtml += '</ul>';
    }

    dialog.innerHTML = `
        <h3 style="margin-top:0; color:var(--primary-color);">Info Messaggio</h3>
        ${contentHtml}
        <div style="text-align:right; margin-top:15px; border-top:1px solid var(--border-color); padding-top:10px;">
            <button id="close-readers-btn" style="background:var(--surface-2); border:1px solid var(--border-color); color:var(--text-color); padding:6px 12px; border-radius:4px; cursor:pointer;">Chiudi</button>
        </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Funzione di chiusura
    const closeDialog = () => overlay.remove();
    
    dialog.querySelector('#close-readers-btn').onclick = closeDialog;
    overlay.onclick = (e) => {
        if (e.target === overlay) closeDialog();
    };
}

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
	updateCCMenuState(peerId);
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

function setFocus(peerId, manual=false) { 
    // 1. Reset stato precedente
    videosGrid.classList.remove('has-fullscreen');
    const allFeeds = videosGrid.querySelectorAll('.video-feed');
    allFeeds.forEach(feed => {
        feed.classList.remove('is-focused', 'fullscreen-active', 'pip-mode');
    });

    focusedPeerId = peerId;
    isManualFocus = manual; 

    if (manual && autoFocusTimer) { 
        clearTimeout(autoFocusTimer); 
        autoFocusTimer = null; 
    }

    // Se non c'è nessun focus (clic per deselezionare), abbiamo finito (torna griglia)
    if (!peerId) return;

    // 2. Attiva modalità Fullscreen sul contenitore
    videosGrid.classList.add('has-fullscreen');

    // 3. Identifica il video da ingrandire
    let targetFeed = null;
    if (peerId === 'local') {
        targetFeed = localFeedEl;
    } else {
        targetFeed = videosGrid.querySelector(`[data-peer-id="${peerId}"]`);
    }

    // 4. Applica classi
    if (targetFeed) {
        targetFeed.classList.add('fullscreen-active'); // Diventa grande
    }

    // 5. Trasforma TUTTI gli altri video in PiP (Picture in Picture)
    allFeeds.forEach(feed => {
        if (feed !== targetFeed) {
            feed.classList.add('pip-mode');
        }
    });
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
  
  videosGrid.insertBefore(div, localFeedEl); // Aggiunge il video

  if (focusedPeerId) {
      setFocus(focusedPeerId);
  }
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
transferFileButton.addEventListener('click', () => { 
    if(Object.keys(peerConnections).length === 0) { alert("Nessun partecipante."); return; } 
    targetFileRecipientId = null; // Resetta: invio broadcast
    fileInput.click(); 
});

// 2. Voce Menu Contestuale: Invia a UNO SPECIFICO
menuSendFile.addEventListener('click', () => {
    if (contextTargetPeerId) {
        targetFileRecipientId = contextTargetPeerId; // Imposta il destinatario
        hideContextMenu();
        // Verifica se il canale dati è aperto per quell'utente
        if(!dataChannels[targetFileRecipientId] || dataChannels[targetFileRecipientId].readyState !== 'open'){
            alert("Impossibile inviare file: connessione dati non stabile con questo utente.");
            return;
        }
        fileInput.click(); // Apre la selezione file
    }
});

// 3. Gestione Selezione File (Logica modificata)
fileInput.addEventListener('change', (e) => { 
    const file = e.target.files[0]; 
    if (!file) return; 

    if (targetFileRecipientId) {
        // CASO A: Invio Singolo
        sendFile(targetFileRecipientId, file);
    } else {
        // CASO B: Invio Broadcast (a tutti)
        Object.keys(dataChannels).forEach(peerId => sendFile(peerId, file)); 
    }
    
    fileInput.value = ''; 
    targetFileRecipientId = null; // Reset sicurezza
});

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
    
    // Gestione metadati (JSON)
    if (typeof data === 'string') {
        try {
            const msg = JSON.parse(data);
            if (msg.type === 'file-metadata') {
                // [NUOVO] Suono ricezione file
                playNotificationSound('file');

                fileMetadata[peerId] = { 
                    name: msg.name, 
                    size: msg.size, 
                    type: msg.fileType, 
                    received: 0 
                };
                fileChunks[peerId] = [];
                fileMetadata[peerId].toast = createProgressToast(`Ricevendo: ${msg.name}`, false);
            }
        } catch (e) {}
        return;
    }

    // Gestione dati binari (Chunk del file)
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
    
    // Creiamo il Blob dai chunk ricevuti
    const blob = new Blob(fileChunks[peerId], { type: meta.type });
    const url = URL.createObjectURL(blob);

    // Rileviamo se l'utente è su Mobile (iPhone, iPad, Android)
    // Questo regex copre la maggior parte dei dispositivi mobili moderni
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        // SU MOBILE: Creiamo un pulsante visibile.
        // iOS blocca i download automatici non generati da un tocco diretto dell'utente.
        const btn = document.createElement('button');
        btn.innerText = `📥 SCARICA: ${meta.name}`;
        
        // Stili inline per centrarlo e renderlo ben visibile sopra tutto
        btn.style.cssText = `
            position: fixed; 
            top: 50%; 
            left: 50%; 
            transform: translate(-50%, -50%); 
            z-index: 10000; 
            padding: 20px 30px; 
            font-size: 1.2em; 
            font-weight: bold;
            background: var(--primary-color, #00bcd4); 
            color: white; 
            border: 2px solid #fff; 
            border-radius: 12px; 
            box-shadow: 0 0 20px rgba(0,0,0,0.7);
            cursor: pointer;
        `;

        // Al click dell'utente, scateniamo il download
        btn.onclick = () => {
            const a = document.createElement('a');
            a.href = url;
            a.download = meta.name; // Nota: iOS potrebbe ignorare il nome e usare "document"
            a.target = '_blank';    // Fondamentale per iOS per aprire l'anteprima
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Rimuoviamo il pulsante e puliamo
            btn.remove();
            cleanupTransferData(peerId, url);
        };

        document.body.appendChild(btn);

    } else {
        // SU DESKTOP: Download automatico (comportamento classico)
        const a = document.createElement('a');
        a.href = url;
        a.download = meta.name;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Pulizia immediata (con leggero ritardo per sicurezza browser)
        setTimeout(() => {
            cleanupTransferData(peerId, url);
        }, 100);
    }
}

// Funzione helper per pulire la memoria e aggiornare la UI
function cleanupTransferData(peerId, url) {
    // Rilasciamo l'URL del blob per liberare memoria
    window.URL.revokeObjectURL(url);

    // Aggiorniamo il Toast per dire "Completato"
    if (fileMetadata[peerId] && fileMetadata[peerId].toast) {
        const toast = fileMetadata[peerId].toast;
        toast.querySelector('.file-name').textContent = `Completato: ${fileMetadata[peerId].name}`;
        toast.querySelector('.progress-bar-fill').style.backgroundColor = '#4caf50'; // Verde successo
        
        // Rimuoviamo il toast dopo 3 secondi
        setTimeout(() => {
            if (toast) toast.remove();
        }, 3000);
    }

    // Cancelliamo i dati dalla memoria RAM
    delete fileChunks[peerId];
    delete fileMetadata[peerId];
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
    // 1. Determiniamo lo spazio disponibile
    const containerW = window.innerWidth;
    const containerH = window.innerHeight;

    // 2. Definiamo il rapporto d'aspetto fisso (16:9) per evitare distorsioni
    const targetRatio = 16 / 9;
    
    let finalW, finalH;

    // 3. Calcoliamo le dimensioni massime mantenendo il rapporto 16:9 (Logica "Contain")
    if (containerW / containerH > targetRatio) {
        // Lo schermo è più largo del 16:9 (es. monitor ultrawide o barre laterali)
        finalH = containerH;
        finalW = finalH * targetRatio;
    } else {
        // Lo schermo è più stretto del 16:9 (es. Mobile o 4:3)
        finalW = containerW;
        finalH = finalW / targetRatio;
    }

    // 4. Applichiamo le dimensioni al canvas
    canvas.width = finalW; 
    canvas.height = finalH;

    // 5. Stiliamo il canvas per centrarlo visivamente
    canvas.style.width = `${finalW}px`;
    canvas.style.height = `${finalH}px`;
    canvas.style.boxShadow = "0 0 0 9999px rgba(0,0,0,1)"; // Trucco per rendere nerissimo lo spazio vuoto attorno
    canvas.style.background = "#1e1e1e"; // Colore di sfondo area disegnabile

    // 6. Ridisegniamo la cronologia se presente
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
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke(); ctx.closePath();
    
    const drawData = { 
        x0: x0 / canvas.width, 
        y0: y0 / canvas.height, 
        x1: x1 / canvas.width, 
        y1: y1 / canvas.height, 
        color: color 
    };

    if (emit && socket && currentRoomId) {
        socket.emit('wb-draw', currentRoomId, drawData);
        localWhiteboardHistory.push(drawData); 
    }
}

function drawRemote(data, saveToHistory = true){
    if(!ctx) initWhiteboard();
    const w = canvas.width; 
    const h = canvas.height;
    
    ctx.beginPath(); 
    ctx.moveTo(data.x0 * w, data.y0 * h); 
    ctx.lineTo(data.x1 * w, data.y1 * h);
    ctx.strokeStyle = data.color; 
    ctx.lineWidth = 3; 
    ctx.lineCap = 'round'; 
    ctx.stroke(); 
    ctx.closePath();

    if(saveToHistory) localWhiteboardHistory.push(data);
}

function throttle(callback, delay) { let previousCall = new Date().getTime(); return function() { const time = new Date().getTime(); if ((time - previousCall) >= delay) { previousCall = time; callback.apply(null, arguments); } }; }

toggleWhiteboardButton.addEventListener('click', () => {
    if(extrasMenu) extrasMenu.classList.remove('active'); 

    const isHidden = whiteboardContainer.classList.contains('hidden');

    if(moreOptionsBtn) moreOptionsBtn.classList.remove('has-notification');

    if (isHidden) { 
        whiteboardContainer.classList.remove('hidden'); 
        toggleWhiteboardButton.classList.add('active'); 
        toggleWhiteboardButton.classList.remove('has-notification'); 
        initWhiteboard(); 
        resizeCanvas(); 
        if(socket && currentRoomId) socket.emit('wb-request-history', currentRoomId); 
    } else { 
        whiteboardContainer.classList.add('hidden'); 
        toggleWhiteboardButton.classList.remove('active'); 
    }
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
    // Decide quale stream registrare (locali o focus remoto)
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
        // [NUOVO] Suono di avvio registrazione
        playNotificationSound('rec');

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

// Listener Menu Contestuale: Attiva/Disattiva CC
if (menuToggleCC) {
    menuToggleCC.addEventListener('click', () => {
        if (!contextTargetPeerId) return;
        
        const peerId = contextTargetPeerId;
        const isActive = activeTranscriptions[peerId] || false;
        const newState = !isActive;
        
        activeTranscriptions[peerId] = newState;
        
        // 1. Aggiorna UI Menu
        updateCCMenuState(peerId);
        hideContextMenu(); // Chiudi menu

        // 2. Invia richiesta all'utente remoto
        if (socket) {
            socket.emit('request-transcription', peerId, socket.id, newState);
        }

        // 3. Gestione UI Video Locale
        const feed = videosGrid.querySelector(`[data-peer-id="${peerId}"]`);
        const subOverlay = feed ? feed.querySelector('.subtitle-overlay') : null;

        if (newState) {
            // ATTIVAZIONE
            if(!transcriptionHistory[peerId]) transcriptionHistory[peerId] = ""; // Init buffer
            if(subOverlay) {
                subOverlay.classList.remove('hidden');
                subOverlay.textContent = "In attesa di audio...";
            }
        } else {
            // DISATTIVAZIONE & DOWNLOAD
            if(subOverlay) subOverlay.classList.add('hidden');
            
            // Chiedi se scaricare
            const fullText = transcriptionHistory[peerId];
            if (fullText && fullText.length > 10) { // Scarica solo se c'è testo rilevante
                if (confirm(`Trascrizione terminata per questo utente.\nVuoi scaricare il testo?`)) {
                    downloadTranscription(peerId, fullText);
                }
            }
            // Reset buffer opzionale, o mantienilo per appendere se riattiva
            transcriptionHistory[peerId] = ""; 
        }
    });
}

function updateCCMenuState(peerId) {
    const isActive = activeTranscriptions[peerId];
    if (isActive) {
        menuToggleCC.classList.add('active-cc');
        menuToggleCC.querySelector('span:last-child').textContent = "Disattiva Sottotitoli";
    } else {
        menuToggleCC.classList.remove('active-cc');
        menuToggleCC.querySelector('span:last-child').textContent = "Attiva Sottotitoli";
    }
}

// ** ADMIN PANEL UI **
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
function addChatMessage(sender, message, isLocal = false, type = 'public', msgId = null) {
    const messageEl = document.createElement('div');
    messageEl.classList.add('chat-message');

    // Se abbiamo un ID messaggio (quindi non è di sistema), configuriamo i dati per la lettura
    if (msgId && type !== 'system') {
        messageEl.dataset.messageId = msgId;
        messageEl.dataset.readers = JSON.stringify([]); // Inizializziamo array vuoto
        
        // Aggiungiamo l'evento click per vedere chi ha letto
        messageEl.addEventListener('click', () => showReadersDialog(msgId));
        messageEl.style.cursor = 'pointer'; // Feedback visivo
    }

    // Determina le classi CSS in base al tipo
    let cssClass;
    let senderText = sender;

    if (type === 'system') {
        cssClass = 'sender-system';
        senderText = 'Sistema';
    } else if (type === 'private') {
        cssClass = 'sender-private';
    } else {
        cssClass = isLocal ? 'sender-me' : 'sender-remote';
    }

    // Costruzione del testo del mittente
    const prefix = isLocal 
        ? `Tu${type === 'private' ? ` (DM a ${sender})` : ''}: ` 
        : `${senderText}: `;

    // Costruzione HTML del messaggio
    let htmlContent = `<span class="${cssClass}">${prefix}</span>${message}`;

    // Aggiungiamo l'indicatore di lettura (spunte) solo se c'è un ID e non è di sistema
    if (msgId && type !== 'system') {
        htmlContent += `
            <div class="read-status" id="status-${msgId}">
                <span class="read-count"></span>
                <span class="material-icons" style="font-size: 14px;">done_all</span>
            </div>
        `;
    }

    messageEl.innerHTML = htmlContent;
    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // --- Logica Suoni e Notifiche ---
    if (!isLocal && type !== 'system') {
        // Suono di notifica
        playNotificationSound('chat');

        // Controllo se la chat è visibile
        // Consideriamo la chat aperta se il pannello è attivo (mobile) o non nascosto (desktop)
        const isChatVisible = (!chatPanel.classList.contains('hidden') && window.innerWidth > 768) || 
                              (chatPanel.classList.contains('active') && !chatPanel.classList.contains('hidden'));

        if (isChatVisible) {
            // Se la vedo, invio subito la conferma di lettura
            if (socket && currentRoomId && msgId) {
                socket.emit('msg-read', currentRoomId, msgId, userNickname);
                // Segniamo localmente come processato per non reinviarlo dopo
                messageEl.classList.add('processed-read'); 
            }
        } else {
            // Se la chat è chiusa, incremento il contatore badge
            unreadMessagesCount++;
            updateUnreadBadge();
        }
    }
}

function clearChatInput(){ chatMessageInput.value = ''; }
function sendMessage() {
    const fullMessage = chatMessageInput.value.trim();
    if (!fullMessage) return;

    const parts = fullMessage.split(' ');

    // --- Gestione Messaggi Privati (/dm) ---
    if (parts[0].toLowerCase() === '/dm' && parts.length >= 3) {
        const recipientNickname = parts[1];
        const messageContent = parts.slice(2).join(' ');

        if (recipientNickname.toLowerCase() === userNickname.toLowerCase()) {
            addChatMessage('Sistema', 'No DM a te stesso.', true, 'system');
            clearChatInput();
            return;
        }

        const recipientId = Object.keys(remoteNicknames).find(key => 
            remoteNicknames[key] && remoteNicknames[key].toLowerCase() === recipientNickname.toLowerCase()
        );

        if (recipientId) {
            sendPrivateMessage(recipientId, recipientNickname, messageContent);
            clearChatInput();
        } else {
            addChatMessage('Sistema', `Utente "${recipientNickname}" non trovato.`, true, 'system');
        }
        return;
    }

    // --- Gestione Messaggi Pubblici (Aggiornata con ID) ---
    if (socket && currentRoomId) {
        // Generiamo un ID univoco lato client
        const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // Inviamo al server: Stanza, Nick, Messaggio, ID
        socket.emit('send-message', currentRoomId, userNickname, fullMessage, messageId);
        
        // Aggiungiamo alla nostra chat passando l'ID
        addChatMessage(userNickname, fullMessage, true, 'public', messageId);
        
        clearChatInput();
    }
}

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
  
// --- SOCKET EVENTI TRASCRIZIONE ---

  // 1. Qualcuno mi chiede di attivare il MIO riconoscimento vocale
  socket.on('transcription-request', (requesterId, enable) => {
      // Nota: Per semplicità, se UNO chiede, attiviamo. Se NESSUNO vuole, potremmo spegnere.
      // Qui usiamo un contatore semplice o flag.
      
      if (enable) {
          if (!isTranscribingLocal) {
              initSpeechRecognition();
              try {
                  recognition.start();
                  isTranscribingLocal = true;
                  console.log("Speech Recognition avviato su richiesta remota.");
              } catch(e) { console.error("Errore avvio speech:", e); }
          }
      } else {
          // Logica opzionale: Spegnere se non ci sono più richiedenti.
          // Per ora lasciamo acceso se è stato attivato una volta nella sessione per reattività,
          // oppure spegniamo subito. Spegniamo per privacy.
          isTranscribingLocal = false;
          if (recognition) recognition.stop();
          console.log("Speech Recognition fermato.");
      }
  });

  // 2. Ricevo testo trascritto da qualcuno
  socket.on('transcription-data', (senderId, text, isFinal) => {
      // Controllo se HO ATTIVATO i CC per questo utente
      if (!activeTranscriptions[senderId]) return;

      const feed = videosGrid.querySelector(`[data-peer-id="${senderId}"]`);
      if (!feed) return;

      const subOverlay = feed.querySelector('.subtitle-overlay');
      if (subOverlay) {
          subOverlay.textContent = text;
          // Feedback visivo momentaneo
          subOverlay.classList.remove('hidden');
          
          // Nascondi dopo 3 secondi di silenzio
          if (window.subTimers && window.subTimers[senderId]) clearTimeout(window.subTimers[senderId]);
          if (!window.subTimers) window.subTimers = {};
          
          window.subTimers[senderId] = setTimeout(() => {
              if (activeTranscriptions[senderId]) subOverlay.textContent = ""; 
          }, 4000);
      }

      // Accumula storico solo se è testo "Finale" (confermato dall'API)
      // Altrimenti salveremmo tutte le ipotesi intermedie
      if (isFinal) {
          transcriptionHistory[senderId] += text + " ";
      }
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
  socket.on('wb-draw', (data) => { 
    // Se la lavagna è nascosta
    if (whiteboardContainer.classList.contains('hidden')) {
        // Metti il pallino rosso sul pulsante specifico dentro il menu
        toggleWhiteboardButton.classList.add('has-notification');
        
        // Metti il pallino rosso ANCHE sul pulsante "Altro" principale (così l'utente sa che deve aprire il menu)
        if(moreOptionsBtn) moreOptionsBtn.classList.add('has-notification');

        const now = Date.now();
        if (!window.lastWbSound || now - window.lastWbSound > 3000) { 
            playNotificationSound('wb');
            window.lastWbSound = now;
        }
    }
    drawRemote(data); 
  });
  
  socket.on('wb-clear', () => { if(ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); localWhiteboardHistory = []; });
  socket.on('wb-history', (history) => { 
      if(!ctx) initWhiteboard(); 
      ctx.clearRect(0, 0, canvas.width, canvas.height); 
      localWhiteboardHistory = []; 
      history.forEach(item => drawRemote(item)); 
      if (whiteboardContainer.classList.contains('hidden') && history.length > 0) toggleWhiteboardButton.classList.add('has-notification'); 
  });
  
  socket.on('new-message', (sender, message, msgId) => {
      // Passiamo l'ID ricevuto dal server alla funzione di visualizzazione
      addChatMessage(sender, message, false, 'public', msgId);
  });

  socket.on('msg-read-update', (msgId, readerNickname) => {
      // Trova il messaggio corrispondente nel DOM
      const msgEl = document.querySelector(`.chat-message[data-message-id="${msgId}"]`);
      
      if (msgEl) {
          // 1. Recupera l'array attuale dei lettori
          let readers = [];
          try {
              readers = JSON.parse(msgEl.dataset.readers || "[]");
          } catch (e) { readers = []; }

          // 2. Aggiungi il nuovo lettore se non c'è già
          if (!readers.includes(readerNickname)) {
              readers.push(readerNickname);
              
              // Salva il nuovo array nel dataset HTML
              msgEl.dataset.readers = JSON.stringify(readers);

              // 3. Aggiorna la grafica (spunte blu)
              const statusEl = msgEl.querySelector('.read-status');
              if (statusEl) {
                  statusEl.classList.add('seen'); // Classe CSS per colorare di blu
                  
                  // Opzionale: Se vuoi mostrare il numero (es. "+3")
                  // const countSpan = statusEl.querySelector('.read-count');
                  // if(countSpan) countSpan.textContent = readers.length > 0 ? readers.length : '';
              }
          }
      }
  });
  // Standard events
  socket.on('peer-joined', (peerId,nickname)=>{ remoteNicknames[peerId] = nickname; createPeerConnection(peerId); addChatMessage('Sistema', `${nickname} entrato.`, false, 'system'); });
  socket.on('peer-left', (peerId)=>{ removeRemoteFeed(peerId); addChatMessage('Sistema', `Utente uscito.`, false, 'system'); });
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

// --------------------------------------------------------
// LISTENERS UI & CONTROLLI
// --------------------------------------------------------

// --- GESTIONE MENU EXTRA ---
if (moreOptionsBtn && extrasMenu) {
    moreOptionsBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Evita che il click si propaghi al document
        extrasMenu.classList.toggle('active');
        extrasMenu.classList.remove('hidden'); // Rimuovi hidden se presente da CSS legacy
    });

    // Chiudi il menu se si clicca un'opzione dentro
    extrasMenu.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            extrasMenu.classList.remove('active');
        });
    });

    // Chiudi cliccando fuori
    document.addEventListener('click', (e) => {
        if (extrasMenu.classList.contains('active') && !extrasMenu.contains(e.target) && e.target !== moreOptionsBtn) {
            extrasMenu.classList.remove('active');
        }
    });
}

// Controlli Media
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

// Controlli Chat (Aggiornato con Logica Notifiche)
showChatBtn.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
        // Mobile: usa la funzione dedicata e passa il callback per resettare le notifiche
        openChatPanelMobile(() => {
            markAllAsRead();
        });
    } else {
        // Desktop: Toggle visibilità
        chatPanel.classList.toggle('hidden');
        
        // Se il pannello è stato appena aperto (non è hidden), segna tutto come letto
        if (!chatPanel.classList.contains('hidden')) {
            markAllAsRead();
            setTimeout(() => chatMessageInput.focus(), 50); // Focus automatico
        }
    }
});

sendChatButton.addEventListener('click', sendMessage);

chatMessageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Gestione chiusura menu contestuale (click fuori)
document.addEventListener('click', (e) => {
    if (!contextMenuEl.classList.contains('hidden') && 
        !contextMenuEl.contains(e.target) && 
        !e.target.closest('.video-feed')) {
        hideContextMenu();
    }
});

// Prevenzione menu browser default se non sui video
document.addEventListener('contextmenu', (e) => {
    if (contextMenuEl && 
        !e.target.closest('.video-feed') && 
        !contextMenuEl.contains(e.target)) {
        hideContextMenu();
    }
});

// Azioni Menu Contestuale
menuMuteUser.addEventListener('click', () => {
    if (contextTargetPeerId) {
        toggleRemoteMute(contextTargetPeerId);
        hideContextMenu();
    }
});

menuDmUser.addEventListener('click', () => {
    if (contextTargetPeerId) {
        // Controllo anti-self DM
        if (contextTargetPeerId === socket.id) {
            hideContextMenu();
            addChatMessage('Sistema', 'No DM a te stesso.', true, 'system');
            return;
        }

        const nickname = remoteNicknames[contextTargetPeerId] || 'Utente';
        hideContextMenu();

        const focusAndSetDM = () => {
            chatMessageInput.value = `/dm ${nickname} `;
            chatMessageInput.focus();
            if (window.innerWidth <= 768) {
                setTimeout(() => {
                    chatMessageInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }, 50);
            }
        };

        // Se mobile apre il pannello, altrimenti setta solo l'input
        if (window.innerWidth <= 768) openChatPanelMobile(focusAndSetDM);
        else focusAndSetDM();
    }
});

const switchCameraBtn = document.getElementById('switch-camera-button');
let currentFacingMode = 'user'; // 'user' = frontale, 'environment' = posteriore

async function switchCamera() {
    // Se non c'è video attivo o stream locale, esci
    if (!localStream || !isVideoEnabled) return;

    // 1. Determina la nuova modalità
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    
    // 2. Definisci i vincoli per il nuovo video
    const constraints = {
        video: { 
            facingMode: { exact: currentFacingMode } // 'exact' forza il cambio su mobile
        },
        audio: false // Non chiediamo audio, manteniamo quello esistente
    };

    try {
        // 3. Richiedi il nuovo stream video
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        const newVideoTrack = newStream.getVideoTracks()[0];

        // 4. Sostituisci la traccia nel flusso locale (per farti vedere il cambiamento)
        const oldVideoTrack = localStream.getVideoTracks()[0];
        if (oldVideoTrack) {
            localStream.removeTrack(oldVideoTrack);
            oldVideoTrack.stop(); // Spegni la vecchia camera
        }
        localStream.addTrack(newVideoTrack);
        
        // Aggiorna l'elemento video locale
        localVideoEl.srcObject = localStream;

        // 5. IMPORTANTE: Sostituisci la traccia video in TUTTE le connessioni P2P attive
        // Questo permette agli altri di vedere il cambio senza caduta di connessione
        for (const peerId in peerConnections) {
            const pc = peerConnections[peerId];
            const sender = pc.getSenders().find(s => s.track.kind === 'video');
            if (sender) {
                sender.replaceTrack(newVideoTrack);
            }
        }
        
        // Specchia il video locale solo se è la camera frontale ('user')
        if (currentFacingMode === 'user') {
            localVideoEl.style.transform = 'scaleX(-1)';
        } else {
            localVideoEl.style.transform = 'scaleX(1)';
        }

    } catch (err) {
        console.error("Errore cambio camera:", err);
        // Fallback: se 'exact' fallisce (es. su PC), prova senza 'exact'
        if (constraints.video.facingMode.exact) {
            delete constraints.video.facingMode.exact;
            constraints.video.facingMode = currentFacingMode;
            try {
                // Riprova con vincoli più leggeri
                // ... (ripetere logica semplificata se necessario) ...
                alert("Impossibile cambiare fotocamera su questo dispositivo.");
            } catch(e) {}
        }
    }
}

// 6. Aggiungi il Listener al bottone
if (switchCameraBtn) {
    switchCameraBtn.addEventListener('click', switchCamera);
}