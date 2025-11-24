// app.js 

// URL del Server Signaling (Render)
const RENDER_SERVER_URL = "https://videocall-webrtc-signaling-server.onrender.com"; 
// Se stai testando in locale, de-commenta la riga sotto:
//const RENDER_SERVER_URL = "http://localhost:3000";

// ==========================================
// 🌍 MULTI-LANGUAGE SYSTEM (i18n)
// ==========================================

// 1. Rilevamento lingua (Default fallback: 'en')
const userLang = navigator.language.slice(0, 2); // es. "it", "en", "es", "zh"

// 2. Dizionario Completo
const translations = {
    // --- INGLESE (Default) ---
    en: {
        enter_conference: "Join Conference",
        room_name: "Room Name",
        room_pass: "Room Password (Optional)",
        your_nickname: "Your Nickname",
        join_btn: "Join Conference",
        settings_title: "Settings",
        theme_label: "Dark / Light Theme",
        bg_label: "App Background",
        server_mgmt: "Server Management",
        login_admin: "Admin Login",
        room_label: "Room",
        chat_title: "💬 Chat",
        type_message: "Type a message...",
        send_btn: "Send",
        mute_unmute: "Mute/Unmute Audio",
        video_toggle: "Enable/Disable Video",
        switch_cam: "Switch Camera",
        transfer_file: "Transfer File",
        start_rec: "Start Recording",
        stop_rec: "Stop Recording",
        share_screen: "Share Screen",
        toggle_wb: "Toggle Whiteboard",
        disconnect: "Disconnect",
        wait_peers: "Waiting for other participants...",
        guest: "Guest",
        you: "You",
        system: "System",
        welcome: "Welcome to",
        joined: "joined.",
        left: "left.",
        kicked: "You have been kicked.",
        room_closed: "Room closed.",
        download: "DOWNLOAD",
        private_msg_to: "Private Message to",
        send_file_to: "Send File to User",
        mute_user: "Mute Audio",
        unmute_user: "Unmute Audio"
    },
    // --- ITALIANO ---
    it: {
        enter_conference: "Entra nella Conferenza",
        room_name: "Nome della Stanza",
        room_pass: "Password Stanza (Opzionale)",
        your_nickname: "Il tuo Nickname",
        join_btn: "Entra",
        settings_title: "Impostazioni",
        theme_label: "Tema Scuro / Chiaro",
        bg_label: "Sfondo Applicazione",
        server_mgmt: "Gestione Server",
        login_admin: "Login Admin",
        room_label: "Stanza",
        chat_title: "💬 Chat",
        type_message: "Scrivi un messaggio...",
        send_btn: "Invia",
        mute_unmute: "Muta/Attiva Audio",
        video_toggle: "Attiva/Disattiva Video",
        switch_cam: "Cambia Fotocamera",
        transfer_file: "Trasferisci File",
        start_rec: "Avvia Registrazione",
        stop_rec: "Ferma Registrazione",
        share_screen: "Condividi Schermo",
        toggle_wb: "Lavagna",
        disconnect: "Disconnetti",
        wait_peers: "In attesa di altri partecipanti...",
        guest: "Ospite",
        you: "Tu",
        system: "Sistema",
        welcome: "Benvenuto in",
        joined: "è entrato.",
        left: "è uscito.",
        kicked: "Sei stato espulso.",
        room_closed: "La stanza è stata chiusa.",
        download: "SCARICA",
        private_msg_to: "Messaggio Privato a",
        send_file_to: "Invia File a Utente",
        mute_user: "Silenzia Audio",
        unmute_user: "Riattiva Audio"
    },
    // --- SPAGNOLO ---
    es: {
        enter_conference: "Unirse a la Conferencia",
        room_name: "Nombre de la Sala",
        room_pass: "Contraseña (Opcional)",
        your_nickname: "Tu Apodo",
        join_btn: "Unirse",
        settings_title: "Configuración",
        theme_label: "Tema Oscuro / Claro",
        bg_label: "Fondo de la App",
        server_mgmt: "Gestión del Servidor",
        login_admin: "Acceso Admin",
        room_label: "Sala",
        chat_title: "💬 Chat",
        type_message: "Escribe un mensaje...",
        send_btn: "Enviar",
        mute_unmute: "Silenciar/Activar Audio",
        video_toggle: "Activar/Desactivar Video",
        switch_cam: "Cambiar Cámara",
        transfer_file: "Transferir Archivo",
        start_rec: "Iniciar Grabación",
        stop_rec: "Detener Grabación",
        share_screen: "Compartir Pantalla",
        toggle_wb: "Pizarra",
        disconnect: "Desconectar",
        wait_peers: "Esperando a otros participantes...",
        guest: "Invitado",
        you: "Tú",
        system: "Sistema",
        welcome: "Bienvenido a",
        joined: "se ha unido.",
        left: "ha salido.",
        kicked: "Has sido expulsado.",
        room_closed: "Sala cerrada.",
        download: "DESCARGAR",
        private_msg_to: "Mensaje Privado a",
        send_file_to: "Enviar Archivo a Usuario",
        mute_user: "Silenciar Audio",
        unmute_user: "Reactivar Audio"
    },
    // --- FRANCESE ---
    fr: {
        enter_conference: "Rejoindre la Conférence",
        room_name: "Nom de la Salle",
        room_pass: "Mot de passe (Optionnel)",
        your_nickname: "Votre Pseudo",
        join_btn: "Rejoindre",
        settings_title: "Paramètres",
        theme_label: "Thème Sombre / Clair",
        bg_label: "Arrière-plan de l'App",
        server_mgmt: "Gestion Serveur",
        login_admin: "Connexion Admin",
        room_label: "Salle",
        chat_title: "💬 Chat",
        type_message: "Écrivez un message...",
        send_btn: "Envoyer",
        mute_unmute: "Couper/Activer Audio",
        video_toggle: "Activer/Désactiver Vidéo",
        switch_cam: "Changer de Caméra",
        transfer_file: "Transférer Fichier",
        start_rec: "Démarrer Enregistrement",
        stop_rec: "Arrêter Enregistrement",
        share_screen: "Partager Écran",
        toggle_wb: "Tableau Blanc",
        disconnect: "Déconnecter",
        wait_peers: "En attente d'autres participants...",
        guest: "Invité",
        you: "Vous",
        system: "Système",
        welcome: "Bienvenue dans",
        joined: "a rejoint.",
        left: "a quitté.",
        kicked: "Vous avez été expulsé.",
        room_closed: "Salle fermée.",
        download: "TÉLÉCHARGER",
        private_msg_to: "Message Privé à",
        send_file_to: "Envoyer Fichier à",
        mute_user: "Couper Audio",
        unmute_user: "Activer Audio"
    },
    // --- TEDESCO ---
    de: {
        enter_conference: "Konferenz beitreten",
        room_name: "Raumname",
        room_pass: "Raumpasswort (Optional)",
        your_nickname: "Dein Spitzname",
        join_btn: "Beitreten",
        settings_title: "Einstellungen",
        theme_label: "Dunkles / Helles Design",
        bg_label: "App-Hintergrund",
        server_mgmt: "Serververwaltung",
        login_admin: "Admin-Login",
        room_label: "Raum",
        chat_title: "💬 Chat",
        type_message: "Nachricht schreiben...",
        send_btn: "Senden",
        mute_unmute: "Stummschalten/Aufheben",
        video_toggle: "Video An/Aus",
        switch_cam: "Kamera wechseln",
        transfer_file: "Datei übertragen",
        start_rec: "Aufnahme starten",
        stop_rec: "Aufnahme stoppen",
        share_screen: "Bildschirm teilen",
        toggle_wb: "Whiteboard",
        disconnect: "Trennen",
        wait_peers: "Warte auf andere Teilnehmer...",
        guest: "Gast",
        you: "Du",
        system: "System",
        welcome: "Willkommen in",
        joined: "ist beigetreten.",
        left: "hat verlassen.",
        kicked: "Du wurdest rausgeworfen.",
        room_closed: "Raum geschlossen.",
        download: "HERUNTERLADEN",
        private_msg_to: "Privatnachricht an",
        send_file_to: "Datei senden an",
        mute_user: "Stummschalten",
        unmute_user: "Stumm. aufheben"
    },
    // --- CINESE (Semplificato) ---
    zh: {
        enter_conference: "加入会议",
        room_name: "房间名称",
        room_pass: "房间密码 (可选)",
        your_nickname: "你的昵称",
        join_btn: "加入会议",
        settings_title: "设置",
        theme_label: "深色 / 浅色 主题",
        bg_label: "应用背景",
        server_mgmt: "服务器管理",
        login_admin: "管理员登录",
        room_label: "房间",
        chat_title: "💬 聊天",
        type_message: "输入消息...",
        send_btn: "发送",
        mute_unmute: "静音/取消静音",
        video_toggle: "开启/关闭 视频",
        switch_cam: "切换摄像头",
        transfer_file: "传输文件",
        start_rec: "开始录制",
        stop_rec: "停止录制",
        share_screen: "共享屏幕",
        toggle_wb: "白板",
        disconnect: "断开连接",
        wait_peers: "等待其他参与者...",
        guest: "访客",
        you: "你",
        system: "系统",
        welcome: "欢迎来到",
        joined: "已加入。",
        left: "已离开。",
        kicked: "你已被踢出。",
        room_closed: "房间已关闭。",
        download: "下载",
        private_msg_to: "私信给",
        send_file_to: "发送文件给",
        mute_user: "静音用户",
        unmute_user: "取消静音"
    }
};

// 3. Funzione Helper 't' (Translate)
function t(key) {
    const langData = translations[userLang] || translations['en']; 
    return langData[key] || key; 
}

// 4. Applica traduzioni al DOM
function applyTranslations() {
    // Testo normale
    document.querySelectorAll('[data-lang]').forEach(el => {
        el.textContent = t(el.getAttribute('data-lang'));
    });
    // Placeholder (Input)
    document.querySelectorAll('[data-lang-placeholder]').forEach(el => {
        el.placeholder = t(el.getAttribute('data-lang-placeholder'));
    });
    // Title (Tooltip)
    document.querySelectorAll('[data-lang-title]').forEach(el => {
        el.title = t(el.getAttribute('data-lang-title'));
    });
}

// Esegui subito al caricamento
document.addEventListener('DOMContentLoaded', applyTranslations);

// ==========================================
// END i18n SYSTEM
// ==========================================


// ---------- DOM & Controls ----------
const nicknameOverlay = document.getElementById('nickname-overlay');
const joinButton = document.getElementById('join-button');
const nicknameInput = document.getElementById('nickname-input');
const roomIdInput = document.getElementById('room-id-input');
const videosGrid = document.getElementById('videos-grid'); 
const localVideoEl = document.getElementById('local-video');
const localFeedEl = document.getElementById('local-feed'); 

// Media Controls (Global)
const toggleAudioButton = document.getElementById('toggle-audio-button');
const toggleVideoButton = document.getElementById('toggle-video-button');
const disconnectButton = document.getElementById('disconnect-button');
const localMicStatusIcon = document.getElementById('local-mic-status'); 
const shareScreenButton = document.getElementById('share-screen-button');
const shareRoomLinkButton = document.getElementById('share-room-link'); 
const recordButton = document.getElementById('record-button'); 

// ** FILE TRANSFER CONTROLS **
const transferFileButton = document.getElementById('transfer-file-button');
const fileInput = document.getElementById('file-input');
const fileTransferContainer = document.getElementById('file-transfer-container');

// ** WHITEBOARD CONTROLS **
const toggleWhiteboardButton = document.getElementById('toggle-whiteboard-button');
const whiteboardContainer = document.getElementById('whiteboard-container');
const canvas = document.getElementById('whiteboard-canvas');
const wbUndoBtn = document.getElementById('wb-undo-btn');
const wbClearBtn = document.getElementById('wb-clear-btn');
const wbCloseBtn = document.getElementById('wb-close-btn');
const wbColors = document.querySelectorAll('.color-btn');

// Chat Controls
const chatPanel = document.getElementById('chat-panel');
const messagesContainer = document.getElementById('messages-container');
const chatMessageInput = document.getElementById('chat-message-input');
const sendChatButton = document.getElementById('send-chat-button');
const showChatBtn = document.getElementById('show-chat-btn');

// Context Menu Controls
const contextMenuEl = document.getElementById('remote-context-menu');
const menuDmUser = document.getElementById('menu-dm-user');
const menuMuteUser = document.getElementById('menu-mute-user');
const menuSendFile = document.getElementById('menu-send-file');

// ** SETTINGS CONTROLS **
const settingsModal = document.getElementById('settings-modal');
const settingsBtnOverlay = document.getElementById('settings-btn-overlay');
const settingsBtnRoom = document.getElementById('settings-btn-room');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const themeToggle = document.getElementById('theme-toggle');

// ** ADMIN CONTROLS **
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
let userNickname = t('guest');
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

// Recording Variables
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false; 

// ** WHITEBOARD VARIABLES **
let isDrawing = false;
let currentX = 0;
let currentY = 0;
let currentColor = '#ffffff';
let ctx = null;
let localWhiteboardHistory = []; 

// ** FILE TRANSFER VARIABLES **
const dataChannels = {}; 
const fileChunks = {}; 
const fileMetadata = {}; 
const CHUNK_SIZE = 16384; 
let targetFileRecipientId = null;

// Focus/Speaking Variables
let isManualFocus = false; 
let currentSpeakerId = null; 
const AUTO_FOCUS_COOLDOWN = 3000; 
let autoFocusTimer = null; 
let audioContext = null;
let analyser = null;
let talkingInterval = null;
const AUDIO_THRESHOLD = -40; 
let isLocalTalking = false; 

// Remote Mute Variable
const manuallyMutedPeers = {}; 
let contextTargetPeerId = null; 

let transcriptHistory = [];

const iceConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// AUDIO CONTEXT FOR NOTIFICATIONS
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playNotificationSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'chat') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } 
    else if (type === 'file' || type === 'wb') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, now);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }
    else if (type === 'rec') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, now);
        gainNode.gain.setValueAtTime(0.1, now);
        
        osc.start(now);
        osc.stop(now + 0.1);
        
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

// --- BACKGROUND SETTINGS ---
const availableBackgrounds = [
    { id: 'default', name: 'Default', value: '' }, 
    { id: 'grad1', name: 'Sunset', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { id: 'grad2', name: 'Night', value: 'linear-gradient(to top, #09203f 0%, #537895 100%)' },
    { id: 'img5', name: 'Snow Muntain', value: 'url("https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'img4', name: 'Abstract', value: 'url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'img_space', name: 'Space', value: 'url("https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1920&q=80")'},
	{ id: 'img_jelly', name: 'Jelly Fish', value: 'url("https://plus.unsplash.com/premium_photo-1667232502018-211637ba130c?auto=format&fit=crop&w=1920&q=80")'},
	{ id: 'img_fish', name: 'Fish', value: 'url("https://images.unsplash.com/photo-1514907283155-ea5f4094c70c?auto=format&fit=crop&w=1920&q=80")'},
    { id: 'img1', name: 'Mountain', value: 'url("https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80")' },
	{ id: 'img', name: 'Mongolfiere', value: 'url("https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?auto=format&fit=crop&w=1920&q=80")' },
	{ id: 'space_galaxy', name: 'Milky Way', value: 'url("https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1920&q=80")' },
	{ id: 'space_nebula', name: 'Deep Nebula', value: 'url("https://images.unsplash.com/photo-1528722828814-77b9b83aafb2?auto=format&fit=crop&w=1920&q=80")' },
	{ id: 'space_moon', name: 'Moon Surface', value: 'url("https://images.unsplash.com/photo-1522030299830-16b8d3d049fe?auto=format&fit=crop&w=1920&q=80")' },
	{ id: 'earth', name: 'Planet earth', value: 'url("https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?auto=format&fit=crop&w=1920&q=80")' }
];

const bgOptionsContainer = document.getElementById('background-options');

function initBackgroundSettings() {
    const savedBg = localStorage.getItem('appBackground') || 'default';
    applyBackground(savedBg);

    if(!bgOptionsContainer) return;
    bgOptionsContainer.innerHTML = '';

    availableBackgrounds.forEach(bg => {
        const div = document.createElement('div');
        div.className = 'bg-option';
        div.title = bg.name;
        div.dataset.bgId = bg.id;

        if (bg.id === 'default') {
            div.classList.add('default-bg');
            div.innerHTML = '<span class="material-icons" style="font-size:1.5em; color:var(--muted)">block</span>';
        } else {
            div.style.background = bg.value;
            div.style.backgroundSize = 'cover';
        }

        div.addEventListener('click', () => {
            applyBackground(bg.id);
            saveBackgroundPreference(bg.id);
            updateSelectedVisual(bg.id);
        });

        bgOptionsContainer.appendChild(div);
    });

    updateSelectedVisual(savedBg);
}

function applyBackground(bgId) {
    const bgObj = availableBackgrounds.find(b => b.id === bgId);
    if (!bgObj) return;

    if (bgObj.id === 'default') {
        document.body.style.backgroundImage = '';
        document.body.style.background = ''; 
    } else {
        document.body.style.background = bgObj.value;
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

function log(...args){ console.log('[APP]',...args); }

// --- NOTIFICATIONS & READ RECEIPT MANAGEMENT ---

function updateUnreadBadge() {
    const oldBadge = showChatBtn.querySelector('.notification-badge');
    if (oldBadge) oldBadge.remove();

    if (unreadMessagesCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'notification-badge';
        badge.textContent = unreadMessagesCount > 9 ? '9+' : unreadMessagesCount;
        showChatBtn.appendChild(badge);
        showChatBtn.classList.add('has-notification'); 
    } else {
        showChatBtn.classList.remove('has-notification');
    }
}

function markAllAsRead() {
    unreadMessagesCount = 0;
    updateUnreadBadge();

    if (!socket || !currentRoomId) return;

    const unreadMsgs = messagesContainer.querySelectorAll('.chat-message:not(.processed-read)');

    unreadMsgs.forEach(msg => {
        const msgId = msg.dataset.messageId;
        const isMyMessage = msg.querySelector('.sender-me');

        if (msgId && !isMyMessage) {
            socket.emit('msg-read', currentRoomId, msgId, userNickname);
            msg.classList.add('processed-read'); 
        }
    });
}

function showReadersDialog(msgId) {
    const msgEl = document.querySelector(`.chat-message[data-message-id="${msgId}"]`);
    if (!msgEl) return;

    const readers = JSON.parse(msgEl.dataset.readers || "[]");

    const overlay = document.createElement('div');
    overlay.className = 'readers-dialog-overlay'; 
    
    const dialog = document.createElement('div');
    dialog.className = 'readers-dialog'; 
    
    let contentHtml = '';
    if (readers.length === 0) {
        contentHtml = '<p style="color:var(--muted);">No one has viewed this message yet.</p>';
    } else {
        contentHtml = '<p style="margin-bottom:10px; font-weight:bold;">Read by:</p><ul class="readers-list">';
        readers.forEach(nick => {
            contentHtml += `<li>${nick}</li>`;
        });
        contentHtml += '</ul>';
    }

    dialog.innerHTML = `
        <h3 style="margin-top:0; color:var(--primary-color);">Message Info</h3>
        ${contentHtml}
        <div style="text-align:right; margin-top:15px; border-top:1px solid var(--border-color); padding-top:10px;">
            <button id="close-readers-btn" style="background:var(--surface-2); border:1px solid var(--border-color); color:var(--text-color); padding:6px 12px; border-radius:4px; cursor:pointer;">Close</button>
        </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const closeDialog = () => overlay.remove();
    
    dialog.querySelector('#close-readers-btn').onclick = closeDialog;
    overlay.onclick = (e) => {
        if (e.target === overlay) closeDialog();
    };
}

function showOverlay(show){
  if(show){
    nicknameOverlay.classList.remove('hidden');
    settingsBtnOverlay.classList.remove('hidden'); 
    document.getElementById('conference-container').classList.add('hidden');
  } else {
    nicknameOverlay.classList.add('hidden');
    settingsBtnOverlay.classList.add('hidden'); 
    document.getElementById('conference-container').classList.remove('hidden');
  }
}

function resetAndShowOverlay() {
    videosGrid.innerHTML = '';
    localFeedEl.classList.add('hidden');
    messagesContainer.innerHTML = ''; 
    document.getElementById('room-name-display').textContent = '';

    showOverlay(true);
    userNickname = t('guest'); // Translated guest
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
    localWhiteboardHistory = []; 

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
    placeholder.textContent = t('wait_peers'); // Translated
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
    alert('Check webcam/microphone.'); 
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
    menuMuteUser.querySelector('span:last-child').textContent = isMuted ? t('unmute_user') : t('mute_user');
    const nickname = remoteNicknames[peerId] || 'User';
    menuDmUser.querySelector('span:last-child').textContent = `${t('private_msg_to')} ${nickname}`;
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

function setFocus(peerId, manual=false) { 
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

    if (!peerId) return;

    videosGrid.classList.add('has-fullscreen');

    let targetFeed = null;
    if (peerId === 'local') {
        targetFeed = localFeedEl;
    } else {
        targetFeed = videosGrid.querySelector(`[data-peer-id="${peerId}"]`);
    }

    if (targetFeed) {
        targetFeed.classList.add('fullscreen-active'); 
    }

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

function ensureRemoteFeed(socketId, nickname='User'){
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
    placeholder.textContent = t('wait_peers');
    videosGrid.insertBefore(placeholder, localFeedEl);
  }
}

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
    if( /Mobi|Android/i.test(navigator.userAgent) ) { alert("Not supported on mobile."); return; }
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
        } catch (err) { console.error('Error sharing screen:', err); }
    }
}

// ** FILE TRANSFER LOGIC **
transferFileButton.addEventListener('click', () => { 
    if(Object.keys(peerConnections).length === 0) { alert("No participants."); return; } 
    targetFileRecipientId = null; 
    fileInput.click(); 
});

menuSendFile.addEventListener('click', () => {
    if (contextTargetPeerId) {
        targetFileRecipientId = contextTargetPeerId; 
        hideContextMenu();
        if(!dataChannels[targetFileRecipientId] || dataChannels[targetFileRecipientId].readyState !== 'open'){
            alert("Cannot send file: connection unstable with this user.");
            return;
        }
        fileInput.click(); 
    }
});

fileInput.addEventListener('change', (e) => { 
    const file = e.target.files[0]; 
    if (!file) return; 

    if (targetFileRecipientId) {
        sendFile(targetFileRecipientId, file);
    } else {
        Object.keys(dataChannels).forEach(peerId => sendFile(peerId, file)); 
    }
    
    fileInput.value = ''; 
    targetFileRecipientId = null; 
});

async function sendFile(peerId, file) {
    const dc = dataChannels[peerId];
    if (!dc || dc.readyState !== 'open') { console.warn(`Channel closed ${peerId}`); return; }
    const toast = createProgressToast(`Sending: ${file.name}`, true);
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
                playNotificationSound('file');

                fileMetadata[peerId] = { 
                    name: msg.name, 
                    size: msg.size, 
                    type: msg.fileType, 
                    received: 0 
                };
                fileChunks[peerId] = [];
                fileMetadata[peerId].toast = createProgressToast(`Receiving: ${msg.name}`, false);
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

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        const btn = document.createElement('button');
        btn.innerText = `📥 ${t('download')}: ${meta.name}`;
        
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

        btn.onclick = () => {
            const a = document.createElement('a');
            a.href = url;
            a.download = meta.name; 
            a.target = '_blank'; 
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            btn.remove();
            cleanupTransferData(peerId, url);
        };

        document.body.appendChild(btn);

    } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = meta.name;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        setTimeout(() => {
            cleanupTransferData(peerId, url);
        }, 100);
    }
}

function cleanupTransferData(peerId, url) {
    window.URL.revokeObjectURL(url);

    if (fileMetadata[peerId] && fileMetadata[peerId].toast) {
        const toast = fileMetadata[peerId].toast;
        toast.querySelector('.file-name').textContent = `Completed: ${fileMetadata[peerId].name}`;
        toast.querySelector('.progress-bar-fill').style.backgroundColor = '#4caf50'; 
        
        setTimeout(() => {
            if (toast) toast.remove();
        }, 3000);
    }

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
    const containerW = window.innerWidth;
    const containerH = window.innerHeight;

    const targetRatio = 16 / 9;
    
    let finalW, finalH;

    if (containerW / containerH > targetRatio) {
        finalH = containerH;
        finalW = finalH * targetRatio;
    } else {
        finalW = containerW;
        finalH = finalW / targetRatio;
    }

    canvas.width = finalW; 
    canvas.height = finalH;

    canvas.style.width = `${finalW}px`;
    canvas.style.height = `${finalH}px`;
    canvas.style.boxShadow = "0 0 0 9999px rgba(0,0,0,1)"; 
    canvas.style.background = "#1e1e1e"; 

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
    const isHidden = whiteboardContainer.classList.contains('hidden');
    if (isHidden) { whiteboardContainer.classList.remove('hidden'); toggleWhiteboardButton.classList.add('active'); toggleWhiteboardButton.classList.remove('has-notification'); initWhiteboard(); resizeCanvas(); if(socket && currentRoomId) socket.emit('wb-request-history', currentRoomId); }
    else { whiteboardContainer.classList.add('hidden'); toggleWhiteboardButton.classList.remove('active'); }
});
wbCloseBtn.addEventListener('click', () => { whiteboardContainer.classList.add('hidden'); toggleWhiteboardButton.classList.remove('active'); });

wbClearBtn.addEventListener('click', () => { 
    if(confirm("Clear whiteboard?")){ 
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
        alert('Your browser does not support recording.');
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
        alert("No active video stream to record.");
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
        alert("No supported recording codec found on this device.");
        return;
    }

    recordedChunks = [];
    try {
        playNotificationSound('rec');

        mediaRecorder = new MediaRecorder(streamToRecord, { mimeType: selectedMimeType });
        
        mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };
        
        mediaRecorder.onstop = saveRecording;
        
        mediaRecorder.start(1000); 
        isRecording = true;
        recordButton.classList.add('active');
        console.log(`Recording started with codec: ${selectedMimeType}`);

    } catch (e) {
        console.error("Error starting recording:", e);
        alert("Error starting recording: " + e.message);
        isRecording = false;
        recordButton.classList.remove('active');
    }
}

// ** SETTINGS UI LOGIC **
function openSettings() { settingsModal.classList.remove('hidden'); }
function closeSettings() { settingsModal.classList.add('hidden'); }

settingsBtnOverlay.addEventListener('click', openSettings);
settingsBtnRoom.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', closeSettings);

// Theme Toggle
themeToggle.addEventListener('change', (e) => {
    if(e.target.checked) {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
});

// ** ADMIN PANEL UI **
openAdminLoginBtn.addEventListener('click', () => { 
    closeSettings(); 
    adminPanel.classList.remove('hidden'); 
});

closeAdminBtn.addEventListener('click', () => { adminPanel.classList.add('hidden'); });
adminLoginBtn.addEventListener('click', () => { const pwd = adminPasswordInput.value; if(!socket) initializeSocket(); socket.emit('admin-login', pwd); });
adminRefreshBtn.addEventListener('click', () => { if(socket) socket.emit('admin-refresh'); });

// ** RENDER ADMIN DASHBOARD **
function renderAdminDashboard(data) {
    adminTotalUsers.textContent = data.totalUsers;
    adminBannedCount.textContent = data.bannedCount || 0;
    
    const list = adminRoomsList;
    list.innerHTML = '';
    
    if (Object.keys(data.rooms).length === 0) { 
        list.innerHTML = '<p style="color:var(--muted); text-align:center;">No active rooms.</p>'; 
        return; 
    }

    for (const [roomId, users] of Object.entries(data.rooms)) {
        const config = data.configs[roomId] || { isLocked: false, password: "" }; 
        
        const roomCard = document.createElement('div'); 
        roomCard.className = 'admin-room-card';
        
        const header = document.createElement('div'); 
        header.className = 'room-header';
        
        let statusIcons = '';
        if (config.isLocked) statusIcons += '🔒 ';
        if (config.password) statusIcons += '🔑 ';

        header.innerHTML = `<span class="room-name">${statusIcons}${roomId}</span>`;
        
        const controlsDiv = document.createElement('div');
        controlsDiv.style.display = 'flex';
        controlsDiv.style.gap = '5px';

        // Lock/Unlock Button
        const lockBtn = document.createElement('button');
        lockBtn.className = `btn-admin-action btn-lock ${config.isLocked ? 'locked' : ''}`;
        lockBtn.innerHTML = `<span class="material-icons" style="font-size:1.2em;">${config.isLocked ? 'lock' : 'lock_open'}</span>`;
        lockBtn.title = config.isLocked ? "Unlock Room" : "Lock Room";
        lockBtn.onclick = () => socket.emit('admin-toggle-lock', roomId);

        // Password Button
        const passBtn = document.createElement('button');
        passBtn.className = 'btn-admin-action btn-pass';
        passBtn.innerHTML = '<span class="material-icons" style="font-size:1.2em;">vpn_key</span>';
        passBtn.title = config.password ? `Change Pass (Current: ${config.password})` : "Set Password";
        passBtn.onclick = () => {
            const newPass = prompt("Set room password (leave empty to remove):", config.password);
            if (newPass !== null) socket.emit('admin-set-password', roomId, newPass);
        };

        // Close Room Button
        const closeBtn = document.createElement('button'); 
        closeBtn.className = 'btn-close-room'; 
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => { if(confirm('Close room and disconnect everyone?')) socket.emit('admin-close-room', roomId); };

        controlsDiv.appendChild(lockBtn);
        controlsDiv.appendChild(passBtn);
        controlsDiv.appendChild(closeBtn);
        header.appendChild(controlsDiv);
        
        roomCard.appendChild(header);

        const userList = document.createElement('ul'); 
        userList.className = 'admin-user-list';
        for (const [socketId, nickname] of Object.entries(users)) {
            const li = document.createElement('li'); 
            li.className = 'admin-user-item';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = nickname;
            
            const actionsSpan = document.createElement('div');
            
            // Kick Button
            const kickBtn = document.createElement('button'); 
            kickBtn.className = 'btn-kick'; 
            kickBtn.textContent = 'Kick';
            kickBtn.onclick = () => { if(confirm(`Kick ${nickname}?`)) socket.emit('admin-kick-user', socketId); };
            
            // BAN Button
            const banBtn = document.createElement('button'); 
            banBtn.className = 'btn-admin-action btn-ban'; 
            banBtn.textContent = 'BAN IP';
            banBtn.title = "Ban IP Permanently";
            banBtn.onclick = () => { if(confirm(`WARNING: Ban IP of ${nickname}? They won't be able to join again.`)) socket.emit('admin-ban-ip', socketId); };

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
    let url = `${window.location.protocol}//${window.location.host}${window.location.pathname}?room=${encodeURIComponent(currentRoomId)}`;
    
    if (currentRoomPassword) {
        url += `&pass=${encodeURIComponent(currentRoomPassword)}`;
    }

    navigator.clipboard.writeText(url).then(() => { 
        alert("Link copied to clipboard! " + (currentRoomPassword ? "(Includes password)" : ""));
    }).catch(err => {
        console.error('Copy error:', err);
    }); 
}
function addChatMessage(sender, message, isLocal = false, type = 'public', msgId = null) {
    const messageEl = document.createElement('div');
    messageEl.classList.add('chat-message');

    if (msgId && type !== 'system') {
        messageEl.dataset.messageId = msgId;
        messageEl.dataset.readers = JSON.stringify([]); 
        
        messageEl.addEventListener('click', () => showReadersDialog(msgId));
        messageEl.style.cursor = 'pointer'; 
    }

    let cssClass;
    let senderText = sender;

    if (type === 'system') {
        cssClass = 'sender-system';
        senderText = t('system'); // Translated System
    } else if (type === 'private') {
        cssClass = 'sender-private';
    } else {
        cssClass = isLocal ? 'sender-me' : 'sender-remote';
    }

    const prefix = isLocal 
        ? `${t('you')}${type === 'private' ? ` (DM to ${sender})` : ''}: ` 
        : `${senderText}: `;

    let htmlContent = `<span class="${cssClass}">${prefix}</span>${message}`;

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

    if (!isLocal && type !== 'system') {
        playNotificationSound('chat');

        const isChatVisible = (!chatPanel.classList.contains('hidden') && window.innerWidth > 768) || 
                              (chatPanel.classList.contains('active') && !chatPanel.classList.contains('hidden'));

        if (isChatVisible) {
            if (socket && currentRoomId && msgId) {
                socket.emit('msg-read', currentRoomId, msgId, userNickname);
                messageEl.classList.add('processed-read'); 
            }
        } else {
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

    // --- DM Handling (/dm) ---
    if (parts[0].toLowerCase() === '/dm' && parts.length >= 3) {
        const recipientNickname = parts[1];
        const messageContent = parts.slice(2).join(' ');

        if (recipientNickname.toLowerCase() === userNickname.toLowerCase()) {
            addChatMessage(t('system'), 'Cannot DM yourself.', true, 'system');
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
            addChatMessage(t('system'), `User "${recipientNickname}" not found.`, true, 'system');
        }
        return;
    }

    if (socket && currentRoomId) {
        const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        socket.emit('send-message', currentRoomId, userNickname, fullMessage, messageId);
        
        addChatMessage(userNickname, fullMessage, true, 'public', messageId);
        
        clearChatInput();
    }
}

function sendPrivateMessage(recipientId, recipientNickname, message) { if (!message || !recipientId) return; if (socket && currentRoomId) { socket.emit('send-private-message', currentRoomId, recipientId, userNickname, message); addChatMessage(recipientNickname, message, true, 'private'); } }
function openChatPanelMobile(callback) { if (chatPanel.classList.contains('active') && !chatPanel.classList.contains('hidden')) { if (callback) callback(); return; } chatPanel.classList.remove('hidden'); setTimeout(() => { chatPanel.classList.add('active'); let closeBtn = document.getElementById('close-chat-btn'); if (!closeBtn) { closeBtn = document.createElement('button'); closeBtn.textContent = '← Back to video'; closeBtn.id = 'close-chat-btn'; closeBtn.style.cssText = `position: relative; width: calc(100% - 20px); padding: 10px; margin: 10px; border: none; background: var(--primary-color); color: #fff; font-weight: bold; cursor: pointer; border-radius: 6px;`; const chatHeader = chatPanel.querySelector('h3'); if(chatHeader) chatPanel.insertBefore(closeBtn, chatHeader); closeBtn.addEventListener('click', () => { chatPanel.classList.remove('active'); setTimeout(() => { chatPanel.classList.add('hidden'); closeBtn.remove(); }, 300); }); } setTimeout(callback, 350); }, 10); }

// ** SOCKET IO **
function initializeSocket(){
  if(socket) return; 
  socket = io(RENDER_SERVER_URL);
  socket.on('error-message', (msg) => {
      alert("ERROR: " + msg);
      resetAndShowOverlay(); 
      if(socket) socket.disconnect();
      socket = null;
  });
  socket.on('kicked-by-admin', (msg) => {
      alert(msg); 
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
  socket.on('connect', ()=> log('Connected', socket.id));

  socket.on('nickname-in-use', (msg) => { alert(msg); resetAndShowOverlay(); if (socket) socket.disconnect(); socket = null; });
  
  socket.on('welcome', (newPeerId, nickname, peers=[])=>{ 
      remoteNicknames[newPeerId] = nickname; 
      addChatMessage(t('system'), `${t('welcome')} ${currentRoomId}!`, false, 'system'); 
      peers.forEach(peer=>{ if(peer.id !== socket.id) { remoteNicknames[peer.id] = peer.nickname; createPeerConnection(peer.id); } }); 
      setFocus('local', false); 
  });
  
  // Whiteboard events
  socket.on('wb-draw', (data) => { 
      if (whiteboardContainer.classList.contains('hidden')) {
          toggleWhiteboardButton.classList.add('has-notification');
          
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
      addChatMessage(sender, message, false, 'public', msgId);
  });

  socket.on('msg-read-update', (msgId, readerNickname) => {
      const msgEl = document.querySelector(`.chat-message[data-message-id="${msgId}"]`);
      
      if (msgEl) {
          let readers = [];
          try {
              readers = JSON.parse(msgEl.dataset.readers || "[]");
          } catch (e) { readers = []; }

          if (!readers.includes(readerNickname)) {
              readers.push(readerNickname);
              msgEl.dataset.readers = JSON.stringify(readers);
              const statusEl = msgEl.querySelector('.read-status');
              if (statusEl) {
                  statusEl.classList.add('seen'); 
              }
          }
      }
  });

  socket.on('peer-joined', (peerId,nickname)=>{ 
      remoteNicknames[peerId] = nickname; 
      createPeerConnection(peerId); 
      addChatMessage(t('system'), `${nickname} ${t('joined')}`, false, 'system'); 
  });
  
  socket.on('peer-left', (peerId)=>{ 
      removeRemoteFeed(peerId); 
      addChatMessage(t('system'), t('left'), false, 'system'); 
  });
  
  socket.on('new-private-message', (s, m) => { addChatMessage(`${t('private_msg_to')} ${s}`, m, false, 'private'); });
  socket.on('audio-status-changed', (pid, talk) => { const f = videosGrid.querySelector(`[data-peer-id="${pid}"]`); if(f) { f.classList.toggle('is-talking', talk); f.querySelector('.remote-mic-status').textContent = talk ? 'mic' : 'mic_off'; } });
  socket.on('remote-stream-type-changed', (pid, ratio) => { const f = videosGrid.querySelector(`[data-peer-id="${pid}"]`); if(f){ f.classList.remove('ratio-4-3', 'ratio-16-9'); f.classList.add(`ratio-${ratio}`); } });
  socket.on('receive-transcript', (senderId, nickname, text, isFinal) => {
    updateSubtitleUI(senderId, nickname, text, isFinal);
    // Assicurati che il contenitore sia visibile se qualcuno parla
    if(subtitlesOverlay.classList.contains('hidden')) {
        subtitlesOverlay.classList.remove('hidden');
    }
});

  // WebRTC Signaling
  socket.on('offer', async (fid, o)=>{ const pc = createPeerConnection(fid); if(pc.signalingState !== 'stable') return; await pc.setRemoteDescription(new RTCSessionDescription(o)); if (iceCandidateQueues[fid]) { iceCandidateQueues[fid].forEach(c => pc.addIceCandidate(new RTCIceCandidate(c))); iceCandidateQueues[fid] = []; } const a = await pc.createAnswer(); await pc.setLocalDescription(a); socket.emit('answer', fid, pc.localDescription); });
  socket.on('answer', async (fid, a)=>{ const pc = peerConnections[fid]; if(pc && pc.signalingState === 'have-local-offer') { await pc.setRemoteDescription(new RTCSessionDescription(a)); if (iceCandidateQueues[fid]) { iceCandidateQueues[fid].forEach(c => pc.addIceCandidate(new RTCIceCandidate(c))); iceCandidateQueues[fid] = []; } } });
  socket.on('candidate', async (fid, c)=>{ const pc = peerConnections[fid]; if(pc && c) { if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(c)); else { if (!iceCandidateQueues[fid]) iceCandidateQueues[fid] = []; iceCandidateQueues[fid].push(c); } } });

  // Admin events
  socket.on('admin-login-success', () => { adminLoginView.classList.add('hidden'); adminDashboardView.classList.remove('hidden'); adminMsg.textContent = ''; });
  socket.on('admin-login-fail', () => { adminMsg.textContent = 'Wrong Password.'; });
  socket.on('admin-data-update', (data) => { renderAdminDashboard(data); });
  socket.on('kicked-by-admin', () => { alert(t('kicked')); location.reload(); });
  socket.on('room-closed-by-admin', () => { alert(t('room_closed')); location.reload(); });
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const passParam = params.get('pass');

    if (roomParam) {
        roomIdInput.value = roomParam;
    }

    if (passParam) {
        roomPasswordInput.value = passParam;
    }

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
function openFullscreen() {
    const elem = document.documentElement;
    try {
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) { /* Safari & Chrome iOS (limitato) */
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) { /* IE11 */
            elem.msRequestFullscreen();
        }
    } catch (err) {
        console.log("Fullscreen request denied or not supported:", err);
    }
}

joinButton.addEventListener('click', async () => {
    const nickname = nicknameInput.value.trim();
    const roomId = roomIdInput.value.trim();
    const password = document.getElementById('room-password-input').value.trim();

    if (!nickname || !roomId) { alert('Missing data'); return; }
    userNickname = nickname;
    currentRoomId = roomId;
    currentRoomPassword = password;

    await startLocalMedia();
    initializeSocket();

    socket.emit('join-room', currentRoomId, userNickname, password);

    document.getElementById('room-name-display').textContent = roomId;
    showOverlay(false);
    setFocus('local', false);
});

localFeedEl.addEventListener('click', () => {
    toggleFocus('local');
});

// ==========================================
// 📝 TRANSCRIPTION / SPEECH-TO-TEXT LOGIC
// ==========================================

const toggleTranscriptionBtn = document.getElementById('toggle-transcription-btn');
const subtitlesOverlay = document.getElementById('subtitles-overlay');

let recognition = null;
let isTranscribing = false;
let subClearTimer = null;

// Verifica supporto browser (Chrome/Edge/Safari supportano webkitSpeechRecognition)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    // Usa la lingua rilevata dal sistema (es. "it-IT") o fallback su 'en-US'
    recognition.lang = navigator.language || 'en-US'; 
    recognition.continuous = true;      // Continua ad ascoltare anche dopo le pause
    recognition.interimResults = true;  // Mostra i risultati mentre parli

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

        // Se c'è testo, invialo
        const textToSend = finalTranscript || interimTranscript;
        if (textToSend.trim().length > 0 && socket && currentRoomId) {
            const isFinal = !!finalTranscript;
            
            // 1. Mostra i MIEI sottotitoli localmente
            updateSubtitleUI('local', t('you'), textToSend, isFinal);
            
            // 2. Invia agli altri
            socket.emit('send-transcript', currentRoomId, userNickname, textToSend, isFinal);
        }
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') {
            alert("Microphone access blocked for speech recognition.");
            stopTranscription();
        }
    };

    recognition.onend = () => {
        // Se si ferma ma il flag è attivo, riavvialo (succede spesso su Chrome dopo un po' di silenzio)
        if (isTranscribing) {
            try { recognition.start(); } catch(e){}
        }
    };
} else {
    // Nascondi il pulsante se il browser non supporta la feature (es. Firefox)
    if(toggleTranscriptionBtn) toggleTranscriptionBtn.style.display = 'none';
    console.warn("Web Speech API not supported in this browser.");
}

// --- Funzioni di Controllo ---

function toggleTranscription() {
    if (!recognition) return;

    isTranscribing = !isTranscribing;
    const icon = toggleTranscriptionBtn.querySelector('.material-icons');

    if (isTranscribing) {
        recognition.start();
        toggleTranscriptionBtn.classList.add('active');
        icon.textContent = 'closed_caption'; // Icona "CC attivo"
        subtitlesOverlay.classList.remove('hidden');
        addChatMessage(t('system'), 'Transcription started (visible to others).', true, 'system');
    } else {
        recognition.stop();
        toggleTranscriptionBtn.classList.remove('active');
        icon.textContent = 'closed_caption_off'; // Icona "CC spento"
        subtitlesOverlay.classList.add('hidden');
        subtitlesOverlay.innerHTML = ''; // Pulisci schermo
    }
}

function stopTranscription() {
    isTranscribing = false;
    if(recognition) recognition.stop();
    if(toggleTranscriptionBtn) {
        toggleTranscriptionBtn.classList.remove('active');
        toggleTranscriptionBtn.querySelector('.material-icons').textContent = 'closed_caption_off';
    }
}

// --- Gestione UI Sottotitoli ---

function updateSubtitleUI(id, nickname, text, isFinal) {
    // Cerchiamo se esiste già una riga per questo utente
    let line = document.getElementById(`sub-line-${id}`);
    
    if (!line) {
        line = document.createElement('div');
        line.id = `sub-line-${id}`;
        line.className = 'subtitle-line';
        subtitlesOverlay.appendChild(line);
    }

    // Aggiorna il testo
    line.innerHTML = `<span class="speaker-name">${nickname}:</span> ${text}`;

    // Se la frase è finita, rimuovila dopo 3 secondi
	if (isFinal) {
        setTimeout(() => {
            if (line && line.parentNode) line.remove();
        }, 4000);
		
        const timestamp = new Date().toLocaleTimeString();
        transcriptHistory.push(`[${timestamp}] ${nickname}: ${text}`);
    }
    
    // Auto-scroll (non necessario con flex-end, ma utile per sicurezza)
    subtitlesOverlay.scrollTop = subtitlesOverlay.scrollHeight;
}

function downloadTranscript() {
    if (transcriptHistory.length === 0) {
        alert("Nessuna trascrizione disponibile da salvare.");
        return;
    }

    // Unisce tutte le righe con un "a capo" (\n)
    const blobData = transcriptHistory.join('\n');
    const blob = new Blob([blobData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `Meeting-Transcript-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    
    // Pulizia
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

if(toggleTranscriptionBtn) {
    toggleTranscriptionBtn.addEventListener('click', toggleTranscription);
}

const downloadTranscriptBtn = document.getElementById('download-transcript-btn');
if(downloadTranscriptBtn) {
    downloadTranscriptBtn.addEventListener('click', downloadTranscript);
}

// ==========================================
// 📱 MOBILE TOOLS MENU LOGIC
// ==========================================

const mobileMoreBtn = document.getElementById('mobile-more-btn');
const mobileToolsMenu = document.getElementById('mobile-tools-menu');
const closeMobileTools = document.getElementById('close-mobile-tools');

// Elementi del menu mobile
const mobBtnSubs = document.getElementById('mob-btn-subs');
const mobBtnFile = document.getElementById('mob-btn-file');
const mobBtnRec = document.getElementById('mob-btn-rec');
const mobBtnWb = document.getElementById('mob-btn-wb');
const mobBtnDown = document.getElementById('mob-btn-down');

// Riferimenti ai bottoni originali (desktop)
const desktopSubsBtn = document.getElementById('toggle-transcription-btn');
const desktopFileBtn = document.getElementById('transfer-file-button');
const desktopRecBtn = document.getElementById('record-button');
const desktopWbBtn = document.getElementById('toggle-whiteboard-button');
const desktopDownBtn = document.getElementById('download-transcript-btn');

// 1. Apri/Chiudi Menu
if(mobileMoreBtn) {
    mobileMoreBtn.addEventListener('click', () => {
        mobileToolsMenu.classList.add('active');
        syncMobileButtonStates(); // Aggiorna lo stato visivo (attivo/non attivo)
    });
}

if(closeMobileTools) {
    closeMobileTools.addEventListener('click', () => {
        mobileToolsMenu.classList.remove('active');
    });
}

// Chiudi se si clicca fuori (sulla parte scura del video)
document.addEventListener('click', (e) => {
    if (mobileToolsMenu.classList.contains('active') && 
        !mobileToolsMenu.contains(e.target) && 
        !mobileMoreBtn.contains(e.target)) {
        mobileToolsMenu.classList.remove('active');
    }
});

// 2. Mapping dei click (Mobile -> Desktop Function)
// Usiamo .click() sui bottoni desktop originali per sfruttare la logica già esistente
if(mobBtnSubs) mobBtnSubs.addEventListener('click', () => { desktopSubsBtn.click(); setTimeout(syncMobileButtonStates, 50); });
if(mobBtnFile) mobBtnFile.addEventListener('click', () => { mobileToolsMenu.classList.remove('active'); desktopFileBtn.click(); });
if(mobBtnRec) mobBtnRec.addEventListener('click', () => { desktopRecBtn.click(); setTimeout(syncMobileButtonStates, 50); });
if(mobBtnWb) mobBtnWb.addEventListener('click', () => { mobileToolsMenu.classList.remove('active'); desktopWbBtn.click(); });
if(mobBtnDown) mobBtnDown.addEventListener('click', () => { desktopDownBtn.click(); });

// 3. Sincronizzazione Stati (Per colorare i bottoni mobile se attivi)
function syncMobileButtonStates() {
    // Sottotitoli
    if (desktopSubsBtn && desktopSubsBtn.classList.contains('active')) {
        mobBtnSubs.classList.add('active');
    } else {
        mobBtnSubs.classList.remove('active');
    }

    // Registrazione
    if (desktopRecBtn && desktopRecBtn.classList.contains('active')) {
        mobBtnRec.classList.add('active');
    } else {
        mobBtnRec.classList.remove('active');
    }

    // Lavagna
    if (desktopWbBtn && desktopWbBtn.classList.contains('active')) {
        mobBtnWb.classList.add('active');
    } else {
        mobBtnWb.classList.remove('active');
    }
}

// --------------------------------------------------------
// LISTENERS UI & CONTROLS
// --------------------------------------------------------

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
    if (window.innerWidth <= 768) {
        openChatPanelMobile(() => {
            markAllAsRead();
        });
    } else {
        chatPanel.classList.toggle('hidden');
        
        if (!chatPanel.classList.contains('hidden')) {
            markAllAsRead();
            setTimeout(() => chatMessageInput.focus(), 50); 
        }
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
    if (contextMenuEl && 
        !e.target.closest('.video-feed') && 
        !contextMenuEl.contains(e.target)) {
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
            addChatMessage(t('system'), 'Cannot DM yourself.', true, 'system');
            return;
        }

        const nickname = remoteNicknames[contextTargetPeerId] || 'User';
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

        if (window.innerWidth <= 768) openChatPanelMobile(focusAndSetDM);
        else focusAndSetDM();
    }
});

const switchCameraBtn = document.getElementById('switch-camera-button');
let currentFacingMode = 'user'; 

async function switchCamera() {
    if (!localStream || !isVideoEnabled) return;

    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    
    const constraints = {
        video: { 
            facingMode: { exact: currentFacingMode } 
        },
        audio: false 
    };

    try {
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        const newVideoTrack = newStream.getVideoTracks()[0];

        const oldVideoTrack = localStream.getVideoTracks()[0];
        if (oldVideoTrack) {
            localStream.removeTrack(oldVideoTrack);
            oldVideoTrack.stop(); 
        }
        localStream.addTrack(newVideoTrack);
        
        localVideoEl.srcObject = localStream;

        for (const peerId in peerConnections) {
            const pc = peerConnections[peerId];
            const sender = pc.getSenders().find(s => s.track.kind === 'video');
            if (sender) {
                sender.replaceTrack(newVideoTrack);
            }
        }
        
        if (currentFacingMode === 'user') {
            localVideoEl.style.transform = 'scaleX(-1)';
        } else {
            localVideoEl.style.transform = 'scaleX(1)';
        }

    } catch (err) {
        console.error("Switch camera error:", err);
        if (constraints.video.facingMode.exact) {
            delete constraints.video.facingMode.exact;
            constraints.video.facingMode = currentFacingMode;
            try {
                alert("Cannot switch camera on this device.");
            } catch(e) {}
        }
    }
}

if (switchCameraBtn) {
    switchCameraBtn.addEventListener('click', switchCamera);
}