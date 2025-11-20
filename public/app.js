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

// LOGICA FOCUS - CORREZIONE INTESTAZIONE CHAT DM
function setFocus(peerId){
  videosGrid.querySelectorAll('.video-feed').forEach(feed => feed.classList.remove('is-focused'));
  focusedPeerId = peerId;
  
  // Aggiorna l'intestazione della chat in base al peer in focus
  const chatHeader = document.getElementById('chat-panel').querySelector('h3');

  if (peerId === 'local' || !peerConnections[peerId]) {
      localFeedEl.classList.add('is-focused');
      // CORREZIONE: Assicura che l'intestazione sia 'Chat Pubblica' quando il focus è su locale
      chatHeader.textContent = '💬 Chat Pubblica'; 
  } else {
      const newFocused = videosGrid.querySelector(`[data-peer-id="${focusedPeerId}"]`);
      if(newFocused) newFocused.classList.add('is-focused');
      const recipientNickname = remoteNicknames[peerId];
      // Intestazione DM
      chatHeader.textContent = `💬 DM a ${recipientNickname}`; 
  }
}

function addRemoteControlListeners(feed){
    const videoEl = feed.querySelector('video');
    const muteButton = feed.querySelector('.remote-mute-toggle');
    const muteIcon = muteButton.querySelector('.material-icons');
    
    if(videoEl) videoEl.muted = false; 

    muteButton.addEventListener('click', () => {
        if (!videoEl) return;
        videoEl.muted = !videoEl.muted;
        muteIcon.textContent = videoEl.muted ? 'volume_off' : 'mic';
        muteButton.title = videoEl.muted ? 'Attiva audio utente' : 'Muta utente remoto';
    });
}

function ensureRemoteFeed(socketId, nickname='Utente'){
  // CORREZIONE CRITICA: usa 'dataset.peerId' per la selezione, non 'dataset.peer-id'
  let feed = videosGrid.querySelector(`[data-peer-id="${socketId}"]`);
  if(feed) return feed;

  const template = document.getElementById('remote-video-template');
  const div = template.content.cloneNode(true).querySelector('.video-feed');
  // CORREZIONE CRITICA: usa 'dataset.peerId' (camelCase) in JS, mentre l'HTML è corretto
  div.dataset.peerId = socketId; 
  div.querySelector('.video-label').textContent = nickname;
  addRemoteControlListeners(div); 
  div.addEventListener('click', ()=> setFocus(socketId)); 

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

  if(focusedPeerId === socketId) setFocus('local');

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

  if(socket) socket.disconnect();
  location.reload();
}

// Condivisione Schermo
async function toggleScreenShare() {
    // La condivisione schermo su mobile non è supportata
    if( /Mobi|Android/i.test(navigator.userAgent) ) {
        alert("La condivisione dello schermo non è supportata sulla maggior parte dei dispositivi mobili.");
        return;
    }
    
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            Object.values(videoSenders).forEach(sender => sender.replaceTrack(videoTrack)); 
            updateLocalVideo(); 
        }
        
        // Torna a 4:3
        localFeedEl.classList.remove('ratio-16-9'); 
        localFeedEl.classList.add('ratio-4-3');
        
        socket.emit('stream-type-changed', currentRoomId, '4-3');
        shareScreenButton.querySelector('.material-icons').textContent = 'screen_share';
        shareScreenButton.title = 'Condividi Schermo';
    } else {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            const screenVideoTrack = screenStream.getVideoTracks()[0];
            Object.values(videoSenders).forEach(sender => sender.replaceTrack(screenVideoTrack));
            updateLocalVideo();
            screenVideoTrack.onended = toggleScreenShare; 
            
            // Passa a 16:9
            localFeedEl.classList.remove('ratio-4-3');
            localFeedEl.classList.add('ratio-16-9');
            
            socket.emit('stream-type-changed', currentRoomId, '16-9');
            shareScreenButton.querySelector('.material-icons').textContent = 'stop_screen_share';
            shareScreenButton.title = 'Interrompi Condivisione';
            Object.values(peerConnections).forEach(pc => pc.onnegotiationneeded());
        } catch (err) {
            log('Errore condivisione schermo:', err);
            screenStream = null;
            localFeedEl.classList.remove('ratio-16-9'); 
            localFeedEl.classList.add('ratio-4-3');
            shareScreenButton.querySelector('.material-icons').textContent = 'screen_share';
            shareScreenButton.title = 'Condividi Schermo';
        }
    }
}

// ---------- Link e URL ----------
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

// ---------- Chat Logic ----------
// LOGICA DM: AGGIUNTO SUPPORTO DM
function addChatMessage(sender, message, isLocal=false, dmRecipient=null){
    const messageEl = document.createElement('div');
    messageEl.classList.add('chat-message');

    let senderHtml = '';
    
    if (dmRecipient) {
        // Messaggio Privato (inviato o ricevuto)
        messageEl.classList.add('private-message');
        if(isLocal) {
            // DM Inviato: Tu -> Destinatario
            senderHtml = `<span class="sender-me">DM a ${dmRecipient}: </span>`;
            messageEl.classList.add('local'); // Aggiunto per styling locale
        } else {
            // DM Ricevuto: Mittente -> Tu
            senderHtml = `<span class="sender-remote">DM da ${sender}: </span>`;
            messageEl.classList.add('remote'); // Aggiunto per styling remoto
        }
    } else {
        // Messaggio Pubblico
        if(isLocal) {
            senderHtml = `<span class="sender-me">${sender}: </span>`;
            messageEl.classList.add('local'); 
        } else {
            senderHtml = `<span class="sender-remote">${sender}: </span>`;
            messageEl.classList.add('remote'); 
        }
    }
    
    messageEl.innerHTML = senderHtml + message;

    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function clearChatInput(){ chatMessageInput.value = ''; }

// LOGICA DM: INVIA MESSAGGIO PRIVATO se focusedPeerId è settato
function sendMessage(){
    const message = chatMessageInput.value.trim();
    if (!message) return;
    if (socket && currentRoomId) {
        
        // CHECK DM: Se il focus non è su 'local' e l'ID è presente tra i peer
        if (focusedPeerId !== 'local' && peerConnections[focusedPeerId]) {
            // Invia Messaggio Privato (DM)
            const recipientId = focusedPeerId;
            const recipientNickname = remoteNicknames[recipientId];

            socket.emit('send-private-message', currentRoomId, recipientId, userNickname, message);
            // Visualizza il messaggio locale come DM inviato
            addChatMessage('Tu', message, true, recipientNickname); 
        } else {
            // Invia Messaggio Pubblico
            socket.emit('send-message', currentRoomId, userNickname, message);
            addChatMessage(userNickname, message, true);
        }

        clearChatInput();
    } else {
        log('Errore: Socket non connesso o RoomId mancante. Messaggio non inviato.');
        alert('Impossibile inviare il messaggio: connessione non stabilita.');
    }
}

// ---------- Socket.IO / WebRTC ----------
function initializeSocket(){
  socket = io(RENDER_SERVER_URL);
  
  socket.on('connect', ()=> log('Connesso', socket.id));

  socket.on('welcome', (newPeerId, nickname, peers=[])=>{
    remoteNicknames[newPeerId] = nickname;
    addChatMessage('Sistema', `Benvenuto nella stanza ${currentRoomId}!`);
    peers.forEach(peer=>{
      if(peer.id !== socket.id) {
        remoteNicknames[peer.id] = peer.nickname;
        createPeerConnection(peer.id); 
      }
    });
    setFocus('local');
  });

  socket.on('peer-joined', (peerId,nickname)=>{
    remoteNicknames[peerId] = nickname;
    createPeerConnection(peerId); 
    log(`Peer unito: ${nickname} (${peerId})`);
    addChatMessage('Sistema', `${nickname} è entrato.`);
  });

  socket.on('peer-left', (peerId)=>{
    const nickname = remoteNicknames[peerId] || 'Un utente';
    removeRemoteFeed(peerId);
    addChatMessage('Sistema', `${nickname} è uscito.`);
  });

  socket.on('new-message', (senderNickname, message)=>{
    // Messaggio Pubblico
    addChatMessage(senderNickname, message, false);
  });
  
  // LISTENER: RICEZIONE DM
  socket.on('new-private-message', (senderNickname, message)=>{
    // Messaggio Privato ricevuto. dmRecipient = 'Tu'
    addChatMessage(senderNickname, message, false, 'Tu');
  });

  socket.on('remote-stream-type-changed', (peerId, newRatio) => {
      const feed = videosGrid.querySelector(`[data-peer-id="${peerId}"]`);
      if(feed){
          feed.classList.remove('ratio-4-3', 'ratio-16-9');
          feed.classList.add(`ratio-${newRatio}`);
          log(`Rapporto video aggiornato per ${remoteNicknames[peerId]} a ${newRatio}`);
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
        log(`Candidato ICE accodato per ${fromId}.`);
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
  } else log('WARNING: localStream è null.');

  pc.onicecandidate = event=>{ if(event.candidate) socket.emit('candidate', socketId, event.candidate); };
  pc.ontrack = event=>{
    const feed = ensureRemoteFeed(socketId, remoteNicknames[socketId]);
    const video = feed.querySelector('video');
    if(video && event.streams.length > 0) video.srcObject = event.streams[0];
    else log(`Impossibile collegare lo stream per ${socketId}.`);
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

// ---------- Inizializzazione Listener e Avvio ----------
document.addEventListener('DOMContentLoaded', () => {
    const urlRoomId = getRoomIdFromUrl();
    if (urlRoomId) roomIdInput.value = urlRoomId;

    // Assicuriamo che su mobile la chat sia nascosta inizialmente
    if(window.innerWidth <= 768) {
        chatPanel.classList.add('hidden');
    }
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
  setFocus('local');
  localFeedEl.addEventListener('click', ()=> setFocus('local'));
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