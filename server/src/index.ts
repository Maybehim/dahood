import http from 'node:http';
import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { Server, Socket } from 'socket.io';
import { RoomManager } from './game/roomManager.js';
import { RoomState } from './game/types.js';
import { parseCsvWordPack } from './routes/wordUpload.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const manager = new RoomManager();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/rooms/:code/word-pack', (req, res) => {
  try {
    const csv = String(req.body.csv ?? '');
    if (!csv.trim()) {
      res.status(400).json({ error: 'CSV required' });
      return;
    }
    const pack = parseCsvWordPack(csv);
    manager.applyCustomWordPack(req.params.code.toUpperCase(), pack);
    res.json({ success: true, count: pack.length });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

interface ClientMeta {
  playerId: string;
  roomCode?: string;
}

const socketMeta = new Map<string, ClientMeta>();
const playerSockets = new Map<string, Set<string>>();
const rateLimits = new Map<string, Record<string, number>>();

function checkRateLimit(socketId: string, action: string, windowMs: number) {
  const now = Date.now();
  const entry = rateLimits.get(socketId) ?? {};
  const last = entry[action] ?? 0;
  if (now - last < windowMs) {
    throw new Error('Too many requests, slow down');
  }
  entry[action] = now;
  rateLimits.set(socketId, entry);
}

function trackSocket(socket: Socket, playerId: string): void {
  socketMeta.set(socket.id, { playerId });
  if (!playerSockets.has(playerId)) {
    playerSockets.set(playerId, new Set());
  }
  playerSockets.get(playerId)!.add(socket.id);
}

function untrackSocket(socketId: string): void {
  const meta = socketMeta.get(socketId);
  if (!meta) return;
  const set = playerSockets.get(meta.playerId);
  if (set) {
    set.delete(socketId);
    if (set.size === 0) {
      playerSockets.delete(meta.playerId);
    }
  }
  socketMeta.delete(socketId);
}

function setRoomForSocket(socket: Socket, roomCode: string): void {
  const meta = socketMeta.get(socket.id);
  if (!meta) return;
  meta.roomCode = roomCode;
  socketMeta.set(socket.id, meta);
  socket.join(roomCode);
}

function leaveRoom(socket: Socket): void {
  const meta = socketMeta.get(socket.id);
  if (!meta?.roomCode) return;
  socket.leave(meta.roomCode);
  manager.leaveRoom(meta.roomCode, meta.playerId);
  meta.roomCode = undefined;
  socketMeta.set(socket.id, meta);
}

function broadcastRoom(room: RoomState): void {
  for (const [socketId, meta] of socketMeta.entries()) {
    if (meta.roomCode !== room.code) continue;
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;
    socket.emit('room:state', serializeRoom(room, meta.playerId));
  }
}

manager.on('room:update', ({ room }) => {
  broadcastRoom(room);
});

manager.on('word:reveal', ({ roomCode, word, category, playerIds }) => {
  for (const playerId of playerIds) {
    const sockets = playerSockets.get(playerId);
    if (!sockets) continue;
    for (const socketId of sockets) {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) continue;
      const meta = socketMeta.get(socketId);
      if (meta?.roomCode !== roomCode) continue;
      socket.emit('word:reveal', { word, category });
    }
  }
});

io.on('connection', (socket) => {
  const authPlayerId = typeof socket.handshake.auth?.playerId === 'string'
    ? socket.handshake.auth.playerId
    : undefined;
  const playerId = authPlayerId ?? randomUUID();
  trackSocket(socket, playerId);

  socket.emit('connection:ready', { playerId });

  socket.on('disconnect', () => {
    const meta = socketMeta.get(socket.id);
    if (meta?.roomCode) {
      manager.disconnect(meta.roomCode, meta.playerId);
    }
    untrackSocket(socket.id);
  });

  socket.on('room:create', ({ name, avatar, settings }, callback) => {
    try {
      if (!name || typeof name !== 'string') throw new Error('Name required');
      if (!avatar || typeof avatar !== 'string') throw new Error('Avatar required');
      const room = manager.createRoom(playerId, name, avatar);
      if (settings) {
        manager.updateSettings(room.code, settings);
      }
      setRoomForSocket(socket, room.code);
      callback?.({ room: serializeRoom(room, playerId) });
    } catch (error) {
      callback?.({ error: (error as Error).message });
    }
  });

  socket.on('room:join', ({ code, name, avatar, spectator }, callback) => {
    try {
      if (!code || typeof code !== 'string') throw new Error('Room code required');
      if (!name || typeof name !== 'string') throw new Error('Name required');
      if (!avatar || typeof avatar !== 'string') throw new Error('Avatar required');
      const { room } = manager.joinRoom(code.toUpperCase(), playerId, name, avatar, spectator);
      setRoomForSocket(socket, room.code);
      callback?.({ room: serializeRoom(room, playerId) });
    } catch (error) {
      callback?.({ error: (error as Error).message });
    }
  });

  socket.on('room:leave', () => {
    leaveRoom(socket);
  });

  socket.on('settings:update', (changes, callback) => {
    try {
      const meta = socketMeta.get(socket.id);
      if (!meta?.roomCode) throw new Error('Not in a room');
      const room = manager.getRoom(meta.roomCode);
      if (!room) throw new Error('Room missing');
      if (room.hostId !== meta.playerId) throw new Error('Only host can update settings');
      manager.updateSettings(meta.roomCode, changes ?? {});
      callback?.({ success: true });
    } catch (error) {
      callback?.({ error: (error as Error).message });
    }
  });

  socket.on('game:start', (callback) => {
    try {
      const meta = socketMeta.get(socket.id);
      if (!meta?.roomCode) throw new Error('Not in room');
      const room = manager.getRoom(meta.roomCode);
      if (!room) throw new Error('Room missing');
      if (room.hostId !== meta.playerId) throw new Error('Only host can start');
      manager.startGame(meta.roomCode);
      callback?.({ success: true });
    } catch (error) {
      callback?.({ error: (error as Error).message });
    }
  });

  socket.on('game:nextState', () => {
    const meta = socketMeta.get(socket.id);
    if (!meta?.roomCode) return;
    const room = manager.getRoom(meta.roomCode);
    if (!room || room.hostId !== meta.playerId) return;
    manager.forceAdvance(meta.roomCode);
  });

  socket.on('clue:submit', ({ clue }, callback) => {
    const meta = socketMeta.get(socket.id);
    if (!meta?.roomCode) {
      callback?.({ error: 'Not in room' });
      return;
    }
    try {
      checkRateLimit(socket.id, 'clue', 1000);
      manager.submitClue(meta.roomCode, meta.playerId, clue);
      callback?.({ success: true });
    } catch (error) {
      callback?.({ error: (error as Error).message });
    }
  });

  socket.on('vote:submit', ({ suspectId }, callback) => {
    const meta = socketMeta.get(socket.id);
    if (!meta?.roomCode) {
      callback?.({ error: 'Not in room' });
      return;
    }
    try {
      checkRateLimit(socket.id, 'vote', 1000);
      manager.submitVote(meta.roomCode, meta.playerId, suspectId ?? null);
      callback?.({ success: true });
    } catch (error) {
      callback?.({ error: (error as Error).message });
    }
  });

  socket.on('imposter:guess', ({ guess }, callback) => {
    const meta = socketMeta.get(socket.id);
    if (!meta?.roomCode) {
      callback?.({ error: 'Not in room' });
      return;
    }
    try {
      checkRateLimit(socket.id, 'guess', 1000);
      manager.submitImposterGuess(meta.roomCode, meta.playerId, guess ?? '');
      callback?.({ success: true });
    } catch (error) {
      callback?.({ error: (error as Error).message });
    }
  });
});

function serializeRoom(room: RoomState, viewerId?: string) {
  const viewer = room.players.find((p) => p.id === viewerId);
  const canSeeWord = room.phase === 'RESULTS' || room.phase === 'GAME_SUMMARY' || (viewer && !viewer.isImposter);
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    settings: room.settings,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      isHost: player.isHost,
      connected: player.connected,
      score: player.score
    })),
    spectators: room.spectators.map((s) => ({
      id: s.id,
      name: s.name,
      avatar: s.avatar,
      connected: s.connected
    })),
    round: room.round
      ? {
          roundNumber: room.round.roundNumber,
          category: room.round.category,
          imposterId: canSeeWord ? room.round.imposterId : undefined,
          clues: room.round.clues,
          votes: room.round.votingComplete ? room.round.votes : [],
          timer: room.round.timer,
          turnOrder: room.round.turnOrder,
          turnIndex: room.round.turnIndex,
          word: canSeeWord ? room.round.word : undefined,
          imposterGuess: room.round.imposterGuess,
          imposterWin: room.round.imposterWin
        }
      : null,
    history: room.history.map((round) => ({
      roundNumber: round.roundNumber,
      word: round.word,
      category: round.category,
      imposterId: round.imposterId,
      clues: round.clues,
      votes: round.votes,
      imposterGuess: round.imposterGuess,
      imposterWin: round.imposterWin
    }))
  };
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
server.listen(PORT, () => {
  console.log(`Word Imposter server listening on ${PORT}`);
});
