import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';
import type { RoomView } from '../types.js';

interface GameState {
  socket?: Socket;
  playerId?: string;
  room?: RoomView;
  secretWord?: string;
  theme: 'light' | 'dark';
  isConnecting: boolean;
  connect: () => void;
  toggleTheme: () => void;
  createRoom: (payload: { name: string; avatar: string; settings?: Record<string, unknown> }) => Promise<void>;
  joinRoom: (payload: { code: string; name: string; avatar: string; spectator?: boolean }) => Promise<void>;
  leaveRoom: () => void;
  startGame: () => Promise<void>;
  submitClue: (clue: string) => Promise<void>;
  submitVote: (suspectId: string | null) => Promise<void>;
  submitImposterGuess: (guess: string) => Promise<void>;
  updateSettings: (changes: Record<string, unknown>) => Promise<void>;
}

export const useGameStore = create<GameState>()(
  devtools((set, get) => ({
    socket: undefined,
    playerId: undefined,
    room: undefined,
    secretWord: undefined,
    theme: 'dark',
    isConnecting: false,
    connect: () => {
      if (get().socket) return;
      set({ isConnecting: true });
      const socket = io('/', {
        autoConnect: false,
        transports: ['websocket'],
        auth: { playerId: get().playerId }
      });
      const setSocket = (value: Partial<GameState> | ((state: GameState) => Partial<GameState>)) =>
        set(value as any);
      socket.on('connection:ready', ({ playerId }) => {
        setSocket({ playerId });
      });
      socket.on('room:state', (room: RoomView) => {
        set((state) => {
          const secretWord = room.round
            ? room.round.word ?? state.secretWord
            : undefined;
          return { room, secretWord };
        });
      });
      socket.on('word:reveal', ({ word }) => {
        setSocket({ secretWord: word });
      });
      socket.on('disconnect', () => {
        setSocket({ room: undefined, secretWord: undefined });
      });
      socket.connect();
      set({ socket, isConnecting: false });
    },
    toggleTheme: () => {
      set((state) => {
        const next = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.classList.toggle('dark', next === 'dark');
        return { theme: next };
      });
    },
    async createRoom(payload) {
      const socket = get().socket ?? (get().connect(), get().socket);
      await waitForSocket(socket);
      return emitAsync(socket!, 'room:create', payload).then((response: any) => {
        if (response?.error) throw new Error(response.error);
        set({ room: response.room, secretWord: undefined });
      });
    },
    async joinRoom(payload) {
      const socket = get().socket ?? (get().connect(), get().socket);
      await waitForSocket(socket);
      return emitAsync(socket!, 'room:join', payload).then((response: any) => {
        if (response?.error) throw new Error(response.error);
        set({ room: response.room, secretWord: undefined });
      });
    },
    leaveRoom() {
      const socket = get().socket;
      if (!socket) return;
      socket.emit('room:leave');
      set({ room: undefined, secretWord: undefined });
    },
    async startGame() {
      const socket = get().socket;
      if (!socket) throw new Error('Not connected');
      const response: any = await emitAsync(socket, 'game:start');
      if (response?.error) throw new Error(response.error);
    },
    async submitClue(clue: string) {
      const socket = get().socket;
      if (!socket) throw new Error('Not connected');
      const response: any = await emitAsync(socket, 'clue:submit', { clue });
      if (response?.error) throw new Error(response.error);
    },
    async submitVote(suspectId: string | null) {
      const socket = get().socket;
      if (!socket) throw new Error('Not connected');
      const response: any = await emitAsync(socket, 'vote:submit', { suspectId });
      if (response?.error) throw new Error(response.error);
    },
    async submitImposterGuess(guess: string) {
      const socket = get().socket;
      if (!socket) throw new Error('Not connected');
      const response: any = await emitAsync(socket, 'imposter:guess', { guess });
      if (response?.error) throw new Error(response.error);
    },
    async updateSettings(changes: Record<string, unknown>) {
      const socket = get().socket;
      if (!socket) throw new Error('Not connected');
      const response: any = await emitAsync(socket, 'settings:update', changes);
      if (response?.error) throw new Error(response.error);
    }
  }))
);

function emitAsync(socket: Socket | undefined, event: string, payload?: unknown) {
  if (!socket) return Promise.reject(new Error('Socket unavailable'));
  return new Promise((resolve) => {
    socket.emit(event, payload ?? {}, resolve);
  });
}

async function waitForSocket(socket?: Socket) {
  if (!socket) throw new Error('Socket not ready');
  if (socket.connected) return;
  await new Promise<void>((resolve) => {
    socket.once('connect', () => resolve());
  });
}
