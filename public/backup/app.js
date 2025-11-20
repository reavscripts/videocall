// app.js

// URL del server WebSocket / Socket.IO
const RENDER_SERVER_URL = (typeof process !== 'undefined' && process.env.SOCKET_URL)
    ? process.env.SOCKET_URL
    : "https://videocall-webrtc-signaling-server.onrender.com";

// ---------- DOM & Controlli ----------
const nicknameOverlay = document.getElementById('nickname-overlay');
const joinButton = document.getElementById('join-button');
const nicknameInput = document.getElementById('nickname-input');
const roomIdInput = document.getElementById('room-id-input');
const videosGrid = document.getElementById('videos-grid'); 
const localVideoEl = document.getElementById('local-video');
const localFeedEl = document.getElementById('local-feed'); 

// Controlli Media
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
const showChatButton = document.getElementById('show-chat-btn');

// Variabili globali
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

// ---------- Local Media ----------
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

// ---------- Focus Video ----------
function setFocus(peerId){
  videosGrid.querySelectorAll('.video-feed').forEach(feed => feed.classList.remove('is-focused'));
  focusedPeerId = peerId;
  if(peerId === 'local'){
    localFeedEl.classList.add('is-focused');
  } else {
    const newFocused = videosGrid.querySelector(`[data-peer-id="${peerId}"]`);
    if(newFocused) newFocused.classList.add('is-focused');
  }
}

// ---------- Remote Video ----------
function addRemoteControlListeners(feed){
  const videoEl = feed.querySelector('video');
  const muteButton = feed.querySelector('.remote-mute-toggle');
  const muteIcon = muteButton.querySelector('.material-icons');
  
  if(videoEl) videoEl.muted = false; 

  muteButton.addEventListener('click', () => {
      if(!videoEl) return;
      videoEl.muted = !videoEl.muted;
      muteIcon.textContent = videoEl.muted ? 'volume_off' : 'mic';
      muteButton.title = videoEl.muted ? 'Attiva audio utente' : 'Muta utente remoto';
  });
}

function ensureRemoteFeed(socketId, nickname='Utente'){
  let feed = videosGrid.querySelector(`[data-peer-id="${socketId}"]`);
  if(feed) return feed;

  const template = document.getElementById('remote-video-template');
  const div = template.content.cloneNode(true).querySelector('.video-feed');
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
  if(localStream) localStream.getAudioTracks().forEach(t => t.enabled = isAudioEnabled);
  toggleAudioButton.querySelector('.material-icons').textContent = isAudioEnabled ? 'mic' : 'mic_off';
  localMicStatusIcon.textContent = isAudioEnabled ? 'mic' : 'mic_off'; 
}

function toggleVideo(){
  isVideoEnabled = !isVideoEnabled;
  if(localStream) localStream.getVideoTracks().forEach(t => t.enabled = isVideoEnabled);
  toggleVideoButton.querySelector('.material-icons').textContent = isVideoEnabled ? 'videocam' : 'videocam_off';
}

function disconnect(){
  Object.values(peerConnections).forEach(pc => pc.close());
  localStream?.getTracks().forEach(t => t.stop());
  screenStream?.getTracks().forEach(t => t.stop());
  socket?.disconnect();
  location.reload();
}

// ---------- Screen Share ----------
async function toggleScreenShare(){
  if(screenStream){
    screenStream.getTracks().forEach(t => t.stop());
    screenStream = null;
    if(localStream){
      const videoTrack = localStream.getVideoTracks()[0];
      Object.values(videoSenders).forEach(s => s.replaceTrack(videoTrack));
    }
    localFeedEl.classList.remove('ratio-16-9'); 
    localFeedEl.classList.add('ratio-4-3');
    shareScreenButton.querySelector('.material-icons').textContent = 'screen_share';
    shareScreenButton.title = 'Condividi Schermo';
  } else {
    try{
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video:true, audio:true });
      const screenVideoTrack = screenStream.getVideoTracks()[0];
      Object.values(videoSenders).forEach(s => s.replaceTrack(screenVideoTrack));
      updateLocalVideo();
      screenVideoTrack.onended = toggleScreenShare;
      localFeedEl.classList.remove('ratio-4-3');
      localFeedEl.classList.add('ratio-16-9');
      shareScreenButton.querySelector('.material-icons').textContent = 'stop_screen_share';
      shareScreenButton.title = 'Interrompi Condivisione';
      Object.values(peerConnections).forEach(pc => pc.onnegotiationneeded());
    }catch(err){
      log('Errore condivisione schermo:', err);
      screenStream = null;
      localFeedEl.classList.remove('ratio-16-9'); 
      localFeedEl.classList.add('ratio-4-3');
      shareScreenButton.querySelector('.material-icons').textContent = 'screen_share';
      shareScreenButton.title = 'Condividi Schermo';
    }
  }
}

// ---------- Chat ----------
function addChatMessage(sender,message,isLocal=false){
  const msg = document.createElement('div');
  msg.classList.add('chat-message');
  msg.innerHTML = isLocal 
    ? `<span class="sender-me">Tu: </span>${message}` 
    : `<span class="sender-remote">${sender}: </span>${message}`;
  messagesContainer.appendChild(msg);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function clearChatInput(){ chatMessageInput.value = ''; }

function sendMessage(){
  const message = chatMessageInput.value.trim();
  if(!message) return;
  if(socket && currentRoomId){
    socket.emit('send-message', currentRoomId, userNickname, message);
    addChatMessage(userNickname,message,true);
    clearChatInput();
  } else {
    alert('Impossibile inviare messaggio: connessione non stabilita.');
  }
}

// ---------- Socket.IO / WebRTC ----------
function initializeSocket(){
  socket = io(RENDER_SERVER_URL);

  socket.on('connect', ()=> log('Connesso', socket.id));

  socket.on('welcome',(newPeerId,nickname,peers=[])=>{
    remoteNicknames[newPeerId]=nickname;
    addChatMessage('Sistema',`Benvenuto nella stanza ${currentRoomId}!`);
    peers.forEach(peer=>{ if(peer.id!==socket.id){ remoteNicknames[peer.id]=peer.nickname; createPeerConnection(peer.id); } });
    setFocus('local');
  });

  socket.on('peer-joined',(peerId,nickname)=>{
    remoteNicknames[peerId]=nickname;
    createPeerConnection(peerId);
    addChatMessage('Sistema',`${nickname} è entrato.`);
  });

  socket.on('peer-left',(peerId)=>{
    const nickname=remoteNicknames[peerId]||'Un utente';
    removeRemoteFeed(peerId);
    addChatMessage('Sistema',`${nickname} è uscito.`);
  });

  socket.on('new-message',(sender,message)=>{ addChatMessage(sender,message,false); });

  socket.on('offer',async (fromId,offer)=>{
    const pc=createPeerConnection(fromId);
    if(pc.signalingState!=='stable') return;
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    if(iceCandidateQueues[fromId]) iceCandidateQueues[fromId].forEach(c=>{ if(c) pc.addIceCandidate(new RTCIceCandidate(c)); });
    iceCandidateQueues[fromId]=[];
    const answer=await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer',fromId,pc.localDescription);
  });

  socket.on('answer',async(fromId,answer)=>{
    const pc=peerConnections[fromId];
    if(pc && pc.signalingState==='have-local-offer') await pc.setRemoteDescription(new RTCSessionDescription(answer));
  });

  socket.on('candidate',async(fromId,candidate)=>{
    const pc=peerConnections[fromId];
    if(pc && candidate){
      if(pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(candidate));
      else { if(!iceCandidateQueues[fromId]) iceCandidateQueues[fromId]=[]; iceCandidateQueues[fromId].push(candidate); }
    }
  });
}

// ---------- Peer Connection ----------
function createPeerConnection(socketId){
  if(peerConnections[socketId]) return peerConnections[socketId];
  const pc=new RTCPeerConnection(iceConfiguration);
  peerConnections[socketId]=pc;
  iceCandidateQueues[socketId]=[];

  if(localStream){
    localStream.getTracks().forEach(track=>{
      const sender=pc.addTrack(track,localStream);
      if(track.kind==='video') videoSenders[socketId]=sender;
    });
  }

  pc.onicecandidate=event=>{ if(event.candidate) socket.emit('candidate',socketId,event.candidate); };
  pc.ontrack=event=>{
    const feed=ensureRemoteFeed(socketId,remoteNicknames[socketId]);
    const video=feed.querySelector('video');
    if(video && event.streams && event.streams.length>0) video.srcObject=event.streams[0];
  };

  const shouldCreateOffer = (socket.id < socketId);
  pc.onnegotiationneeded=async()=>{
    if(!shouldCreateOffer) return;
    if(pc.signalingState!=='stable') return;
    try{ const offer=await pc.createOffer(); await pc.setLocalDescription(offer); socket.emit('offer',socketId,pc.localDescription); }
    catch(err){ console.error('Errore offer',err); }
  };

  return pc;
}

// ---------- URL / Link ----------
function getRoomIdFromUrl(){ return new URLSearchParams(window.location.search).get('room'); }
function copyRoomLink(){
  const url=`${window.location.protocol}//${window.location.host}${window.location.pathname}?room=${currentRoomId}`;
  navigator.clipboard.writeText(url).then(()=>{ shareRoomLinkButton.value='Link Copiato!'; setTimeout(()=>{ shareRoomLinkButton.value='Ottieni Link'; },3000); });
}

// ---------- Event Listeners ----------
document.addEventListener('DOMContentLoaded',()=>{
  const urlRoomId=getRoomIdFromUrl();
  if(urlRoomId) roomIdInput.value=urlRoomId;
});

joinButton.addEventListener('click',async()=>{
  const nickname=nicknameInput.value.trim();
  const roomId=roomIdInput.value.trim();
  if(!nickname||!roomId){ alert('Inserisci nickname e stanza'); return; }
  userNickname=nickname;
  currentRoomId=roomId;
  await startLocalMedia();
  initializeSocket();
  socket.emit('join-room',currentRoomId,userNickname);
  document.getElementById('room-name-display').textContent=roomId;
  showOverlay(false);
  setFocus('local');
  localFeedEl.addEventListener('click',()=> setFocus('local'));
});

toggleAudioButton.addEventListener('click',toggleAudio);
toggleVideoButton.addEventListener('click',toggleVideo);
disconnectButton.addEventListener('click',disconnect);
shareScreenButton.addEventListener('click',toggleScreenShare); 
shareRoomLinkButton.addEventListener('click',copyRoomLink);

// Chat
sendChatButton.addEventListener('click',sendMessage);
chatMessageInput.addEventListener('keydown',e=>{ if(e.key==='Enter') sendMessage(); });

// Mostra/Nascondi chat su mobile/desktop
showChatButton.addEventListener('click',()=>{
  if(window.innerWidth<=768){
    chatPanel.classList.toggle('mobile-fullscreen');
    if(chatPanel.classList.contains('mobile-fullscreen')){
      const backBtn=document.createElement('button');
      backBtn.textContent='🔙 Torna alle Webcam';
      backBtn.id='chat-back-btn';
      backBtn.style.marginBottom='10px';
      chatPanel.prepend(backBtn);
      backBtn.addEventListener('click',()=>{
        chatPanel.classList.remove('mobile-fullscreen');
        backBtn.remove();
      });
    }
  } else chatPanel.classList.toggle('hidden');
});
