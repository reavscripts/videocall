const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");

const app = express();
const server = http.createServer(app);

const SERVER_INSTANCE_ID = Date.now().toString();

/* ===================== ENV ===================== */
const REDIS_URL = (process.env.REDIS_URL || "").trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "").trim();
const clientUrl = (process.env.CLIENT_URL || "").replace(/\/$/, "");

if (!REDIS_URL) {
  console.error("❌ Missing REDIS_URL");
  process.exit(1);
}
if (!ADMIN_PASSWORD) {
  console.error("❌ Missing ADMIN_PASSWORD");
  process.exit(1);
}

/* ===================== Socket.IO ===================== */
const allowedOrigins = [
  "http://localhost:3000",
  "https://videocall-webrtc-signaling-server.onrender.com",
  clientUrl
].filter(Boolean);

const io = new Server(server, {
  pingTimeout: 60000,
  pingInterval: 25000,
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

/* ===================== Static ===================== */
app.use(express.static(path.join(__dirname, "public")));

/* ===================== Limits / Validation ===================== */
const LIMITS = {
  ROOM_ID_MAX: 32,
  NICK_MAX: 24,
  MSG_MAX: 1200,
  TOPIC_MAX: 120,
  PASS_MAX: 64,
  WB_MAX_STROKES: 8000,
  WB_EVENT_MAX_BYTES: 8_000,
  MSG_HISTORY_MAX: 100
};

/* ===================== Rate limiting (no deps) ===================== */
const RATE = {
  WINDOW_MS: 4000,
  MAX_CHAT_EVENTS: 20,
  MAX_WB_EVENTS: 120,
  MAX_SIGNAL_EVENTS: 250
};

const rateBucket = new Map(); // socketId -> {t0, chat, wb, sig}

function nowMs() {
  return Date.now();
}
function bucketFor(socket) {
  const id = socket.id;
  const t = nowMs();
  let b = rateBucket.get(id);
  if (!b || (t - b.t0) > RATE.WINDOW_MS) {
    b = { t0: t, chat: 0, wb: 0, sig: 0 };
    rateBucket.set(id, b);
  }
  return b;
}
function allow(socket, type) {
  const b = bucketFor(socket);
  if (type === "chat") return (++b.chat) <= RATE.MAX_CHAT_EVENTS;
  if (type === "wb") return (++b.wb) <= RATE.MAX_WB_EVENTS;
  if (type === "sig") return (++b.sig) <= RATE.MAX_SIGNAL_EVENTS;
  return true;
}

/* ===================== Small helpers ===================== */
function safeStr(v, maxLen) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, maxLen);
}
function normalizeRoomId(roomIdRaw) {
  return safeStr(roomIdRaw, LIMITS.ROOM_ID_MAX).replace("#", "").toLowerCase();
}
function getCleanNick(nickname) {
  return String(nickname || "").replace(/^[@+]+/, "");
}
function getClientIp(socket) {
  const header = socket.handshake.headers["x-forwarded-for"];
  if (header) return header.split(",")[0].trim();
  return socket.handshake.address;
}

/* ===================== Redis ===================== */
const redis = createClient({
  url: REDIS_URL,
  socket: {
    tls: true
  }
});
const redisSub = redis.duplicate();

redis.on("error", (e) => console.error("Redis error:", e));
redisSub.on("error", (e) => console.error("RedisSub error:", e));

const K = {
  roomsIndex: () => "rooms:all",                        // SET roomIds
  roomUsers: (roomId) => `room:${roomId}:users`,        // HASH socketId -> nickname
  userRooms: (socketId) => `user:${socketId}:rooms`,    // SET roomIds
  roomConfig: (roomId) => `room:${roomId}:config`,      // HASH
  roomMessages: (roomId) => `room:${roomId}:messages`,  // LIST json
  roomWB: (roomId) => `room:${roomId}:wb`,              // LIST json
  roomCreator: (roomId) => `room:${roomId}:creator`,    // string (SETNX)
  bannedIPs: () => "banned:ips"                         // SET ip
};

// Safety TTL for room-related keys (auto cleanup of stale data)
const ROOM_TTL_SECONDS = 60 * 60 * 24; // 24h

async function initRedisAndAdapter() {
  await redis.connect();
  await redisSub.connect();
  io.adapter(createAdapter(redis, redisSub));
  console.log("✅ Redis connected + Socket.IO Redis adapter enabled");
}

/* --------------------- Redis state helpers --------------------- */
async function isIpBanned(ip) {
  return await redis.sIsMember(K.bannedIPs(), ip);
}
async function banIp(ip) {
  await redis.sAdd(K.bannedIPs(), ip);
}

async function ensureRoomInIndex(roomId) {
  await redis.sAdd(K.roomsIndex(), roomId);
}

async function getRoomConfig(roomId) {
  const raw = await redis.hGetAll(K.roomConfig(roomId));
  return {
    password: raw.password || "",
    isLocked: raw.isLocked === "1",
    topic: raw.topic || "",
    nameColor: raw.nameColor || "#00b8ff",
    isModerated: raw.isModerated === "1"
  };
}

async function ensureRoomConfig(roomId, initialPassword = "") {
  const key = K.roomConfig(roomId);
  const exists = await redis.exists(key);
  if (!exists) {
    await redis.hSet(key, {
      password: initialPassword || "",
      isLocked: "0",
      topic: "",
      nameColor: "#00b8ff",
      isModerated: "0"
    });
  }
  await redis.expire(key, ROOM_TTL_SECONDS);
}

async function setRoomConfig(roomId, patch) {
  const key = K.roomConfig(roomId);
  const mapped = {};
  if ("password" in patch) mapped.password = patch.password || "";
  if ("isLocked" in patch) mapped.isLocked = patch.isLocked ? "1" : "0";
  if ("topic" in patch) mapped.topic = patch.topic || "";
  if ("nameColor" in patch) mapped.nameColor = patch.nameColor || "#00b8ff";
  if ("isModerated" in patch) mapped.isModerated = patch.isModerated ? "1" : "0";
  await redis.hSet(key, mapped);
  await redis.expire(key, ROOM_TTL_SECONDS);
}

async function addUserToRoom(roomId, socketId, nickname) {
  const usersKey = K.roomUsers(roomId);
  const userRoomsKey = K.userRooms(socketId);
  const p = redis.multi();
  p.hSet(usersKey, socketId, nickname);
  p.sAdd(userRoomsKey, roomId);
  p.expire(usersKey, ROOM_TTL_SECONDS);
  p.expire(userRoomsKey, ROOM_TTL_SECONDS);
  await p.exec();
}

async function removeUserFromRoom(roomId, socketId) {
  const usersKey = K.roomUsers(roomId);
  const userRoomsKey = K.userRooms(socketId);
  const p = redis.multi();
  p.hDel(usersKey, socketId);
  p.sRem(userRoomsKey, roomId);
  await p.exec();
}

async function getRoomUsers(roomId) {
  const users = await redis.hGetAll(K.roomUsers(roomId));
  return Object.entries(users).map(([id, nickname]) => ({ id, nickname }));
}

async function getUserRooms(socketId) {
  return await redis.sMembers(K.userRooms(socketId));
}

async function pushRoomMessage(roomId, msgObj) {
  const key = K.roomMessages(roomId);
  await redis.rPush(key, JSON.stringify(msgObj));
  await redis.lTrim(key, -LIMITS.MSG_HISTORY_MAX, -1);
  await redis.expire(key, ROOM_TTL_SECONDS);
}

async function getRoomMessages(roomId) {
  const key = K.roomMessages(roomId);
  const arr = await redis.lRange(key, 0, -1);
  return arr.map((s) => {
    try { return JSON.parse(s); } catch { return null; }
  }).filter(Boolean);
}

async function pushWB(roomId, stroke) {
  const key = K.roomWB(roomId);
  await redis.rPush(key, JSON.stringify(stroke));
  await redis.lTrim(key, -LIMITS.WB_MAX_STROKES, -1);
  await redis.expire(key, ROOM_TTL_SECONDS);
}

async function getWB(roomId) {
  const key = K.roomWB(roomId);
  const arr = await redis.lRange(key, 0, -1);
  return arr.map((s) => {
    try { return JSON.parse(s); } catch { return null; }
  }).filter(Boolean);
}

async function clearWB(roomId) {
  await redis.del(K.roomWB(roomId));
}

async function undoWB(roomId) {
  await redis.rPop(K.roomWB(roomId));
}

async function deleteRoomIfEmpty(roomId) {
  const usersKey = K.roomUsers(roomId);
  const count = await redis.hLen(usersKey);
  if (count !== 0) return false;

  const p = redis.multi();
  p.del(usersKey);
  p.del(K.roomConfig(roomId));
  p.del(K.roomMessages(roomId));
  p.del(K.roomWB(roomId));
  p.del(K.roomCreator(roomId));
  p.sRem(K.roomsIndex(), roomId);
  await p.exec();
  return true;
}

async function getPublicRoomList() {
  const roomIds = await redis.sMembers(K.roomsIndex());
  if (!roomIds.length) return [];

  const p = redis.multi();
  for (const r of roomIds) {
    p.hLen(K.roomUsers(r));
    p.hGet(K.roomConfig(r), "isLocked");
    p.hGet(K.roomConfig(r), "password");
  }
  const res = await p.exec();

  const list = [];
  for (let i = 0; i < roomIds.length; i++) {
    const roomId = roomIds[i];
    const count = Number(res[i * 3 + 0][1] || 0);
    const isLocked = (res[i * 3 + 1][1] || "0") === "1";
    const password = res[i * 3 + 2][1] || "";
    if (count > 0) {
      list.push({ name: roomId, count, isLocked, hasPass: !!password });
    }
  }
  return list;
}

async function ensureCreatorOp(roomId, cleanNick) {
  // first creator gets @ (SETNX)
  const ok = await redis.setNX(K.roomCreator(roomId), "1");
  if (ok) {
    await redis.expire(K.roomCreator(roomId), ROOM_TTL_SECONDS);
    return "@" + cleanNick;
  }
  return cleanNick;
}

/* ===================== Admin state (per instance) ===================== */
const admins = new Set(); // socket IDs only (ok to be local)
function logToAdmin(message) {
  const time = new Date().toLocaleTimeString();
  const logMsg = `[${time}] ${message}`;
  console.log(logMsg);
  admins.forEach((adminId) => {
    io.to(adminId).emit("admin-log", logMsg);
  });
}
function sendAdminData(adminSocketId) {
  io.to(adminSocketId).emit("admin-data-update", {
    totalUsers: io.engine.clientsCount
    // (optional: you can add more stats by reading redis, but this is kept light)
  });
}

/* ===================== Socket Handlers ===================== */
io.on("connection", (socket) => {
  const clientIp = getClientIp(socket);

  socket.emit("server-instance-id", SERVER_INSTANCE_ID);

  (async () => {
    if (await isIpBanned(clientIp)) {
      socket.emit("kicked-by-admin", "Your IP address has been banned.");
      socket.disconnect(true);
      return;
    }

    logToAdmin(`New connection: ${socket.id} (IP: ${clientIp})`);

    /* ---------- request-room-list ---------- */
    socket.on("request-room-list", async () => {
      socket.emit("server-room-list-update", await getPublicRoomList());
    });

    /* ===================== JOIN ROOM ===================== */
    socket.on("join-room", async (roomIdRaw, nicknameRaw, passwordRaw = "") => {
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return socket.emit("error-message", "Invalid room name.");

      if (await isIpBanned(clientIp)) {
        return socket.emit("error-message", "You are banned.");
      }

      const nicknameInput = safeStr(nicknameRaw, LIMITS.NICK_MAX);
      if (!nicknameInput) return socket.emit("error-message", "Invalid nickname.");

      const password = safeStr(passwordRaw, LIMITS.PASS_MAX);

      await ensureRoomInIndex(roomId);
      await ensureRoomConfig(roomId, password);

      const config = await getRoomConfig(roomId);

      if (config.isLocked) return socket.emit("error-message", "Room locked.");
      if (config.password && config.password !== password) return socket.emit("error-message", "Wrong password.");

      // Already joined this room? return snapshot
      const alreadyNick = await redis.hGet(K.roomUsers(roomId), socket.id);
      if (alreadyNick) {
        const users = await getRoomUsers(roomId);
        const peers = users.filter((u) => u.id !== socket.id).map((u) => ({ id: u.id, nickname: u.nickname }));

        socket.emit(
          "welcome",
          roomId,
          socket.id,
          alreadyNick,
          peers,
          config.topic,
          !!config.password,
          config.nameColor,
          true,
          !!config.isModerated
        );

        socket.emit("room-info-updated", config.topic, !!config.password, false, null, config.nameColor, !!config.isModerated, false);
        socket.emit("update-user-list", roomId, users);
        return;
      }

      // Normalize nickname + creator @ assignment
      let cleanNick = getCleanNick(nicknameInput);
      cleanNick = safeStr(cleanNick, LIMITS.NICK_MAX);
      if (!cleanNick) return socket.emit("error-message", "Invalid nickname.");

      let finalNickname = await ensureCreatorOp(roomId, cleanNick);

      // Ensure nickname uniqueness (within room). If password matches, allow takeover.
      const usersMap = await redis.hGetAll(K.roomUsers(roomId));
      const baseNickname = finalNickname;
      while (true) {
        const existing = Object.entries(usersMap).find(([_, n]) =>
          String(n).toLowerCase().replace(/^[@+]+/, "") === String(finalNickname).toLowerCase().replace(/^[@+]+/, "")
        );
        if (!existing) break;

        const isAuth = (config.password && config.password === password);
        if (isAuth) break;

        const randomNum = Math.floor(Math.random() * 1000) + 1;
        const cleanBase = baseNickname.replace(/^[@+]+/, "");
        finalNickname = `${cleanBase}_${randomNum}`.slice(0, LIMITS.NICK_MAX);
      }

      // If takeover is allowed, remove old socketId entry (best-effort)
      const existingPost = Object.entries(usersMap).find(([_, n]) =>
        String(n).toLowerCase().replace(/^[@+]+/, "") === String(finalNickname).toLowerCase().replace(/^[@+]+/, "")
      );
      if (existingPost) {
        const [oldSocketId, oldNick] = existingPost;
        const isAuth = (config.password && config.password === password);
        if (isAuth) {
          if (String(oldNick).startsWith("@") && !String(finalNickname).startsWith("@")) {
            finalNickname = "@" + finalNickname.replace(/^@/, "");
          }
          await redis.hDel(K.roomUsers(roomId), oldSocketId);
          // also cleanup old user's room set
          await redis.sRem(K.userRooms(oldSocketId), roomId);
        }
      }

      socket.join(roomId);
      await addUserToRoom(roomId, socket.id, finalNickname);

      const users = await getRoomUsers(roomId);
      const peers = users.filter((u) => u.id !== socket.id).map((u) => ({ id: u.id, nickname: u.nickname }));

      socket.to(roomId).emit("peer-joined", roomId, socket.id, finalNickname);

      await pushRoomMessage(roomId, {
        sender: "System",
        text: `${finalNickname} joined.`,
        id: "sys_" + Date.now(),
        timestamp: Date.now(),
        type: "system"
      });

      socket.emit(
        "welcome",
        roomId,
        socket.id,
        finalNickname,
        peers,
        config.topic,
        !!config.password,
        config.nameColor,
        false,
        !!config.isModerated
      );

      // send history + wb history
      socket.emit("chat-history", roomId, await getRoomMessages(roomId));
      const wbHist = await getWB(roomId);
      if (wbHist.length) socket.emit("wb-history", wbHist);

      io.to(roomId).emit("update-user-list", roomId, users);
      io.emit("server-room-list-update", await getPublicRoomList());
    });

    /* ===================== LEAVE ROOM ===================== */
    socket.on("leave-room", async (roomIdRaw) => {
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;

      const nickname = await redis.hGet(K.roomUsers(roomId), socket.id);
      if (nickname) {
        await removeUserFromRoom(roomId, socket.id);

        socket.to(roomId).emit("peer-left", roomId, socket.id, nickname);
        socket.to(roomId).emit("remote-typing-stop", roomId, socket.id);

        io.to(roomId).emit("update-user-list", roomId, await getRoomUsers(roomId));

        await deleteRoomIfEmpty(roomId);
      }

      socket.leave(roomId);
      io.emit("server-room-list-update", await getPublicRoomList());
    });

    /* ===================== COMMANDS / PERMISSIONS ===================== */
    socket.on("command-action", async (roomIdRaw, actionTypeRaw, targetNameRaw) => {
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;
      if (!allow(socket, "chat")) return;

      const senderNick = await redis.hGet(K.roomUsers(roomId), socket.id);
      if (!senderNick) return;

      const actionType = safeStr(actionTypeRaw, 16);
      const targetName = safeStr(targetNameRaw, LIMITS.NICK_MAX);

      let msgText = "";
      if (actionType === "slap") {
        msgText = `* ${senderNick} slaps ${targetName} around a bit with a large trout *`;
      } else {
        return;
      }

      const msgObj = {
        sender: senderNick,
        text: msgText,
        id: "act_" + Date.now(),
        timestamp: Date.now(),
        type: "action"
      };

      await pushRoomMessage(roomId, msgObj);
      io.to(roomId).emit("new-action-message", msgObj);
    });

    async function canOp(roomId) {
      const myNick = await redis.hGet(K.roomUsers(roomId), socket.id);
      return !!myNick && (String(myNick).startsWith("@") || admins.has(socket.id));
    }

    socket.on("command-op", async (roomIdRaw, targetNickRaw) => {
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;

      if (!(await canOp(roomId))) {
        socket.emit("error-message", "You do not have permission to give OP.");
        return;
      }

      const cleanTarget = getCleanNick(safeStr(targetNickRaw, LIMITS.NICK_MAX)).toLowerCase();
      const usersMap = await redis.hGetAll(K.roomUsers(roomId));
      const targetSocketId = Object.keys(usersMap).find((id) =>
        getCleanNick(usersMap[id]).toLowerCase() === cleanTarget
      );

      if (!targetSocketId) return socket.emit("error-message", "User not found.");

      const oldNick = usersMap[targetSocketId];
      if (String(oldNick).startsWith("@")) return socket.emit("error-message", "User is already an operator.");

      const baseNick = getCleanNick(oldNick);
      const newNick = "@" + baseNick;

      await redis.hSet(K.roomUsers(roomId), targetSocketId, newNick);

      io.to(roomId).emit("user-nick-updated", targetSocketId, newNick);
      io.to(roomId).emit("new-message", roomId, "Server", `${baseNick} is now an Operator (+o).`, "sys_" + Date.now());
    });

    socket.on("command-deop", async (roomIdRaw, targetNickRaw) => {
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;

      if (!(await canOp(roomId))) {
        socket.emit("error-message", "You do not have permission to remove OP.");
        return;
      }

      const cleanTarget = getCleanNick(safeStr(targetNickRaw, LIMITS.NICK_MAX)).toLowerCase();
      const usersMap = await redis.hGetAll(K.roomUsers(roomId));
      const targetSocketId = Object.keys(usersMap).find((id) =>
        getCleanNick(usersMap[id]).toLowerCase() === cleanTarget
      );

      if (!targetSocketId) return socket.emit("error-message", "User not found.");

      const oldNick = usersMap[targetSocketId];
      if (!String(oldNick).startsWith("@")) return socket.emit("error-message", "That user is not an operator.");

      const newNick = getCleanNick(oldNick);
      await redis.hSet(K.roomUsers(roomId), targetSocketId, newNick);

      io.to(roomId).emit("user-nick-updated", targetSocketId, newNick);
      io.to(roomId).emit("new-message", roomId, "Server", `${newNick} is no longer an Operator (-o).`, "sys_" + Date.now());
    });

    socket.on("command-voice", async (roomIdRaw, targetNickRaw) => {
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;

      if (!(await canOp(roomId))) return;

      const cleanTarget = getCleanNick(safeStr(targetNickRaw, LIMITS.NICK_MAX)).toLowerCase();
      const usersMap = await redis.hGetAll(K.roomUsers(roomId));
      const targetSocketId = Object.keys(usersMap).find((id) =>
        getCleanNick(usersMap[id]).toLowerCase() === cleanTarget
      );
      if (!targetSocketId) return;

      const oldNick = usersMap[targetSocketId];
      if (String(oldNick).startsWith("@")) return socket.emit("error-message", "User is already an Operator (already has voice).");
      if (String(oldNick).startsWith("+")) return socket.emit("error-message", "User already has voice.");

      const baseNick = getCleanNick(oldNick);
      const newNick = "+" + baseNick;
      await redis.hSet(K.roomUsers(roomId), targetSocketId, newNick);

      io.to(roomId).emit("user-nick-updated", targetSocketId, newNick);
      io.to(roomId).emit("new-message", roomId, "Server", `${baseNick} received voice (+v).`, "sys_" + Date.now());
    });

    socket.on("command-devoice", async (roomIdRaw, targetNickRaw) => {
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;

      if (!(await canOp(roomId))) {
        socket.emit("error-message", "Only operators can manage voice.");
        return;
      }

      const cleanTarget = getCleanNick(safeStr(targetNickRaw, LIMITS.NICK_MAX)).toLowerCase();
      const usersMap = await redis.hGetAll(K.roomUsers(roomId));
      const targetSocketId = Object.keys(usersMap).find((id) =>
        getCleanNick(usersMap[id]).toLowerCase() === cleanTarget
      );
      if (!targetSocketId) return socket.emit("error-message", "User not found.");

      const oldNick = usersMap[targetSocketId];
      if (!String(oldNick).startsWith("+")) return socket.emit("error-message", "User does not have voice status (+).");

      const newNick = getCleanNick(oldNick);
      await redis.hSet(K.roomUsers(roomId), targetSocketId, newNick);

      io.to(roomId).emit("user-nick-updated", targetSocketId, newNick);
      io.to(roomId).emit("new-message", roomId, "Server", `${newNick} lost voice status (-v).`, "sys_" + Date.now());
    });

    socket.on("command-moderate", async (roomIdRaw, stateRaw) => {
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;

      if (!(await canOp(roomId))) {
        socket.emit("error-message", "You do not have OP permissions.");
        return;
      }

      const isNowModerated = (String(stateRaw) === "on");
      const config = await getRoomConfig(roomId);
      if (isNowModerated === !!config.isModerated) return;

      await setRoomConfig(roomId, { isModerated: isNowModerated });

      const updated = await getRoomConfig(roomId);
      io.to(roomId).emit(
        "room-info-updated",
        updated.topic,
        !!updated.password,
        false,
        null,
        updated.nameColor,
        !!updated.isModerated,
        true
      );

      io.to(roomId).emit("room-mode-updated", !!updated.isModerated);
    });

    /* ===================== typing ===================== */
    socket.on("typing-start", (roomIdRaw, nicknameRaw) => {
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;
      const nickname = safeStr(nicknameRaw, LIMITS.NICK_MAX);
      socket.to(roomId).emit("remote-typing-start", roomId, socket.id, nickname);
    });

    socket.on("typing-stop", (roomIdRaw) => {
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;
      socket.to(roomId).emit("remote-typing-stop", roomId, socket.id);
    });

    /* ===================== OP settings ===================== */
    socket.on("op-update-settings", async (roomIdRaw, newTopicRaw, newPasswordRaw, newColorRaw, newIsModerated) => {
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;

      const myNick = await redis.hGet(K.roomUsers(roomId), socket.id);
      if (!myNick || !String(myNick).startsWith("@")) {
        socket.emit("error-message", "You do not have Operator permissions (@).");
        return;
      }

      const newTopic = safeStr(newTopicRaw, LIMITS.TOPIC_MAX);
      const newPassword = safeStr(newPasswordRaw, LIMITS.PASS_MAX);
      const newColor = safeStr(newColorRaw, 32) || "#00b8ff";
      const newModerated = !!newIsModerated;

      const old = await getRoomConfig(roomId);

      await setRoomConfig(roomId, {
        topic: newTopic,
        password: newPassword,
        nameColor: newColor,
        isModerated: newModerated
      });

      const updated = await getRoomConfig(roomId);

      const oldHasPassword = !!old.password;
      const newHasPassword = !!updated.password;
      const topicChanged = (old.topic !== updated.topic);
      const modeChanged = (!!old.isModerated !== !!updated.isModerated);

      let passwordAction = null;
      if (!oldHasPassword && newHasPassword) passwordAction = "added";
      else if (oldHasPassword && !newHasPassword) passwordAction = "removed";

      io.to(roomId).emit(
        "room-info-updated",
        updated.topic,
        newHasPassword,
        topicChanged,
        passwordAction,
        updated.nameColor,
        !!updated.isModerated,
        modeChanged
      );

      socket.emit("op-settings-saved");
      io.emit("server-room-list-update", await getPublicRoomList());
    });

    /* ===================== Global transcription ===================== */
    socket.on("toggle-global-transcription", (roomIdRaw, isActive) => {
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;
      io.to(roomId).emit("global-transcription-status", !!isActive);
    });

    socket.on("global-transcript-chunk", (roomIdRaw, data) => {
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;
      io.to(roomId).emit("receive-global-transcript", data);
    });

    /* ===================== Admin ===================== */
    socket.on("admin-login", (passwordRaw) => {
      const pass = String(passwordRaw ?? "");
      if (pass === ADMIN_PASSWORD) {
        admins.add(socket.id);
        socket.emit("admin-login-success");
        sendAdminData(socket.id);
        logToAdmin(`Admin logged in: ${socket.id}`);
      } else {
        socket.emit("admin-login-fail");
        logToAdmin(`Admin login failed from IP: ${clientIp}`);
      }
    });

    socket.on("admin-ban-ip", async (targetSocketId) => {
      if (!admins.has(socket.id)) return;

      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (!targetSocket) return;

      const targetIp = getClientIp(targetSocket);
      await banIp(targetIp);

      targetSocket.emit("kicked-by-admin", "You have been permanently banned.");
      targetSocket.disconnect(true);

      logToAdmin(`IP BAN Executed on ${targetIp}`);
    });

    socket.on("admin-toggle-lock", async (roomIdRaw) => {
      if (!admins.has(socket.id)) return;
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;

      const conf = await getRoomConfig(roomId);
      await setRoomConfig(roomId, { isLocked: !conf.isLocked });
    });

    socket.on("admin-set-password", async (roomIdRaw, newPassRaw) => {
      if (!admins.has(socket.id)) return;
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;

      await setRoomConfig(roomId, { password: safeStr(newPassRaw, LIMITS.PASS_MAX) });
      io.emit("server-room-list-update", await getPublicRoomList());
    });

    socket.on("admin-kick-user", (targetSocketId) => {
      if (!admins.has(socket.id)) return;
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (!targetSocket) return;

      targetSocket.emit("kicked-by-admin", "Kicked by admin.");
      targetSocket.disconnect(true);
    });

    socket.on("admin-close-room", async (roomIdRaw) => {
      if (!admins.has(socket.id)) return;
      const targetRoomId = normalizeRoomId(roomIdRaw);
      if (!targetRoomId) return;

      io.to(targetRoomId).emit("room-closed-by-admin", targetRoomId);

      // remove all users from the room in redis and clean room keys
      const users = await redis.hGetAll(K.roomUsers(targetRoomId));
      const p = redis.multi();
      for (const sid of Object.keys(users)) {
        p.sRem(K.userRooms(sid), targetRoomId);
      }
      p.del(K.roomUsers(targetRoomId));
      p.del(K.roomConfig(targetRoomId));
      p.del(K.roomMessages(targetRoomId));
      p.del(K.roomWB(targetRoomId));
      p.del(K.roomCreator(targetRoomId));
      p.sRem(K.roomsIndex(), targetRoomId);
      await p.exec();

      io.emit("server-room-list-update", await getPublicRoomList());
    });

    socket.on("admin-refresh", () => {
      if (admins.has(socket.id)) sendAdminData(socket.id);
    });

    /* ===================== Per-user transcription ===================== */
    socket.on("request-transcription", (targetId, requesterId, enable) => {
      io.to(targetId).emit("transcription-request", requesterId, enable);
    });

    socket.on("transcription-result", (targetId, text, isFinal) => {
      io.to(targetId).emit("transcription-data", socket.id, text, isFinal);
    });

    /* ===================== Chat ===================== */
    socket.on("send-message", async (rRaw, sRaw, mRaw, msgIdRaw) => {
      if (!allow(socket, "chat")) return;

      const roomId = normalizeRoomId(rRaw);
      if (!roomId) return;

      const sender = safeStr(sRaw, LIMITS.NICK_MAX + 2);
      const text = safeStr(mRaw, LIMITS.MSG_MAX);
      const finalId = safeStr(msgIdRaw, 64) || Date.now().toString();
      if (!text) return;

      const myNick = await redis.hGet(K.roomUsers(roomId), socket.id);
      if (!myNick) return;

      const config = await getRoomConfig(roomId);
      if (config.isModerated) {
        if (!String(myNick).startsWith("@") && !String(myNick).startsWith("+")) {
          socket.emit("error-message", "Chat in moderated mode (+m). You do not have permission to speak.");
          return;
        }
      }

      const msgObj = {
        sender,
        text,
        id: finalId,
        timestamp: Date.now(),
        type: "public"
      };

      await pushRoomMessage(roomId, msgObj);
      socket.to(roomId).emit("new-message", roomId, sender, text, finalId);
    });

    socket.on("msg-read", (roomIdRaw, messageId, readerNickname) => {
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;
      io.to(roomId).emit("msg-read-update", messageId, readerNickname);
    });

    socket.on("send-private-message", (rRaw, receiverId, sRaw, mRaw) => {
      if (!allow(socket, "chat")) return;
      const sender = safeStr(sRaw, LIMITS.NICK_MAX + 2);
      const text = safeStr(mRaw, LIMITS.MSG_MAX);
      if (!receiverId) return;
      io.to(receiverId).emit("new-private-message", sender, text);
    });

    /* ===================== Whiteboard ===================== */
    socket.on("wb-draw", async (roomIdRaw, data) => {
      if (!allow(socket, "wb")) return;
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;

      const approx = (() => {
        try { return JSON.stringify(data).length; } catch { return 0; }
      })();
      if (approx > LIMITS.WB_EVENT_MAX_BYTES) return;

      await pushWB(roomId, data);
      socket.to(roomId).emit("wb-draw", data);
    });

    socket.on("wb-clear", async (roomIdRaw) => {
      if (!allow(socket, "wb")) return;
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;

      await clearWB(roomId);
      io.to(roomId).emit("wb-clear");
    });

    socket.on("wb-undo", async (roomIdRaw) => {
      if (!allow(socket, "wb")) return;
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;

      await undoWB(roomId);
      io.to(roomId).emit("wb-history", await getWB(roomId));
    });

    socket.on("wb-request-history", async (roomIdRaw) => {
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;

      socket.emit("wb-history", await getWB(roomId));
    });

    /* ===================== WebRTC signaling ===================== */
    socket.on("offer", (id, o) => {
      if (allow(socket, "sig")) io.to(id).emit("offer", socket.id, o);
    });
    socket.on("answer", (id, a) => {
      if (allow(socket, "sig")) io.to(id).emit("answer", socket.id, a);
    });
    socket.on("candidate", (id, c) => {
      if (allow(socket, "sig")) io.to(id).emit("candidate", socket.id, c);
    });

    socket.on("audio-status-changed", (roomIdRaw, t) => {
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;
      socket.to(roomId).emit("audio-status-changed", socket.id, t);
    });

    socket.on("video-status-changed", (roomIdRaw, isEnabled) => {
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;
      socket.to(roomId).emit("remote-video-status-changed", socket.id, !!isEnabled);
    });

    socket.on("stream-type-changed", (roomIdRaw, ratio) => {
      const roomId = normalizeRoomId(roomIdRaw);
      if (!roomId) return;
      socket.to(roomId).emit("remote-stream-type-changed", socket.id, ratio);
    });

    /* ===================== DISCONNECT ===================== */
    socket.on("disconnect", async (reason) => {
      rateBucket.delete(socket.id);
      admins.delete(socket.id);

      try {
        const roomIds = await getUserRooms(socket.id);
        for (const roomId of roomIds) {
          const nickname = await redis.hGet(K.roomUsers(roomId), socket.id);
          await removeUserFromRoom(roomId, socket.id);

          if (nickname) {
            socket.to(roomId).emit("peer-left", roomId, socket.id, nickname);
            socket.to(roomId).emit("remote-typing-stop", roomId, socket.id);
            io.to(roomId).emit("update-user-list", roomId, await getRoomUsers(roomId));
          }

          await deleteRoomIfEmpty(roomId);
        }
        await redis.del(K.userRooms(socket.id));
      } catch (e) {
        console.error("Disconnect cleanup error:", e);
      }

      try {
        io.emit("server-room-list-update", await getPublicRoomList());
      } catch {}

      logToAdmin(`Disconnected: ${socket.id} (${reason || "unknown"})`);
    });
  })().catch((e) => {
    console.error("Connection init error:", e);
    socket.disconnect(true);
  });
});

/* ===================== Start ===================== */
const PORT = process.env.PORT || 3000;

initRedisAndAdapter()
  .then(() => {
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to init Redis:", err);
    process.exit(1);
  });
