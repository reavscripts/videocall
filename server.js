const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const SERVER_INSTANCE_ID = Date.now().toString();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";

const clientUrl = (process.env.CLIENT_URL || "").replace(/\/$/, "");

const io = new Server(server, {
    pingTimeout: 60000,
    pingInterval: 25000,
    cors: { 
        origin: [
            "http://localhost:3000", 
            "https://videocall-webrtc-signaling-server.onrender.com", 
            clientUrl
        ], 
        methods: ['GET', 'POST'] 
    }
});

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {}; 
const roomConfigs = {}; 
const roomMessages = {}; 
const bannedIPs = new Set(); 
const admins = new Set(); 

function getClientIp(socket) {
    const header = socket.handshake.headers['x-forwarded-for'];
    if (header) return header.split(',')[0].trim();
    return socket.handshake.address;
}

function logToAdmin(message) {
    const time = new Date().toLocaleTimeString();
    const logMsg = `[${time}] ${message}`;
    console.log(logMsg); 
    admins.forEach(adminId => {
        io.to(adminId).emit('admin-log', logMsg);
    });
}

io.on('connection', (socket) => {
    const clientIp = getClientIp(socket);
	socket.emit('server-instance-id', SERVER_INSTANCE_ID);
    
    if (bannedIPs.has(clientIp)) {
        socket.emit('kicked-by-admin', 'Your IP address has been banned.');
        socket.disconnect(true);
        return; 
    }

    logToAdmin(`New connection: ${socket.id} (IP: ${clientIp})`);

    socket.on('join-room', (roomIdRaw, nickname, password = "") => {
        const roomId = String(roomIdRaw).replace('#', '').toLowerCase();
        
        if (bannedIPs.has(clientIp)) {
            socket.emit('error-message', 'You are banned.');
            return;
        }

        if (!rooms[roomId]) {
            rooms[roomId] = {};
        }

        if (rooms[roomId][socket.id]) {
            const currentNick = rooms[roomId][socket.id]; 
            const config = roomConfigs[roomId] || { topic: "", nameColor: "#00b8ff", password: "" };
            
            const peers = Object.entries(rooms[roomId])
                .filter(([id]) => id !== socket.id)
                .map(([id, nick]) => ({ id, nickname: nick }));

            socket.emit('welcome', 
                roomId,
                socket.id, 
                currentNick, 
                peers, 
                config.topic, 
                !!config.password, 
                config.nameColor,
                true, 
				!!config.isModerated
            );

            socket.emit('room-info-updated', config.topic, !!config.password, false, null, config.nameColor, !!config.isModerated, false);
            return; 
        }

        let isRoomCreator = (Object.keys(rooms[roomId]).length === 0);
        let finalNickname = nickname.replace(/^@/, ''); 
        
        if (isRoomCreator) {
            finalNickname = '@' + finalNickname; 
        }

        if (!roomConfigs[roomId]) {
            roomConfigs[roomId] = { 
                password: password, 
                isLocked: false,
                topic: "",
                nameColor: "#00b8ff",
                isModerated: false
            };
        }
        const config = roomConfigs[roomId];

        if (config.isLocked) { socket.emit('error-message', 'Room locked.'); return; }
        if (config.password && config.password !== password) { socket.emit('error-message', 'Wrong password.'); return; }

        const existingUserEntry = Object.entries(rooms[roomId]).find(([id, n]) => n.toLowerCase().replace('@','') === finalNickname.toLowerCase());
        
        if (existingUserEntry) {
            const [oldSocketId, oldNick] = existingUserEntry;
            const isAuth = (!config.password || config.password === password);
            
            if (isAuth) {
                if (oldNick.startsWith('@') && !finalNickname.startsWith('@')) {
                    finalNickname = '@' + finalNickname.replace(/^@/, '');
                }
                delete rooms[roomId][oldSocketId];
            } else {
                socket.emit('nickname-in-use', `Nick '${finalNickname}' is already in use.`);
                return;
            }
        }

        socket.join(roomId); 
        rooms[roomId][socket.id] = finalNickname; 
        
        const peers = Object.entries(rooms[roomId])
            .filter(([id]) => id !== socket.id)
            .map(([id, nick]) => ({ id, nickname: nick }));

        socket.to(roomId).emit('peer-joined', roomId, socket.id, finalNickname);
        
        if (!roomMessages[roomId]) roomMessages[roomId] = [];
        roomMessages[roomId].push({
            sender: 'System',
            text: `${finalNickname} joined.`,
            id: 'sys_' + Date.now(),
            timestamp: Date.now(),
            type: 'system'
        });

        socket.emit('welcome', roomId, socket.id, finalNickname, peers, config.topic, !!config.password, config.nameColor, false, !!config.isModerated);
        
        io.emit('server-room-list-update', getPublicRoomList());
        broadcastAdminUpdate();
        if (roomMessages[roomId].length > 0) {
            socket.emit('chat-history', roomMessages[roomId]);
        }
    });

    socket.on('leave-room', (roomIdRaw) => {
        if (!roomIdRaw) return;

        const roomId = String(roomIdRaw).trim().replace('#', '').toLowerCase();
        
        if (rooms[roomId]) {
            if (rooms[roomId][socket.id]) {
                const nickname = rooms[roomId][socket.id];
                delete rooms[roomId][socket.id];
                
                socket.to(roomId).emit('peer-left', roomId, socket.id, nickname);

                if (Object.keys(rooms[roomId]).length === 0) {
                    delete rooms[roomId];
                    delete roomConfigs[roomId];
                    if(roomMessages[roomId]) delete roomMessages[roomId];
                }
            }
        } 

        socket.leave(roomId); 

        io.emit('server-room-list-update', getPublicRoomList());
        broadcastAdminUpdate();
    });

    function getCleanNick(nickname) {
        return nickname.replace(/^[@+]+/, '');
    }

    socket.on('command-action', (roomId, actionType, targetName) => {
        if(!rooms[roomId] || !rooms[roomId][socket.id]) return;
        const senderNick = rooms[roomId][socket.id];
        
        let msgText = "";
        if(actionType === 'slap') {
            msgText = `* ${senderNick} slaps ${targetName} around a bit with a large trout *`;
        }

        const msgId = 'act_' + Date.now();
        if (!roomMessages[roomId]) roomMessages[roomId] = [];
        const msgObj = {
            sender: senderNick,
            text: msgText,
            id: msgId,
            timestamp: Date.now(),
            type: 'action'
        };
        roomMessages[roomId].push(msgObj);

        io.to(roomId).emit('new-action-message', msgObj);
    });

    socket.on('command-op', (roomId, targetNick) => {
        if (!rooms[roomId]) return;     
        const myNick = rooms[roomId][socket.id];
        if (!myNick || (!myNick.startsWith('@') && !admins.has(socket.id))) {
            socket.emit('error-message', "You do not have permission to give OP.");
            return;
        }

        const cleanTarget = getCleanNick(targetNick).toLowerCase();
        const targetSocketId = Object.keys(rooms[roomId]).find(id => 
            getCleanNick(rooms[roomId][id]).toLowerCase() === cleanTarget
        );

        if (targetSocketId) {
            let oldNick = rooms[roomId][targetSocketId];

            if (oldNick.startsWith('@')) {
                socket.emit('error-message', "User is already an operator.");
                return;
            }

            const baseNick = getCleanNick(oldNick);
            const newNick = '@' + baseNick;

            rooms[roomId][targetSocketId] = newNick;

            io.to(roomId).emit('user-nick-updated', targetSocketId, newNick);
            io.to(roomId).emit('new-message', roomId, 'Server', `${baseNick} is now an Operator (+o).`, 'sys_' + Date.now());
        } else {
            socket.emit('error-message', "User not found.");
        }
    });

    socket.on('command-deop', (roomId, targetNick) => {
        if(!rooms[roomId]) return;
        const myNick = rooms[roomId][socket.id];
        if(!myNick || (!myNick.startsWith('@') && !admins.has(socket.id))) {
            socket.emit('error-message', "You do not have permission to remove OP.");
            return;
        }

        const cleanTarget = getCleanNick(targetNick).toLowerCase();
        const targetSocketId = Object.keys(rooms[roomId]).find(id => getCleanNick(rooms[roomId][id]).toLowerCase() === cleanTarget);
        
        if(targetSocketId) {
            let oldNick = rooms[roomId][targetSocketId];
            
            if(oldNick.startsWith('@')) {
                const newNick = getCleanNick(oldNick);
                rooms[roomId][targetSocketId] = newNick;
                
                io.to(roomId).emit('user-nick-updated', targetSocketId, newNick);
                io.to(roomId).emit('new-message', roomId, 'Server', `${newNick} is no longer an Operator (-o).`, 'sys_'+Date.now());
            } else {
                socket.emit('error-message', "That user is not an operator.");
            }
        } else {
            socket.emit('error-message', "User not found.");
        }
    });

    socket.on('command-voice', (roomId, targetNick) => {
        if(!rooms[roomId]) return;
        const myNick = rooms[roomId][socket.id];
        if(!myNick || (!myNick.startsWith('@') && !admins.has(socket.id))) return;

        const cleanTarget = getCleanNick(targetNick).toLowerCase();
        const targetSocketId = Object.keys(rooms[roomId]).find(id => getCleanNick(rooms[roomId][id]).toLowerCase() === cleanTarget);

        if(targetSocketId) {
             let oldNick = rooms[roomId][targetSocketId];
             
             if(oldNick.startsWith('@')) {
                 socket.emit('error-message', "User is already an Operator (already has voice).");
                 return;
             }

             if(!oldNick.startsWith('+')) {
                 const baseNick = getCleanNick(oldNick);
                 const newNick = '+' + baseNick;
                 
                 rooms[roomId][targetSocketId] = newNick;
                 
                 io.to(roomId).emit('user-nick-updated', targetSocketId, newNick);
                 io.to(roomId).emit('new-message', roomId, 'Server', `${baseNick} received voice (+v).`, 'sys_'+Date.now());
             } else {
                 socket.emit('error-message', "User already has voice.");
             }
        }
    });

    socket.on('command-devoice', (roomId, targetNick) => {
        if(!rooms[roomId]) return;
        const myNick = rooms[roomId][socket.id];
        
        if(!myNick || !myNick.startsWith('@')) {
            socket.emit('error-message', "Only operators can manage voice.");
            return;
        }

        const cleanTarget = getCleanNick(targetNick).toLowerCase();
        const targetSocketId = Object.keys(rooms[roomId]).find(id => getCleanNick(rooms[roomId][id]).toLowerCase() === cleanTarget);

        if(targetSocketId) {
             let oldNick = rooms[roomId][targetSocketId];
             
             if(oldNick.startsWith('+')) {
                 const newNick = getCleanNick(oldNick); 
                 rooms[roomId][targetSocketId] = newNick;
                 
                 io.to(roomId).emit('user-nick-updated', targetSocketId, newNick);
                 io.to(roomId).emit('new-message', roomId, 'Server', `${newNick} lost voice status (-v).`, 'sys_'+Date.now());
             } else {
                 socket.emit('error-message', "User does not have voice status (+).");
             }
        } else {
            socket.emit('error-message', "User not found.");
        }
    });
	
    socket.on('command-moderate', (roomId, state) => { 
        if(!rooms[roomId]) return;
        const myNick = rooms[roomId][socket.id];
        if(!myNick || (!myNick.startsWith('@') && !admins.has(socket.id))) {
            socket.emit('error-message', "You do not have OP permissions.");
            return;
        }

        if (!roomConfigs[roomId]) return;

        const isNowModerated = (state === 'on');
        const oldModerated = !!roomConfigs[roomId].isModerated;

        if (isNowModerated === oldModerated) return;

        roomConfigs[roomId].isModerated = isNowModerated;

        io.to(roomId).emit('room-info-updated', 
            roomConfigs[roomId].topic,
            !!roomConfigs[roomId].password,
            false,
            null,
            roomConfigs[roomId].nameColor,
            isNowModerated,
            true
        );

        io.to(roomId).emit('room-mode-updated', isNowModerated);
    });
	
    socket.on('typing-start', (roomId, nickname) => {
        socket.to(roomId).emit('remote-typing-start', roomId, socket.id, nickname);
    });

    socket.on('typing-stop', (roomId) => {
        socket.to(roomId).emit('remote-typing-stop', roomId, socket.id);
    });

    socket.on('op-update-settings', (roomId, newTopic, newPassword, newColor, newIsModerated) => {
        if (!rooms[roomId] || !rooms[roomId][socket.id]) return;

        const currentNick = rooms[roomId][socket.id];
        if (!currentNick.startsWith('@')) {
            socket.emit('error-message', "You do not have Operator permissions (@).");
            return;
        }

        if (roomConfigs[roomId]) {
            const oldTopic = roomConfigs[roomId].topic || "";
            const oldHasPassword = !!roomConfigs[roomId].password; 
            const oldModerated = !!roomConfigs[roomId].isModerated;

            roomConfigs[roomId].topic = newTopic || "";
            roomConfigs[roomId].password = newPassword || ""; 
            roomConfigs[roomId].nameColor = newColor || "#00b8ff"; 
            roomConfigs[roomId].isModerated = !!newIsModerated; 

            const newHasPassword = !!newPassword; 
            const topicChanged = (oldTopic !== (newTopic || ""));
            const modeChanged = (oldModerated !== roomConfigs[roomId].isModerated);
            
            let passwordAction = null; 
            if (!oldHasPassword && newHasPassword) passwordAction = 'added';
            else if (oldHasPassword && !newHasPassword) passwordAction = 'removed';
            
            io.to(roomId).emit('room-info-updated', 
                newTopic, 
                newHasPassword, 
                topicChanged, 
                passwordAction,
                newColor,
                roomConfigs[roomId].isModerated, 
                modeChanged
            );
            
            socket.emit('op-settings-saved');
            broadcastAdminUpdate();
        }
    });
    
    socket.on('toggle-global-transcription', (roomId, isActive) => {
        io.to(roomId).emit('global-transcription-status', isActive);
    });

    socket.on('global-transcript-chunk', (roomId, data) => {
        io.to(roomId).emit('receive-global-transcript', data);
    });

    socket.on('admin-login', (password) => {
        if (password === ADMIN_PASSWORD) {
            admins.add(socket.id);
            socket.emit('admin-login-success');
            sendAdminData(socket.id);
            logToAdmin(`Admin logged in: ${socket.id}`);
        } else {
            socket.emit('admin-login-fail');
            logToAdmin(`Admin login failed from IP: ${clientIp}`);
        }
    });
	
    socket.on('admin-ban-ip', (targetSocketId) => {
        if (!admins.has(socket.id)) return;
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
            const targetIp = getClientIp(targetSocket);
            bannedIPs.add(targetIp);
            targetSocket.emit('kicked-by-admin', "You have been permanently banned.");
            targetSocket.disconnect(true);
            logToAdmin(`IP BAN Executed on ${targetIp}`);
            broadcastAdminUpdate();
        }
    });

    socket.on('admin-toggle-lock', (roomId) => {
        if (!admins.has(socket.id) || !roomConfigs[roomId]) return;
        roomConfigs[roomId].isLocked = !roomConfigs[roomId].isLocked;
        broadcastAdminUpdate();
    });

    socket.on('admin-set-password', (roomId, newPass) => {
        if (!admins.has(socket.id) || !roomConfigs[roomId]) return;
        roomConfigs[roomId].password = newPass;
        broadcastAdminUpdate();
    });

    socket.on('admin-kick-user', (targetSocketId) => {
        if (!admins.has(socket.id)) return;
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
            targetSocket.emit('kicked-by-admin', "Kicked by admin.");
            targetSocket.disconnect(true);
        }
        broadcastAdminUpdate();
    });

    socket.on('admin-close-room', (roomIdRaw) => {
        if (!admins.has(socket.id)) return;

        const targetRoomId = String(roomIdRaw).toLowerCase();
        
        const usersInRoom = rooms[targetRoomId];
        if (usersInRoom) {
            Object.keys(usersInRoom).forEach(socketId => {
                const s = io.sockets.sockets.get(socketId);
                if (s) {
                    s.emit('room-closed-by-admin', targetRoomId);
                    s.leave(targetRoomId);
                }
            });
        }

        delete rooms[targetRoomId];
        delete roomConfigs[targetRoomId]; 
        delete roomMessages[targetRoomId];

        broadcastAdminUpdate();
        io.emit('server-room-list-update', getPublicRoomList());
    });

    socket.on('admin-refresh', () => {
        if(admins.has(socket.id)) sendAdminData(socket.id);
    });

    function sendAdminData(adminSocketId) {
        const stats = {
            totalUsers: io.engine.clientsCount,
            rooms: rooms,
            configs: roomConfigs, 
            bannedCount: bannedIPs.size
        };
        io.to(adminSocketId).emit('admin-data-update', stats);
    }

    function broadcastAdminUpdate() {
        if (admins.size === 0) return;
        const stats = {
            totalUsers: io.engine.clientsCount,
            rooms: JSON.parse(JSON.stringify(rooms)),
            configs: JSON.parse(JSON.stringify(roomConfigs)),
            bannedCount: bannedIPs.size
        };
        
        admins.forEach(adminId => io.to(adminId).emit('admin-data-update', stats));
    }

    socket.on('request-room-list', () => {
        socket.emit('server-room-list-update', getPublicRoomList());
    });

    socket.on('request-transcription', (targetId, requesterId, enable) => {
        io.to(targetId).emit('transcription-request', requesterId, enable);
    });

    socket.on('transcription-result', (targetId, text, isFinal) => {
        io.to(targetId).emit('transcription-data', socket.id, text, isFinal);
    });
    
    socket.on('send-message', (r, s, m, msgId) => {
        const roomId = r.toLowerCase(); 
        const finalId = msgId || Date.now().toString(); 
       
        const config = roomConfigs[roomId];
        if (config && config.isModerated) {
            if (!rooms[roomId]) return;
            const senderNick = rooms[roomId][socket.id];
            if (!senderNick || (!senderNick.startsWith('@') && !senderNick.startsWith('+'))) {
                socket.emit('error-message', "Chat in moderated mode (+m). You do not have permission to speak.");
                return; 
            }
        }

        if (!roomMessages[roomId]) roomMessages[roomId] = [];
        
        roomMessages[roomId].push({
            sender: s,
            text: m,
            id: finalId,
            timestamp: Date.now(),
            type: 'public' 
        });

        if (roomMessages[roomId].length > 100) roomMessages[roomId].shift();

        socket.to(roomId).emit('new-message', roomId, s, m, finalId);
    });
    
    socket.on('msg-read', (roomId, messageId, readerNickname) => {
        io.to(roomId).emit('msg-read-update', messageId, readerNickname);
    });
    socket.on('send-private-message', (r, rid, s, m) => io.to(rid).emit('new-private-message', s, m));
    socket.on('wb-draw', (r, d) => socket.to(r).emit('wb-draw', d));
    socket.on('wb-clear', (r) => io.to(r).emit('wb-clear'));
    socket.on('wb-undo', (r) => io.to(r).emit('wb-undo')); 
    socket.on('offer', (id, o) => io.to(id).emit('offer', socket.id, o));
    socket.on('answer', (id, a) => io.to(id).emit('answer', socket.id, a));
    socket.on('candidate', (id, c) => io.to(id).emit('candidate', socket.id, c));
    socket.on('audio-status-changed', (r, t) => socket.to(r).emit('audio-status-changed', socket.id, t));
	socket.on('video-status-changed', (roomId, isEnabled) => {
        socket.to(roomId).emit('remote-video-status-changed', socket.id, isEnabled);
    });
    socket.on('stream-type-changed', (r, ratio) => socket.to(r).emit('remote-stream-type-changed', socket.id, ratio));

    socket.on('disconnect', (reason) => {
        if (admins.has(socket.id)) admins.delete(socket.id);
        
        let updateNeeded = false;

        for (const roomId in rooms) {
            if (rooms[roomId][socket.id]) {
                const nickname = rooms[roomId][socket.id];
                
                delete rooms[roomId][socket.id];
                updateNeeded = true;
                
                socket.to(roomId).emit('peer-left', roomId, socket.id, nickname);
                socket.to(roomId).emit('remote-typing-stop', roomId, socket.id);

                if (Object.keys(rooms[roomId]).length === 0) {
                    delete rooms[roomId];
                    delete roomConfigs[roomId];
                    if (roomMessages[roomId]) delete roomMessages[roomId];
                }
            }
        }
        
        if (updateNeeded) {
            broadcastAdminUpdate();
            io.emit('server-room-list-update', getPublicRoomList());
        }
    });
});

function getPublicRoomList() {
    const list = [];
    for(const [id, users] of Object.entries(rooms)) {
        const conf = roomConfigs[id] || {};
        list.push({
            name: id,
            count: Object.keys(users).length,
            isLocked: !!conf.isLocked,
            hasPass: !!conf.password
        });
    }
    return list;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));