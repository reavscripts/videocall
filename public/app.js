// app.js - Full featured WebRTC frontend (completo)
//
// Funzionalità incluse:
// - Connessione a signaling server Socket.IO
// - WebRTC multi-peer (offer/answer/candidate)
// - Grid responsive: focus top-left più grande, remote video in griglia
// - Doppio click su video -> fullscreen
// - Toggle microfono / videocamera
// - Condivisione schermo (start/stop) con replaceTrack
// - Blur toggle (semplice filter; commento per integrazione BodyPix/MediaPipe)
// - Chat via Socket.IO
// - Raise hand sincronizzato
// - Clean disconnect & cleanup
// - Reconnection attempt (semplice) su socket drop
//
// Nota: per blur avanzato (separare soggetto da sfondo) integra BodyPix o MediaPipe
//       e sostituisci il localStream con uno stream canvas composito.
//       Ho lasciato uno stub e commenti in proposito.
//
// Configura RENDER_SERVER_URL con il tuo server di signaling (public link fornito)
const RENDER_SERVER_URL = "https://videocall-webrtc-signaling-server.onrender.com";
//const RENDER_SERVER_URL = "https://localhost:3000/";
// ---------- DOM ----------
const nicknameOverlay = document.getElementById('nickname-overlay');
const joinButton = document.getElementById('join-button');
const nicknameInput = document.getElementById('nickname-input');
const roomIdInput = document.getElementById('room-id-input');

const conferenceContainer = document.getElementById('conference-container');
const roomNameDisplay = document.getElementById('room-name-display');
const shareRoomLinkInput = document.getElementById('share-room-link');

const remoteVideosContainer = document.getElementById('remote-videos-container'); // grid container
const mainVideoFeed = document.getElementById('main-video-feed'); // container for local/main
const localVideoEl = document.getElementById('local-video');

const remoteTemplate = document.getElementById('remote-video-template');

const toggleAudioButton = document.getElementById('toggle-audio-button');
const toggleVideoButton = document.getElementById('toggle-video-button');
const shareScreenButton = document.getElementById('share-screen-button');
const blurToggle = document.getElementById('blur-toggle');
const raiseHandBtn = document.getElementById('raise-hand-btn');
const disconnectButton = document.getElementById('disconnect-button');
const mainMuteBtn = document.getElementById('main-mute-btn');

const showChatBtn = document.getElementById('show-chat-btn');
const showGridBtn = document.getElementById('show-grid-btn');
const chatPanel = document.getElementById('chat-panel');
const messagesContainer = document.getElementById('messages-container');
const chatMessageInput = document.getElementById('chat-message-input');
const sendChatButton = document.getElementById('send-chat-button');

// ---------- State ----------
let socket = null;
let localStream = null;        // MediaStream (camera + mic)
let screenStream = null;       // MediaStream (screen)
let userNickname = 'Ospite';
let currentRoomId = null;

const peerConnections = {};    // { socketId: RTCPeerConnection }
const remoteNicknames = {};    // { socketId: nickname }
let focusedPeerId = 'local';   // peerId currently in visual focus (main)
let blurApplied = false;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;

// ICE servers config
const iceConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// ---------- Helpers & UI ----------

function log(...args) { console.log('[APP]', ...args); }

function showOverlay(show) {
  if (show) {
    nicknameOverlay.classList.remove('hidden');
    conferenceContainer.classList.add('hidden');
  } else {
    nicknameOverlay.classList.add('hidden');
    conferenceContainer.classList.remove('hidden');
  }
}

function setupRoomLink() {
  const roomUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(currentRoomId)}`;
  shareRoomLinkInput.value = "Ottieni Link";
  const clone = shareRoomLinkInput.cloneNode(true);
  shareRoomLinkInput.parentNode.replaceChild(clone, shareRoomLinkInput);
  clone.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      const original = clone.value;
      clone.value = "Link Copiato!";
      clone.style.backgroundColor = '#4CAF50';
      setTimeout(() => { clone.value = original; clone.style.backgroundColor = ''; }, 1500);
    } catch (e) {
      // fallback
      alert(`Copia manuale: ${roomUrl}`);
    }
  });
}

// Check ?room=... param
function checkRoomUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const room = urlParams.get('room');
  if (room) {
    roomIdInput.value = decodeURIComponent(room);
    nicknameInput.focus();
  }
}

// Update CSS focus classes for grid layout
function updateGridLayout() {
  document.querySelectorAll('.video-feed').forEach(el => el.classList.remove('is-focused'));
  const focused = document.querySelector(`.video-feed[data-peer-id="${focusedPeerId}"]`);
  if (focused) focused.classList.add('is-focused');
}

// Create/refresh local video element (exists in HTML already)
function createLocalVideoElement() {
  const localFeed = mainVideoFeed; // '#main-video-feed' container includes <video id="local-video">
  localFeed.dataset.peerId = 'local';
  if (localVideoEl && localStream) {
    localVideoEl.srcObject = localStream;
    localVideoEl.muted = true;
    localVideoEl.playsInline = true;
  }
  // ensure local feed has data-peer-id attribute
  updateGridLayout();
}

// Append a remote feed (or reuse if exists)
function ensureRemoteFeed(socketId, nickname = 'Utente') {
  let remoteFeed = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${socketId}"]`);
  if (remoteFeed) {
    // update label
    const label = remoteFeed.querySelector('.video-label');
    if (label) label.textContent = nickname;
    return remoteFeed;
  }
  // clone template
  const clone = remoteTemplate.content.cloneNode(true);
  remoteFeed = clone.querySelector('.remote-feed');
  remoteFeed.dataset.peerId = socketId;
  remoteFeed.querySelector('.video-label').textContent = nickname;
  // click to focus
  remoteFeed.addEventListener('click', () => setMainVideo(socketId));
  // double click for fullscreen on video element
  const v = remoteFeed.querySelector('video');
  v.addEventListener('dblclick', () => {
    if (!document.fullscreenElement) {
      remoteFeed.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });
  // status icons area exists in template's markup -> update when needed
  // append
  remoteVideosContainer.appendChild(remoteFeed);
  // remove placeholder if present
  document.getElementById('remote-video-placeholder')?.remove();
  return remoteFeed;
}

// Remove remote feed element and pc
function removeRemoteFeed(peerId) {
  const el = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${peerId}"]`);
  if (el) el.remove();
  if (peerConnections[peerId]) {
    try { peerConnections[peerId].close(); } catch(e){}
    delete peerConnections[peerId];
  }
  delete remoteNicknames[peerId];
  // restore placeholder if none
  if (Object.keys(peerConnections).length === 0) {
    if (!document.getElementById('remote-video-placeholder')) {
      const placeholderDiv = document.createElement('div');
      placeholderDiv.id = 'remote-video-placeholder';
      placeholderDiv.className = 'video-placeholder';
      placeholderDiv.textContent = 'In attesa di altri partecipanti...';
      remoteVideosContainer.appendChild(placeholderDiv);
    }
  }
  // if focused was the removed one, fallback to local
  if (focusedPeerId === peerId) {
    setMainVideo('local');
  }
}

// Set main focus (changes CSS; main video element remains local video element but grid visual indicates focus)
function setMainVideo(peerId) {
  focusedPeerId = peerId;
  updateGridLayout();
  // update main label when switching to remote: copy label from remote to main label for clarity
  const mainLabelEl = mainVideoFeed.querySelector('.video-label');
  if (!mainLabelEl) return;
  if (peerId === 'local') {
    mainLabelEl.textContent = `${userNickname} (Tu)`;
    // ensure local video is in the main feed (we always keep local video inside main feed)
    if (localVideoEl && localStream) {
      mainVideoFeed.querySelector('video').srcObject = localStream;
    }
    mainMuteBtn.style.display = 'none';
  } else {
    // show remote's nickname and show main mute button (to mute remote audio locally)
    mainLabelEl.textContent = remoteNicknames[peerId] || 'Utente';
    // set main video element srcObject to remote stream if we want to show remote in main video area
    // Approach: copy remote stream into main area by using its stream object
    const remoteFeed = remoteVideosContainer.querySelector(`.remote-feed[data-peer-id="${peerId}"]`);
    const remoteVideo = remoteFeed?.querySelector('video');
    if (remoteVideo && remoteVideo.srcObject) {
      mainVideoFeed.querySelector('video').srcObject = remoteVideo.srcObject;
      // mute main if it's remote? default not muted; we provide a mute toggle
      mainMuteBtn.style.display = 'block';
    } else {
      // remote stream not ready; fallback to local
      mainLabelEl.textContent = `${userNickname} (Tu)`;
      mainMuteBtn.style.display = 'none';
    }
  }
}

// Toggle mute for main video (only local UI mute for remote audio)
function toggleMainMute() {
  const v = mainVideoFeed.querySelector('video');
  if (!v) return;
  v.muted = !v.muted;
  mainMuteBtn.textContent = v.muted ? '🔇' : '🔊';
}

// ---------- Media (getUserMedia, screen share, track replace) ----------

async function startLocalMedia(constraints = { audio: true, video: true }) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    createLocalVideoElement();
    setMainVideo('local');
    return localStream;
  } catch (error) {
    console.error('getUserMedia error', error);
    throw error;
  }
}

async function stopLocalMedia() {
  try {
    localStream?.getTracks().forEach(t => t.stop());
  } catch (e) {}
  localStream = null;
}

// Replace local video track across all peerConnections (used for screen share and for toggling camera)
function replaceVideoTrack(newTrack) {
  // replace within localStream
  const oldVideoTrack = localStream?.getVideoTracks()[0];
  if (oldVideoTrack) {
    try {
      localStream.removeTrack(oldVideoTrack);
      oldVideoTrack.stop();
    } catch (e) {}
  }
  localStream.addTrack(newTrack);

  // update local video element
  if (localVideoEl) {
    localVideoEl.srcObject = null;
    localVideoEl.srcObject = localStream;
    localVideoEl.muted = true;
  }

  // replace in all peer connections
  Object.values(peerConnections).forEach(pc => {
    const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender) {
      sender.replaceTrack(newTrack).catch(err => {
        console.warn('replaceTrack error', err);
      });
    }
  });
}

// Screen sharing toggle
async function toggleScreenShare() {
  try {
    if (screenStream) {
      // stop sharing, revert to camera
      screenStream.getTracks().forEach(t => t.stop());
      screenStream = null;
      // get camera stream and replace
      const cam = await navigator.mediaDevices.getUserMedia({ video: true });
      replaceVideoTrack(cam.getVideoTracks()[0]);
      shareScreenButton.textContent = '🖥️';
      return;
    }

    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = screenStream.getVideoTracks()[0];
    replaceVideoTrack(screenTrack);
    shareScreenButton.textContent = '🛑';

    // when user stops sharing via browser UI
    screenTrack.onended = async () => {
      screenStream = null;
      try {
        const cam = await navigator.mediaDevices.getUserMedia({ video: true });
        replaceVideoTrack(cam.getVideoTracks()[0]);
      } catch (e) {
        console.warn('Cannot reacquire camera after screen share stopped', e);
      } finally {
        shareScreenButton.textContent = '🖥️';
      }
    };
  } catch (e) {
    console.warn('Screen share failed or cancelled', e);
  }
}

// Toggle audio (mic)
function toggleAudio() {
  const track = localStream?.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  toggleAudioButton.textContent = track.enabled ? '🎤' : '🔇';
  // Notify peers (so they can show mute icon)
  socket?.emit('peer-mute', socket.id, !track.enabled);
}

// Toggle camera (video)
async function toggleVideo() {
  const track = localStream?.getVideoTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  toggleVideoButton.textContent = track.enabled ? '📹' : '📸';
}

// Simple blur toggle (applies CSS filter to local video element).
// NOTE: this is not a real background segmentation blur; for true background blur, integrate BodyPix / MediaPipe
function toggleBlur() {
  blurApplied = !blurApplied;
  if (!localVideoEl) return;
  if (blurApplied) {
    localVideoEl.style.filter = 'blur(6px) saturate(0.95)';
    blurToggle.textContent = '✨';
  } else {
    localVideoEl.style.filter = '';
    blurToggle.textContent = '✨';
  }
}

// ---------- Chat & Raise Hand ----------
function appendMessage(nickname, message, isLocal = false) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message');
  if (isLocal) messageDiv.classList.add('self');

  const senderSpan = document.createElement('span');
  senderSpan.classList.add('sender');
  senderSpan.textContent = isLocal ? 'Tu' : nickname;

  const timeSpan = document.createElement('span');
  timeSpan.classList.add('timestamp');
  timeSpan.textContent = ` (${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}):`;

  messageDiv.appendChild(senderSpan);
  messageDiv.appendChild(timeSpan);
  messageDiv.appendChild(document.createTextNode(` ${message}`));

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendChatMessage() {
  const message = chatMessageInput.value.trim();
  if (!message || !socket) return;
  appendMessage(userNickname, message, true);
  socket.emit('chat-message', message);
  chatMessageInput.value = '';
}

// Raise hand (emit event)
function raiseHand() {
  socket?.emit('raise-hand', socket.id);
  // local visual feedback
  raiseHandBtn.classList.add('raised');
  setTimeout(() => raiseHandBtn.classList.remove('raised'), 2000);
}

// ---------- Socket.IO & WebRTC ----------

function initializeSocket() {
  socket = io(RENDER_SERVER_URL, {
    query: { roomId: currentRoomId, nickname: userNickname },
    reconnectionAttempts: MAX_RECONNECT
  });

  socket.on('connect', () => {
    log('socket connected', socket.id);
    reconnectAttempts = 0;
  });

  socket.on('disconnect', (reason) => {
    log('socket disconnected', reason);
    // No automatic heavy cleanup here; attempt reconnecting is handled by socket.io
  });

  socket.on('connect_error', (err) => {
    log('connect_error', err);
  });

  // server emits welcome with newPeerId (the one who joined), nickname and current peers array
  socket.on('welcome', (newPeerId, nickname, peers = []) => {
    log('welcome', newPeerId, nickname, peers);
    // store nickname
    remoteNicknames[newPeerId] = nickname;
    // init connections to existing peers (peers is array of {id, nickname})
    peers.forEach(peer => {
      if (peer.id !== socket.id) {
        remoteNicknames[peer.id] = peer.nickname || peer.id;
        createPeerConnection(peer.id, true);
      }
    });
    // If newPeerId isn't self, create connection to them (they may be the one that triggered this)
    if (newPeerId !== socket.id) {
      createPeerConnection(newPeerId, false);
    }
  });

  socket.on('peer-joined', (peerId, nickname) => {
    log('peer-joined', peerId, nickname);
    remoteNicknames[peerId] = nickname;
    createPeerConnection(peerId, true); // create offer towards them
  });

  socket.on('peer-left', (peerId) => {
    log('peer-left', peerId);
    removeRemoteFeed(peerId);
  });

  socket.on('chat-message', (senderId, nickname, message) => {
    if (senderId !== socket.id) appendMessage(nickname, message, false);
  });

  // low-level WebRTC signaling (offer/answer/candidate)
  socket.on('offer', async (fromId, offer) => {
    try {
      log('received offer from', fromId);
      const pc = createPeerConnection(fromId, false);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', fromId, pc.localDescription);
    } catch (e) {
      console.error('handle offer error', e);
    }
  });

  socket.on('answer', async (fromId, answer) => {
    try {
      const pc = peerConnections[fromId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (e) {
      console.error('handle answer error', e);
    }
  });

  socket.on('candidate', async (fromId, candidate) => {
    try {
      if (!candidate) return;
      const pc = peerConnections[fromId];
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      // ICE addition errors are common for duplicates; ignore
    }
  });

  // peer mute and raise-hand visual
  socket.on('peer-mute', (peerId, muted) => {
    const feed = document.querySelector(`.video-feed[data-peer-id="${peerId}"]`);
    if (feed) {
      const icons = feed.querySelector('.status-icons');
      if (icons) icons.innerHTML = muted ? '<span class="icon">🔇</span>' : '';
    }
  });

  socket.on('raise-hand', (peerId) => {
    const feed = document.querySelector(`.video-feed[data-peer-id="${peerId}"]`);
    if (feed) {
      const icons = feed.querySelector('.status-icons');
      if (icons) {
        icons.innerHTML += '<span class="icon">✋</span>';
        setTimeout(() => { icons.innerHTML = icons.innerHTML.replace('✋', ''); }, 4000);
      }
    }
  });

  // reconnect logic (simple)
  socket.io.on('reconnect_attempt', () => {
    reconnectAttempts++;
    if (reconnectAttempts > MAX_RECONNECT) {
      socket.disconnect();
      log('Max reconnect attempts reached');
    }
  });
}

// Create RTCPeerConnection for a remote peer
function createPeerConnection(socketId, isOfferer) {
  if (!localStream) {
    console.warn('createPeerConnection called before localStream is ready');
    // attempt to start camera quickly
    startLocalMedia().catch(() => {});
  }

  if (peerConnections[socketId]) return peerConnections[socketId];

  const pc = new RTCPeerConnection(iceConfiguration);
  peerConnections[socketId] = pc;

  // add local tracks
  try {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  } catch (e) {
    console.warn('Error adding local tracks to pc', e);
  }

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('candidate', socketId, event.candidate);
    }
  };

  pc.ontrack = (event) => {
    // event.streams[0] contains the MediaStream from remote peer
    handleRemoteStream(socketId, event.streams[0]);
  };

  pc.onnegotiationneeded = async () => {
    if (isOfferer) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', socketId, pc.localDescription);
      } catch (e) {
        console.warn('negotiationneeded error', e);
      }
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
      // server will likely emit 'peer-left' eventually; keep cleanup conservative
      log('pc connectionState', pc.connectionState, 'for', socketId);
    }
  };

  return pc;
}

// handle remote stream arrival
function handleRemoteStream(socketId, stream) {
  remoteNicknames[socketId] = remoteNicknames[socketId] || 'Utente';
  const remoteFeed = ensureRemoteFeed(socketId, remoteNicknames[socketId]);
  const v = remoteFeed.querySelector('video');
  if (v) v.srcObject = stream;
  // initial status icons clearing
  const icons = remoteFeed.querySelector('.status-icons');
  if (icons) icons.innerHTML = '';
  // if currently focused is local, put new peer in focus by default behavior
  if (focusedPeerId === 'local') setMainVideo(socketId);
}

// ---------- Join / Leave ----------

joinButton.addEventListener('click', async () => {
  const nickname = nicknameInput.value.trim();
  const roomId = roomIdInput.value.trim();
  if (!nickname || !roomId) {
    alert('Per favore inserisci nickname e nome stanza.');
    return;
  }
  userNickname = nickname;
  currentRoomId = roomId;
  roomNameDisplay.textContent = currentRoomId;

  try {
    await startLocalMedia({ video: true, audio: true });
    createLocalVideoElement();
    showOverlay(false);
    // Prepare UI initial state: chat hidden on desktop by default
    if (!window.matchMedia("(max-width: 900px)").matches) {
      chatPanel.classList.add('hidden');
    }
    // initialize socket & join
    initializeSocket();
    setupRoomLink();
  } catch (err) {
    console.error('Errore avviando media', err);
    alert('Impossibile avviare webcam/microfono. Controlla i permessi.');
  }
});

// Disconnect / leave
disconnectButton.addEventListener('click', () => {
  leaveRoom();
});

function leaveRoom() {
  socket?.emit('leave-room');
  // close p2p
  Object.values(peerConnections).forEach(pc => {
    try { pc.close(); } catch (e) {}
  });
  Object.keys(peerConnections).forEach(k => delete peerConnections[k]);

  // stop media
  try { localStream?.getTracks().forEach(t => t.stop()); } catch (e) {}
  localStream = null;

  // remove video elements (keep main local container present)
  document.querySelectorAll('.remote-feed').forEach(el => el.remove());
  // restore placeholder
  if (!document.getElementById('remote-video-placeholder')) {
    const placeholderDiv = document.createElement('div');
    placeholderDiv.id = 'remote-video-placeholder';
    placeholderDiv.className = 'video-placeholder';
    placeholderDiv.textContent = 'In attesa di altri partecipanti...';
    remoteVideosContainer.appendChild(placeholderDiv);
  }

  // UI back to overlay
  showOverlay(true);

  // cleanup socket
  try { socket.disconnect(); } catch (e) {}
  socket = null;
}

// ---------- UI event bindings ----------

toggleAudioButton?.addEventListener('click', toggleAudio);
toggleVideoButton?.addEventListener('click', toggleVideo);
shareScreenButton?.addEventListener('click', toggleScreenShare);
blurToggle?.addEventListener('click', toggleBlur);
raiseHandBtn?.addEventListener('click', raiseHand);
mainMuteBtn?.addEventListener('click', toggleMainMute);

sendChatButton?.addEventListener('click', sendChatMessage);
chatMessageInput?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendChatMessage();
});

showChatBtn?.addEventListener('click', () => {
  // mobile: overlay panel; desktop: toggle visibility
  if (chatPanel.classList.contains('hidden')) {
    chatPanel.classList.remove('hidden');
    showChatBtn.classList.add('active');
  } else {
    chatPanel.classList.add('hidden');
    showChatBtn.classList.remove('active');
  }
});

showGridBtn?.addEventListener('click', () => {
  // Reset focus to local (returns to webcam grid view)
  setMainVideo('local');
});

// Clicking the local main video can focus/unfocus
mainVideoFeed?.addEventListener('click', () => setMainVideo('local'));

// ---------- Initialization ----------
// Pre-fill room input from URL param
document.addEventListener('DOMContentLoaded', () => {
  checkRoomUrl();
  // ensure placeholder exists
  if (!document.getElementById('remote-video-placeholder')) {
    const placeholderDiv = document.createElement('div');
    placeholderDiv.id = 'remote-video-placeholder';
    placeholderDiv.className = 'video-placeholder';
    placeholderDiv.textContent = 'In attesa di altri partecipanti...';
    remoteVideosContainer.appendChild(placeholderDiv);
  }
});

// ---------- Notes about advanced blur/background segmentation ----------
/*
If you want a true background blur (separate person from background), integrate one of:
 - TensorFlow.js BodyPix (body segmentation) -> composite a canvas where person is painted sharp and background blurred
 - MediaPipe Selfie Segmentation -> same approach via canvas
Implementation sketch:
 - Create an offscreen <canvas> same size as video
 - On each animation frame, run segmentation, draw person onto canvas and draw blurred version of original behind
 - Use canvas.captureStream() to obtain a MediaStream, then replaceVideoTrack(canvasStream.getVideoTracks()[0])
This file includes a simple CSS-based blur toggle only (applies blur to whole local video).
*/

// ---------- End ----------
