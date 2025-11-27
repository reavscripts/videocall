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
const openServerListBtn = document.getElementById('open-server-list-btn');
const serverListModal = document.getElementById('server-list-modal');
const closeServerListBtn = document.getElementById('close-server-list-btn');
const serverListContainer = document.getElementById('server-list-container');
const refreshServerListModalBtn = document.getElementById('refresh-server-list-modal-btn');
let myJoinedChannels = []; // Array per tenere traccia dei canali della sessione: ['lobby', 'test']
const myChannelsListEl = document.getElementById('my-channels-list');
const roomChatsData = {}; // { 'nomeStanza': [ {sender, text, ...} ] }
const opModerateToggle = document.getElementById('op-moderate-toggle');

// ** CONTROLLI OPERATORE (@) **
const opSettingsBtn = document.getElementById('op-settings-btn');
const opModal = document.getElementById('op-modal');
const closeOpModalBtn = document.getElementById('close-op-modal');
const opSaveBtn = document.getElementById('op-save-btn');
const roomTopicDisplay = document.getElementById('room-topic-display');
const opTopicInput = document.getElementById('op-topic-input');
const opPasswordInput = document.getElementById('op-password-input');
const opColorInput = document.getElementById('op-color-input');

// VARIABILI SPEECH TO TEXT
const menuToggleCC = document.getElementById('menu-toggle-cc');
let recognition = null; // Istanza SpeechRecognition (se siamo noi a parlare)
let isTranscribingLocal = false; // Se stiamo trascrivendo noi stessi per qualcuno
const activeTranscriptions = {}; // { peerId: true/false } (Chi stiamo ascoltando)
const transcriptionHistory = {}; // { peerId: "testo completo..." } per il download
const globalTranscriptBtn = document.getElementById('global-transcript-btn');
const meetingTranscriptPanel = document.getElementById('meeting-transcript-panel');
const transcriptContent = document.getElementById('transcript-content');
const closeTranscriptBtn = document.getElementById('close-transcript-btn');

let isGlobalMeetingRecording = false; // Stato globale
let meetingHistory = []; // Array per salvare tutto: {time, name, text}

// Controlli Media (Globali)
const toggleAudioButton = document.getElementById('toggle-audio-button');
const toggleVideoButton = document.getElementById('toggle-video-button');
const disconnectButton = document.getElementById('disconnect-button');
const localMicStatusIcon = document.getElementById('local-mic-status'); 
const shareScreenButton = document.getElementById('share-screen-button');
const shareRoomLinkButton = document.getElementById('share-room-link'); 
const recordButton = document.getElementById('record-button'); 

const typingIndicator = document.getElementById('typing-indicator');
const typingText = document.getElementById('typing-text');
const activeTypers = new Set(); // Mantiene la lista di chi scrive
let typingTimeout = null;     // Timer per capire quando smetti
let isTyping = false;         // Stato locale

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
const channelSidebar = document.getElementById('channel-sidebar');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const serverChannelList = document.getElementById('server-channel-list');
const refreshChannelsBtn = document.getElementById('refresh-channels-btn');
const chatResizer = document.getElementById('chat-resizer');
const currentChannelItem = document.getElementById('current-channel-item');

let isChatResizing = false;

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
let focusedPeerId = null; 
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

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// ==========================================
// 🌍 SISTEMA DI LOCALIZZAZIONE (i18n)
// ==========================================

const APP_LANGUAGE = navigator.language.split('-')[0];

const TRANSLATIONS = {
    // 🇮🇹 ITALIANO
    it: {
        // HTML Elements (ID o Classi)
        ui: {
            "join-button": "Entra nella Conferenza",
            "room-id-input": { placeholder: "Nome della Stanza" },
            "room-password-input": { placeholder: "Password Stanza (Opzionale)" },
            "nickname-input": { placeholder: "Il tuo Nickname" },
            "chat-panel h3": "💬 Chat", 
            "chat-message-input": { placeholder: "Scrivi un messaggio..." },
            "send-chat-button": "Invia",
            "settings-btn-overlay": { title: "Impostazioni" },
            "settings-btn-room": { title: "Impostazioni" },
            "show-chat-btn": { title: "Apri Chat" },
            "share-room-link": { title: "Condividi Link Stanza" },
            "toggle-audio-button": { title: "Muta/Attiva Audio" },
            "toggle-video-button": { title: "Disattiva/Attiva Video" },
            "switch-camera-button": { title: "Cambia Fotocamera" },
            "more-options-btn": { title: "Altre Opzioni" },
            "disconnect-button": { title: "Disconnetti" },
            
            // Menu Extra
            "transfer-file-button span:last-child": "Invia File",
            "record-button span:last-child": "Registra",
            "toggle-whiteboard-button span:last-child": "Lavagna",
            "share-screen-button span:last-child": "Condividi Schermo",
            "global-transcript-btn span:last-child": "Verbale Riunione", // NUOVO

            // Menu Contestuale
            "menu-dm-user span:last-child": "Messaggio Privato",
            "menu-send-file span:last-child": "Invia File",
            "menu-toggle-cc span:last-child": "Attiva Sottotitoli",
            "menu-mute-user span:last-child": "Silenzia Audio",
            
            // Admin & Pannelli
            "admin-header h3": "🛡️ Dashboard Admin",
            "admin-login-btn": "Accedi",
            "admin-refresh-btn": "Aggiorna Dati",
            "admin-total-users": { prefix: "Utenti: " },
            "close-chat-btn": "← Torna alle webcam",
            "transcript-header h4": "📝 Verbale Live" // NUOVO
        },
        // Messaggi JavaScript
        js: {
            "welcome": "Benvenuto in",
            "user_joined": "è entrato.",
            "user_left": "Utente uscito.",
            "link_copied": "Link copiato negli appunti!",
            "missing_data": "Dati mancanti",
            "banned": "Sei stato espulso.",
            "room_closed": "Stanza chiusa.",
            "error_cam": "Controlla webcam/microfono",
            "screen_share_mobile": "Non supportato su mobile.",
            "no_participants": "Nessun partecipante.",
            "download_transcript": "Trascrizione terminata. Vuoi scaricare il testo?",
            "waiting_others": "In attesa di altri partecipanti...",
            "you": "Tu",
            "system": "Sistema",
            
            // NUOVI MEETING MINUTES
            "transcript_started": "Registrazione riunione avviata.",
            "transcript_stopped": "Registrazione riunione fermata.",
            "download_meeting": "Meeting terminato. Scaricare il verbale completo?"
        }
    },
    // 🇪🇸 SPAGNOLO
    es: {
        ui: {
            "join-button": "Unirse a la conferencia",
            "room-id-input": { placeholder: "Nombre de la sala" },
            "room-password-input": { placeholder: "Contraseña (Opcional)" },
            "nickname-input": { placeholder: "Tu Apodo" },
            "chat-panel h3": "💬 Chat",
            "chat-message-input": { placeholder: "Escribe un mensaje..." },
            "send-chat-button": "Enviar",
            "settings-btn-overlay": { title: "Configuración" },
            "settings-btn-room": { title: "Configuración" },
            "show-chat-btn": { title: "Abrir Chat" },
            "toggle-audio-button": { title: "Silenciar/Activar Audio" },
            "toggle-video-button": { title: "Activar/Desactivar Video" },
            "disconnect-button": { title: "Desconectar" },
            "more-options-btn": { title: "Más opciones" },

            "transfer-file-button span:last-child": "Enviar Archivo",
            "record-button span:last-child": "Grabar",
            "toggle-whiteboard-button span:last-child": "Pizarra",
            "share-screen-button span:last-child": "Compartir Pantalla",
            "global-transcript-btn span:last-child": "Acta de Reunión", // NUOVO

            "menu-dm-user span:last-child": "Mensaje Privado",
            "menu-send-file span:last-child": "Enviar Archivo",
            "menu-toggle-cc span:last-child": "Activar Subtítulos",
            "menu-mute-user span:last-child": "Silenciar Audio",

            "transcript-header h4": "📝 Acta en Vivo" // NUOVO
        },
        js: {
            "welcome": "Bienvenido a",
            "user_joined": "ha entrado.",
            "user_left": "Usuario salió.",
            "link_copied": "¡Enlace copiado!",
            "missing_data": "Faltan datos",
            "waiting_others": "Esperando a otros participantes...",
            "you": "Tú",
            "system": "Sistema",
            "download_transcript": "Transcripción finalizada. ¿Descargar texto?",
            
            // NUOVI
            "transcript_started": "Grabación de reunión iniciada.",
            "transcript_stopped": "Grabación de reunión detenida.",
            "download_meeting": "Reunión finalizada. ¿Descargar el acta completa?"
        }
    },
    // 🇫🇷 FRANCESE
    fr: {
        ui: {
            "join-button": "Rejoindre la conférence",
            "room-id-input": { placeholder: "Nom de la salle" },
            "room-password-input": { placeholder: "Mot de passe (Optionnel)" },
            "nickname-input": { placeholder: "Votre Pseudo" },
            "chat-panel h3": "💬 Chat",
            "send-chat-button": "Envoyer",
            "chat-message-input": { placeholder: "Écrire un message..." },
            "settings-btn-overlay": { title: "Paramètres" },
            "disconnect-button": { title: "Déconnecter" },
            "more-options-btn": { title: "Plus d'options" },

            "transfer-file-button span:last-child": "Envoyer un fichier",
            "record-button span:last-child": "Enregistrer",
            "toggle-whiteboard-button span:last-child": "Tableau blanc",
            "share-screen-button span:last-child": "Partager l'écran",
            "global-transcript-btn span:last-child": "Compte Rendu", // NUOVO

            "menu-toggle-cc span:last-child": "Activer Sous-titres",
            "transcript-header h4": "📝 Notes en Direct" // NUOVO
        },
        js: {
            "welcome": "Bienvenue dans",
            "user_joined": "a rejoint.",
            "user_left": "Utilisateur parti.",
            "link_copied": "Lien copié !",
            "waiting_others": "En attente d'autres participants...",
            "you": "Toi",
            "system": "Système",
            "download_transcript": "Transcription terminée. Télécharger ?",
            
            // NUOVI
            "transcript_started": "Enregistrement de la réunion démarré.",
            "transcript_stopped": "Enregistrement de la réunion arrêté.",
            "download_meeting": "Réunion terminée. Télécharger le compte rendu ?"
        }
    },
    // 🇨🇳 CINESE (Semplificato)
    zh: {
        ui: {
            "join-button": "加入会议",
            "room-id-input": { placeholder: "会议室名称" },
            "room-password-input": { placeholder: "会议密码 (可选)" },
            "nickname-input": { placeholder: "您的昵称" },
            "chat-panel h3": "💬 聊天",
            "chat-message-input": { placeholder: "输入消息..." },
            "send-chat-button": "发送",
            "settings-btn-overlay": { title: "设置" },
            "settings-btn-room": { title: "设置" },
            "show-chat-btn": { title: "打开聊天" },
            "share-room-link": { title: "分享会议链接" },
            "toggle-audio-button": { title: "静音/取消静音" },
            "toggle-video-button": { title: "开启/关闭视频" },
            "switch-camera-button": { title: "切换摄像头" },
            "more-options-btn": { title: "更多选项" },
            "disconnect-button": { title: "断开连接" },
            
            // Menu Extra
            "transfer-file-button span:last-child": "发送文件",
            "record-button span:last-child": "录制",
            "toggle-whiteboard-button span:last-child": "白板",
            "share-screen-button span:last-child": "共享屏幕",
            "global-transcript-btn span:last-child": "会议纪要", // NUOVO
            
            // Menu Contestuale & Admin
            "menu-dm-user span:last-child": "私信",
            "menu-send-file span:last-child": "发送文件",
            "menu-toggle-cc span:last-child": "开启字幕",
            "menu-mute-user span:last-child": "静音用户",
            "admin-header h3": "🛡️ 管理员面板",
            "admin-login-btn": "登录",
            "admin-refresh-btn": "刷新数据",
            "close-chat-btn": "← 返回视频",
            "transcript-header h4": "📝 实时纪要" // NUOVO
        },
        js: {
            "welcome": "欢迎来到",
            "user_joined": "已加入。",
            "user_left": "用户已离开。",
            "link_copied": "链接已复制到剪贴板！",
            "missing_data": "数据缺失",
            "banned": "您已被踢出。",
            "room_closed": "会议室已关闭。",
            "error_cam": "请检查摄像头/麦克风",
            "screen_share_mobile": "移动设备不支持此功能。",
            "no_participants": "暂无参与者。",
            "download_transcript": "转录已完成。是否下载文本？",
            "waiting_others": "等待其他参与者...",
            "you": "您",
            "system": "系统",
            
            // NUOVI
            "transcript_started": "会议录制已开始。",
            "transcript_stopped": "会议录制已停止。",
            "download_meeting": "会议结束。是否下载完整纪要？"
        }
    }
};

// Collezione di Sticker e GIF
const STICKER_COLLECTION = {
    gifs: [
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbXNtaW16ZXI0ZGh6ZXBib3ZtYnI5b3J6ZHR4YjE2ZDFvYm95b3J6ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0amJbCG8xLYt5iDC/giphy.gif",
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbnZ5Z3I5aG41bGR4b3ZtYnI5b3J6ZHR4YjE2ZDFvYm95b3J6ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Cmr1OMJ2FN0B2/giphy.gif",
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnZ5Z3I5aG41bGR4b3ZtYnI5b3J6ZHR4YjE2ZDFvYm95b3J6ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKs6AW2Cx1niOk8/giphy.gif", 
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnZ5Z3I5aG41bGR4b3ZtYnI5b3J6ZHR4YjE2ZDFvYm95b3J6ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26gsjCZpPolPr3sBy/giphy.gif",
        "https://media.giphy.com/media/IsfrRWzbVjIyI/giphy.gif"
    ],
    pepe: [
        "https://media.tenor.com/images/861409ba9b00e46a67f4f7be0aebd2f4/tenor.gif",
        "https://media.tenor.com/images/5d3158e072b226e63283319047910103/tenor.gif",
        "https://media.tenor.com/images/3a38fa87a552300d8f20387431e67040/tenor.gif"
    ]
};

function playNotificationSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'chat') {
        // Suono: "Pop" 
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
        // Suono: Doppio Beep
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, now);
        gainNode.gain.setValueAtTime(0.1, now);
        osc.start(now);
        osc.stop(now + 0.1);
        
        // Secondo osc per il doppio beep
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
    { id: 'default', name: 'Vuoto', value: '' }, // Valore vuoto = usa colore tema CSS
    { id: 'grad1', name: 'Tramonto', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
	{ id: 'img4', name: 'Astratto', value: 'url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'grad2', name: 'Notte', value: 'linear-gradient(to top, #09203f 0%, #537895 100%)' },
	{ id: 'moon', name: 'Moon', value: 'url("https://images.unsplash.com/photo-1517866184231-7ef94c2ea930?auto=format&fit=crop&w=1920&q=80")' },
	{ id: 'earth', name: 'Earth', value: 'url("https://images.unsplash.com/photo-1656077217715-bdaeb06bd01f?auto=format&fit=crop&w=1920&q=80")' },
	{ id: 'nebula1', name: 'Nebula 1', value: 'url("https://images.unsplash.com/photo-1716881139357-ddcb2f52940c?auto=format&fit=crop&w=1920&q=80")' },
	{ id: 'nebula2', name: 'Nebula 2', value: 'url("https://images.unsplash.com/photo-1591972729866-028644a72183?auto=format&fit=crop&w=1920&q=80")' },
	{ id: 'onepiece1', name: 'Luffy', value: 'url("https://images4.alphacoders.com/136/thumb-1920-1368242.png?auto=format&fit=crop&w=1920&q=80")' },
	{ id: 'onepiece2', name: 'garp', value: 'url("https://images2.alphacoders.com/134/thumb-1920-1348840.jpeg?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'img1', name: 'Montagna', value: 'url("https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'clrmountain', name: 'Color Mount', value: 'url("https://images.unsplash.com/photo-1503027075-f790a0a2dcb6?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'baloon', name: 'Baloons', value: 'url("https://images.unsplash.com/photo-1464692805480-a69dfaafdb0d?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'img2', name: 'JellyFish', value: 'url("https://images.unsplash.com/photo-1441555136638-e47c0158bfc9?auto=format&fit=crop&w=1920&q=80")' },
	{ id: 'img5', name: 'Fish', value: 'url("https://images.unsplash.com/photo-1551103807-35843c283f14?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'img3', name: 'Turle', value: 'url("https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?auto=format&fit=crop&w=1920&q=80")' }
];

const bgOptionsContainer = document.getElementById('background-options');

function initBackgroundSettings() {
    // 1. Carica sfondo salvato o usa default
    const savedBg = localStorage.getItem('appBackground') || 'grad1';
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

// Funzione per uccidere forzatamente il riconoscimento vocale
function stopSpeechRecognition() {
    if (recognition) {
        try {
            recognition.onend = null; // Rimuovi il listener per evitare il riavvio automatico
            recognition.onerror = null;
            recognition.stop();
        } catch (e) {
            console.warn("Errore nello stop forzato:", e);
        }
        recognition = null;
    }
}

let isRecognitionRestarting = false; // Flag per evitare loop stretti

function initSpeechRecognition() {
    // 1. Pulizia preventiva: se esiste, uccidilo.
    if (recognition) return; 

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Browser non supportato. Usa Chrome o Edge.");
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = APP_LANGUAGE === 'zh' ? 'zh-CN' : (APP_LANGUAGE === 'it' ? 'it-IT' : 'en-US'); 
    recognition.continuous = true; 
    recognition.interimResults = true; 
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        isRecognitionRestarting = false;
    };

    recognition.onresult = (event) => {
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            }
        }

        // Se c'è testo definitivo, invialo
        if (finalTranscript && socket && currentRoomId) {

            // Logica Verbale (Meeting Minutes)
            if (isGlobalMeetingRecording) {
                const data = {
                    nickname: userNickname,
                    text: finalTranscript,
                    timestamp: new Date().toLocaleTimeString()
                };
                socket.emit('global-transcript-chunk', currentRoomId, data);
            }

            // Logica Sottotitoli (CC)
            if (isTranscribingLocal) {
                Object.keys(peerConnections).forEach(peerId => {
                    socket.emit('transcription-result', peerId, finalTranscript, true);
                });
            }
        }
    };

    recognition.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return; // Ignora errori banali
        console.warn("[Speech] Errore:", event.error);
    };

    recognition.onend = () => {
        // Se il flag è ancora attivo, riavvia
        if ((isTranscribingLocal || isGlobalMeetingRecording) && !isRecognitionRestarting) {
            isRecognitionRestarting = true;
            
            // Riavvia dopo 500ms per evitare crash del browser
            setTimeout(() => {
                stopSpeechRecognition(); // Pulizia sicurezza
                initSpeechRecognition(); // Ricrea istanza
                try {
                    if (recognition) recognition.start();
                } catch(e) { console.warn("Riavvio fallito:", e); }
            }, 500);
        } else {
            stopSpeechRecognition(); // Pulisci tutto
        }
    };
}

// ---------- Helpers ----------
function t(key) {
    if (TRANSLATIONS[APP_LANGUAGE] && TRANSLATIONS[APP_LANGUAGE].js[key]) {
        return TRANSLATIONS[APP_LANGUAGE].js[key];
    }
    // Fallback: se la chiave non esiste o la lingua è EN, ritorna una default (o gestisci diversamente)
    // Qui ritorno una mappa inglese di default per i messaggi JS critici se serve
    const defaults = {
        "welcome": "Welcome to",
        "user_joined": "joined.",
        "user_left": "User left.",
        "link_copied": "Link copied to clipboard!",
        "missing_data": "Missing data",
        "waiting_others": "Waiting for other participants...",
        "you": "You",
        "system": "System"
    };
    return defaults[key] || key;
}

// Funzione principale che aggiorna il DOM
function initLocalization() {
    const dict = TRANSLATIONS[APP_LANGUAGE];
    if (!dict || !dict.ui) return; // Se è inglese o lingua non supportata, lascia l'HTML così com'è

    console.log(`[i18n] Applicazione lingua: ${APP_LANGUAGE}`);

    for (const [selector, value] of Object.entries(dict.ui)) {
        // Cerca per ID o selettore CSS
        let el = document.getElementById(selector);
        if (!el) el = document.querySelector(selector);

        if (el) {
            if (typeof value === 'string') {
                el.innerText = value;
            } else {
                if (value.placeholder) el.placeholder = value.placeholder;
                if (value.title) el.title = value.title;
                if (value.prefix) {
                    // Per elementi che hanno un numero dinamico dentro (es. Utenti: 0)
                    // Questa logica va gestita a parte nell'aggiornamento dinamico, 
                    // ma qui traduciamo l'etichetta statica se possibile.
                }
            }
        }
    }
}

function downloadTranscription(peerId, text) {
    const nickname = remoteNicknames[peerId] || "Utente";
    const blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });   
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Trascrizione_${nickname}_${new Date().toLocaleTimeString()}.txt`;
    document.body.appendChild(a);
    a.click();  
    // Pulizia
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// --- GESTIONE NOTIFICHE E LETTURA ---

function updateTypingUI() {
    if (activeTypers.size > 0) {
        typingIndicator.classList.remove('hidden');
        
        const names = Array.from(activeTypers);
        if (names.length === 1) {
            typingText.textContent = `${names[0]} sta scrivendo...`;
        } else if (names.length === 2) {
            typingText.textContent = `${names[0]} e ${names[1]} stanno scrivendo...`;
        } else {
            typingText.textContent = `Più persone stanno scrivendo...`;
        }
    } else {
        typingIndicator.classList.add('hidden');
    }
}

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
    // 1. Pulisci la griglia
    videosGrid.innerHTML = '';
    
    // 2. Resetta interfaccia
    messagesContainer.innerHTML = ''; 
    document.getElementById('room-name-display').textContent = '';

    showOverlay(true);
    userNickname = 'Ospite';
    currentRoomId = null;
    
    // 3. Ferma Stream
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    localStream = null;
    if (screenStream) screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
    
    // 4. Reset Icone
    toggleAudioButton.querySelector('.material-icons').textContent = 'mic';
    toggleVideoButton.querySelector('.material-icons').textContent = 'videocam';
    shareScreenButton.classList.remove('active');
    shareScreenButton.querySelector('.material-icons').textContent = 'screen_share';
    isAudioEnabled = true;
    isVideoEnabled = true;

    // 5. Reset Whiteboard & File
    whiteboardContainer.classList.add('hidden');
    toggleWhiteboardButton.classList.remove('active');
    toggleWhiteboardButton.classList.remove('has-notification'); 
    if(ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    localWhiteboardHistory = []; 

    if(fileTransferContainer) fileTransferContainer.innerHTML = '';
    for(const k in dataChannels) delete dataChannels[k];

    // 6. Stop Recording
    if (isRecording) stopRecording(); 
    if (recordButton) {
        recordButton.classList.remove('active');
        recordButton.querySelector('.material-icons').textContent = 'fiber_manual_record';
        isRecording = false;
    }
    
    // 7. Pulisci variabili Logiche
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

    // --- FIX: RICOSTRUZIONE GRIGLIA ---
    
    // A. Crea il placeholder
    const placeholder = document.createElement('div');
    placeholder.id = 'remote-video-placeholder';
    placeholder.className = 'video-placeholder';
    placeholder.textContent = t('waiting_others');
    
    // B. Inserisci PRIMA il placeholder
    videosGrid.appendChild(placeholder);
    
    // C. Inserisci POI il localFeed (che esiste ancora in memoria anche se rimosso dal DOM)
    videosGrid.appendChild(localFeedEl);
    
    // D. Nascondilo e resettalo
    localFeedEl.classList.add('hidden');
    localFeedEl.classList.remove('is-focused', 'is-talking');
    
    // 8. Reset Input
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

// Funzione monitoraggio audio ottimizzata (Singleton Context)
function monitorLocalAudio(start = true) {
    // 1. Pulizia: Se dobbiamo fermare o se l'audio è disabilitato
    if (!start || !localStream || !isAudioEnabled) {
        if (talkingInterval) { 
            clearInterval(talkingInterval); 
            talkingInterval = null; 
        }
        
        // Chiudiamo il context precedente per liberare risorse hardware
        if (audioContext && audioContext.state !== 'closed') {
            try {
                audioContext.close();
            } catch(e) { console.warn("Errore chiusura AudioContext", e); }
        }
        audioContext = null; // Reset variabile globale

        if (isLocalTalking && socket) {
            isLocalTalking = false;
            localFeedEl.classList.remove('is-talking');
            socket.emit('audio-status-changed', currentRoomId, isLocalTalking);
        }
        return;
    }

    // 2. Avvio: Crea il context solo se non esiste o è chiuso
    if (start && !talkingInterval) {
        try {
            // Crea nuovo context solo se necessario
            if (!audioContext || audioContext.state === 'closed') {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Se il context è sospeso (autoplay policy), riattiviamolo
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }

            analyser = audioContext.createAnalyser();
            analyser.fftSize = 512; // Ridotto da 2048 per performance
            analyser.minDecibels = -90;
            analyser.maxDecibels = 0;
            analyser.smoothingTimeConstant = 0.8; // Meno jitter

            const source = audioContext.createMediaStreamSource(localStream);
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            talkingInterval = setInterval(() => {
                // Controllo sicurezza: se il context è crashato, fermiamo tutto
                if(!audioContext || audioContext.state === 'closed') {
                    monitorLocalAudio(false);
                    return;
                }

                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for(let i = 0; i < bufferLength; i++) sum += dataArray[i];
                const average = sum / bufferLength;
                
                // Algoritmo calcolo volume
                const db = average > 0 ? 20 * Math.log10(average / 128) + 10 : -100;
                
                const currentlyTalking = db > AUDIO_THRESHOLD && isAudioEnabled;

                if (currentlyTalking !== isLocalTalking) {
                    isLocalTalking = currentlyTalking;
                    localFeedEl.classList.toggle('is-talking', isLocalTalking);
                    if (socket) socket.emit('audio-status-changed', currentRoomId, isLocalTalking);
                }
            }, 100); 
        } catch (e) {
            console.error("Errore avvio monitoraggio audio:", e);
            // Non crashare l'app, semplicemente disabilita l'effetto visivo
            monitorLocalAudio(false);
        }
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
  
  // Pulizia risorse completa
  if(peerConnections[socketId]) { peerConnections[socketId].close(); delete peerConnections[socketId]; }
  if (dataChannels[socketId]) { dataChannels[socketId].close(); delete dataChannels[socketId]; }
  delete fileChunks[socketId]; delete fileMetadata[socketId];
  delete remoteNicknames[socketId]; delete iceCandidateQueues[socketId];
  delete videoSenders[socketId]; delete manuallyMutedPeers[socketId]; 
  
  if (currentSpeakerId === socketId) currentSpeakerId = null;
  if (autoFocusTimer) { clearTimeout(autoFocusTimer); autoFocusTimer = null; }

  // CORREZIONE FOCUS: Se esce l'utente che stavo guardando ingrandito, torna alla griglia
  if(focusedPeerId === socketId) {
      setFocus(null); 
  }

  // Se rimane solo il mio video locale, mostra il messaggio di attesa
  const remoteVideos = videosGrid.querySelectorAll('.video-feed:not(#local-feed)');
  if(remoteVideos.length === 0){
    // Rimuovi eventuali placeholder vecchi per non duplicarli
    const oldPh = document.getElementById('remote-video-placeholder');
    if(oldPh) oldPh.remove();

    const placeholder = document.createElement('div');
    placeholder.id = 'remote-video-placeholder';
    placeholder.className = 'video-placeholder';
    placeholder.textContent = t('waiting_others');
    videosGrid.insertBefore(placeholder, localFeedEl);
  }
}

// app.js - PARTE 2
async function enableMediaIfNeeded() {
    if (!localStream) {
        try {
            // Richiede permessi ora
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            updateLocalVideo();
            
            // Imposta tracce in base allo stato desiderato
            localStream.getAudioTracks().forEach(t => t.enabled = isAudioEnabled);
            localStream.getVideoTracks().forEach(t => t.enabled = isVideoEnabled);
            
            // Aggiungi le tracce alle connessioni esistenti (siamo entrati come "ascoltatori")
            for(const peerId in peerConnections) {
                const pc = peerConnections[peerId];
                localStream.getTracks().forEach(track => {
                    const sender = pc.addTrack(track, localStream);
                    if(track.kind === 'video') videoSenders[peerId] = sender;
                });
                // Rinegozia
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('offer', peerId, pc.localDescription);
            }
            monitorLocalAudio(isAudioEnabled);
        } catch(err) {
            console.error(err);
            alert("Impossibile accedere a webcam/mic. Verifica i permessi.");
            return false;
        }
    }
    return true;
}

// Override toggleAudio
async function toggleAudio(){
    // Se non abbiamo ancora lo stream, crealo ora
    if(!localStream) {
        isAudioEnabled = true; // Intenzione utente
        await enableMediaIfNeeded();
    } else {
        isAudioEnabled = !isAudioEnabled;
        localStream.getAudioTracks().forEach(track => track.enabled = isAudioEnabled);
    }
    
    toggleAudioButton.querySelector('.material-icons').textContent = isAudioEnabled ? 'mic' : 'mic_off';
    localMicStatusIcon.textContent = isAudioEnabled ? 'mic' : 'mic_off'; 
    monitorLocalAudio(isAudioEnabled); 
}

// Override toggleVideo
async function toggleVideo(){
    if(!localStream) {
        isVideoEnabled = true; 
        await enableMediaIfNeeded();
    } else {
        isVideoEnabled = !isVideoEnabled;
        localStream.getVideoTracks().forEach(track => track.enabled = isVideoEnabled);
    }
    
    // 1. Aggiorna icona bottone
    toggleVideoButton.querySelector('.material-icons').textContent = isVideoEnabled ? 'videocam' : 'videocam_off';
    
    // 2. Mostra/Nascondi immagine NO CAM locale
    const localOverlay = document.getElementById('local-no-cam');
	if (localOverlay) localOverlay.classList.add('hidden');
    if (localOverlay) {
        if (isVideoEnabled) localOverlay.classList.add('hidden');
        else localOverlay.classList.remove('hidden');
    }

    // 3. Dillo al server (così gli altri vedono la tua immagine)
    if (socket && currentRoomId) {
        socket.emit('video-status-changed', currentRoomId, isVideoEnabled);
    }
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

if (chatResizer) {
    chatResizer.addEventListener('mousedown', (e) => {
        isChatResizing = true;
        chatResizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isChatResizing) return;
        // Calcola nuova larghezza (Window Width - Mouse X)
        // Poiché il pannello è a destra
        let newWidth = window.innerWidth - e.clientX;
        
        // Limiti
        if (newWidth < 250) newWidth = 250;
        if (newWidth > window.innerWidth * 0.6) newWidth = window.innerWidth * 0.6;
        
        chatPanel.style.width = `${newWidth}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isChatResizing) {
            isChatResizing = false;
            chatResizer.classList.remove('resizing');
            document.body.style.cursor = 'default';
        }
    });
}

// -----------------------------------------------------------
// 4. PARSER COMANDI SLASH (/join, /slap, ecc)
// -----------------------------------------------------------

function sendMessage(contentOverride = null) {
    const fullMessage = (typeof contentOverride === 'string') ? contentOverride : chatMessageInput.value.trim();
    if (!fullMessage) return;

    // --- COMANDI SLASH ---
    if (fullMessage.startsWith('/')) {
        const args = fullMessage.split(' ');
        const cmd = args[0].toLowerCase();
        const arg1 = args[1];
        const contentArgs = args.slice(2).join(' ');

        switch(cmd) {
            case '/help':
                const helpText = `
                <b>Comandi Disponibili:</b><br>
                /join #canale - Entra/Crea un canale<br>
                /leave - Disconnetti<br>
                /serverlist - Lista canali globali<br>
                /op nome - Rendi operatore<br>
				/deop nome - Togli operatore<br>
                /voice nome - Dai voice (+)<br>
				/devoice nome - Togli voice<br>
                /slap nome - Schiaffeggia utente<br>
                /dm nome msg - Messaggio privato
                `;
                addChatMessage('Sistema', helpText, false, 'system');
                break;
                
            case '/join':
                if(arg1) {
                    // Rimuove il '#' se l'utente lo ha scritto
                    const roomName = arg1.replace('#', '').toLowerCase();
                    handleJoinCommand(roomName);
                } else {
                    addChatMessage('Sistema', 'Uso: /join #nomestanza', false, 'system');
                }
                break;

            case '/leave':
                // CASO A: Canale specificato (es: /leave #test)
                if (arg1) {
                    const roomToLeave = arg1.replace('#', '').toLowerCase();
                    // Controlla se siamo effettivamente in quel canale
                    if (myJoinedChannels.includes(roomToLeave)) {
                        removeChannelFromSidebar(roomToLeave);
                        addChatMessage('Sistema', `Hai lasciato il canale #${roomToLeave}.`, false, 'system');
                    } else {
                        addChatMessage('Sistema', `Non sei connesso al canale #${roomToLeave}.`, false, 'system');
                    }
                } 
                // CASO B: Nessun canale specificato (lascia quello corrente)
                else {
                    if (currentRoomId) {
                        // Salviamo l'ID prima che venga resettato
                        const roomName = currentRoomId; 
                        removeChannelFromSidebar(roomName);
                    } else {
                        // Se non siamo in nessuna stanza, disconnessione totale
                        disconnect();
                    }
                }
                break;
				
            case '/serverlist':
                // Richiede la lista e apre il modale
                socket.emit('request-room-list');
                if(serverListModal) serverListModal.classList.remove('hidden');
                addChatMessage('Sistema', 'Apertura lista server...', false, 'system');
                break;

            case '/op':
                if(arg1) socket.emit('command-op', currentRoomId, arg1);
                else addChatMessage('Sistema', 'Uso: /op nomeutente', false, 'system');
                break;
				
            case '/deop':
                if(arg1) socket.emit('command-deop', currentRoomId, arg1);
                else addChatMessage('Sistema', 'Uso: /deop nomeutente', false, 'system');
                break;

            case '/voice':
                 if(arg1) socket.emit('command-voice', currentRoomId, arg1);
                 else addChatMessage('Sistema', 'Uso: /voice nomeutente', false, 'system');
                 break;
				 
			case '/devoice':
                 if(arg1) socket.emit('command-devoice', currentRoomId, arg1);
                 else addChatMessage('Sistema', 'Uso: /devoice nomeutente', false, 'system');
                 break;
				 
			case '/moderate':
                if(arg1 === 'on' || arg1 === 'off') {
                    socket.emit('command-moderate', currentRoomId, arg1);
                } else {
                    addChatMessage('Sistema', 'Uso: /moderate on | /moderate off', false, 'system');
                }
                break;

            case '/slap':
                if(arg1) socket.emit('command-action', currentRoomId, 'slap', arg1);
                else addChatMessage('Sistema', 'Uso: /slap nomeutente', false, 'system');
                break;

            case '/dm':
                if(arg1 && contentArgs) {
                   const recipientNickname = arg1;
                   if (recipientNickname.toLowerCase() === userNickname.toLowerCase()) {
                        addChatMessage('Sistema', 'No DM a te stesso.', true, 'system');
                   } else {
                        // Cerca l'ID socket basandosi sul nickname
                        const recipientId = Object.keys(remoteNicknames).find(key => 
                            remoteNicknames[key] && remoteNicknames[key].toLowerCase() === recipientNickname.toLowerCase()
                        );
                        if (recipientId) {
                            sendPrivateMessage(recipientId, recipientNickname, contentArgs);
                        } else {
                            addChatMessage('Sistema', `Utente "${recipientNickname}" non trovato.`, true, 'system');
                        }
                   }
                } else {
                    addChatMessage('Sistema', 'Uso: /dm nome messaggio', false, 'system');
                }
                break;
                
            default:
                addChatMessage('Sistema', `Comando sconosciuto: ${cmd}`, false, 'system');
        }
        
        if (!contentOverride) clearChatInput();
        return; // IMPORTANTE: Non inviare al server come messaggio pubblico
    }

    // --- MESSAGGI NORMALI ---
    if (socket && currentRoomId) {
        const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        socket.emit('send-message', currentRoomId, userNickname, fullMessage, messageId);
        addChatMessage(userNickname, fullMessage, true, 'public', messageId);
        if (!contentOverride) clearChatInput();
    }
}

function handleJoinCommand(roomName) {
    // 1. Se siamo già in questa stanza, avvisa e non fare nulla
    if (roomName === currentRoomId) {
        addChatMessage('Sistema', `Sei già connesso al canale #${roomName}.`, false, 'system');
        return;
    }

    // 2. Aggiungi alla lista locale dei canali "aperti" se non c'è già
    if (!myJoinedChannels.includes(roomName)) {
        myJoinedChannels.push(roomName);
    }
    
    // 3. Esegui il cambio stanza effettivo
    switchChannel(roomName);
}

function switchChannel(newRoomId) {
    // 1. Normalizza l'ID
    newRoomId = newRoomId.toLowerCase();
    
    // Se stiamo cliccando sulla stessa stanza, non fare nulla
    if (currentRoomId === newRoomId) return;

    // 2. IMPORTANTE: NON inviare 'leave-room'. 
    // Vogliamo rimanere connessi alla stanza vecchia in background.

    // 3. Pulisci la vista ATTUALE
    // Chiudiamo le connessioni VIDEO per risparmiare risorse (verranno ricreate se torni qui)
    Object.values(peerConnections).forEach(pc => pc.close());
    for (const key in peerConnections) delete peerConnections[key];
    videosGrid.innerHTML = ''; 
    
    // 4. Ripristina il placeholder e il video locale
    const placeholder = document.createElement('div');
    placeholder.id = 'remote-video-placeholder';
    placeholder.className = 'video-placeholder';
    placeholder.textContent = 'Caricamento stanza...';
    videosGrid.appendChild(placeholder);
    
    if (localFeedEl) {
        videosGrid.appendChild(localFeedEl);
        localFeedEl.classList.remove('hidden');
    }

    // 5. Aggiorna stato applicazione
    saveCurrentChatToMemory(); // Salva chat vecchia
    messagesContainer.innerHTML = ''; // Pulisci UI
    
    currentRoomId = newRoomId; // Imposta nuova stanza
    document.getElementById('room-name-display').textContent = `#${newRoomId}`;
    
    loadChatFromMemory(newRoomId); // Carica chat nuova se esiste
    renderSidebarChannels(); // Aggiorna sidebar (evidenzia attiva)

    // 6. Aggiorna l'URL del browser
    const url = new URL(window.location);
    url.searchParams.set('room', newRoomId);
    window.history.pushState({}, '', url);

    // 7. Richiedi al server i dati della nuova stanza (Chi c'è dentro?)
    // Il server capirà che sei già dentro e ti manderà solo i dati aggiornati
    if(socket && socket.connected) {
        socket.emit('join-room', currentRoomId, userNickname, currentRoomPassword);
    }
}

function renderSidebarChannels() {
    if(!myChannelsListEl) return;
    myChannelsListEl.innerHTML = '';

    myJoinedChannels.forEach(room => {
        const div = document.createElement('div');
        // Aggiungi classe 'active' se è la stanza in cui siamo ora
        div.className = `channel-item ${room === currentRoomId ? 'active' : ''}`;
        div.style.justifyContent = 'space-between'; // Per separare nome e tasto X
        
        // Nome Canale
        const span = document.createElement('span');
        span.textContent = `#${room}`;
        div.appendChild(span);

        // Tasto X per chiudere il canale dalla lista
        const closeBtn = document.createElement('button');
        closeBtn.className = 'remove-chan-btn';
        closeBtn.innerHTML = '<span class="material-icons" style="font-size:14px">close</span>';
        closeBtn.title = "Lascia il canale";
        
        // CSS Inline per il bottone X (o mettilo nel CSS)
        closeBtn.style.background = 'transparent';
        closeBtn.style.border = 'none';
        closeBtn.style.color = '#ff5252';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.opacity = '0.7';

        closeBtn.onclick = (e) => {
            e.stopPropagation(); // Evita che il click sul bottone attivi il click sul div (cambio stanza)
            if(confirm(`Vuoi lasciare il canale #${room}?`)) {
                removeChannelFromSidebar(room);
            }
        };
        div.appendChild(closeBtn);

        // Click sull'intero div per cambiare canale
        div.onclick = () => {
            if (room !== currentRoomId) {
                switchChannel(room);
            }
        };

        myChannelsListEl.appendChild(div);
    });
}

function removeChannelFromSidebar(roomToRemove) {
    if (!roomToRemove) return;

    // 1. Normalizzazione identica al server
    const roomName = roomToRemove.trim().replace('#', '').toLowerCase();

    // 2. Invia evento al server (se connesso)
    if (socket && socket.connected) {
        socket.emit('leave-room', roomName);
        
        // FIX AGGIUNTIVO: Chiediamo subito la lista aggiornata per fixare il modale "Canali Attivi"
        setTimeout(() => {
            socket.emit('request-room-list');
        }, 200);
    } else {
        console.error("Socket non connesso, impossibile inviare leave-room");
    }

    // 3. Rimuovi dalla lista locale
    myJoinedChannels = myJoinedChannels.filter(r => r !== roomName);
    
    // 4. Pulisci memoria chat locale
    if (roomChatsData[roomName]) delete roomChatsData[roomName];
    
    // 5. Aggiorna la Sidebar
    renderSidebarChannels();
    
    // 6. GESTIONE CAMBIO VISTA
    // Se stiamo chiudendo la stanza che stiamo guardando ORA
    if (currentRoomId === roomName) {
        
        // Pulisci UI
        if(messagesContainer) messagesContainer.innerHTML = '';
        const titleEl = document.getElementById('room-name-display');
        if(titleEl) titleEl.textContent = '';
        if(videosGrid) videosGrid.innerHTML = '';
        
        // Reset variabile currentRoomId
        currentRoomId = null; 

        // Se ci sono altri canali aperti, sposta la vista sul primo disponibile
        if (myJoinedChannels.length > 0) {
            switchChannel(myJoinedChannels[0]);
        } else {
            // Se non c'è nulla, torna alla home
            resetAndShowOverlay();
            
            // Pulizia extra per evitare flussi video residui
            if(localStream) {
                // Opzionale: fermare la cam se esci da tutto
                // localStream.getTracks().forEach(t => t.stop());
            }
        }
    } 
}

// ** FILE TRANSFER LOGIC (PROTETTO) **
if (transferFileButton) {
    transferFileButton.addEventListener('click', () => { 
        if(Object.keys(peerConnections).length === 0) { alert("Nessun partecipante."); return; } 
        targetFileRecipientId = null; 
        fileInput.click(); 
    });
}

// ... (Menu contestuale file send) ...
if (menuSendFile) {
    menuSendFile.addEventListener('click', () => {
        if (contextTargetPeerId) {
            targetFileRecipientId = contextTargetPeerId;
            hideContextMenu();
            if(!dataChannels[targetFileRecipientId] || dataChannels[targetFileRecipientId].readyState !== 'open'){
                alert("Impossibile inviare file: connessione dati non stabile.");
                return;
            }
            fileInput.click();
        }
    });
}

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

if (settingsBtnOverlay) settingsBtnOverlay.addEventListener('click', openSettings);
if (settingsBtnRoom) settingsBtnRoom.addEventListener('click', openSettings);
if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);

// Cambio Tema
if (themeToggle) {
    themeToggle.addEventListener('change', (e) => {
        if(e.target.checked) {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
    });
}

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

// --- GESTIONE VERBALE RIUNIONE (GLOBAL TRANSCRIPT) ---

if (globalTranscriptBtn) {
    globalTranscriptBtn.addEventListener('click', () => {
        if(extrasMenu) extrasMenu.classList.remove('active'); // Chiudi menu

        // Toggle stato locale
        const newState = !isGlobalMeetingRecording;
        
        // Invia comando al server (che lo dirà a tutti)
        socket.emit('toggle-global-transcription', currentRoomId, newState);
    });
}

// Chiudi solo il pannello visivo (ma continua a registrare sotto se attivo)
if (closeTranscriptBtn) {
    closeTranscriptBtn.addEventListener('click', () => {
        meetingTranscriptPanel.classList.add('hidden');
    });
}

// Funzione per scaricare il verbale (Meeting Minutes)
function downloadMeetingMinutes() {
    if (meetingHistory.length === 0) return;

    let content = `VERBALE RIUNIONE - ${currentRoomId}\n`;
    content += `Data: ${new Date().toLocaleDateString()}\n`;
    content += `----------------------------------------\n\n`;

    meetingHistory.forEach(item => {
        content += `[${item.timestamp}] ${item.name}:\n${item.text}\n\n`;
    });

    // Usa la funzione di download con fix BOM (UTF-8)
    const blob = new Blob(['\uFEFF' + content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Meeting_Minutes_${currentRoomId}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// ** ADMIN PANEL UI (PROTETTO) **
if (openAdminLoginBtn) {
    openAdminLoginBtn.addEventListener('click', () => { 
        closeSettings(); 
        adminPanel.classList.remove('hidden'); 
    });
}

if (closeAdminBtn) {
    closeAdminBtn.addEventListener('click', () => { adminPanel.classList.add('hidden'); });
}

if (adminLoginBtn) {
    adminLoginBtn.addEventListener('click', () => { 
        const pwd = adminPasswordInput.value; 
        if(!socket) initializeSocket(); 
        socket.emit('admin-login', pwd); 
    });
}

if (adminRefreshBtn) {
    adminRefreshBtn.addEventListener('click', () => { if(socket) socket.emit('admin-refresh'); });
}

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

        header.innerHTML = `<span class="room-name">${statusIcons}#${roomId}</span>`;
        
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

        alert("Link copiato negli appunti! " + (currentRoomPassword ? "(Include la password)" : ""));
    }).catch(err => {
        console.error('Errore copia:', err);
    }); 
}

const originalAddChatMessage = addChatMessage;
function addChatMessage(sender, message, isLocal = false, type = 'public', msgId = null) {
    const messageEl = document.createElement('div');
    messageEl.classList.add('chat-message');

    // --- CASO 1: MESSAGGIO DI SISTEMA (Join/Leave/Errori) ---
    if (type === 'system') {
        messageEl.innerHTML = `
            <div class="message-system-wrapper">
                <span class="system-msg-content">${message}</span>
            </div>
        `;
        messagesContainer.appendChild(messageEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // [NUOVO] Salva messaggio di sistema in memoria per il cambio canali
        if (typeof roomChatsData !== 'undefined' && currentRoomId) {
            if (!roomChatsData[currentRoomId]) roomChatsData[currentRoomId] = [];
            // I messaggi di sistema spesso non hanno ID univoci, li salviamo sempre
            roomChatsData[currentRoomId].push({ 
                sender: 'Sistema', 
                text: message, 
                type: 'system', 
                id: 'sys_' + Date.now(), 
                timestamp: Date.now() 
            });
        }
        return; // Ci fermiamo qui
    }

    // --- CASO 2: MESSAGGI UTENTE (Public/Private) ---
    
    // A. Setup Ricevute di Lettura (Click per info)
    if (msgId) {
        messageEl.dataset.messageId = msgId;
        messageEl.dataset.readers = JSON.stringify([]); 
        messageEl.addEventListener('click', () => showReadersDialog(msgId));
        messageEl.style.cursor = 'pointer'; 
    }

    // B. Definizione Stile Mittente
    let cssClass;
    if (type === 'private') {
        cssClass = 'sender-private';
    } else {
        cssClass = isLocal ? 'sender-me' : 'sender-remote';
    }

    // C. Rilevamento Immagini / Sticker / GIF
    const isImage = (url) => {
        return /\.(gif|jpe?g|png|webp)($|\?)/i.test(url) || 
               url.includes('media.giphy.com') || 
               url.includes('media.tenor.com');
    };

    let messageContentHtml = message;

    if (isImage(message.trim())) {
        // È un'immagine: Renderizza il tag <img>
        messageContentHtml = `<img src="${message}" class="chat-media-img" onclick="window.open(this.src, '_blank'); event.stopPropagation();" alt="sticker" />`;
    } else {
        // È testo normale
        messageContentHtml = message;
    }

    // D. Costruzione Prefisso (Nome Mittente)
    const prefix = isLocal 
        ? `${userNickname}${type === 'private' ? ` (DM a ${sender})` : ''}: ` 
        : `${sender}: `;

    // E. Costruzione HTML Finale
    let htmlContent = `<span class="${cssClass}">${prefix}</span>${messageContentHtml}`;

    // F. Aggiunta Icona Spunte Lettura (solo se c'è un ID)
    if (msgId) {
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

    // --- G. LOGICA SUONI E NOTIFICHE ---
    if (!isLocal) {
        playNotificationSound('chat');
        
        // Verifica se la chat è visibile (Desktop o Mobile)
        const isChatVisible = (!chatPanel.classList.contains('hidden') && window.innerWidth > 768) || 
                              (chatPanel.classList.contains('active') && !chatPanel.classList.contains('hidden'));

        if (isChatVisible) {
            // Se vedo la chat, mando subito la conferma di lettura
            if (socket && currentRoomId && msgId) {
                socket.emit('msg-read', currentRoomId, msgId, userNickname);
                messageEl.classList.add('processed-read'); 
            }
        } else {
            // Se non la vedo, incremento il badge notifiche
            unreadMessagesCount++;
            updateUnreadBadge();
        }
    }

    // [NUOVO] Salva messaggio utente in memoria per il cambio canali
    if (typeof roomChatsData !== 'undefined' && currentRoomId) {
        if (!roomChatsData[currentRoomId]) roomChatsData[currentRoomId] = [];
        
        // Evitiamo duplicati controllando l'ID
        const exists = msgId && roomChatsData[currentRoomId].some(m => m.id === msgId);
        if (!exists) {
            roomChatsData[currentRoomId].push({ 
                sender: sender, 
                text: message, 
                type: type, 
                id: msgId, 
                timestamp: Date.now() 
            });
        }
    }
}

function clearChatInput(){ chatMessageInput.value = ''; }

// -----------------------------------------------------------
// 5. SIDEBAR & LISTA SERVER
// -----------------------------------------------------------

if (toggleSidebarBtn && channelSidebar) {
    toggleSidebarBtn.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            channelSidebar.classList.toggle('mobile-open');
        } else {
            channelSidebar.classList.toggle('collapsed');
        }
    });
}

if (refreshChannelsBtn) {
    refreshChannelsBtn.addEventListener('click', () => {
        if(socket) socket.emit('request-room-list');
    });
}

// Funzione render aggiornata per il Modale
function renderServerList(list) {
    if (!serverListContainer) return;
    
    // Resetta il contenuto (rimuove la scritta "Aggiornamento...")
    serverListContainer.innerHTML = '';
    
    if (list.length === 0) {
        serverListContainer.innerHTML = '<p style="text-align:center; color:gray;">Nessuna stanza attiva.</p>';
        return;
    }

    list.forEach(room => {
        const div = document.createElement('div');
        div.className = 'channel-item'; 
        div.style.background = 'var(--surface-2)';
        div.style.justifyContent = 'space-between';
        
        // Verifica se siamo già dentro questo canale (nella sidebar)
        const amIInThisRoom = myJoinedChannels.includes(room.name);
        const isCurrentView = (room.name === currentRoomId);
        
        // Marker visivi
        let statusText = '';
        if (isCurrentView) statusText = ' <span style="color:var(--primary-color); font-size:0.8em; font-weight:bold;">(TU SEI QUI)</span>';
        else if (amIInThisRoom) statusText = ' <span style="color:#4caf50; font-size:0.8em; font-weight:bold;">(APERTO)</span>';

        const icons = [];
        if(room.isLocked) icons.push('🔒');
        if(room.hasPass) icons.push('🔑');
        
        div.innerHTML = `
            <span>#${room.name}${statusText} ${icons.join('')}</span>
            <small style="color:var(--primary-color); font-weight:bold;">${room.count} Utenti</small>
        `;
        
        div.addEventListener('click', () => {
            // CASO 1: È il canale che sto già guardando
            if (room.name === currentRoomId) {
                serverListModal.classList.add('hidden');
                return;
            }

            // CASO 2: Ho già il canale nella sidebar ma sto guardando altro
            if (amIInThisRoom) {
                serverListModal.classList.add('hidden');
                switchChannel(room.name);
                return;
            }

            // CASO 3: Non sono nel canale -> Chiedo conferma per entrare
            if (confirm(`Vuoi entrare nel canale #${room.name}?`)) {
                serverListModal.classList.add('hidden');
                // Usa la funzione che gestisce l'ingresso e l'aggiunta alla sidebar
                handleJoinCommand(room.name);
            }
        });
        
        serverListContainer.appendChild(div);
    });
}

// Event Listeners per il nuovo Modale
if (openServerListBtn) {
    openServerListBtn.addEventListener('click', () => {
        serverListModal.classList.remove('hidden');
        if(socket) socket.emit('request-room-list');
    });
}

if (closeServerListBtn) {
    closeServerListBtn.addEventListener('click', () => {
        serverListModal.classList.add('hidden');
    });
}

if (refreshServerListModalBtn) {
    refreshServerListModalBtn.addEventListener('click', () => {
        serverListContainer.innerHTML = '<p style="text-align:center;">Aggiornamento...</p>';
        if(socket) socket.emit('request-room-list');
    });
}

function sendPrivateMessage(recipientId, recipientNickname, message) { if (!message || !recipientId) return; if (socket && currentRoomId) { socket.emit('send-private-message', currentRoomId, recipientId, userNickname, message); addChatMessage(recipientNickname, message, true, 'private'); } }
function openChatPanelMobile(callback) { if (chatPanel.classList.contains('active') && !chatPanel.classList.contains('hidden')) { if (callback) callback(); return; } chatPanel.classList.remove('hidden'); setTimeout(() => { chatPanel.classList.add('active'); let closeBtn = document.getElementById('close-chat-btn'); if (!closeBtn) { closeBtn = document.createElement('button'); closeBtn.textContent = '← Torna alle webcam'; closeBtn.id = 'close-chat-btn'; closeBtn.style.cssText = `position: relative; width: calc(100% - 20px); padding: 10px; margin: 10px; border: none; background: var(--primary-color); color: #fff; font-weight: bold; cursor: pointer; border-radius: 6px;`; const chatHeader = chatPanel.querySelector('h3'); if(chatHeader) chatPanel.insertBefore(closeBtn, chatHeader); closeBtn.addEventListener('click', () => { chatPanel.classList.remove('active'); setTimeout(() => { chatPanel.classList.add('hidden'); closeBtn.remove(); }, 300); }); } setTimeout(callback, 350); }, 10); }

// ** SOCKET IO **
let localServerInstanceId = null;

function initializeSocket(){
  if(socket) return; 
  socket = io(RENDER_SERVER_URL);
  
  socket.on('server-instance-id', (serverId) => {
      
      // Se avevamo già un ID salvato ed è diverso da quello appena arrivato...
      if (localServerInstanceId && localServerInstanceId !== serverId) {
          console.warn("[SYNC] Rilevato riavvio del server. Reset totale.");
          alert("Il server è stato aggiornato/riavviato. La pagina verrà ricaricata.");
          
          // PULIZIA TOTALE: Ricarica la pagina come se fosse la prima volta
          window.location.reload(); 
          return;
      }
      
      // Altrimenti è la prima connessione, salviamo l'ID
      localServerInstanceId = serverId;
  });
  
  socket.on('disconnect', (reason) => {
      
      // Se la connessione cade perché il server è stato riavviato o spento
      if (reason === "io server disconnect" || reason === "transport close") {
          alert("Il server è stato riavviato. La pagina verrà ricaricata per pulire la sessione.");
          // Questo comando pulisce TUTTA la memoria locale del browser ricaricando la pagina da zero
          location.reload(); 
      }
  });
  
  socket.on('error-message', (msg) => {
      // Mostra l'errore all'utente
      alert("AVVISO: " + msg);

      if (!nicknameOverlay.classList.contains('hidden')) {
          resetAndShowOverlay(); 
          if(socket) socket.disconnect();
          socket = null;
      }
  });
  
  socket.on('kicked-by-admin', (msg) => {
      alert(msg); // Messaggio personalizzato (es. "Sei bannato")
      location.reload();
  });
  
// --- GESTIONE TYPING REMOTE ---
	socket.on('remote-typing-start', (evtRoomId, sid, nick) => {
      if (evtRoomId.toLowerCase() !== currentRoomId.toLowerCase()) return;

      activeTypers.add(nick);
      updateTypingUI();
  });

  socket.on('remote-typing-stop', (evtRoomId, sid) => {
      if (evtRoomId.toLowerCase() !== currentRoomId.toLowerCase()) return;
      const nick = remoteNicknames[sid];
      if (nick) {
          activeTypers.delete(nick);
      } else {
      }
      updateTypingUI();
  });

// 1. Lista Stanze
	socket.on('server-room-list-update', (list) => {
        renderServerList(list);
    });

	// 2. Messaggi Action (Slap)
	socket.on('new-action-message', (msgObj) => {
		// Aggiungi una visualizzazione speciale per le action
		const messageEl = document.createElement('div');
		messageEl.classList.add('chat-message', 'action-msg');
		messageEl.innerHTML = `<span style="color:#ff4081; font-weight:bold;">* ${msgObj.text}</span>`;
		messagesContainer.appendChild(messageEl);
		messagesContainer.scrollTop = messagesContainer.scrollHeight;
	});

	// 3. Aggiornamento Nick (per OP/Voice)
	socket.on('user-nick-updated', (socketId, newNick) => {
		// 1. Aggiorna la memoria locale dei nick
		remoteNicknames[socketId] = newNick;
		
		// 2. Aggiorna l'etichetta sul video (se esiste)
		const feed = document.querySelector(`[data-peer-id="${socketId}"]`);
		if(feed) {
			feed.querySelector('.remote-nickname').textContent = newNick;
		}

		// --- FIX: CONTROLLO SE SONO IO ---
		// Se l'ID aggiornato corrisponde al MIO socket, aggiorno la mia interfaccia
		if (socket && socketId === socket.id) {
			userNickname = newNick; 
			
			// Aggiorna etichetta del mio video locale
			const localLabel = document.getElementById('local-nickname-display');
			if(localLabel) localLabel.textContent = userNickname;

			// Gestione Tasto Scudo (OP)
			const opBtn = document.getElementById('op-settings-btn');
			if (opBtn) {
				if (newNick.startsWith('@')) {
					// SONO DIVENTATO OP
					opBtn.classList.remove('hidden');
					opBtn.classList.add('op-attention'); // Effetto pulsazione
					
					// Messaggio visivo in chat
					addChatMessage('Sistema', 'Congratulazioni! Sei diventato Operatore (@).', false, 'system');
				} else {
					// HO PERSO L'OP
					opBtn.classList.add('hidden');
					opBtn.classList.remove('op-attention');
				}
			}
		}
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
              } catch(e) { console.error("Errore avvio speech:", e); }
          }
      } else {
          // Logica opzionale: Spegnere se non ci sono più richiedenti.
          // Per ora lasciamo acceso se è stato attivato una volta nella sessione per reattività,
          // oppure spegniamo subito. Spegniamo per privacy.
          isTranscribingLocal = false;
          if (recognition) recognition.stop();
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
  
  socket.on('global-transcription-status', (isActive) => {
        isGlobalMeetingRecording = isActive;

        if (isActive) {
            // === AVVIO ===
            meetingHistory = []; // Resetta l'array (importante!)
            transcriptContent.innerHTML = ''; 
            meetingTranscriptPanel.classList.remove('hidden'); 
            if(globalTranscriptBtn) globalTranscriptBtn.classList.add('active-recording');
            
            addChatMessage(t('system'), "🔴 Registrazione verbale avviata.", false, 'system');
            
            // Avvio pulito
            stopSpeechRecognition(); 
            initSpeechRecognition();
            try { recognition.start(); } catch(e){}

        } else {
            // === STOP ===
            if(globalTranscriptBtn) globalTranscriptBtn.classList.remove('active-recording');
            addChatMessage(t('system'), "⚫ Registrazione verbale fermata.", false, 'system');
            
            // Se non servono i sottotitoli, spegni il microfono
            if (!isTranscribingLocal) {
                stopSpeechRecognition();
            }

            // Attendi 1 secondo per eventuali ultimi pacchetti di rete
            setTimeout(() => {
                if (meetingHistory.length > 0) {
                    if (confirm("Verbale pronto. Vuoi scaricarlo ora?")) {
                        downloadMeetingMinutes();
                    }
                } else {
                    alert("Nessun testo rilevato durante la riunione (forse nessuno ha parlato?).");
                }
            }, 1000);
        }
    });

    // 2. Riceviamo un pezzo di testo da qualcuno
    socket.on('receive-global-transcript', (data) => {
        // data: { nickname, text, timestamp }
        
        // 1. Salva in memoria
        meetingHistory.push({
            name: data.nickname,
            text: data.text,
            timestamp: data.timestamp
        });

        // 2. Aggiorna Pannello UI (Append)
        const row = document.createElement('div');
        row.className = 'transcript-line';
        row.innerHTML = `
            <span class="t-time">[${data.timestamp}]</span>
            <span class="t-name">${data.nickname}:</span>
            <span class="t-text">${data.text}</span>
        `;
        transcriptContent.appendChild(row);
        
        // Auto-scroll in basso
        transcriptContent.scrollTop = transcriptContent.scrollHeight;
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
  socket.on('connect', ()=> console.log('Connesso', socket.id));

  socket.on('nickname-in-use', (msg) => { alert(msg); resetAndShowOverlay(); if (socket) socket.disconnect(); socket = null; });
  
  // Modifica la firma per ricevere anche topic e password
  // NOTA: Aggiunto 'joinedRoomId' come PRIMO argomento
  socket.on('welcome', (joinedRoomId, newPeerId, serverAssignedNickname, peers=[], topic="", hasPassword=false, nameColor="#00b8ff", isSilentRejoin=false, isModerated=false) => { 
      
      // Se il messaggio di benvenuto non è per la stanza che sto guardando ora, ignoralo
      // (Serve per quando ti unisci a stanze in background)
      if (joinedRoomId !== currentRoomId) {
          return;
      }

      // --- Da qui in poi è la logica standard di caricamento interfaccia ---
      if (localFeedEl) {
          localFeedEl.classList.remove('hidden');
      }

      const placeholder = document.getElementById('remote-video-placeholder');
      if (placeholder) {
          if (peers.length === 0) {
              placeholder.textContent = t('waiting_others');
          } else {
              placeholder.remove();
          }
      }

      userNickname = serverAssignedNickname; 
      
      const localLabel = document.getElementById('local-nickname-display');
      if(localLabel) localLabel.textContent = userNickname;
      
      // Aggiorna la lista nick locale
      remoteNicknames[newPeerId] = serverAssignedNickname; 
      
      updateRoomInfoUI(topic, hasPassword);
      applyRoomBrandColor(nameColor); 

      // Gestione Bottone OP
      const opBtn = document.getElementById('op-settings-btn');
      if (userNickname.startsWith('@')) {
          const toggleEl = document.getElementById('op-moderate-toggle');
          if(toggleEl) toggleEl.checked = isModerated;
          opBtn.classList.remove('hidden');
          opBtn.classList.add('op-attention');
          if(document.getElementById('op-topic-input')) document.getElementById('op-topic-input').value = topic;
          if(opColorInput) opColorInput.value = nameColor;
          if(opModerateToggle) opModerateToggle.checked = isModerated;
      } else {
          opBtn.classList.add('hidden');
          opBtn.classList.remove('op-attention');
          if(opModerateToggle) opModerateToggle.checked = isModerated;
      }

      if (!isSilentRejoin) {
          addChatMessage(userNickname, `${t('welcome')} #${currentRoomId}!`, false, 'system'); 
          // ... messaggi di sistema opzionali ...
      }
      
      // Avvia connessioni video (WebRTC)
      peers.forEach(peer => { 
          if(peer.id !== socket.id) { 
              remoteNicknames[peer.id] = peer.nickname; 
              createPeerConnection(peer.id); 
          } 
      });  
  });
  
  // Ora riceve anche 'topicChanged' (bool) e 'passwordAction' ('added'/'removed'/null)
  socket.on('room-info-updated', (newTopic, hasPassword, topicChanged, passwordAction, newColor, isModerated, modeChanged) => {
      updateRoomInfoUI(newTopic, hasPassword);
      if(newColor) applyRoomBrandColor(newColor);
      
      // FIX ROBUSTO: Aggiorna il toggle nel modale cercando l'elemento
      const toggleEl = document.getElementById('op-moderate-toggle');
      if(toggleEl) toggleEl.checked = isModerated;

      // --- COSTRUZIONE MESSAGGIO UNICA (Rimosso il duplicato 'let parts') ---
      let parts = [];
      
      if (topicChanged) parts.push(`Topic: "${newTopic}"`);
      if (passwordAction === 'added') parts.push("Password attivata 🔒");
      else if (passwordAction === 'removed') parts.push("Password rimossa 🔓");
      
      // Messaggio per cambio moderazione
      if (modeChanged) {
          if (isModerated) parts.push("Modalità Moderata ATTIVA (+m) 🔇");
          else parts.push("Modalità Moderata DISATTIVA (-m) 🔊");
      }

      if (parts.length > 0) {
          addChatMessage('Sistema', parts.join(" | "), false, 'system');
      }
  });

	socket.on('room-mode-updated', (isModerated) => {
        if(opModerateToggle) opModerateToggle.checked = isModerated;
    });
	
  // Conferma personale per l'OP che il salvataggio è riuscito
  socket.on('op-settings-saved', () => {
    if(opModal) opModal.classList.add('hidden');
    // FIX: Controllo se l'elemento esiste prima di settare il valore
    if(opPasswordInput) opPasswordInput.value = ''; 
	});
  
  
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
  
  // --- GESTIONE CRONOLOGIA CHAT (Versione Grafica) ---
  socket.on('chat-history', (history) => {
      // 1. Carica messaggi
      history.forEach(msg => {
          const isMe = (msg.sender === userNickname);
          // Usa il tipo salvato dal server (system/public) o defaulta a 'public'
          const msgType = msg.type || 'public';
          
          addChatMessage(msg.sender, msg.text, isMe, msgType, msg.id);
      });

      // 2. Divisore Grafico
      const divider = document.createElement('div');
      divider.className = 'chat-divider';
      divider.innerHTML = '<span>Cronologia Precedente</span>';
      
      messagesContainer.appendChild(divider);
      
      setTimeout(() => {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 50);
  });
  
  socket.on('new-message', (roomId, sender, message, msgId) => {
    // Normalizza ID per confronto sicuro
    const rId = roomId.toLowerCase();
    const cId = currentRoomId ? currentRoomId.toLowerCase() : "";

    if (rId === cId) {
        // Se è la stanza che sto guardando, mostra il messaggio
        addChatMessage(sender, message, false, 'public', msgId);
    } else {
        // Salva in memoria background
        if (!roomChatsData[rId]) roomChatsData[rId] = [];
        roomChatsData[rId].push({ sender, text: message, type: 'public', id: msgId });
        
        // Notifica Sidebar
        const channelItem = Array.from(document.querySelectorAll('.channel-item span')).find(el => el.textContent.toLowerCase().includes(rId));
        if(channelItem) {
            channelItem.style.fontWeight = 'bold';
            channelItem.style.color = '#fff'; 
        }
    }
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
	socket.on('peer-joined', (evtRoomId, peerId, nickname) => {
    // A. Se l'evento è per la stanza che sto guardando ORA
		if (currentRoomId && evtRoomId.toLowerCase() === currentRoomId.toLowerCase()) {
			remoteNicknames[peerId] = nickname;
			createPeerConnection(peerId);
			addChatMessage(t('system'), `${nickname} ${t('user_joined')}`, false, 'system');
		} 
		// B. Se è per un'altra stanza in cui sono connesso (background)
		else {
			// Opzionale: Aggiungi logica per salvare il messaggio in memoria 'roomChatsData'
			if (!roomChatsData[evtRoomId]) roomChatsData[evtRoomId] = [];
			roomChatsData[evtRoomId].push({
				sender: 'Sistema',
				text: `${nickname} ${t('user_joined')}`,
				type: 'system',
				timestamp: Date.now()
			});
			
			// Evidenzia la stanza nella sidebar se esiste
			const channelItem = Array.from(document.querySelectorAll('.channel-item span'))
				.find(el => el.textContent.toLowerCase().includes(evtRoomId.toLowerCase()));
			if(channelItem) {
				channelItem.style.color = 'var(--primary-color)'; // Evidenzia
				channelItem.style.fontWeight = 'bold';
			}
		}
	});
  
  // NOTA: Ora riceviamo evtRoomId come primo argomento
	socket.on('peer-left', (evtRoomId, peerId, nickname) => {
		// A. Se l'evento è per la stanza attiva
		if (currentRoomId && evtRoomId.toLowerCase() === currentRoomId.toLowerCase()) {
			removeRemoteFeed(peerId);
			const name = nickname || 'Utente';
			addChatMessage(t('system'), `${name} è uscito.`, false, 'system');
		}
		// B. Se è per una stanza in background
		else {
			// Pulizia logica delle connessioni (importante per il multi-stanza)
			if(peerConnections[peerId]) { 
				peerConnections[peerId].close(); 
				delete peerConnections[peerId]; 
			}
			// ...rimuovi feed video se per errore era rimasto...
			const el = document.querySelector(`[data-peer-id="${peerId}"]`);
			if(el) el.remove();
			
			// Salva messaggio sistema in background
			if (!roomChatsData[evtRoomId]) roomChatsData[evtRoomId] = [];
			roomChatsData[evtRoomId].push({
				sender: 'Sistema',
				text: `${nickname || 'Utente'} è uscito.`,
				type: 'system',
				timestamp: Date.now()
			});
		}
	});
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
  socket.on('room-closed-by-admin', (closedRoomId) => { 

      if (!closedRoomId) return; 
      
      const roomName = closedRoomId.toLowerCase();

      // Mostra alert solo se l'utente è "consapevole" di quella stanza
      if (myJoinedChannels.includes(roomName)) {
          alert(`La stanza #${roomName} è stata chiusa dall'amministratore.`);
      }

      // 1. Rimuovi dalla lista canali
      myJoinedChannels = myJoinedChannels.filter(r => r !== roomName);
      renderSidebarChannels(); 

      // 2. Se ero dentro quella stanza, portami via
      if (currentRoomId === roomName) {
          document.getElementById('room-name-display').textContent = '';
          
          if (myJoinedChannels.length > 0) {
              switchChannel(myJoinedChannels[0]);
          } else {
              resetAndShowOverlay();
          }
      } 
  });
}

document.addEventListener('DOMContentLoaded', () => {
	initLocalization();
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
if (joinButton) {
    joinButton.addEventListener('click', async ()=>{
      const nickname = nicknameInput.value.trim();
      const roomId = roomIdInput.value.trim().replace('#', '').toLowerCase();
      const password = document.getElementById('room-password-input').value.trim();

      if(!nickname || !roomId){ alert('Dati mancanti'); return; }
      
      userNickname = nickname; 
      currentRoomId = roomId; 
      currentRoomPassword = password;

      // --- 1. GESTIONE SIDEBAR: Aggiungi canale alla lista ---
      if (!myJoinedChannels.includes(roomId)) {
          myJoinedChannels.push(roomId);
      }
      renderSidebarChannels(); 
      
      const localLabel = document.getElementById('local-nickname-display');
      if(localLabel) localLabel.textContent = userNickname;

      // --- 2. MEDIA STATUS: Tutto spento di default ---
      isAudioEnabled = false; 
      isVideoEnabled = false;
      
      // Aggiorna UI bottoni per mostrare che sono spenti
      toggleAudioButton.querySelector('.material-icons').textContent = 'mic_off';
      toggleVideoButton.querySelector('.material-icons').textContent = 'videocam_off';
      localMicStatusIcon.textContent = 'mic_off';
      
      // Mostra il box video locale
      localFeedEl.classList.remove('hidden'); 
      
      // --- 3. FIX IMMAGINE NO-CAM: Mostrala subito ---
      const localOverlay = document.getElementById('local-no-cam');
      if (localOverlay) {
          localOverlay.classList.remove('hidden'); // Rimuove "hidden" per mostrarla subito
      }
      
      // --- 4. CONNESSIONE SOCKET ---
      initializeSocket();
      socket.emit('join-room', currentRoomId, userNickname, password); 
      
      // Aggiorna Titolo
      document.getElementById('room-name-display').textContent = '#' + roomId;
      
      // Aggiorna Sidebar UI (evidenzia canale attuale)
      if(currentChannelItem) currentChannelItem.textContent = roomId;

      // Chiudi schermata di login
      showOverlay(false); 
    });
}

if (localFeedEl) {
    localFeedEl.addEventListener('click', () => {
        toggleFocus('local');
    });
}

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

// --- CONTROLLI CHAT (Logica Unificata Desktop/Mobile) ---
if (showChatBtn) {
    showChatBtn.addEventListener('click', (e) => {
        e.stopPropagation(); 
        
        // Logica semplice: aggiungi/rimuovi classi. 
        // Il CSS gestisce la posizione e l'animazione (Slide da destra su mobile).
        
        if (chatPanel.classList.contains('hidden')) {
            // APERTURA
            chatPanel.classList.remove('hidden');
            // Piccolo timeout per permettere al browser di renderizzare prima di animare (per lo slide)
            setTimeout(() => {
                chatPanel.classList.add('active');
            }, 10);
            
            markAllAsRead();
            
            // Focus input (solo desktop per non aprire tastiera su mobile)
            if (window.innerWidth > 768) {
                setTimeout(() => chatMessageInput?.focus(), 50);
            }
        } else {
            // CHIUSURA
            chatPanel.classList.remove('active');
            
            // Aspetta la fine dell'animazione CSS (0.3s) prima di nascondere
            setTimeout(() => {
                chatPanel.classList.add('hidden');
            }, 300);
        }
    });
}


if (sendChatButton) {
    sendChatButton.addEventListener('click', () => sendMessage());
}

if (chatMessageInput) {
    chatMessageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    chatMessageInput.addEventListener('input', () => {
        if (!socket || !currentRoomId) return;
        if (!isTyping) {
            isTyping = true;
            socket.emit('typing-start', currentRoomId, userNickname);
        }
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            isTyping = false;
            socket.emit('typing-stop', currentRoomId);
        }, 2000);
    });
}

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

// --------------------------------------------------------
// LOGICA UI OPERATORE (Topic & Password)
// --------------------------------------------------------

// Apertura Modale OP
if (opSettingsBtn) {
    opSettingsBtn.addEventListener('click', () => {
        // 1. Rimuovi l'animazione pulsante (se c'era)
        opSettingsBtn.classList.remove('op-attention'); 
        // 2. Apri il modale
        opModal.classList.remove('hidden');
    });
}

// Chiusura Modale OP
if (closeOpModalBtn) {
    closeOpModalBtn.addEventListener('click', () => {
        opModal.classList.add('hidden');
    });
}

// Salvataggio Impostazioni OP
if (opSaveBtn) {
    opSaveBtn.addEventListener('click', () => {
        const newTopic = opTopicInput.value.trim();
        const newPass = opPasswordInput.value.trim();
        const newColor = opColorInput.value;
        
        // FIX ROBUSTO: Cerchiamo l'elemento qui e ora per essere sicuri al 100%
        const toggleEl = document.getElementById('op-moderate-toggle');
        const isModerated = toggleEl ? toggleEl.checked : false; 
        

        if (socket && currentRoomId) {
            // Inviamo 5 parametri (l'ultimo è isModerated)
            socket.emit('op-update-settings', currentRoomId, newTopic, newPass, newColor, isModerated);
        }
    });
}

// --------------------------------------------------------
// FUNZIONI HELPER UTILITY
// --------------------------------------------------------
function saveCurrentChatToMemory() {
    if(!currentRoomId) return;
    // Raccoglie i messaggi attuali dal DOM (o potremmo salvarli man mano che arrivano)
    // Per semplicità, qui assumiamo che roomChatsData[currentRoomId] sia già aggiornato
    // o che non cancelliamo nulla.
    // In questa implementazione semplice, ci affidiamo al fatto che 'new-message' popola l'array
    // quando siamo in background, ma quando siamo in foreground dobbiamo popolarlo noi.
}

function loadChatFromMemory(roomId) {
    if (roomChatsData[roomId]) {
        roomChatsData[roomId].forEach(msg => {
            const isMe = msg.sender === userNickname;
            addChatMessage(msg.sender, msg.text, isMe, msg.type, msg.id);
        });
    }
}

function updateRoomInfoUI(topic, isLocked) {
    const topicDisplay = document.getElementById('room-topic-display');
    const roomTitle = document.getElementById('room-name-display');

    // 1. Aggiorna Topic
    if (topicDisplay) {
        if (topic && topic.trim() !== "") {
            topicDisplay.textContent = topic;
            topicDisplay.classList.remove('hidden');
            topicDisplay.style.visibility = 'visible'; // Forza visibilità
        } else {
            topicDisplay.classList.add('hidden');
            topicDisplay.style.visibility = 'hidden';
        }
    }

    // 2. Aggiorna icona lucchetto nel titolo
    if (roomTitle) {
        let currentText = roomTitle.textContent;
        // Rimuovi lucchetto vecchio se presente
        if (currentText.includes('🔒 ')) {
            currentText = currentText.replace('🔒 ', '');
        }
        
        // Aggiungi lucchetto se bloccata
        if (isLocked) {
            roomTitle.textContent = '🔒 ' + currentText;
        } else {
            roomTitle.textContent = currentText;
        }
    }
}

// Funzione per applicare il colore del brand (Titolo + Topic)
function applyRoomBrandColor(color) {
    const titleEl = document.getElementById('room-name-display');
    const topicEl = document.getElementById('room-topic-display');
    
    // 1. Aggiorna la variabile CSS globale
    // Questo aggiorna automaticamente il colore del Topic (desktop e mobile)
    document.documentElement.style.setProperty('--dynamic-brand-color', color);

    // 2. Aggiorna il Titolo Principale (#chan)
    if (titleEl) {
        // Helper per schiarire il colore (per il gradiente del titolo)
        const adjustColorLightness = (col, amount) => {
            return '#' + col.replace(/^#/, '').replace(/../g, c => ('0'+Math.min(255, Math.max(0, parseInt(c, 16) + amount)).toString(16)).substr(-2));
        };
        
        const lighterColor = adjustColorLightness(color, 60);

        // Applica gradiente al Titolo
        titleEl.style.background = `linear-gradient(to right, ${color} 0%, ${lighterColor} 100%)`;
        titleEl.style.webkitBackgroundClip = 'text';
        titleEl.style.webkitTextFillColor = 'transparent';
        
        // Aggiorna il Glow del titolo
        titleEl.style.filter = `drop-shadow(0 0 15px ${color}80)`; // 80 hex = ~50% opacità
    }
}

// --- LOGICA GIPHY (Trend & Search) ---
const GIPHY_API_KEY = 'ehM2UChAfuhm4vDy1af3p4p0XafHq0Ag'; // Chiave Beta Pubblica. Sostituisci con la tua se smette di andare!

document.addEventListener('DOMContentLoaded', () => {
    const stickerBtn = document.getElementById('sticker-toggle-btn');
    const stickerContainer = document.getElementById('sticker-picker-container');
    const stickerGrid = document.getElementById('sticker-grid');
    const searchInput = document.getElementById('sticker-search-input');
    
    // Timer per non cercare ad ogni singola lettera (Debounce)
    let searchTimeout = null;

    if(!stickerBtn || !stickerContainer) return;

    // 1. Funzione per chiamare Giphy
    async function fetchGifs(query = '') {
        stickerGrid.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Caricamento...</div>';
        
        try {
            // Se c'è testo usa 'search', altrimenti 'trending'
            const endpoint = query ? 'search' : 'trending';
            const limit = 24; // Numero di GIF da caricare
            
            // Costruiamo l'URL
            const url = `https://api.giphy.com/v1/gifs/${endpoint}?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&rating=g`;

            const response = await fetch(url);
            const data = await response.json();
            
            renderGifs(data.data);

        } catch (error) {
            console.error("Errore Giphy:", error);
            stickerGrid.innerHTML = '<div style="text-align:center; padding:20px; color:red;">Errore caricamento GIF.</div>';
        }
    }

    // 2. Funzione per mostrare le GIF
    function renderGifs(gifList) {
        stickerGrid.innerHTML = ''; // Pulisci
        
        if (gifList.length === 0) {
            stickerGrid.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Nessun risultato.</div>';
            return;
        }

        gifList.forEach(gif => {
            // Giphy offre molte versioni. Usiamo 'fixed_height_small' per l'anteprima leggera
            // e 'original' per l'invio in chat.
            const previewUrl = gif.images.fixed_height_small.url;
            const sendUrl = gif.images.original.url; // Quella che inviamo in chat

            const img = document.createElement('img');
            img.src = previewUrl;
            img.className = 'sticker-option';
            img.loading = 'lazy'; // Ottimizza caricamento
            
            img.addEventListener('click', () => {
                sendMessage(sendUrl); // Invia l'URL ad alta qualità
                stickerContainer.classList.add('hidden'); // Chiudi pannello
            });
            
            stickerGrid.appendChild(img);
        });
    }

    // 3. Gestione Apertura Pannello
    stickerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isClosed = stickerContainer.classList.contains('hidden');
        
        if (isClosed) {
            stickerContainer.classList.remove('hidden');
            document.getElementById('emoji-picker-container')?.classList.add('hidden'); // Chiudi emoji
            
            // Se la griglia è vuota, carica i Trend
            if (stickerGrid.children.length === 0) {
                fetchGifs(); // Carica Trending
            }
            
            // Focus sul campo cerca per scrivere subito
            setTimeout(() => searchInput.focus(), 100);
        } else {
            stickerContainer.classList.add('hidden');
        }
    });

    // 4. Gestione Ricerca (mentre scrivi)
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        // Aspetta che l'utente smetta di scrivere per 500ms prima di cercare
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            fetchGifs(query);
        }, 500);
    });

    // Chiudi cliccando fuori
    document.addEventListener('click', (e) => {
        if (!stickerContainer.classList.contains('hidden')) {
            if (!stickerContainer.contains(e.target) && e.target !== stickerBtn) {
                stickerContainer.classList.add('hidden');
            }
        }
    });
});

// FINE DEL FILE