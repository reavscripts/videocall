const RENDER_SERVER_URL = "https://videocall-webrtc-signaling-server.onrender.com"; 

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

// Controlli Chat
const chatPanel = document.getElementById('chat-panel');
const messagesContainer = document.getElementById('messages-container');
const chatMessageInput = document.getElementById('chat-message-input');
const sendChatButton = document.getElementById('send-chat-button');
const showChatBtn = document.getElementById('show-chat-btn');

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

// ***** Variabili Aggiunte per Focus/Parlato *****
let isManualFocus = false; // True se l'utente ha cliccato su un feed
let currentSpeakerId = null; 
const AUTO_FOCUS_COOLDOWN = 3000; // Tempo di attesa prima di togliere il focus automatico
let autoFocusTimer = null; 
// **********************************************

// Variabili per Rilevamento Audio
let audioContext = null;
let analyser = null;
let talkingInterval = null;
const AUDIO_THRESHOLD = -40; // Decibel soglia per considerare l'utente 'parlante'
const remoteAudioProcessors = {}; 
let isLocalTalking = false; // Stato di parlato locale

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

async function startLocalMedia(){
  try{
    localStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
    updateLocalVideo();
    toggleAudioButton.querySelector('.material-icons').textContent = 'mic';
    toggleVideoButton.querySelector('.material-icons').textContent = 'videocam';
    localFeedEl.classList.add('ratio-4-3'); 
    localFeedEl.classList.remove('ratio-16-9'); 
    
    // Inizializza monitoraggio audio locale
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

// ***** FUNZIONE AGGIORNATA: Monitoraggio Audio Locale *****
function monitorLocalAudio(start = true) {
    if (!localStream || !isAudioEnabled) {
        if (talkingInterval) {
            clearInterval(talkingInterval);
            talkingInterval = null;
             // Se smetti di monitorare, resetta lo stato di parlato locale
            if (isLocalTalking) {
                 isLocalTalking = false;
                 localFeedEl.classList.remove('is-talking');
                 if (socket) socket.emit('audio-status-changed', currentRoomId, isLocalTalking);
            }
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
            
            // Calcola il volume medio (RMS in db)
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

// Monitoraggio Audio Remoto (lasciato vuoto, usa signaling)
function monitorRemoteAudio(stream, peerId) {} 


// LOGICA FOCUS AGGIORNATA
function setFocus(peerId, manual=true){ // AGGIUNTO 'manual=true'
  videosGrid.querySelectorAll('.video-feed').forEach(feed => feed.classList.remove('is-focused'));
  focusedPeerId = peerId;
  isManualFocus = manual; // Traccia se l'utente ha scelto il focus
  
  // Cancella il timer di auto-focus se il focus è manuale
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
// ... (omesso codice invariato) ...
}

function ensureRemoteFeed(socketId, nickname='Utente'){
  let feed = videosGrid.querySelector(`[data-peer-id="${socketId}"]`);
  if(feed) return feed;

  const template = document.getElementById('remote-video-template');
  const div = template.content.cloneNode(true).querySelector('.video-feed');
  div.dataset.peerId = socketId; 
  div.querySelector('.video-label').textContent = nickname;
  addRemoteControlListeners(div); 
  
  // ***** AGGIORNAMENTO LISTENER CLICK *****
  div.addEventListener('click', ()=> setFocus(socketId, true)); // Focus MANUALE

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

  if (remoteAudioProcessors[socketId]) {
    clearInterval(remoteAudioProcessors[socketId].interval);
    delete remoteAudioProcessors[socketId];
  }
  
  // ***** Cleanup focus/parlato *****
  if (currentSpeakerId === socketId) currentSpeakerId = null;
  if (autoFocusTimer) { clearTimeout(autoFocusTimer); autoFocusTimer = null; }
  
  // Torna al focus locale (automatico) se l'utente rimosso era in focus
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
  
  // Aggiorna monitor audio locale
  monitorLocalAudio(isAudioEnabled); 
}

function toggleVideo(){
// ... (omesso codice invariato) ...
}

function disconnect(){
// ... (omesso codice invariato) ...
}

async function toggleScreenShare() {
// ... (omesso codice invariato) ...
}

// ---------- Link e URL ----------
// ... (omesso codice invariato) ...

// ---------- Chat Logic ----------
// ***** Funzione addChatMessage modificata per supportare sender-system *****
function addChatMessage(sender, message, isLocal=false){
    const messageEl = document.createElement('div');
    messageEl.classList.add('chat-message');
    
    let cssClass = isLocal ? 'sender-me' : 'sender-remote';
    if (sender === 'Sistema') {
        cssClass = 'sender-system'; // Applica la nuova classe CSS
    }

    messageEl.innerHTML = `<span class="${cssClass}">${sender}: </span>${message}`;
    
    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}


function clearChatInput(){ chatMessageInput.value = ''; }

function sendMessage(){
// ... (omesso codice invariato) ...
}

// ---------- Socket.IO / WebRTC ----------
function initializeSocket(){
  socket = io(RENDER_SERVER_URL);
  
  socket.on('connect', ()=> log('Connesso', socket.id));

  socket.on('welcome', (newPeerId, nickname, peers=[])=>{
// ... (omesso codice invariato) ...
  });

  socket.on('peer-joined', (peerId,nickname)=>{
// ... (omesso codice invariato) ...
  });

  socket.on('peer-left', (peerId)=>{
// ... (omesso codice invariato) ...
  });

  socket.on('new-message', (senderNickname, message)=>{
// ... (omesso codice invariato) ...
  });
  
  // ***** Listener AGGIORNATO: stato audio cambiato remoto con Auto-Focus *****
  socket.on('audio-status-changed', (peerId, isTalking) => {
      const feed = videosGrid.querySelector(`[data-peer-id="${peerId}"]`);
      if(feed) {
          // 1. Applica/Rimuovi la classe is-talking (verde)
          feed.classList.toggle('is-talking', isTalking);
      }
      
      // 2. Logica di Auto-Focus
      if (isTalking) {
          currentSpeakerId = peerId;
          
          // Metti in focus chi sta parlando SOLO se non siamo in focus manuale
          if (!isManualFocus) {
              // Cancella il timer di spegnimento se qualcuno inizia a parlare
              if (autoFocusTimer) clearTimeout(autoFocusTimer);

              // Metti in focus il nuovo parlante (manual=false)
              setFocus(peerId, false);
          }
      } else {
          // Se l'utente che ha appena smesso di parlare era l'ultimo parlante/focus automatico
          if (peerId === currentSpeakerId && !isManualFocus) {
              // Resetta il timer
              if (autoFocusTimer) clearTimeout(autoFocusTimer);
              
              // Imposta un timer per togliere il focus dopo COOLDOWN
              autoFocusTimer = setTimeout(() => {
                  // Torna al focus locale solo se l'attuale focus è ancora lui
                  if (peerId === focusedPeerId) {
                      setFocus('local', false);
                  }
                  autoFocusTimer = null;
              }, AUTO_FOCUS_COOLDOWN);
          }
      }
  });


  socket.on('remote-stream-type-changed', (peerId, newRatio) => {
// ... (omesso codice invariato) ...
  });

  socket.on('offer', async (fromId, offer)=>{
// ... (omesso codice invariato) ...
  });

  socket.on('answer', async (fromId, answer)=>{
// ... (omesso codice invariato) ...
  });

  socket.on('candidate', async (fromId, candidate)=>{
// ... (omesso codice invariato) ...
  });
}

function createPeerConnection(socketId){
// ... (omesso codice invariato) ...
  pc.ontrack = event=>{
    const feed = ensureRemoteFeed(socketId, remoteNicknames[socketId]);
    const video = feed.querySelector('video');
    
    if(video && event.streams.length > 0) {
        video.srcObject = event.streams[0];
    } else log(`Impossibile collegare lo stream per ${socketId}.`);
  };
// ... (omesso codice invariato) ...
}

// ---------- Inizializzazione Listener e Avvio ----------
document.addEventListener('DOMContentLoaded', () => {
  const urlRoomId = getRoomIdFromUrl();
  if(urlRoomId) roomIdInput.value = urlRoomId;

  // Rimuovi o rendi più discreto il placeholder iniziale
  if (videosGrid.children.length === 1 && videosGrid.querySelector('#local-feed')){
    const placeholder = document.createElement('div');
    placeholder.id = 'remote-video-placeholder';
    placeholder.className = 'video-placeholder';
    placeholder.textContent = 'In attesa di altri partecipanti...';
    videosGrid.insertBefore(placeholder, localFeedEl);
  }
  
  localFeedEl.addEventListener('click', ()=> setFocus('local', true)); // Focus MANUALE
});

joinButton.addEventListener('click', async ()=>{
// ... (omesso codice invariato) ...
});

// Listener Media
toggleAudioButton.addEventListener('click', toggleAudio);
toggleVideoButton.addEventListener('click', toggleVideo);
disconnectButton.addEventListener('click', disconnect);
shareScreenButton.addEventListener('click', toggleScreenShare); 
shareRoomLinkButton.addEventListener('click', copyRoomLink); 

// Listener Chat (Logica corretta per mobile/desktop)
showChatBtn.addEventListener('click', () => {
    if(window.innerWidth <= 768){ // mobile: overlay della chat
        chatPanel.classList.remove('hidden');
        setTimeout(() => chatPanel.classList.add('active'), 10); 

        let closeBtn = document.getElementById('close-chat-btn');
        if (!closeBtn) {
            closeBtn = document.createElement('button');
            closeBtn.textContent = '← Torna alle webcam';
            closeBtn.id = 'close-chat-btn';
            
            closeBtn.style.cssText = `
                position: relative; width: calc(100% - 20px); padding: 10px; margin: 10px;
                border: none; background: var(--primary-color); color: var(--bg);
                font-weight: bold; cursor: pointer; border-radius: 6px;
            `; 

            const chatHeader = chatPanel.querySelector('h3');
            if(chatHeader) chatPanel.insertBefore(closeBtn, chatHeader);

            closeBtn.addEventListener('click', () => {
                chatPanel.classList.remove('active');
                setTimeout(() => {
                    chatPanel.classList.add('hidden');
                    closeBtn.remove(); 
                }, 300);
            });
        }
    } else { // desktop: sidebar toggle
        chatPanel.classList.toggle('hidden');
    }
});


sendChatButton.addEventListener('click', sendMessage);
chatMessageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
});