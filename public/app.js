//const RENDER_SERVER_URL = "http://localhost:3000";
const RENDER_SERVER_URL = "https://videocall-webrtc-signaling-server.onrender.com";

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
let myJoinedChannels = []; 
let channelCollapseStates = {};
let channelUsersRegistry = {};
const myChannelsListEl = document.getElementById('my-channels-list');
const roomChatsData = {}; 
const opModerateToggle = document.getElementById('op-moderate-toggle');


const opSettingsBtn = document.getElementById('op-settings-btn');
const opModal = document.getElementById('op-modal');
const closeOpModalBtn = document.getElementById('close-op-modal');
const opSaveBtn = document.getElementById('op-save-btn');
const roomTopicDisplay = document.getElementById('room-topic-display');
const opTopicInput = document.getElementById('op-topic-input');
const opPasswordInput = document.getElementById('op-password-input');
const opColorInput = document.getElementById('op-color-input');

const menuToggleCC = document.getElementById('menu-toggle-cc');
let recognition = null; 
let isTranscribingLocal = false; 
const activeTranscriptions = {}; 
const transcriptionHistory = {}; 
const globalTranscriptBtn = document.getElementById('global-transcript-btn');
const meetingTranscriptPanel = document.getElementById('meeting-transcript-panel');
const transcriptContent = document.getElementById('transcript-content');
const closeTranscriptBtn = document.getElementById('close-transcript-btn');

let isGlobalMeetingRecording = false; 
let meetingHistory = []; 

const toggleAudioButton = document.getElementById('toggle-audio-button');
const toggleVideoButton = document.getElementById('toggle-video-button');
const disconnectButton = document.getElementById('disconnect-button');
const localMicStatusIcon = document.getElementById('local-mic-status'); 
const shareScreenButton = document.getElementById('share-screen-button');
const shareRoomLinkButton = document.getElementById('share-room-link'); 
const recordButton = document.getElementById('record-button'); 

const typingIndicator = document.getElementById('typing-indicator');
const typingText = document.getElementById('typing-text');
const activeTypers = new Set(); 
let typingTimeout = null;     
let isTyping = false;         

const transferFileButton = document.getElementById('transfer-file-button');
const fileInput = document.getElementById('file-input');
const fileTransferContainer = document.getElementById('file-transfer-container');

const toggleWhiteboardButton = document.getElementById('toggle-whiteboard-button');
const whiteboardContainer = document.getElementById('whiteboard-container');
const canvas = document.getElementById('whiteboard-canvas');
const wbUndoBtn = document.getElementById('wb-undo-btn');
const wbClearBtn = document.getElementById('wb-clear-btn');
const wbCloseBtn = document.getElementById('wb-close-btn');
const wbColors = document.querySelectorAll('.color-btn');

const chatPanel = document.getElementById('chat-panel');
const messagesContainer = document.getElementById('messages-container');
const chatMessageInput = document.getElementById('chat-message-input');
const sendChatButton = document.getElementById('send-chat-button');
const showChatBtn = document.getElementById('show-chat-btn');
const channelSidebar = document.getElementById('channel-sidebar');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const refreshChannelsBtn = document.getElementById('refresh-channels-btn');
const chatResizer = document.getElementById('chat-resizer');
const currentChannelItem = document.getElementById('current-channel-item');

let isChatResizing = false;

const contextMenuEl = document.getElementById('remote-context-menu');
const moreOptionsBtn = document.getElementById('more-options-btn');
const extrasMenu = document.getElementById('extras-menu');
const menuDmUser = document.getElementById('menu-dm-user');
const menuMuteUser = document.getElementById('menu-mute-user');
const menuSendFile = document.getElementById('menu-send-file');

const settingsModal = document.getElementById('settings-modal');
const settingsBtnOverlay = document.getElementById('settings-btn-overlay');
const settingsBtnRoom = document.getElementById('settings-btn-room');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const themeToggle = document.getElementById('theme-toggle');

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
let wakeLock = null;
let keepAliveCtx = null;
let keepAliveOsc = null;

let localStream = null;
let userNickname = 'Guest';
let currentRoomId = null;
let currentRoomPassword = '';
const peerConnections = {};
const remoteNicknames = {};
let focusedPeerId = null; 
let screenStream = null; 
const videoSenders = {}; 
const roomVideoStates = {}; 
const audioSenders = {}; 
const roomAudioStates = {};

function getRoomIdByPeerId(peerId) {
    for (const [rId, users] of Object.entries(channelUsersRegistry)) {
        if (users.find(u => u.id === peerId)) return rId;
    }
    return null;
}

let isAudioEnabled = true;
let isVideoEnabled = true;
const iceCandidateQueues = {};
let unreadMessagesCount = 0;

let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false; 

let isDrawing = false;
let currentX = 0;
let currentY = 0;
let currentColor = '#ffffff';
let ctx = null;
let localWhiteboardHistory = []; 

const dataChannels = {}; 
const fileChunks = {}; 
const fileMetadata = {}; 
const CHUNK_SIZE = 16384; 
let targetFileRecipientId = null;

let isManualFocus = false; 
let currentSpeakerId = null; 
const AUTO_FOCUS_COOLDOWN = 3000; 
let autoFocusTimer = null; 
let audioContext = null;
let analyser = null;
let talkingInterval = null;
const AUDIO_THRESHOLD = -40; 
let isLocalTalking = false; 

const manuallyMutedPeers = {}; 
let contextTargetPeerId = null; 

const iceConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const APP_LANGUAGE = navigator.language.split('-')[0];

const TRANSLATIONS = {
    en: {
        ui: {
            "join-button": "Join Conference",
            "room-id-input": { placeholder: "Room Name" },
            "room-password-input": { placeholder: "Room Password (Optional)" },
            "nickname-input": { placeholder: "Your Nickname" },
            "chat-panel h3": "💬 Chat", 
            "chat-message-input": { placeholder: "Type a message..." },
            "send-chat-button": "Send",
            "settings-btn-overlay": { title: "Settings" },
            "settings-btn-room": { title: "Settings" },
            "show-chat-btn": { title: "Open Chat" },
            "share-room-link": { title: "Share Room Link" },
            "toggle-audio-button": { title: "Mute/Unmute Audio" },
            "toggle-video-button": { title: "Disable/Enable Video" },
            "switch-camera-button": { title: "Switch Camera" },
            "more-options-btn": { title: "More Options" },
            "disconnect-button": { title: "Disconnect" },
            "transfer-file-button span:last-child": "Send File",
            "record-button span:last-child": "Record",
            "toggle-whiteboard-button span:last-child": "Whiteboard",
            "share-screen-button span:last-child": "Share Screen",
            "global-transcript-btn span:last-child": "Meeting Minutes", 
            "menu-dm-user span:last-child": "Private Message",
            "menu-send-file span:last-child": "Send File",
            "menu-toggle-cc span:last-child": "Toggle Subtitles",
            "menu-mute-user span:last-child": "Mute Audio",
            "admin-header h3": "🛡️ Admin Dashboard",
            "admin-login-btn": "Login",
            "admin-refresh-btn": "Refresh Data",
            "admin-total-users": { prefix: "Users: " },
            "close-chat-btn": "← Back to video",
            "transcript-header h4": "📝 Live Minutes",
            "channels-header": "YOUR CHANNELS",
            "admin-no-rooms": "No active rooms.",
            
            // Settings Modal
            "settings-title": "Settings",
            "theme-label": "Dark / Light Theme",
            "bg-label": "Application Background",
            "server-label": "Server Management",
            "open-admin-login": "Admin Login",

            // Protected Channel (OP) Modal
            "op-title": "Protected Channel",
            "op-topic-label": "Room Topic",
            "op-topic-desc": "Visible to everyone at the top center.",
            "op-pass-label": "Access Password",
            "op-pass-desc": "Users will need this password to join.",
            "op-mod-label": "Moderated Chat (+m)",
            "op-mod-desc": "If active, only OP (@) and Voice (+) can type.",
            "op-color-label": "Brand Color (#Chan)",
            "op-color-hint": "CLICK TO CHANGE",
            "op-color-desc": "Changes the visual theme for all users.",
            "op-save-text": "Save Changes"
        },
        js: {
            "welcome": "Welcome to",
            "user_joined": "joined.",
            "user_left": "User left.",
            "link_copied": "Link copied to clipboard!",
            "missing_data": "Missing data",
            "banned": "You have been banned.",
            "room_closed": "Room closed.",
            "error_cam": "Check webcam/microphone",
            "screen_share_mobile": "Not supported on mobile.",
            "no_participants": "No participants.",
            "download_transcript": "Transcription finished. Download text?",
            "waiting_others": "Waiting for other participants...",
            "you": "You",
            "system": "System",
            "transcript_started": "Meeting recording started.",
            "transcript_stopped": "Meeting recording stopped.",
            "download_meeting": "Meeting finished. Download full minutes?",
            "previous_history": "Previous History",
            "pass_enabled": "Password enabled 🔒",
            "pass_removed": "Password removed 🔓",
            "mod_active": "Moderated Mode ACTIVE (+m) 🔇",
            "mod_disabled": "Moderated Mode DISABLED (-m) 🔊",
            "room_locked": "Room Locked",
            "room_unlocked": "Room Unlocked"
        }
    },
    it: {
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
            "transfer-file-button span:last-child": "Invia File",
            "record-button span:last-child": "Registra",
            "toggle-whiteboard-button span:last-child": "Lavagna",
            "share-screen-button span:last-child": "Condividi Schermo",
            "global-transcript-btn span:last-child": "Verbale Riunione",
            "menu-dm-user span:last-child": "Messaggio Privato",
            "menu-send-file span:last-child": "Invia File",
            "menu-toggle-cc span:last-child": "Attiva Sottotitoli",
            "menu-mute-user span:last-child": "Silenzia Audio",
            "admin-header h3": "🛡️ Dashboard Admin",
            "admin-login-btn": "Accedi",
            "admin-refresh-btn": "Aggiorna Dati",
            "admin-total-users": { prefix: "Utenti: " },
            "close-chat-btn": "← Torna alle webcam",
            "transcript-header h4": "📝 Verbale Live",
            "channels-header": "I TUOI CANALI",
            "admin-no-rooms": "Nessuna stanza attiva.",

            // Settings Modal
            "settings-title": "Impostazioni",
            "theme-label": "Tema Scuro / Chiaro",
            "bg-label": "Sfondo Applicazione",
            "server-label": "Gestione Server",
            "open-admin-login": "Login Admin",

            // Protected Channel (OP) Modal
            "op-title": "Canale Protetto",
            "op-topic-label": "Argomento Stanza",
            "op-topic-desc": "Visibile a tutti in alto al centro.",
            "op-pass-label": "Password Accesso",
            "op-pass-desc": "Gli utenti dovranno inserirla per entrare.",
            "op-mod-label": "Chat Moderata (+m)",
            "op-mod-desc": "Se attiva, solo OP (@) e Voice (+) possono scrivere.",
            "op-color-label": "Colore Brand (#Chan)",
            "op-color-hint": "CLICCA PER CAMBIARE",
            "op-color-desc": "Cambia il tema visivo per tutti gli utenti.",
            "op-save-text": "Salva Modifiche"
        },
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
            "transcript_started": "Registrazione riunione avviata.",
            "transcript_stopped": "Registrazione riunione fermata.",
            "download_meeting": "Meeting terminato. Scaricare il verbale completo?",
            "previous_history": "Cronologia Precedente",
            "pass_enabled": "Password attivata 🔒",
            "pass_removed": "Password rimossa 🔓",
            "mod_active": "Modalità Moderata ATTIVA (+m) 🔇",
            "mod_disabled": "Modalità Moderata DISATTIVA (-m) 🔊",
            "room_locked": "Stanza Bloccata",
            "room_unlocked": "Stanza Sbloccata"
        }
    },
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
            "global-transcript-btn span:last-child": "Acta de Reunión",
            "menu-dm-user span:last-child": "Mensaje Privado",
            "menu-send-file span:last-child": "Enviar Archivo",
            "menu-toggle-cc span:last-child": "Activar Subtítulos",
            "menu-mute-user span:last-child": "Silenciar Audio",
            "transcript-header h4": "📝 Acta en Vivo",
            "channels-header": "TUS CANALES",
            "admin-no-rooms": "No hay salas activas.",

            // Settings Modal
            "settings-title": "Configuración",
            "theme-label": "Tema Oscuro / Claro",
            "bg-label": "Fondo de Aplicación",
            "server-label": "Gestión del Servidor",
            "open-admin-login": "Acceso Admin",

            // Protected Channel (OP) Modal
            "op-title": "Canal Protegido",
            "op-topic-label": "Tema de la Sala",
            "op-topic-desc": "Visible para todos arriba al centro.",
            "op-pass-label": "Contraseña de Acceso",
            "op-pass-desc": "Los usuarios la necesitarán para entrar.",
            "op-mod-label": "Chat Moderado (+m)",
            "op-mod-desc": "Si está activo, solo OP (@) y Voz (+) pueden escribir.",
            "op-color-label": "Color de Marca (#Chan)",
            "op-color-hint": "CLIC PARA CAMBIAR",
            "op-color-desc": "Cambia el tema visual para todos.",
            "op-save-text": "Guardar Cambios"
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
            "transcript_started": "Grabación de reunión iniciada.",
            "transcript_stopped": "Grabación de reunión detenida.",
            "download_meeting": "Reunión finalizada. ¿Descargar el acta completa?",
            "previous_history": "Historial Anterior",
            "pass_enabled": "Contraseña activada 🔒",
            "pass_removed": "Contraseña eliminada 🔓",
            "mod_active": "Modo Moderado ACTIVADO (+m) 🔇",
            "mod_disabled": "Modo Moderado DESACTIVADO (-m) 🔊",
            "room_locked": "Sala Bloqueada",
            "room_unlocked": "Sala Desbloqueada"
        }
    },
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
            "global-transcript-btn span:last-child": "Compte Rendu",
            "menu-toggle-cc span:last-child": "Activer Sous-titres",
            "transcript-header h4": "📝 Notes en Direct",
            "channels-header": "VOS CANAUX",
            "admin-no-rooms": "Aucune salle active.",

            // Settings Modal
            "settings-title": "Paramètres",
            "theme-label": "Thème Sombre / Clair",
            "bg-label": "Arrière-plan",
            "server-label": "Gestion Serveur",
            "open-admin-login": "Connexion Admin",

            // Protected Channel (OP) Modal
            "op-title": "Canal Protégé",
            "op-topic-label": "Sujet de la salle",
            "op-topic-desc": "Visible par tous en haut au centre.",
            "op-pass-label": "Mot de passe d'accès",
            "op-pass-desc": "Requis pour rejoindre la salle.",
            "op-mod-label": "Chat Modéré (+m)",
            "op-mod-desc": "Si actif, seuls les OP (@) et Voix (+) écrivent.",
            "op-color-label": "Couleur de Marque (#Chan)",
            "op-color-hint": "CLIQUER POUR CHANGER",
            "op-color-desc": "Change le thème visuel pour tous.",
            "op-save-text": "Enregistrer"
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
            "transcript_started": "Enregistrement de la réunion démarré.",
            "transcript_stopped": "Enregistrement de la réunion arrêté.",
            "download_meeting": "Réunion terminée. Télécharger le compte rendu ?",
            "previous_history": "Historique Précédent",
            "pass_enabled": "Mot de passe activé 🔒",
            "pass_removed": "Mot de passe supprimé 🔓",
            "mod_active": "Mode Modéré ACTIVÉ (+m) 🔇",
            "mod_disabled": "Mode Modéré DÉSACTIVÉ (-m) 🔊",
            "room_locked": "Salle Verrouillée",
            "room_unlocked": "Salle Déverrouillée"
        }
    },
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
            "transfer-file-button span:last-child": "发送文件",
            "record-button span:last-child": "录制",
            "toggle-whiteboard-button span:last-child": "白板",
            "share-screen-button span:last-child": "共享屏幕",
            "global-transcript-btn span:last-child": "会议纪要", 
            "menu-dm-user span:last-child": "私信",
            "menu-send-file span:last-child": "发送文件",
            "menu-toggle-cc span:last-child": "开启字幕",
            "menu-mute-user span:last-child": "静音用户",
            "admin-header h3": "🛡️ 管理员面板",
            "admin-login-btn": "登录",
            "admin-refresh-btn": "刷新数据",
            "close-chat-btn": "← 返回视频",
            "transcript-header h4": "📝 实时纪要",
            "channels-header": "您的频道",
            "admin-no-rooms": "无活跃房间。",

            // Settings Modal
            "settings-title": "设置",
            "theme-label": "深色 / 浅色 主题",
            "bg-label": "应用背景",
            "server-label": "服务器管理",
            "open-admin-login": "管理员登录",

            // Protected Channel (OP) Modal
            "op-title": "受保护频道",
            "op-topic-label": "房间主题",
            "op-topic-desc": "顶部居中显示，所有人可见。",
            "op-pass-label": "访问密码",
            "op-pass-desc": "用户需要输入此密码才能加入。",
            "op-mod-label": "聊天管理 (+m)",
            "op-mod-desc": "开启后，仅 OP (@) 和 Voice (+) 可发言。",
            "op-color-label": "品牌颜色 (#Chan)",
            "op-color-hint": "点击修改",
            "op-color-desc": "更改所有用户的视觉主题。",
            "op-save-text": "保存更改"
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
            "transcript_started": "会议录制已开始。",
            "transcript_stopped": "会议录制已停止。",
            "download_meeting": "会议结束。是否下载完整纪要？",
            "previous_history": "之前的历史记录",
            "pass_enabled": "密码已启用 🔒",
            "pass_removed": "密码已移除 🔓",
            "mod_active": "管理模式已开启 (+m) 🔇",
            "mod_disabled": "管理模式已关闭 (-m) 🔊",
            "room_locked": "房间已锁定",
            "room_unlocked": "房间已解锁"
        }
    }
};

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

const availableBackgrounds = [
    { id: 'default', name: 'Empty', value: '' }, 
    { id: 'grad1', name: 'Sunset', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { id: 'img4', name: 'Abstract', value: 'url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'grad2', name: 'Night', value: 'linear-gradient(to top, #09203f 0%, #537895 100%)' },
    { id: 'moon', name: 'Moon', value: 'url("https://images.unsplash.com/photo-1517866184231-7ef94c2ea930?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'earth', name: 'Earth', value: 'url("https://images.unsplash.com/photo-1656077217715-bdaeb06bd01f?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'nebula1', name: 'Nebula 1', value: 'url("https://images.unsplash.com/photo-1716881139357-ddcb2f52940c?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'nebula2', name: 'Nebula 2', value: 'url("https://images.unsplash.com/photo-1591972729866-028644a72183?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'onepiece1', name: 'Luffy', value: 'url("https://images4.alphacoders.com/136/thumb-1920-1368242.png?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'onepiece2', name: 'Garp', value: 'url("https://images2.alphacoders.com/134/thumb-1920-1348840.jpeg?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'img1', name: 'Mountain', value: 'url("https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'clrmountain', name: 'Color Mount', value: 'url("https://images.unsplash.com/photo-1503027075-f790a0a2dcb6?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'baloon', name: 'Balloons', value: 'url("https://images.unsplash.com/photo-1464692805480-a69dfaafdb0d?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'img2', name: 'JellyFish', value: 'url("https://images.unsplash.com/photo-1441555136638-e47c0158bfc9?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'img5', name: 'Fish', value: 'url("https://images.unsplash.com/photo-1551103807-35843c283f14?auto=format&fit=crop&w=1920&q=80")' },
    { id: 'img3', name: 'Turtle', value: 'url("https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?auto=format&fit=crop&w=1920&q=80")' }
];

const bgOptionsContainer = document.getElementById('background-options');

function initBackgroundSettings() {
    const savedBg = localStorage.getItem('appBackground') || 'grad1';
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

function stopSpeechRecognition() {
    if (recognition) {
        try {
            recognition.onend = null; 
            recognition.onerror = null;
            recognition.stop();
        } catch (e) {
            console.warn("Forced stop error:", e);
        }
        recognition = null;
    }
}

let isRecognitionRestarting = false; 

function initSpeechRecognition() {
    if (recognition) return; 

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Browser not supported. Use Chrome or Edge.");
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

        if (finalTranscript && socket && currentRoomId) {

            if (isGlobalMeetingRecording) {
                if (isLocalTalking) { 
                    const data = {
                        nickname: userNickname,
                        text: finalTranscript,
                        timestamp: new Date().toLocaleTimeString()
                    };
                    socket.emit('global-transcript-chunk', currentRoomId, data);
                }
            }

            if (isTranscribingLocal) {
                Object.keys(peerConnections).forEach(peerId => {
                    socket.emit('transcription-result', peerId, finalTranscript, true);
                });
            }
        }
    };

    recognition.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return; 
        console.warn("[Speech] Error:", event.error);
    };

    recognition.onend = () => {
        if ((isTranscribingLocal || isGlobalMeetingRecording) && !isRecognitionRestarting) {
            isRecognitionRestarting = true;
            
            setTimeout(() => {
                stopSpeechRecognition(); 
                initSpeechRecognition(); 
                try {
                    if (recognition) recognition.start();
                } catch(e) { console.warn("Restart failed:", e); }
            }, 500);
        } else {
            stopSpeechRecognition(); 
        }
    };
}

function normalizeRoomId(roomId) {
    return String(roomId || '').trim().replace(/^#/, '').toLowerCase();
}

function t(key) {
    if (TRANSLATIONS[APP_LANGUAGE] && TRANSLATIONS[APP_LANGUAGE].js[key]) {
        return TRANSLATIONS[APP_LANGUAGE].js[key];
    }
    if (TRANSLATIONS['en'] && TRANSLATIONS['en'].js[key]) {
        return TRANSLATIONS['en'].js[key];
    }
    return key; 
}

function initLocalization() {
    let dict = TRANSLATIONS[APP_LANGUAGE];

    if (!dict) {
        dict = TRANSLATIONS['en'];
    }

    if (!dict || !dict.ui) return;

    for (const [selector, value] of Object.entries(dict.ui)) {
        let el = document.getElementById(selector);
        if (!el) el = document.querySelector(selector);

        if (el) {
            if (typeof value === 'string') {
                el.innerText = value;
            } else {
                if (value.placeholder) el.placeholder = value.placeholder;
                if (value.title) el.title = value.title;
            }
        }
    }
}

function downloadTranscription(peerId, text) {
    const nickname = remoteNicknames[peerId] || "User";
    const blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });   
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Transcription_${nickname}_${new Date().toLocaleTimeString()}.txt`;
    document.body.appendChild(a);
    a.click();  
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function updateTypingUI() {
    if (activeTypers.size > 0) {
        typingIndicator.classList.remove('hidden');
        
        const names = Array.from(activeTypers);
        if (names.length === 1) {
            typingText.textContent = `${names[0]} is typing...`;
        } else if (names.length === 2) {
            typingText.textContent = `${names[0]} and ${names[1]} are typing...`;
        } else {
            typingText.textContent = `Several people are typing...`;
        }
    } else {
        typingIndicator.classList.add('hidden');
    }
}

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
  const logo = document.getElementById('app-logo');

  if(show){
    nicknameOverlay.classList.remove('hidden');
    settingsBtnOverlay.classList.remove('hidden'); 
    document.getElementById('conference-container').classList.add('hidden');
    if(logo) logo.style.display = 'block';
  } else {
    nicknameOverlay.classList.add('hidden');
    settingsBtnOverlay.classList.add('hidden'); 
    document.getElementById('conference-container').classList.remove('hidden');
    if(logo) logo.style.display = 'none'; 
  }
}

function resetAndShowOverlay() {
	localWhiteboardHistory = [];
    videosGrid.innerHTML = '';
    
    messagesContainer.innerHTML = ''; 
    document.getElementById('room-name-display').textContent = '';

    showOverlay(true);
    userNickname = 'Guest';
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
    
    for (const key in roomVideoStates) delete roomVideoStates[key];
    for (const key in roomAudioStates) delete roomAudioStates[key];

    Object.values(peerConnections).forEach(pc => pc.close());
    for (const key in peerConnections) delete peerConnections[key];
    for (const key in remoteNicknames) delete remoteNicknames[key];
    for (const key in iceCandidateQueues) delete iceCandidateQueues[key];
    for (const key in videoSenders) delete videoSenders[key];
    for (const key in audioSenders) delete audioSenders[key];
    for (const key in manuallyMutedPeers) delete manuallyMutedPeers[key];
    
    isManualFocus = false;
    currentSpeakerId = null;
    if (autoFocusTimer) clearTimeout(autoFocusTimer);
    autoFocusTimer = null;
    monitorLocalAudio(false); 
    
    videosGrid.appendChild(localFeedEl);
    
    localFeedEl.classList.add('hidden');
    localFeedEl.classList.remove('is-focused', 'is-talking');
    
    nicknameInput.value = '';
    roomIdInput.value = '';
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
    if (!start || !localStream || !isAudioEnabled) {
        if (talkingInterval) { 
            clearInterval(talkingInterval); 
            talkingInterval = null; 
        }
        
        if (audioContext && audioContext.state !== 'closed') {
            try {
                audioContext.close();
            } catch(e) { console.warn("Error closing AudioContext", e); }
        }
        audioContext = null; 

        if (isLocalTalking && socket) {
            isLocalTalking = false;
            localFeedEl.classList.remove('is-talking');
            socket.emit('audio-status-changed', currentRoomId, isLocalTalking);
        }
        return;
    }

    if (start && !talkingInterval) {
        try {
            if (!audioContext || audioContext.state === 'closed') {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }

            analyser = audioContext.createAnalyser();
            analyser.fftSize = 512; 
            analyser.minDecibels = -90;
            analyser.maxDecibels = 0;
            analyser.smoothingTimeConstant = 0.8; 

            const source = audioContext.createMediaStreamSource(localStream);
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            talkingInterval = setInterval(() => {
                if(!audioContext || audioContext.state === 'closed') {
                    monitorLocalAudio(false);
                    return;
                }

                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for(let i = 0; i < bufferLength; i++) sum += dataArray[i];
                const average = sum / bufferLength;
                
                const db = average > 0 ? 20 * Math.log10(average / 128) + 10 : -100;
                
                const currentlyTalking = db > AUDIO_THRESHOLD && isAudioEnabled;

                if (currentlyTalking !== isLocalTalking) {
                    isLocalTalking = currentlyTalking;
                    localFeedEl.classList.toggle('is-talking', isLocalTalking);
                    if (socket) socket.emit('audio-status-changed', currentRoomId, isLocalTalking);
                }
            }, 100); 
        } catch (e) {
            console.error("Error starting audio monitor:", e);
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
    menuMuteUser.querySelector('span:last-child').textContent = isMuted ? 'Unmute Audio' : 'Mute Audio';
    const nickname = remoteNicknames[peerId] || 'User';
    menuDmUser.querySelector('span:last-child').textContent = `Private Message to ${nickname}`;
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
  delete videoSenders[socketId]; delete audioSenders[socketId]; delete manuallyMutedPeers[socketId]; 
  
  if (currentSpeakerId === socketId) currentSpeakerId = null;
  if (autoFocusTimer) { clearTimeout(autoFocusTimer); autoFocusTimer = null; }

  if(focusedPeerId === socketId) {
      setFocus(null); 
  }

  const remoteVideos = videosGrid.querySelectorAll('.video-feed:not(#local-feed)');
}

async function enableMediaIfNeeded() {
    if (!localStream) {
        try {
            const constraints = {
                audio: true,
                video: isVideoEnabled ? true : false
            };

            localStream = await navigator.mediaDevices.getUserMedia(constraints);

            localStream.getAudioTracks().forEach(t => t.enabled = isAudioEnabled);

            updateLocalVideo();

            for(const peerId in peerConnections) {
                const pc = peerConnections[peerId];
                localStream.getTracks().forEach(track => {
                    const sender = pc.addTrack(track, localStream);
                    if(track.kind === 'video') videoSenders[peerId] = sender;
                    if(track.kind === 'audio') audioSenders[peerId] = sender;
                });
                
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('offer', peerId, pc.localDescription);
            }
            monitorLocalAudio(isAudioEnabled);
        } catch(err) {
            console.error(err);
            alert("Cannot access webcam/mic. Check permissions.");
            return false;
        }
    }
    return true;
}

async function toggleAudio() {
    if (!currentRoomId) return;

    if (!localStream) {
        isAudioEnabled = true; 
        const success = await enableMediaIfNeeded();
        if (!success) return;
        roomAudioStates[currentRoomId] = true;
    } else {
        if (typeof roomAudioStates[currentRoomId] === 'undefined') {
            roomAudioStates[currentRoomId] = true; 
        } else {
            roomAudioStates[currentRoomId] = !roomAudioStates[currentRoomId];
        }
    }

    const isEnabledForThisRoom = roomAudioStates[currentRoomId];
    isAudioEnabled = isEnabledForThisRoom; 

    toggleAudioButton.querySelector('.material-icons').textContent = isEnabledForThisRoom ? 'mic' : 'mic_off';
    if(localMicStatusIcon) localMicStatusIcon.textContent = isEnabledForThisRoom ? 'mic' : 'mic_off';
    monitorLocalAudio(isEnabledForThisRoom);

    const audioTrack = localStream.getAudioTracks()[0];
    const usersInRoom = channelUsersRegistry[currentRoomId] || [];

    usersInRoom.forEach(user => {
        const peerId = user.id;
        if (peerId === socket.id) return;

        const sender = audioSenders[peerId];
        if (sender) {
            if (isEnabledForThisRoom) {
                if (audioTrack && !audioTrack.enabled) audioTrack.enabled = true;
                sender.replaceTrack(audioTrack).catch(e => console.error("Audio replace err:", e));
            } else {
                sender.replaceTrack(null).catch(e => console.error("Audio clear err:", e));
            }
        }
    });
    
    if (socket) socket.emit('audio-status-changed', currentRoomId, isEnabledForThisRoom);
    const isAudioNeededAnywhere = Object.values(roomAudioStates).some(state => state === true);
    if (audioTrack) {
        audioTrack.enabled = isAudioNeededAnywhere;
    }
}

async function toggleVideo() {
    if (!currentRoomId) return;

    if (typeof roomVideoStates[currentRoomId] === 'undefined') {
        roomVideoStates[currentRoomId] = true; 
    } else {
        roomVideoStates[currentRoomId] = !roomVideoStates[currentRoomId];
    }

    const isEnabledForThisRoom = roomVideoStates[currentRoomId];
    isVideoEnabled = isEnabledForThisRoom; 

    toggleVideoButton.querySelector('.material-icons').textContent = isEnabledForThisRoom ? 'videocam' : 'videocam_off';

    const localOverlay = document.getElementById('local-no-cam');
    if (localOverlay) {
        if (isEnabledForThisRoom) localOverlay.classList.add('hidden');
        else localOverlay.classList.remove('hidden');
    }

    if (isEnabledForThisRoom) {
        if (!localStream) {
            await enableMediaIfNeeded();
        } else {
            try {

                const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
                const newVideoTrack = newStream.getVideoTracks()[0];

                localStream.getVideoTracks().forEach(t => {
                    t.stop();
                    localStream.removeTrack(t);
                });

                localStream.addTrack(newVideoTrack);
                updateLocalVideo();

                const usersInRoom = channelUsersRegistry[currentRoomId] || [];
                
                for (const user of usersInRoom) {
                    const peerId = user.id;
                    if (peerId === socket.id) continue;

                    const sender = videoSenders[peerId];
                    const pc = peerConnections[peerId];

                    if (sender) {

                        sender.replaceTrack(newVideoTrack).catch(e => console.error("Error replacing track:", e));
                    } else if (pc) {

                        const newSender = pc.addTrack(newVideoTrack, localStream);
                        videoSenders[peerId] = newSender;

                        try {
                            const offer = await pc.createOffer();
                            await pc.setLocalDescription(offer);
                            socket.emit('offer', peerId, pc.localDescription);
                        } catch (err) {
                            console.error("Renegotiation error:", err);
                        }
                    }
                }
            } catch (e) {
                console.error("Errore riattivazione video:", e);

                roomVideoStates[currentRoomId] = false;
                isVideoEnabled = false;
                toggleVideoButton.querySelector('.material-icons').textContent = 'videocam_off';
                if(localOverlay) localOverlay.classList.remove('hidden');
                return;
            }
        }
    } else {

        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                track.stop(); 

            });

            const usersInRoom = channelUsersRegistry[currentRoomId] || [];
            usersInRoom.forEach(user => {
                const peerId = user.id;
                if (peerId === socket.id) return;
                const sender = videoSenders[peerId];
                if (sender) {
                    sender.replaceTrack(null).catch(e => console.error("Error clearing track:", e));
                }
            });
        }
    }

    if (socket && currentRoomId) {
        socket.emit('video-status-changed', currentRoomId, isEnabledForThisRoom);
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
        } catch (err) { console.error('Screen share error:', err); }
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
        let newWidth = window.innerWidth - e.clientX;
        
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

function sendMessage(contentOverride = null) {
    const fullMessage = (typeof contentOverride === 'string') ? contentOverride : chatMessageInput.value.trim();
    if (!fullMessage) return;

    if (fullMessage.startsWith('/')) {
        const args = fullMessage.split(' ');
        const cmd = args[0].toLowerCase();
        const arg1 = args[1];
        const contentArgs = args.slice(2).join(' ');

        switch(cmd) {
            case '/help':
                const helpText = `
                <b>Available Commands:</b><br>
                /join #channel - Join/Create channel<br>
                /part - Leave current channel<br>
                /chanlist - Global channel list<br>
                /op name - Make operator<br>
				/deop name - Remove operator<br>
                /voice name - Give voice (+)<br>
				/devoice name - Remove voice<br>
                /slap name - Slap user<br>
                /dm name msg - Private message
                `;
                addChatMessage('System', helpText, false, 'system');
                break;
                
            case '/join':
                if(arg1) {
                    const roomName = arg1.replace('#', '').toLowerCase();
                    const password = args[2] || ""; 
                    handleJoinCommand(roomName, password);
                } else {
                    addChatMessage('System', 'Usage: /join #roomname [password]', false, 'system');
                }
                break;

            case '/part':
                if (arg1) {
                    const roomToLeave = arg1.replace('#', '').toLowerCase();
                    if (myJoinedChannels.includes(roomToLeave)) {
                        removeChannelFromSidebar(roomToLeave);
                        addChatMessage('System', `You left #${roomToLeave}.`, false, 'system');
                    } else {
                        addChatMessage('System', `You are not in #${roomToLeave}.`, false, 'system');
                    }
                } else {
                    if (currentRoomId) {
                        const roomName = currentRoomId; 
                        removeChannelFromSidebar(roomName);
                    } else {
                        disconnect();
                    }
                }
                break;
				
            case '/chanlist':
                socket.emit('request-room-list');
                if(serverListModal) serverListModal.classList.remove('hidden');
                addChatMessage('System', 'Opening channel list...', false, 'system');
                break;

            case '/op':
                if (!userNickname.startsWith('@')) { addChatMessage('System', '⛔ Operators only.', true, 'system'); return; }
                if(arg1) socket.emit('command-op', currentRoomId, arg1);
                else addChatMessage('System', 'Usage: /op username', false, 'system');
                break;
				
            case '/deop':
                if (!userNickname.startsWith('@')) { addChatMessage('System', '⛔ Operators only.', true, 'system'); return; }
                if(arg1) socket.emit('command-deop', currentRoomId, arg1);
                else addChatMessage('System', 'Usage: /deop username', false, 'system');
                break;

            case '/voice':
                 if (!userNickname.startsWith('@')) { addChatMessage('System', '⛔ Operators only.', true, 'system'); return; }
                 if(arg1) socket.emit('command-voice', currentRoomId, arg1);
                 else addChatMessage('System', 'Usage: /voice username', false, 'system');
                 break;
				 
			case '/devoice':
                 if (!userNickname.startsWith('@')) { addChatMessage('System', '⛔ Operators only.', true, 'system'); return; }
                 if(arg1) socket.emit('command-devoice', currentRoomId, arg1);
                 else addChatMessage('System', 'Usage: /devoice username', false, 'system');
                 break;
				 
			case '/moderate':
                if (!userNickname.startsWith('@')) { addChatMessage('System', '⛔ Operators only.', true, 'system'); return; }
                if(arg1 === 'on' || arg1 === 'off') {
                    socket.emit('command-moderate', currentRoomId, arg1);
                } else {
                    addChatMessage('System', 'Usage: /moderate on | /moderate off', false, 'system');
                }
                break;

            case '/slap':
                if(arg1) socket.emit('command-action', currentRoomId, 'slap', arg1);
                else addChatMessage('System', 'Usage: /slap username', false, 'system');
                break;

            case '/dm':
                if(arg1 && contentArgs) {
                   const recipientNickname = arg1;
                   if (recipientNickname.toLowerCase() === userNickname.toLowerCase()) {
                        addChatMessage('System', 'Cannot DM yourself.', true, 'system');
                   } else {
                        const recipientId = Object.keys(remoteNicknames).find(key => 
                            remoteNicknames[key] && remoteNicknames[key].toLowerCase() === recipientNickname.toLowerCase()
                        );
                        if (recipientId) {
                            sendPrivateMessage(recipientId, recipientNickname, contentArgs);
                        } else {
                            addChatMessage('System', `User "${recipientNickname}" not found.`, true, 'system');
                        }
                   }
                } else {
                    addChatMessage('System', 'Usage: /dm name message', false, 'system');
                }
                break;
                
            default:
                addChatMessage('System', `Unknown command: ${cmd}`, false, 'system');
        }
        
        if (!contentOverride) clearChatInput();
        return; 
    }

    if (socket && currentRoomId) {
        const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        socket.emit('send-message', currentRoomId, userNickname, fullMessage, messageId);
        addChatMessage(userNickname, fullMessage, true, 'public', messageId);
        if (!contentOverride) clearChatInput();
    }
}

function handleJoinCommand(roomName, password = "") {
    roomName = normalizeRoomId(roomName);
    if (roomName === normalizeRoomId(currentRoomId)) {
        addChatMessage('System', `You are already in #${roomName}.`, false, 'system');
        return;
    }

    if (!myJoinedChannels.includes(roomName)) {
        myJoinedChannels.push(roomName);
    }
    
    switchChannel(roomName, password); 
}

async function switchChannel(newRoomId, newPassword = "") {
    newRoomId = normalizeRoomId(newRoomId);
    if (currentRoomId === newRoomId) return;

    if (currentRoomId && socket && socket.connected) {
        socket.emit('leave-room', currentRoomId);
    }

    // Pulizia connessioni precedenti
    Object.values(peerConnections).forEach(pc => pc.close());
    for (const key in peerConnections) delete peerConnections[key];
    for (const key in videoSenders) delete videoSenders[key];
    for (const key in audioSenders) delete audioSenders[key];
    for (const key in remoteNicknames) delete remoteNicknames[key];
    for (const key in iceCandidateQueues) delete iceCandidateQueues[key];
    for (const key in dataChannels) {
        if(dataChannels[key]) dataChannels[key].close();
        delete dataChannels[key];
    }

    focusedPeerId = null;
    currentSpeakerId = null;
    if (autoFocusTimer) { clearTimeout(autoFocusTimer); autoFocusTimer = null; }

    videosGrid.innerHTML = ''; 

    const placeholder = document.createElement('div');
    placeholder.id = 'remote-video-placeholder';
    placeholder.className = 'video-placeholder';
    placeholder.textContent = 'Switching room...';
    videosGrid.appendChild(placeholder);

    if (localFeedEl) {
        videosGrid.appendChild(localFeedEl);
        localFeedEl.classList.remove('hidden');
        localFeedEl.classList.remove('is-talking', 'is-focused', 'fullscreen-active', 'pip-mode');
    }

    saveCurrentChatToMemory(); 
    messagesContainer.innerHTML = ''; 

    currentRoomId = newRoomId; 
    currentRoomPassword = newPassword;

    // --- LOGICA MODIFICATA: SEPARAZIONE STATI E DEFAULT OFF ---

    // 1. VIDEO: Default OFF se è una stanza nuova
    if (typeof roomVideoStates[currentRoomId] === 'undefined') {
        roomVideoStates[currentRoomId] = false; 
    }
    const isCamOnInNewRoom = roomVideoStates[currentRoomId];
    isVideoEnabled = isCamOnInNewRoom; 

    // Riconciliazione Hardware Video
    if (isCamOnInNewRoom) {
        // Se la stanza prevede video ACCESO, controlliamo se abbiamo le tracce
        const hasVideo = localStream && localStream.getVideoTracks().length > 0 && localStream.getVideoTracks()[0].readyState === 'live';
        if (!hasVideo) {
            try {
                // Ripristiniamo la cam se era accesa in questa stanza ma spenta nell'hardware
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                const newTrack = stream.getVideoTracks()[0];
                if (!localStream) localStream = stream;
                else localStream.addTrack(newTrack);
            } catch(e) {
                console.error("Errore ripristino video:", e);
                roomVideoStates[currentRoomId] = false;
                isVideoEnabled = false;
            }
        } else {
            localStream.getVideoTracks().forEach(t => t.enabled = true);
        }
    } else {
        // Se la stanza prevede video SPENTO, spegniamo le tracce (spegne la luce webcam)
        if (localStream) {
            localStream.getVideoTracks().forEach(t => {
                t.stop(); // Importante: ferma l'hardware
                localStream.removeTrack(t);
            });
        }
    }

    // 2. AUDIO: Default OFF se è una stanza nuova
    if (typeof roomAudioStates[currentRoomId] === 'undefined') {
        roomAudioStates[currentRoomId] = false;
    }
    const isAudioOnInNewRoom = roomAudioStates[currentRoomId];
    isAudioEnabled = isAudioOnInNewRoom;
    
    // Riconciliazione Hardware Audio
    if (isAudioOnInNewRoom) {
         const hasAudio = localStream && localStream.getAudioTracks().length > 0;
         if (!hasAudio) {
              try {
                  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                  const newTrack = stream.getAudioTracks()[0];
                  if (!localStream) localStream = stream; 
                  else localStream.addTrack(newTrack);
              } catch(e) {
                  roomAudioStates[currentRoomId] = false;
                  isAudioEnabled = false;
              }
         } else {
             localStream.getAudioTracks().forEach(t => t.enabled = true);
         }
    } else {
        // Audio spento (Mute)
        if (localStream) {
            localStream.getAudioTracks().forEach(t => t.enabled = false);
        }
    }

    // Aggiornamento Icone UI
    if (toggleVideoButton) {
        toggleVideoButton.querySelector('.material-icons').textContent = isVideoEnabled ? 'videocam' : 'videocam_off';
    }
    const localOverlay = document.getElementById('local-no-cam');
    if (localOverlay) {
        if (isVideoEnabled) localOverlay.classList.add('hidden');
        else localOverlay.classList.remove('hidden');
    }
    
    toggleAudioButton.querySelector('.material-icons').textContent = isAudioEnabled ? 'mic' : 'mic_off';
    if(localMicStatusIcon) localMicStatusIcon.textContent = isAudioEnabled ? 'mic' : 'mic_off';
    
    // ----------------------------------------------------------

    updateLocalVideo(); // Aggiorna l'elemento video HTML
    monitorLocalAudio(isAudioEnabled);

    document.getElementById('room-name-display').textContent = `#${newRoomId}`;
    // Reset chat UI before restoring cached messages (prevents duplicates)
    if (messagesContainer) messagesContainer.innerHTML = '';
    loadChatFromMemory(newRoomId);
renderSidebarChannels(); 

    const url = new URL(window.location);
    url.searchParams.set('room', newRoomId);
    window.history.pushState({}, '', url);

    if(socket && socket.connected) {
        setTimeout(() => {
            socket.emit('join-room', currentRoomId, userNickname, currentRoomPassword);
        }, 100);
    }
}

function renderSidebarChannels() {
    if(!myChannelsListEl) return;
    myChannelsListEl.innerHTML = '';

    const safeCurrentRoomId = currentRoomId ? currentRoomId.toLowerCase() : null;

    myJoinedChannels.forEach(room => {
        const roomName = room.toLowerCase();
        const isActive = (roomName === safeCurrentRoomId);
        
        // Recupera lo stato (se true, è chiuso/collassato)
        const isCollapsed = channelCollapseStates[roomName] || false;
        
        const container = document.createElement('div');
        container.className = `channel-item ${isActive ? 'active' : ''} ${isCollapsed ? 'collapsed' : ''}`;

        const headerRow = document.createElement('div');
        headerRow.className = 'channel-header-row';
        
        // 1. Icona Toggle (Freccetta)
        const toggleIcon = document.createElement('span');
        toggleIcon.className = 'material-icons channel-toggle-icon';
        toggleIcon.textContent = 'expand_more'; 
        
        // Opacità ridotta se non è attivo
        if (!isActive) {
            toggleIcon.style.opacity = '0.3'; 
        }
        headerRow.appendChild(toggleIcon);

        // 2. Nome del Canale (ORA CON LA CLASSE 'channel-name')
        const nameSpan = document.createElement('span');
        nameSpan.className = 'channel-name'; // <--- QUESTA RIGA È FONDAMENTALE
        nameSpan.textContent = `#${room}`; 
        headerRow.appendChild(nameSpan);

        // 3. Pulsante Chiudi Canale (X)
        const closeBtn = document.createElement('button');
        closeBtn.className = 'remove-chan-btn';
        closeBtn.innerHTML = '<span class="material-icons">close</span>';
        closeBtn.onclick = (e) => {
            e.stopPropagation(); 
            if(confirm(`Leave channel #${room}?`)) removeChannelFromSidebar(room);
        };
        headerRow.appendChild(closeBtn);

        // Gestione Click sull'intestazione
        headerRow.onclick = () => {
            if (isActive) {
                channelCollapseStates[roomName] = !channelCollapseStates[roomName];
                renderSidebarChannels(); 
            } else {
                channelCollapseStates[roomName] = false; 
                switchChannel(room, ""); 
            }
        };

        container.appendChild(headerRow);

        if (isActive && !isCollapsed) {
            const userListDiv = document.createElement('div');
            userListDiv.className = 'channel-user-list';

            let usersInRoom = channelUsersRegistry[room] || channelUsersRegistry[roomName] || [];
            const mySocketId = socket ? socket.id : 'temp-local-id';
            const amIHere = usersInRoom.find(u => u.id === mySocketId);
            let displayUsers = [...usersInRoom];

            if (userNickname && !amIHere) {
                displayUsers.push({ id: mySocketId, nickname: userNickname });
            }

            displayUsers.sort((a, b) => a.nickname.localeCompare(b.nickname));

            displayUsers.forEach(user => {
                const userEntry = document.createElement('div');
                userEntry.className = 'channel-user-item';
                
                const displayName = user.nickname;
                let dotClass = 'regular';
                const isMe = (user.id === mySocketId);

                if (isMe) userEntry.classList.add('is-me');
                
                if (displayName.startsWith('@')) {
                    userEntry.classList.add('is-op');
                    dotClass = 'is-op';
                } else if (displayName.startsWith('+')) {
                    userEntry.classList.add('is-voice');
                    dotClass = 'is-voice';
                }

                userEntry.innerHTML = `<span class="user-status-dot ${dotClass}"></span> ${displayName}`;
                
                if (!isMe) { 
                    userEntry.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        chatTargetUser = displayName.replace(/^[@+]/, '');
                        const chatContextMenu = document.getElementById('chat-context-menu');
                        if(chatContextMenu){
                             const iAmOp = userNickname.startsWith('@');
                             const opElements = ['chat-menu-op', 'chat-menu-deop', 'chat-menu-voice', 'chat-menu-devoice'];
                             opElements.forEach(id => {
                                 const el = document.getElementById(id);
                                 if (el) el.style.display = iAmOp ? 'flex' : 'none';
                             });
                             const hrs = chatContextMenu.querySelectorAll('hr');
                             hrs.forEach(hr => hr.style.display = iAmOp ? 'block' : 'none');

                             chatContextMenu.classList.remove('hidden');
                             let menuTop = e.clientY;
                             let menuLeft = e.clientX;
                             
                             // Fix posizionamento menu
                             const menuWidth = chatContextMenu.offsetWidth || 160;
                             const menuHeight = chatContextMenu.offsetHeight || 200;
                             
                             if (menuTop + menuHeight > window.innerHeight) menuTop = e.clientY - menuHeight;
                             if (menuTop < 0) menuTop = 10;
                             if (menuLeft + menuWidth > window.innerWidth) menuLeft = window.innerWidth - menuWidth - 10;

                             chatContextMenu.style.top = `${menuTop}px`;
                             chatContextMenu.style.left = `${menuLeft}px`;
                        }
                    });
                }
                userListDiv.appendChild(userEntry);
            });
            container.appendChild(userListDiv);
        }
        myChannelsListEl.appendChild(container);
    });
}

function removeChannelFromSidebar(roomToRemove) {
    if (!roomToRemove) return;

    const roomName = roomToRemove.trim().replace('#', '').toLowerCase();

    if (socket && socket.connected) {
        socket.emit('leave-room', roomName);
        
        setTimeout(() => {
            socket.emit('request-room-list');
        }, 200);
    } else {
        console.error("Socket not connected, cannot leave room");
    }

    myJoinedChannels = myJoinedChannels.filter(r => r !== roomName);
	
    if (roomChatsData[roomName]) delete roomChatsData[roomName];
    if (typeof roomVideoStates[roomName] !== 'undefined') delete roomVideoStates[roomName]; 
    if (typeof roomAudioStates[roomName] !== 'undefined') delete roomAudioStates[roomName];
    if (roomChatsData[roomName]) delete roomChatsData[roomName];
    
    renderSidebarChannels();
    
    if (currentRoomId === roomName) {
        
        if(messagesContainer) messagesContainer.innerHTML = '';
        const titleEl = document.getElementById('room-name-display');
        if(titleEl) titleEl.textContent = '';
        if(videosGrid) videosGrid.innerHTML = '';
        
        currentRoomId = null; 

        if (myJoinedChannels.length > 0) {
            switchChannel(myJoinedChannels[0]);
        } else {
            resetAndShowOverlay();
            
            if(localStream) {
            }
        }
    } 
}

if (transferFileButton) {
    transferFileButton.addEventListener('click', () => { 
        if(Object.keys(peerConnections).length === 0) { alert("No participants."); return; } 
        targetFileRecipientId = null; 
        fileInput.click(); 
    });
}

if (menuSendFile) {
    menuSendFile.addEventListener('click', () => {
        if (contextTargetPeerId) {
            targetFileRecipientId = contextTargetPeerId;
            hideContextMenu();
            if(!dataChannels[targetFileRecipientId] || dataChannels[targetFileRecipientId].readyState !== 'open'){
                alert("Cannot send file: connection unstable.");
                return;
            }
            fileInput.click();
        }
    });
}

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
    if (!dc || dc.readyState !== 'open') { 
        console.warn(`Channel closed or not ready for ${peerId}`); 
        return; 
    }

    const toast = createProgressToast(`Sending: ${file.name}`, true);
    
    // Invia i metadati
    const metadata = { type: 'file-metadata', name: file.name, size: file.size, fileType: file.type };
    try {
        dc.send(JSON.stringify(metadata));
    } catch (e) {
        console.error("Error sending metadata:", e);
        alert("Errore invio metadati. Riprova.");
        if(toast) toast.remove();
        return;
    }

    const CHUNK_SIZE = 16384; // 16KB
    let offset = 0;

    try {
        while (offset < file.size) {

            if (dc.readyState !== 'open') throw new Error("Connection closed during transfer");

            const chunk = file.slice(offset, offset + CHUNK_SIZE);
            const buffer = await chunk.arrayBuffer();
            
            dc.send(buffer);

            offset += buffer.byteLength;
            
            const percent = Math.min(100, Math.round((offset / file.size) * 100));
            updateProgressToast(toast, percent);

            if (dc.bufferedAmount > 1024 * 1024) { // 1MB threshold
                await new Promise(resolve => {
                    const checkBuffer = setInterval(() => {
                        if (dc.bufferedAmount < 256 * 1024 || dc.readyState !== 'open') {
                            clearInterval(checkBuffer);
                            resolve();
                        }
                    }, 50);
                });
            }
        }
    } catch (err) {
        console.error("File transfer error:", err);
        if(toast) {
            toast.querySelector('.file-name').textContent = "Error Sending File";
            toast.querySelector('.progress-bar-fill').style.backgroundColor = 'red';
        }
    }

    setTimeout(() => { if(toast) toast.remove(); }, 2000);
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
        btn.innerText = `📥 DOWNLOAD: ${meta.name}`;
        
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

    if(saveToHistory) {
        localWhiteboardHistory.push(data);
    }
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
    if(confirm("Clear whiteboard?")){ 
        ctx.clearRect(0, 0, canvas.width, canvas.height); 
        localWhiteboardHistory = [];
        if(socket && currentRoomId) socket.emit('wb-clear', currentRoomId); 
    } 
});

wbUndoBtn.addEventListener('click', () => { if(socket && currentRoomId) socket.emit('wb-undo', currentRoomId); });
wbColors.forEach(btn => { btn.addEventListener('click', (e) => { wbColors.forEach(b => b.classList.remove('active')); e.target.classList.add('active'); currentColor = e.target.dataset.color; }); });

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
        alert("No supported codec found for recording on this device.");
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

    } catch (e) {
        console.error("Recording error:", e);
        alert("Error starting recording: " + e.message);
        isRecording = false;
        recordButton.classList.remove('active');
    }
}

function openSettings() { settingsModal.classList.remove('hidden'); }
function closeSettings() { settingsModal.classList.add('hidden'); }

if (settingsBtnOverlay) settingsBtnOverlay.addEventListener('click', openSettings);
if (settingsBtnRoom) settingsBtnRoom.addEventListener('click', openSettings);
if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);

if (themeToggle) {
    themeToggle.addEventListener('change', (e) => {
        if(e.target.checked) {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
    });
}

if (menuToggleCC) {
    menuToggleCC.addEventListener('click', () => {
        if (!contextTargetPeerId) return;
        
        const peerId = contextTargetPeerId;
        const isActive = activeTranscriptions[peerId] || false;
        const newState = !isActive;
        
        activeTranscriptions[peerId] = newState;
        
        updateCCMenuState(peerId);
        hideContextMenu(); 

        if (socket) {
            socket.emit('request-transcription', peerId, socket.id, newState);
        }

        const feed = videosGrid.querySelector(`[data-peer-id="${peerId}"]`);
        const subOverlay = feed ? feed.querySelector('.subtitle-overlay') : null;

        if (newState) {
            if(!transcriptionHistory[peerId]) transcriptionHistory[peerId] = ""; 
            if(subOverlay) {
                subOverlay.classList.remove('hidden');
                subOverlay.textContent = "Waiting for audio...";
            }
        } else {
            if(subOverlay) subOverlay.classList.add('hidden');
            
            const fullText = transcriptionHistory[peerId];
            if (fullText && fullText.length > 10) { 
                if (confirm(`Transcription finished for this user.\nDownload text?`)) {
                    downloadTranscription(peerId, fullText);
                }
            }
            transcriptionHistory[peerId] = ""; 
        }
    });
}

function updateCCMenuState(peerId) {
    const isActive = activeTranscriptions[peerId];
    if (isActive) {
        menuToggleCC.classList.add('active-cc');
        menuToggleCC.querySelector('span:last-child').textContent = "Disable Subtitles";
    } else {
        menuToggleCC.classList.remove('active-cc');
        menuToggleCC.querySelector('span:last-child').textContent = "Enable Subtitles";
    }
}

if (globalTranscriptBtn) {
    globalTranscriptBtn.addEventListener('click', () => {
        if(extrasMenu) extrasMenu.classList.remove('active'); 

        const newState = !isGlobalMeetingRecording;
        
        socket.emit('toggle-global-transcription', currentRoomId, newState);
    });
}

if (closeTranscriptBtn) {
    closeTranscriptBtn.addEventListener('click', () => {
        meetingTranscriptPanel.classList.add('hidden');
    });
}

function downloadMeetingMinutes() {
    if (meetingHistory.length === 0) return;

    let content = `MEETING MINUTES - ${currentRoomId}\n`;
    content += `Date: ${new Date().toLocaleDateString()}\n`;
    content += `----------------------------------------\n\n`;

    meetingHistory.forEach(item => {
        content += `[${item.timestamp}] ${item.name}:\n${item.text}\n\n`;
    });

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

function renderAdminDashboard(data) {
    adminTotalUsers.textContent = data.totalUsers;
    adminBannedCount.textContent = data.bannedCount || 0;
    
    const list = adminRoomsList;
    list.innerHTML = '';
    
    if (Object.keys(data.rooms).length === 0) { 
        list.innerHTML = `<p style="color:var(--muted); text-align:center;">${t('admin-no-rooms') || 'No active rooms.'}</p>`; 
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

        header.innerHTML = `<span class="room-name">${statusIcons}#${roomId}</span>`;
        
        const controlsDiv = document.createElement('div');
        controlsDiv.style.display = 'flex';
        controlsDiv.style.gap = '5px';

        const lockBtn = document.createElement('button');
        lockBtn.className = `btn-admin-action btn-lock ${config.isLocked ? 'locked' : ''}`;
        lockBtn.innerHTML = `<span class="material-icons" style="font-size:1.2em;">${config.isLocked ? 'lock' : 'lock_open'}</span>`;
        lockBtn.title = config.isLocked ? "Unlock Room" : "Lock Room";
        lockBtn.onclick = () => socket.emit('admin-toggle-lock', roomId);

        const passBtn = document.createElement('button');
        passBtn.className = 'btn-admin-action btn-pass';
        passBtn.innerHTML = '<span class="material-icons" style="font-size:1.2em;">vpn_key</span>';
        passBtn.title = config.password ? `Change Pass (Current: ${config.password})` : "Set Password";
        passBtn.onclick = () => {
            const newPass = prompt("Set room password (leave empty to remove):", config.password);
            if (newPass !== null) socket.emit('admin-set-password', roomId, newPass);
        };

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
            
            const kickBtn = document.createElement('button'); 
            kickBtn.className = 'btn-kick'; 
            kickBtn.textContent = 'Kick';
            kickBtn.onclick = () => { if(confirm(`Kick ${nickname}?`)) socket.emit('admin-kick-user', socketId); };
            
            const banBtn = document.createElement('button'); 
            banBtn.className = 'btn-admin-action btn-ban'; 
            banBtn.textContent = 'BAN IP';
            banBtn.title = "Ban IP Permanently";
            banBtn.onclick = () => { if(confirm(`WARNING: Ban IP of ${nickname}? They won't be able to rejoin.`)) socket.emit('admin-ban-ip', socketId); };

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

function getRoomIdFromUrl(){ const urlParams = new URLSearchParams(window.location.search); return urlParams.get('room'); }

function copyRoomLink(){ 
    let url = `${window.location.protocol}//${window.location.host}${window.location.pathname}?room=${encodeURIComponent(currentRoomId)}`;
    
    if (currentRoomPassword) {
        url += `&pass=${encodeURIComponent(currentRoomPassword)}`;
    }

    navigator.clipboard.writeText(url).then(() => { 
        const originalText = shareRoomLinkButton.querySelector('.material-icons').textContent; 
        shareRoomLinkButton.classList.add('active'); 

        alert("Link copied to clipboard! " + (currentRoomPassword ? "(Includes password)" : ""));
    }).catch(err => {
        console.error('Copy error:', err);
    }); 
}

const originalAddChatMessage = addChatMessage;

function addChatMessage(sender, message, isLocal = false, type = 'public', msgId = null, saveToMemory = true) {
    const messageEl = document.createElement('div');
    messageEl.classList.add('chat-message');

    if (type === 'system') {
        messageEl.innerHTML = `
            <div class="message-system-wrapper">
                <span class="system-msg-content">${message}</span>
            </div>
        `;
        messagesContainer.appendChild(messageEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        if (saveToMemory && typeof roomChatsData !== 'undefined' && currentRoomId) {
            if (!roomChatsData[currentRoomId]) roomChatsData[currentRoomId] = [];
            roomChatsData[currentRoomId].push({
                sender: 'System',
                text: message,
                type: 'system',
                id: 'sys_' + Date.now(),
                timestamp: Date.now()
            });
        }
        return;
    }

    if (msgId) {
        messageEl.dataset.messageId = msgId;
        messageEl.dataset.readers = JSON.stringify([]);
        messageEl.addEventListener('click', () => showReadersDialog(msgId));
        messageEl.style.cursor = 'pointer';
    }

    let cssClass;
    if (type === 'private') {
        cssClass = 'sender-private';
    } else {
        cssClass = isLocal ? 'sender-me' : 'sender-remote';
    }

    const isImage = (url) => {
        return /\.(gif|jpe?g|png|webp)($|\?)/i.test(url) ||
               url.includes('media.giphy.com') ||
               url.includes('media.tenor.com');
    };

    let messageContentHtml = message;

    if (isImage(message.trim())) {
        messageContentHtml = `<img src="${message}" class="chat-media-img" onclick="window.open(this.src, '_blank'); event.stopPropagation();" alt="sticker" />`;
    } else {
        messageContentHtml = message;
    }

    const prefix = isLocal
        ? `${userNickname}${type === 'private' ? ` (DM to ${sender})` : ''}: `
        : `${sender}: `;

    let htmlContent = `<span class="${cssClass} chat-sender-name">${prefix}</span>${messageContentHtml}`;

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

    const senderSpan = messageEl.querySelector('.chat-sender-name');
    if (senderSpan && !isLocal && type !== 'system') {
        senderSpan.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            chatTargetUser = sender.replace(/^[@+]/, '');
            const chatContextMenu = document.getElementById('chat-context-menu');
            
            if(chatContextMenu) {
                const iAmOp = userNickname.startsWith('@');
                const opElements = [
                    'chat-menu-op', 
                    'chat-menu-deop', 
                    'chat-menu-voice', 
                    'chat-menu-devoice'
                ];

                opElements.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.style.display = iAmOp ? 'flex' : 'none';
                    }
                });

                const hrs = chatContextMenu.querySelectorAll('hr');
                hrs.forEach(hr => hr.style.display = iAmOp ? 'block' : 'none');

                chatContextMenu.classList.remove('hidden');
                
                const menuWidth = chatContextMenu.offsetWidth;
                const menuHeight = chatContextMenu.offsetHeight;
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;
                
                let menuTop = e.clientY;

                if (menuTop + menuHeight > windowHeight) {
                    menuTop = e.clientY - menuHeight;
                    if (menuTop < 0) menuTop = 10; 
                }
                
                let menuLeft = e.clientX;
                
                if (menuLeft + menuWidth > windowWidth) {
                    menuLeft = windowWidth - menuWidth - 10;
                }
                
                chatContextMenu.style.top = `${menuTop}px`;
                chatContextMenu.style.left = `${menuLeft}px`;
            }
        });
    }

    if (!isLocal) {
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

    if (saveToMemory && typeof roomChatsData !== 'undefined' && currentRoomId) {
        if (!roomChatsData[currentRoomId]) roomChatsData[currentRoomId] = [];

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

function renderServerList(list) {
    if (!serverListContainer) return;
    
    serverListContainer.innerHTML = '';
    
    if (list.length === 0) {
        serverListContainer.innerHTML = '<p style="text-align:center; color:gray;">No active rooms.</p>';
        return;
    }

    list.forEach(room => {
        const div = document.createElement('div');
        div.className = 'channel-item'; 
        div.style.background = 'var(--surface-2)';
        div.style.justifyContent = 'space-between';
        
        const amIInThisRoom = myJoinedChannels.includes(room.name);
        const isCurrentView = (room.name === currentRoomId);
        
        let statusText = '';
        if (isCurrentView) statusText = ' <span style="color:var(--primary-color); font-size:0.8em; font-weight:bold;">(YOU)</span>';
        else if (amIInThisRoom) statusText = ' <span style="color:#4caf50; font-size:0.8em; font-weight:bold;">(OPEN)</span>';

        const icons = [];
        if(room.isLocked) icons.push('🔒');
        if(room.hasPass) icons.push('🔑');
        
        div.innerHTML = `
            <span>#${room.name}${statusText} ${icons.join('')}</span>
            <small style="color:var(--primary-color); font-weight:bold;">${room.count} Users</small>
        `;
        
        div.addEventListener('click', () => {
            if (room.name === currentRoomId) {
                serverListModal.classList.add('hidden');
                return;
            }

            if (amIInThisRoom) {
                serverListModal.classList.add('hidden');
                switchChannel(room.name);
                return;
            }

            if (confirm(`Join channel #${room.name}?`)) {
                serverListModal.classList.add('hidden');
                handleJoinCommand(room.name);
            }
        });
        
        serverListContainer.appendChild(div);
    });
}

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
        serverListContainer.innerHTML = '<p style="text-align:center;">Updating...</p>';
        if(socket) socket.emit('request-room-list');
    });
}

function sendPrivateMessage(recipientId, recipientNickname, message) { if (!message || !recipientId) return; if (socket && currentRoomId) { socket.emit('send-private-message', currentRoomId, recipientId, userNickname, message); addChatMessage(recipientNickname, message, true, 'private'); } }
function openChatPanelMobile(callback) { if (chatPanel.classList.contains('active') && !chatPanel.classList.contains('hidden')) { if (callback) callback(); return; } chatPanel.classList.remove('hidden'); setTimeout(() => { chatPanel.classList.add('active'); let closeBtn = document.getElementById('close-chat-btn'); if (!closeBtn) { closeBtn = document.createElement('button'); closeBtn.textContent = '← Back to video'; closeBtn.id = 'close-chat-btn'; closeBtn.style.cssText = `position: relative; width: calc(100% - 20px); padding: 10px; margin: 10px; border: none; background: var(--primary-color); color: #fff; font-weight: bold; cursor: pointer; border-radius: 6px;`; const chatHeader = chatPanel.querySelector('h3'); if(chatHeader) chatPanel.insertBefore(closeBtn, chatHeader); closeBtn.addEventListener('click', () => { chatPanel.classList.remove('active'); setTimeout(() => { chatPanel.classList.add('hidden'); closeBtn.remove(); }, 300); }); } setTimeout(callback, 350); }, 10); }

let localServerInstanceId = null;

function initializeSocket(){
  if(socket) return; 
  socket = io(RENDER_SERVER_URL);
  
  socket.on('server-instance-id', (serverId) => {
      if (localServerInstanceId && localServerInstanceId !== serverId) {
          console.warn("[SYNC] Server restart detected. Full reset.");
          alert("The server has been updated/restarted. The page will reload.");
          window.location.reload(); 
          return;
      }
      localServerInstanceId = serverId;
  });
  
  socket.on('disconnect', (reason) => {
      if (reason === "io server disconnect" || reason === "transport close") {
          alert("The server was restarted. The page will reload to clear the session.");
          location.reload(); 
      }
  });
  
  socket.on('error-message', (msg) => {
      alert("WARNING: " + msg);
      if (!nicknameOverlay.classList.contains('hidden')) {
          resetAndShowOverlay(); 
          if(socket) socket.disconnect();
          socket = null;
      }
  });
  
  socket.on('kicked-by-admin', (msg) => {
      alert(msg); 
      location.reload();
  });
  
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
      }
      updateTypingUI();
  });

  socket.on('server-room-list-update', (list) => {
        renderServerList(list);
    });
	
	socket.on('new-private-message', (sender, message) => {
		addChatMessage(sender, message, false, 'private');
	});

	socket.on('new-action-message', (msgObj) => {
		const messageEl = document.createElement('div');
		messageEl.classList.add('chat-message', 'action-msg');
		messageEl.innerHTML = `<span style="color:#ff4081; font-weight:bold;">* ${msgObj.text}</span>`;
		messagesContainer.appendChild(messageEl);
		messagesContainer.scrollTop = messagesContainer.scrollHeight;
	});

	socket.on('user-nick-updated', (socketId, newNick) => {
		remoteNicknames[socketId] = newNick;
		
		const feed = document.querySelector(`[data-peer-id="${socketId}"]`);
		if(feed) {
			feed.querySelector('.remote-nickname').textContent = newNick;
		}

		if (socket && socketId === socket.id) {
			userNickname = newNick; 
			const localLabel = document.getElementById('local-nickname-display');
			if(localLabel) localLabel.textContent = userNickname;
			
			const opBtn = document.getElementById('op-settings-btn');
			if (opBtn) {
				if (newNick.startsWith('@')) {
					opBtn.classList.remove('hidden');
					opBtn.classList.add('op-attention'); 
					addChatMessage('System', 'Congratulations! You are now an Operator (@).', false, 'system');
				} else {
					opBtn.classList.add('hidden');
					opBtn.classList.remove('op-attention');
				}
			}
		}
        for (const rId in channelUsersRegistry) {
            const usersList = channelUsersRegistry[rId];
            if (usersList) {
                const userIndex = usersList.findIndex(u => u.id === socketId);
                if (userIndex !== -1) {
                    usersList[userIndex].nickname = newNick;
                }
            }
        }
		renderSidebarChannels();
	});

  socket.on('transcription-request', (requesterId, enable) => {
      if (enable) {
          if (!isTranscribingLocal) {
              initSpeechRecognition();
              try {
                  recognition.start();
                  isTranscribingLocal = true;
              } catch(e) { console.error("Speech start error:", e); }
          }
      } else {
          isTranscribingLocal = false;
          if (recognition) recognition.stop();
      }
  });

  socket.on('transcription-data', (senderId, text, isFinal) => {
      if (!activeTranscriptions[senderId]) return;

      const feed = videosGrid.querySelector(`[data-peer-id="${senderId}"]`);
      if (!feed) return;

      const subOverlay = feed.querySelector('.subtitle-overlay');
      if (subOverlay) {
          subOverlay.textContent = text;
          subOverlay.classList.remove('hidden');
          
          if (window.subTimers && window.subTimers[senderId]) clearTimeout(window.subTimers[senderId]);
          if (!window.subTimers) window.subTimers = {};
          
          window.subTimers[senderId] = setTimeout(() => {
              if (activeTranscriptions[senderId]) subOverlay.textContent = ""; 
          }, 4000);
      }

      if (isFinal) {
          transcriptionHistory[senderId] += text + " ";
      }
  });
  
  socket.on('global-transcription-status', (isActive) => {
        isGlobalMeetingRecording = isActive;

        if (isActive) {
            meetingHistory = []; 
            transcriptContent.innerHTML = ''; 
            meetingTranscriptPanel.classList.remove('hidden'); 
            if(globalTranscriptBtn) globalTranscriptBtn.classList.add('active-recording');
            
            addChatMessage(t('system'), "🔴 Meeting recording started.", false, 'system');
            
            stopSpeechRecognition(); 
            initSpeechRecognition();
            try { recognition.start(); } catch(e){}

        } else {
            if(globalTranscriptBtn) globalTranscriptBtn.classList.remove('active-recording');
            addChatMessage(t('system'), "⚫ Meeting recording stopped.", false, 'system');
            
            if (!isTranscribingLocal) {
                stopSpeechRecognition();
            }

            setTimeout(() => {
                if (meetingHistory.length > 0) {
                    if (confirm("Minutes ready. Download now?")) {
                        downloadMeetingMinutes();
                    }
                } else {
                    alert("No text detected during the meeting.");
                }
            }, 1000);
        }
    });

    socket.on('receive-global-transcript', (data) => {
        meetingHistory.push({
            name: data.nickname,
            text: data.text,
            timestamp: data.timestamp
        });

        const row = document.createElement('div');
        row.className = 'transcript-line';
        row.innerHTML = `
            <span class="t-time">[${data.timestamp}]</span>
            <span class="t-name">${data.nickname}:</span>
            <span class="t-text">${data.text}</span>
        `;
        transcriptContent.appendChild(row);
        transcriptContent.scrollTop = transcriptContent.scrollHeight;
    });

  socket.on('admin-log', (msg) => {
      const div = document.createElement('div');
      div.className = 'log-entry';
      div.textContent = msg;
      adminLogsConsole.appendChild(div);
      adminLogsConsole.scrollTop = adminLogsConsole.scrollHeight;
  });

  socket.on('admin-data-update', (data) => { renderAdminDashboard(data); });
  socket.on('connect', () => {
      console.log('Connected to server with ID:', socket.id);
      // Se eravamo già in una stanza prima di disconnetterci, rientriamo per sincronizzare la lista
      if (currentRoomId && userNickname) {
          console.log('Re-joining room to sync users...');
          socket.emit('join-room', currentRoomId, userNickname, currentRoomPassword);
      }
  });

  socket.on('nickname-in-use', (msg) => { alert(msg); resetAndShowOverlay(); if (socket) socket.disconnect(); socket = null; });
  
  socket.on('update-user-list', (roomId, users) => {
      console.log(`User list updated for #${roomId}:`, users); // Debug log
      channelUsersRegistry[roomId] = users;
      renderSidebarChannels();
  });

    socket.on('welcome', (joinedRoomId, newPeerId, serverAssignedNickname, peers=[], topic="", hasPassword=false, nameColor="#00b8ff", isSilentRejoin=false, isModerated=false) => {
        if (joinedRoomId !== currentRoomId) return;

        if (localFeedEl) localFeedEl.classList.remove('hidden');

        const originalInput = nicknameInput.value.trim();
        const assignedClean = serverAssignedNickname.replace(/^[@+]+/, '');
        
        // CORREZIONE QUI SOTTO:
        if (!isSilentRejoin && originalInput && assignedClean !== originalInput) {
            alert(`Nickname "${originalInput}" was taken. You joined as "${serverAssignedNickname}".`);
            
            // Aggiorniamo l'input con il nuovo nome per evitare avvisi futuri
            nicknameInput.value = assignedClean; 
        }

        const placeholder = document.getElementById('remote-video-placeholder');
        if (placeholder) {
            if (peers.length === 0) placeholder.textContent = t('waiting_others');
            else placeholder.remove();
        }

        userNickname = serverAssignedNickname;
        const localLabel = document.getElementById('local-nickname-display');
        if(localLabel) localLabel.textContent = userNickname;

        updateRoomInfoUI(topic, hasPassword);
        applyRoomBrandColor(nameColor);

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

        const hasHistory = roomChatsData[joinedRoomId] && roomChatsData[joinedRoomId].length > 0;

        if (!isSilentRejoin && !hasHistory) {
            addChatMessage(userNickname, `${t('welcome')} #${currentRoomId}!`, false, 'system');
        }

        peers.forEach(peer => {
            if(peer.id !== socket.id) {
                remoteNicknames[peer.id] = peer.nickname;
                createPeerConnection(peer.id);
            }
        });
    });
  
  socket.on('room-info-updated', (newTopic, hasPassword, topicChanged, passwordAction, newColor, isModerated, modeChanged) => {
      updateRoomInfoUI(newTopic, hasPassword);
      if(newColor) applyRoomBrandColor(newColor);
      
      const toggleEl = document.getElementById('op-moderate-toggle');
      if(toggleEl) toggleEl.checked = isModerated;

      let parts = [];
      
      if (topicChanged) parts.push(`Topic: "${newTopic}"`);
      if (passwordAction === 'added') parts.push(t('pass_enabled'));
      else if (passwordAction === 'removed') parts.push(t('pass_removed'));
      
      if (modeChanged) {
          if (isModerated) parts.push(t('mod_active'));
          else parts.push(t('mod_disabled'));
      }

      if (parts.length > 0) {
          addChatMessage(t('system'), parts.join(" | "), false, 'system');
      }
  });

	socket.on('room-mode-updated', (isModerated) => {
        if(opModerateToggle) opModerateToggle.checked = isModerated;
    });
	
  socket.on('op-settings-saved', () => {
    if(opModal) opModal.classList.add('hidden');
    if(opPasswordInput) opPasswordInput.value = ''; 
	});
  
  socket.on('wb-draw', (data) => { 
    if (whiteboardContainer.classList.contains('hidden')) {
        toggleWhiteboardButton.classList.add('has-notification');
        
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
      ctx.clearRect(0, 0, canvas.width, canvas.height); // Pulisce tutto
      localWhiteboardHistory = history; // Aggiorna lo storico locale con quello del server
      history.forEach(item => drawRemote(item, false)); // Ridisegna tutto (false = non ri-aggiungere all'array locale perché l'abbiamo appena fatto)
      
      // Notifica visuale se la lavagna è chiusa
      if (whiteboardContainer.classList.contains('hidden') && history.length > 0) {
          toggleWhiteboardButton.classList.add('has-notification'); 
      }
  });


socket.on('chat-history', (roomId, history) => {
    const rid = normalizeRoomId(roomId);
    const cid = normalizeRoomId(currentRoomId);
    if (!rid || !cid) return;

    // If history arrives for a different room (race), just store it and do NOT touch UI
    const seen = new Set();
    const cleanHistory = [];
    for (const msg of (history || [])) {
        const id = msg?.id || `${msg?.sender}|${msg?.timestamp}|${msg?.text}`;
        if (seen.has(id)) continue;
        seen.add(id);
        cleanHistory.push(msg);
    }

    // Store canonical history for that room
    roomChatsData[rid] = cleanHistory.map(m => ({
        sender: m.sender,
        text: m.text,
        type: m.type || 'public',
        id: m.id,
        timestamp: m.timestamp
    }));

    // Render only if user is currently viewing that room
    if (rid !== cid) return;

    messagesContainer.innerHTML = '';
    cleanHistory.forEach(msg => {
        const isMe = (msg.sender === userNickname);
        addChatMessage(msg.sender, msg.text, isMe, msg.type || 'public', msg.id, false);
    });

    setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 50);
});setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 50);
    });

  
  socket.on('new-message', (roomId, sender, message, msgId) => {
    const rId = String(roomId || '').trim().replace(/^#/, '').toLowerCase();
    const cId = currentRoomId ? String(currentRoomId).trim().replace(/^#/, '').toLowerCase() : "";
if (rId === cId) {
        addChatMessage(sender, message, false, 'public', msgId);
    } else {
        if (!roomChatsData[rId]) roomChatsData[rId] = [];
        roomChatsData[rId].push({ sender, text: message, type: 'public', id: msgId });
        
        const channelItem = Array.from(document.querySelectorAll('.channel-item span')).find(el => el.textContent.toLowerCase().includes(rId));
        if(channelItem) {
            channelItem.style.fontWeight = 'bold';
            channelItem.style.color = '#fff'; 
        }
    }
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
  
	socket.on('peer-joined', (evtRoomId, peerId, nickname) => {
		if (currentRoomId && evtRoomId.toLowerCase() === currentRoomId.toLowerCase()) {
			remoteNicknames[peerId] = nickname;
			createPeerConnection(peerId);
			addChatMessage(t('system'), `${nickname} ${t('user_joined')}`, false, 'system');
			renderSidebarChannels();
		} 
		else {
			if (!roomChatsData[evtRoomId]) roomChatsData[evtRoomId] = [];
			roomChatsData[evtRoomId].push({
				sender: 'System',
				text: `${nickname} ${t('user_joined')}`,
				type: 'system',
				timestamp: Date.now()
			});
			
			const channelItem = Array.from(document.querySelectorAll('.channel-item span'))
				.find(el => el.textContent.toLowerCase().includes(evtRoomId.toLowerCase()));
			if(channelItem) {
				channelItem.style.color = 'var(--primary-color)'; 
				channelItem.style.fontWeight = 'bold';
			}
		}
	});
  
	socket.on('peer-left', (evtRoomId, peerId, nickname) => {
		if (currentRoomId && evtRoomId.toLowerCase() === currentRoomId.toLowerCase()) {
			removeRemoteFeed(peerId);
			delete remoteNicknames[peerId]; // Ensure it is removed from list
			renderSidebarChannels();
			const name = nickname || 'User';
			addChatMessage(t('system'), `${name} left.`, false, 'system');
		}
		else {
			if(peerConnections[peerId]) { 
				peerConnections[peerId].close(); 
				delete peerConnections[peerId]; 
			}
			const el = document.querySelector(`[data-peer-id="${peerId}"]`);
			if(el) el.remove();
			
			if (!roomChatsData[evtRoomId]) roomChatsData[evtRoomId] = [];
			roomChatsData[evtRoomId].push({
				sender: 'System',
				text: `${nickname || 'User'} left.`,
				type: 'system',
				timestamp: Date.now()
			});
		}
	});
  
  socket.on('remote-video-status-changed', (peerId, isEnabled) => {
      const feed = videosGrid.querySelector(`[data-peer-id="${peerId}"]`);
      if (!feed) return;

      const noCamOverlay = feed.querySelector('.no-cam-overlay');
      if (noCamOverlay) {
          if (isEnabled) {
              // Se il video è attivato, nascondi l'immagine di default
              noCamOverlay.classList.add('hidden');
          } else {
              // Se il video è disattivato, mostra l'immagine di default (coprendo il fermo immagine)
              noCamOverlay.classList.remove('hidden');
          }
      }
  });
  
  socket.on('remote-stream-type-changed', (pid, ratio) => { const f = videosGrid.querySelector(`[data-peer-id="${pid}"]`); if(f){ f.classList.remove('ratio-4-3', 'ratio-16-9'); f.classList.add(`ratio-${ratio}`); } });
  
  socket.on('offer', async (fid, o)=>{ const pc = createPeerConnection(fid); if(pc.signalingState !== 'stable') return; await pc.setRemoteDescription(new RTCSessionDescription(o)); if (iceCandidateQueues[fid]) { iceCandidateQueues[fid].forEach(c => pc.addIceCandidate(new RTCIceCandidate(c))); iceCandidateQueues[fid] = []; } const a = await pc.createAnswer(); await pc.setLocalDescription(a); socket.emit('answer', fid, pc.localDescription); });
  socket.on('answer', async (fid, a)=>{ const pc = peerConnections[fid]; if(pc && pc.signalingState === 'have-local-offer') { await pc.setRemoteDescription(new RTCSessionDescription(a)); if (iceCandidateQueues[fid]) { iceCandidateQueues[fid].forEach(c => pc.addIceCandidate(new RTCIceCandidate(c))); iceCandidateQueues[fid] = []; } } });
  socket.on('candidate', async (fid, c)=>{ const pc = peerConnections[fid]; if(pc && c) { if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(c)); else { if (!iceCandidateQueues[fid]) iceCandidateQueues[fid] = []; iceCandidateQueues[fid].push(c); } } });

  socket.on('admin-login-success', () => { adminLoginView.classList.add('hidden'); adminDashboardView.classList.remove('hidden'); adminMsg.textContent = ''; });
  socket.on('admin-login-fail', () => { adminMsg.textContent = 'Invalid password.'; });
  socket.on('admin-data-update', (data) => { renderAdminDashboard(data); });
  socket.on('kicked-by-admin', () => { alert("You have been kicked."); location.reload(); });
  socket.on('room-closed-by-admin', (closedRoomId) => { 

      if (!closedRoomId) return; 
      
      const roomName = closedRoomId.toLowerCase();

      if (myJoinedChannels.includes(roomName)) {
          alert(`Room #${roomName} has been closed by admin.`);
      }

      myJoinedChannels = myJoinedChannels.filter(r => r !== roomName);
      renderSidebarChannels(); 

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
  
  if(localStream) { 
      localStream.getTracks().forEach(track => { 
          const sender = pc.addTrack(track, localStream); 
          
          if(track.kind === 'video') {
              videoSenders[socketId] = sender;
              const peerRoom = getRoomIdByPeerId(socketId) || currentRoomId;

              if (peerRoom && !roomVideoStates[peerRoom]) {
                  setTimeout(() => sender.replaceTrack(null), 0);
              }
          }
          
          if(track.kind === 'audio') {
            audioSenders[socketId] = sender;
            const peerRoom = getRoomIdByPeerId(socketId) || currentRoomId;
            if (peerRoom && !roomAudioStates[peerRoom]) {
                setTimeout(() => sender.replaceTrack(null), 0);
            }
          }
      }); 
  }
  
  const shouldCreateOffer = (socket.id < socketId); 
  if (shouldCreateOffer) { 
      const dc = pc.createDataChannel("fileTransfer"); 
      setupDataChannel(dc, socketId); 
  } else { 
      pc.ondatachannel = (event) => { 
          setupDataChannel(event.channel, socketId); 
      }; 
  }

  pc.onicecandidate = event => { 
      if(event.candidate) socket.emit('candidate', socketId, event.candidate); 
  };
  
  pc.ontrack = event => { 
      const feed = ensureRemoteFeed(socketId, remoteNicknames[socketId]); 
      const video = feed.querySelector('video'); 
      
      if(video && event.streams.length > 0) { 
          video.srcObject = event.streams[0]; 
          video.playsInline = true; // Importante per Safari/Mobile

          if (manuallyMutedPeers[socketId]) {
              video.muted = true;
          } else {
              video.muted = false; // Forza l'attivazione dell'audio
          }

          const playPromise = video.play();
          if (playPromise !== undefined) {
              playPromise.catch(error => {
                  console.warn("Autoplay prevented by browser:", error);
              });
          }
      } 
  };
  
  pc.onnegotiationneeded = async () => { 
      if(shouldCreateOffer && pc.signalingState === 'stable'){ 
          try{ 
              const offer = await pc.createOffer(); 
              await pc.setLocalDescription(offer); 
              socket.emit('offer', socketId, pc.localDescription); 
          } catch(err){ 
              console.error('Offer err', err); 
          } 
      } 
  };
  
  return pc;
}

function setupDataChannel(dc, peerId) { dc.onopen = () => { dataChannels[peerId] = dc; }; dc.onclose = () => { delete dataChannels[peerId]; }; dc.onmessage = (event) => handleDataChannelMessage(peerId, event); }

if (joinButton) {
    joinButton.addEventListener('click', async ()=>{
	  activateKeepAlive();
      const nickname = nicknameInput.value.trim();
      const roomId = roomIdInput.value.trim().replace('#', '').toLowerCase();
      const password = document.getElementById('room-password-input').value.trim();

      if(!nickname || !roomId){ alert('Missing data'); return; }
      
      userNickname = nickname; 
      currentRoomId = roomId; 
      currentRoomPassword = password;

      if (!myJoinedChannels.includes(roomId)) {
          myJoinedChannels.push(roomId);
      }
      renderSidebarChannels(); 
      
      const localLabel = document.getElementById('local-nickname-display');
      if(localLabel) localLabel.textContent = userNickname;

      isAudioEnabled = false; 
      isVideoEnabled = false;
      
      toggleAudioButton.querySelector('.material-icons').textContent = 'mic_off';
      toggleVideoButton.querySelector('.material-icons').textContent = 'videocam_off';
      localMicStatusIcon.textContent = 'mic_off';
      
      localFeedEl.classList.remove('hidden'); 
      
      const localOverlay = document.getElementById('local-no-cam');
      if (localOverlay) {
          localOverlay.classList.remove('hidden'); 
      }
      
      initializeSocket();
      socket.emit('join-room', currentRoomId, userNickname, password); 
      
      document.getElementById('room-name-display').textContent = '#' + roomId;
      
      if(currentChannelItem) currentChannelItem.textContent = roomId;

      showOverlay(false); 
    });
}

if (localFeedEl) {
    localFeedEl.addEventListener('click', () => {
        toggleFocus('local');
    });
}

if (moreOptionsBtn && extrasMenu) {
    moreOptionsBtn.addEventListener('click', (e) => {
        e.stopPropagation(); 
        extrasMenu.classList.toggle('active');
        extrasMenu.classList.remove('hidden'); 
    });

    extrasMenu.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            extrasMenu.classList.remove('active');
        });
    });

    document.addEventListener('click', (e) => {
        if (extrasMenu.classList.contains('active') && !extrasMenu.contains(e.target) && e.target !== moreOptionsBtn) {
            extrasMenu.classList.remove('active');
        }
    });
}

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

if (showChatBtn) {
    showChatBtn.addEventListener('click', (e) => {
        e.stopPropagation(); 

        const isMobile = window.innerWidth <= 768;

        if (chatPanel.classList.contains('hidden') || (isMobile && !chatPanel.classList.contains('active'))) {
            
            chatPanel.classList.remove('hidden');
            setTimeout(() => {
                chatPanel.classList.add('active');
            }, 10);
            
            markAllAsRead();
            
            if (window.innerWidth > 768) {
                setTimeout(() => chatMessageInput?.focus(), 50);
            }
        } else {
            chatPanel.classList.remove('active');
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

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === 'visible') {
        console.log("App tornata in primo piano");
        if (socket && currentRoomId) {
             socket.emit('typing-stop', currentRoomId); 
        }
    } else {
        console.log("App in background");
    }
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
            addChatMessage('System', 'Cannot DM yourself.', true, 'system');
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
        console.error("Camera switch error:", err);
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

if (opSettingsBtn) {
    opSettingsBtn.addEventListener('click', () => {
        opSettingsBtn.classList.remove('op-attention'); 
        opModal.classList.remove('hidden');
    });
}

if (closeOpModalBtn) {
    closeOpModalBtn.addEventListener('click', () => {
        opModal.classList.add('hidden');
    });
}

if (opSaveBtn) {
    opSaveBtn.addEventListener('click', () => {
        const newTopic = opTopicInput.value.trim();
        const newPass = opPasswordInput.value.trim();
        const newColor = opColorInput.value;
        
        const toggleEl = document.getElementById('op-moderate-toggle');
        const isModerated = toggleEl ? toggleEl.checked : false; 
        

        if (socket && currentRoomId) {
            socket.emit('op-update-settings', currentRoomId, newTopic, newPass, newColor, isModerated);
        }
    });
}

function saveCurrentChatToMemory() {
    if (currentRoomId && !roomChatsData[normalizeRoomId(currentRoomId)]) {
        roomChatsData[normalizeRoomId(currentRoomId)] = [];
    }
}

function loadChatFromMemory(roomId) {
    roomId = normalizeRoomId(roomId);
    if (roomChatsData[roomId]) {
        roomChatsData[roomId].forEach(msg => {
            const isMe = msg.sender === userNickname;
            addChatMessage(msg.sender, msg.text, isMe, msg.type, msg.id, false);
        });
    }
}

function updateRoomInfoUI(topic, isLocked) {
    const topicDisplay = document.getElementById('room-topic-display');
    const roomTitle = document.getElementById('room-name-display');

    if (topicDisplay) {
        if (topic && topic.trim() !== "") {
            topicDisplay.textContent = topic;
            topicDisplay.classList.remove('hidden');
            topicDisplay.style.visibility = 'visible'; 
        } else {
            topicDisplay.classList.add('hidden');
            topicDisplay.style.visibility = 'hidden';
        }
    }

    if (roomTitle) {
        let currentText = roomTitle.textContent;
        if (currentText.includes('🔒 ')) {
            currentText = currentText.replace('🔒 ', '');
        }
        
        if (isLocked) {
            roomTitle.textContent = '🔒 ' + currentText;
        } else {
            roomTitle.textContent = currentText;
        }
    }
}

function applyRoomBrandColor(color) {
    const titleEl = document.getElementById('room-name-display');
    
    document.documentElement.style.setProperty('--dynamic-brand-color', color);

    if (titleEl) {
        const adjustColorLightness = (col, amount) => {
            return '#' + col.replace(/^#/, '').replace(/../g, c => ('0'+Math.min(255, Math.max(0, parseInt(c, 16) + amount)).toString(16)).substr(-2));
        };
        
        const lighterColor = adjustColorLightness(color, 60);

        titleEl.style.background = `linear-gradient(to right, ${color} 0%, ${lighterColor} 100%)`;
        titleEl.style.webkitBackgroundClip = 'text';
        titleEl.style.webkitTextFillColor = 'transparent';
        
        titleEl.style.filter = `drop-shadow(0 0 15px ${color}80)`; 
    }
}

const GIPHY_API_KEY = 'ehM2UChAfuhm4vDy1af3p4p0XafHq0Ag'; 

document.addEventListener('DOMContentLoaded', () => {
    const stickerBtn = document.getElementById('sticker-toggle-btn');
    const stickerContainer = document.getElementById('sticker-picker-container');
    const stickerGrid = document.getElementById('sticker-grid');
    const searchInput = document.getElementById('sticker-search-input');
    
    let searchTimeout = null;

    if(!stickerBtn || !stickerContainer) return;

    async function fetchGifs(query = '') {
        stickerGrid.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Loading...</div>';
        
        try {
            const endpoint = query ? 'search' : 'trending';
            const limit = 24; 
            
            const url = `https://api.giphy.com/v1/gifs/${endpoint}?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&rating=g`;

            const response = await fetch(url);
            const data = await response.json();
            
            renderGifs(data.data);

        } catch (error) {
            console.error("Giphy Error:", error);
            stickerGrid.innerHTML = '<div style="text-align:center; padding:20px; color:red;">Error loading GIFs.</div>';
        }
    }

    function renderGifs(gifList) {
        stickerGrid.innerHTML = ''; 
        
        if (gifList.length === 0) {
            stickerGrid.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">No results.</div>';
            return;
        }

        gifList.forEach(gif => {
            const previewUrl = gif.images.fixed_height_small.url;
            const sendUrl = gif.images.original.url; 

            const img = document.createElement('img');
            img.src = previewUrl;
            img.className = 'sticker-option';
            img.loading = 'lazy'; 
            
            img.addEventListener('click', () => {
                sendMessage(sendUrl); 
                stickerContainer.classList.add('hidden'); 
            });
            
            stickerGrid.appendChild(img);
        });
    }

    stickerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isClosed = stickerContainer.classList.contains('hidden');
        
        if (isClosed) {
            stickerContainer.classList.remove('hidden');
            document.getElementById('emoji-picker-container')?.classList.add('hidden'); 
            
            if (stickerGrid.children.length === 0) {
                fetchGifs(); 
            }
            
            setTimeout(() => searchInput.focus(), 100);
        } else {
            stickerContainer.classList.add('hidden');
        }
    });

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            fetchGifs(query);
        }, 500);
    });

    document.addEventListener('click', (e) => {
        if (!stickerContainer.classList.contains('hidden')) {
            if (!stickerContainer.contains(e.target) && e.target !== stickerBtn) {
                stickerContainer.classList.add('hidden');
            }
        }
    });
});

// --- JOIN CHANNEL MODAL LOGIC ---
const openJoinModalBtn = document.getElementById('open-join-modal-btn');
const joinChannelModal = document.getElementById('join-channel-modal');
const closeJoinModalBtn = document.getElementById('close-join-modal-btn');
const confirmJoinBtn = document.getElementById('confirm-join-btn');
const newChannelInput = document.getElementById('new-channel-name-input');
const newChannelPass = document.getElementById('new-channel-password-input');

if (openJoinModalBtn) {
    openJoinModalBtn.addEventListener('click', () => {
        joinChannelModal.classList.remove('hidden');
        setTimeout(() => newChannelInput.focus(), 100); 
    });
}

if (closeJoinModalBtn) {
    closeJoinModalBtn.addEventListener('click', () => {
        joinChannelModal.classList.add('hidden');
    });
}

function performJoin() {
    const roomName = newChannelInput.value.trim().replace('#', ''); // Strip # if user typed it
    const roomPass = newChannelPass.value.trim();

    if (roomName) {
        handleJoinCommand(roomName, roomPass); 
        newChannelInput.value = '';
        newChannelPass.value = '';
        joinChannelModal.classList.add('hidden');
        
        const sidebar = document.getElementById('channel-sidebar');
        if (sidebar && sidebar.classList.contains('mobile-open')) {
             sidebar.classList.remove('mobile-open');
        }
    } else {
        alert("Please enter a valid channel name.");
    }
}

if (confirmJoinBtn) {
    confirmJoinBtn.addEventListener('click', performJoin);
}

if (newChannelInput) {
    newChannelInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performJoin();
    });
}

const chatContextMenu = document.getElementById('chat-context-menu');
let chatTargetUser = null; 

document.getElementById('chat-menu-dm').addEventListener('click', () => {
    if(chatTargetUser) {
        chatMessageInput.value = `/dm ${chatTargetUser} `;
        chatMessageInput.focus();
    }
    hideChatContextMenu();
});

document.getElementById('chat-menu-op').addEventListener('click', () => {
    if(chatTargetUser) socket.emit('command-op', currentRoomId, chatTargetUser);
    hideChatContextMenu();
});

document.getElementById('chat-menu-deop').addEventListener('click', () => {
    if(chatTargetUser) socket.emit('command-deop', currentRoomId, chatTargetUser);
    hideChatContextMenu();
});

document.getElementById('chat-menu-voice').addEventListener('click', () => {
    if(chatTargetUser) socket.emit('command-voice', currentRoomId, chatTargetUser);
    hideChatContextMenu();
});

document.getElementById('chat-menu-devoice').addEventListener('click', () => {
    if(chatTargetUser) socket.emit('command-devoice', currentRoomId, chatTargetUser);
    hideChatContextMenu();
});

document.getElementById('chat-menu-slap').addEventListener('click', () => {
    if(chatTargetUser) socket.emit('command-action', currentRoomId, 'slap', chatTargetUser);
    hideChatContextMenu();
});

function hideChatContextMenu() {
    chatContextMenu.classList.add('hidden');
    chatTargetUser = null;
}

document.addEventListener('click', (e) => {
    if (!chatContextMenu.classList.contains('hidden') && !chatContextMenu.contains(e.target)) {
        hideChatContextMenu();
    }
});

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake Lock attivo: lo schermo non si spegnerà.');
            document.addEventListener('visibilitychange', async () => {
                if (wakeLock !== null && document.visibilityState === 'visible') {
                    wakeLock = await navigator.wakeLock.request('screen');
                }
            });
        }
    } catch (err) {
        console.warn(`Wake Lock error: ${err.name}, ${err.message}`);
    }
}

function activateKeepAlive() {
    try {
        if (!keepAliveCtx) {
            keepAliveCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (keepAliveCtx.state === 'suspended') {
            keepAliveCtx.resume().then(() => {
                console.log("KeepAlive AudioContext resumed.");
            });
        }
        if (!keepAliveOsc) {
            keepAliveOsc = keepAliveCtx.createOscillator();
            const gainNode = keepAliveCtx.createGain();
            gainNode.gain.value = 0.0001; 

            keepAliveOsc.connect(gainNode);
            gainNode.connect(keepAliveCtx.destination);

            keepAliveOsc.type = 'sine';
            keepAliveOsc.frequency.setValueAtTime(20, keepAliveCtx.currentTime); // Frequenza bassa

            keepAliveOsc.start();
            console.log("Silent oscillator started (Web Audio API) for background persistence.");
        }
    } catch (e) {
        console.warn("Web Audio API Keep-Alive error:", e);
    }
    requestWakeLock();
}

window.addEventListener('beforeunload', (e) => {
    if (currentRoomId && socket && socket.connected) {
        const confirmationMessage = 'Sei in una chiamata. Vuoi davvero uscire?';       
        e.preventDefault();
        e.returnValue = confirmationMessage;
        return confirmationMessage;
    }
});

function enableSwipeGestures() {
    const minSwipeDistance = 75;

    function addSwipeListener(element, direction, actionCallback) {
        let touchStartX = 0;
        let touchEndX = 0;

        element.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        element.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleGesture();
        }, { passive: true });

        function handleGesture() {
            const distance = touchStartX - touchEndX;

            if (direction === 'left' && distance > minSwipeDistance) {
                actionCallback();
            }

            if (direction === 'right' && distance < -minSwipeDistance) {
                actionCallback();
            }
        }
    }

    const sidebarEl = document.getElementById('channel-sidebar');
    if (sidebarEl) {
        addSwipeListener(sidebarEl, 'left', () => {
            if (sidebarEl.classList.contains('mobile-open')) {
                sidebarEl.classList.remove('mobile-open');
                console.log('Sidebar chiusa con swipe');
            }
        });
    }

    const chatEl = document.getElementById('chat-panel');
    if (chatEl) {
        addSwipeListener(chatEl, 'right', () => {
            // Verifica se la chat è aperta
            if (chatEl.classList.contains('active')) {
                // Logica di chiusura identica a quella del pulsante "Close"
                chatEl.classList.remove('active');
                setTimeout(() => {
                    chatEl.classList.add('hidden');
                    const closeBtn = document.getElementById('close-chat-btn');
                    if (closeBtn) closeBtn.remove();
                }, 300);
                console.log('Chat chiusa con swipe');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    enableSwipeGestures();
});