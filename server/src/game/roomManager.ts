import { EventEmitter } from 'node:events';
import { defaultPackNames, defaultWordPacks } from './wordPacks.js';
import {
  ClueEntry,
  GamePhase,
  Player,
  RoomSettings,
  RoomState,
  RoundState,
  Spectator,
  VoteEntry,
  WordEntry
} from './types.js';
import { ProfanityFilter } from './profanity.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MIN_CODE_LENGTH = 4;
const MAX_CODE_LENGTH = 6;

const DEFAULT_SETTINGS: RoomSettings = {
  rounds: 5,
  clueSeconds: 30,
  voteSeconds: 30,
  allowEmoji: false,
  allowNumbers: false,
  profanityMode: 'replace',
  wordPacks: ['General'],
  categoryMode: 'random',
  categoryValue: undefined,
  clueRounds: 2,
  minPlayers: 3,
  maxPlayers: 12
};

const CATEGORY_CHOICES = ['Food', 'Animals', 'Objects', 'Places', 'School', 'Tech'];

export interface RoomUpdateEvent {
  room: RoomState;
  reason: string;
}

export interface WordRevealEvent {
  roomCode: string;
  word: string;
  category?: string;
  playerIds: string[];
}

export class RoomManager extends EventEmitter {
  private rooms = new Map<string, RoomState>();
  private timers = new Map<string, NodeJS.Timeout>();
  private profanity = new ProfanityFilter();

  createRoom(hostId: string, name: string, avatar: string): RoomState {
    const code = this.generateRoomCode();
    const now = Date.now();
    const player: Player = {
      id: hostId,
      name,
      avatar,
      isHost: true,
      isImposter: false,
      connected: true,
      score: 0
    };
    const room: RoomState = {
      code,
      createdAt: now,
      hostId: hostId,
      players: [player],
      spectators: [],
      settings: { ...DEFAULT_SETTINGS },
      phase: 'LOBBY',
      round: null,
      history: []
    };
    this.rooms.set(code, room);
    this.emitUpdate(room, 'room:create');
    return room;
  }

  joinRoom(
    code: string,
    userId: string,
    name: string,
    avatar: string,
    spectator = false
  ): { room: RoomState; player?: Player; spectator?: Spectator } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) {
      throw new Error('Room not found');
    }

    const existingPlayer = room.players.find((p) => p.id === userId);
    if (existingPlayer) {
      existingPlayer.connected = true;
      existingPlayer.name = name;
      existingPlayer.avatar = avatar;
      this.emitUpdate(room, 'player:reconnect');
      return { room, player: existingPlayer };
    }

    const existingSpectator = room.spectators.find((s) => s.id === userId);
    if (existingSpectator) {
      existingSpectator.connected = true;
      existingSpectator.name = name;
      existingSpectator.avatar = avatar;
      this.emitUpdate(room, 'spectator:reconnect');
      return { room, spectator: existingSpectator };
    }

    if (spectator || room.phase !== 'LOBBY') {
      const newSpectator: Spectator = {
        id: userId,
        name,
        avatar,
        connected: true
      };
      room.spectators.push(newSpectator);
      this.emitUpdate(room, 'spectator:join');
      return { room, spectator: newSpectator };
    }

    if (room.players.length >= room.settings.maxPlayers) {
      throw new Error('Room is full');
    }

    const player: Player = {
      id: userId,
      name,
      avatar,
      isHost: false,
      isImposter: false,
      connected: true,
      score: 0
    };
    room.players.push(player);
    this.emitUpdate(room, 'player:join');
    return { room, player };
  }

  leaveRoom(code: string, userId: string): void {
    const room = this.rooms.get(code);
    if (!room) return;

    const playerIndex = room.players.findIndex((p) => p.id === userId);
    if (playerIndex >= 0) {
      const [player] = room.players.splice(playerIndex, 1);
      if (player.isHost) {
        this.transferHost(room);
      }
      this.emitUpdate(room, 'player:left');
    }

    const spectatorIndex = room.spectators.findIndex((s) => s.id === userId);
    if (spectatorIndex >= 0) {
      room.spectators.splice(spectatorIndex, 1);
      this.emitUpdate(room, 'spectator:left');
    }

    if (room.players.length === 0) {
      this.rooms.delete(code);
      this.clearTimer(code);
    }
  }

  disconnect(roomCode: string, userId: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const player = room.players.find((p) => p.id === userId);
    if (player) {
      player.connected = false;
      if (player.isHost) {
        player.isHost = false;
        this.transferHost(room);
      }
      this.emitUpdate(room, 'player:disconnect');
      return;
    }
    const spectator = room.spectators.find((s) => s.id === userId);
    if (spectator) {
      spectator.connected = false;
      this.emitUpdate(room, 'spectator:disconnect');
    }
  }

  updateSettings(code: string, changes: Partial<RoomSettings>): RoomState {
    const room = this.requireRoom(code);
    room.settings = {
      ...room.settings,
      ...changes,
      clueSeconds: Math.max(10, Math.min(60, changes.clueSeconds ?? room.settings.clueSeconds)),
      voteSeconds: Math.max(15, Math.min(60, changes.voteSeconds ?? room.settings.voteSeconds)),
      rounds: Math.max(1, Math.min(10, changes.rounds ?? room.settings.rounds)),
      clueRounds: Math.max(1, Math.min(5, changes.clueRounds ?? room.settings.clueRounds)),
      minPlayers: Math.max(3, Math.min(12, changes.minPlayers ?? room.settings.minPlayers)),
      maxPlayers: Math.max(3, Math.min(12, changes.maxPlayers ?? room.settings.maxPlayers)),
      categoryValue:
        typeof changes.categoryValue === 'string' && CATEGORY_CHOICES.includes(changes.categoryValue)
          ? changes.categoryValue
          : room.settings.categoryValue
    };
    room.settings.minPlayers = Math.min(room.settings.minPlayers, room.settings.maxPlayers);
    if (Array.isArray(changes.wordPacks)) {
      const cleaned = Array.from(new Set(changes.wordPacks.filter((name): name is string => typeof name === 'string')));
      if (cleaned.length) {
        room.settings.wordPacks = cleaned;
      }
    }
    if (room.settings.categoryMode === 'fixed' && !room.settings.categoryValue) {
      room.settings.categoryValue = CATEGORY_CHOICES[0];
    }
    this.emitUpdate(room, 'settings:update');
    return room;
  }

  applyCustomWordPack(code: string, pack: WordEntry[]): void {
    const room = this.requireRoom(code);
    room.wordPackCustom = pack;
    if (!room.settings.wordPacks.includes('Custom')) {
      room.settings.wordPacks.push('Custom');
    }
    this.emitUpdate(room, 'settings:word-pack');
  }

  startGame(code: string): RoomState {
    const room = this.requireRoom(code);
    if (room.players.length < room.settings.minPlayers) {
      throw new Error('Not enough players');
    }
    room.players.forEach((p) => {
      p.score = 0;
    });
    room.history = [];
    this.beginRound(room, 1);
    return room;
  }

  submitClue(code: string, playerId: string, clue: string): void {
    const room = this.requireRoom(code);
    const round = this.requireRound(room);
    if (room.phase !== 'CLUE_TURN') {
      throw new Error('Not accepting clues now');
    }
    const turnCount = round.turnOrder.length;
    const currentIndex = round.turnIndex % turnCount;
    const currentPlayerId = round.turnOrder[currentIndex];
    if (currentPlayerId !== playerId) {
      throw new Error('Not your turn');
    }
    const normalized = this.normalizeClue(clue, room);
    if (round.clues.some((entry) => entry.clue === normalized)) {
      throw new Error('Clue already used this round');
    }
    round.clues.push({ playerId, clue: normalized });
    this.advanceTurn(room);
  }

  submitVote(code: string, voterId: string, suspectId: string | null): void {
    const room = this.requireRoom(code);
    const round = this.requireRound(room);
    if (room.phase !== 'VOTING') {
      throw new Error('Not voting now');
    }
    if (!round.turnOrder.includes(voterId)) {
      throw new Error('You are not playing this round');
    }
    const existing = round.votes.find((v) => v.voterId === voterId);
    if (existing) {
      existing.suspectId = suspectId;
    } else {
      round.votes.push({ voterId, suspectId });
    }
    if (round.votes.length === round.turnOrder.length || this.allVotesPresent(round)) {
      round.votingComplete = true;
      this.evaluateVotes(room);
    }
    this.emitUpdate(room, 'vote:update');
  }

  submitImposterGuess(code: string, playerId: string, guess: string): void {
    const room = this.requireRoom(code);
    const round = this.requireRound(room);
    if (room.phase !== 'IMPOSTER_GUESS') {
      throw new Error('Not time for guessing');
    }
    if (round.imposterId !== playerId) {
      throw new Error('Only the imposter can guess');
    }
    round.imposterGuess = guess.trim().toLowerCase();
    const correct = round.word?.toLowerCase() === round.imposterGuess;
    round.imposterWin = correct;
    if (correct) {
      const imposter = room.players.find((p) => p.id === round.imposterId);
      if (imposter) imposter.score += 2;
    } else {
      round.imposterWin = false;
      this.awardKnowerPoints(room);
    }
    this.transitionPhase(room, 'RESULTS');
  }

  forceAdvance(code: string): void {
    const room = this.requireRoom(code);
    switch (room.phase) {
      case 'WORD_REVEAL':
        this.transitionPhase(room, 'CLUE_TURN');
        break;
      case 'CLUE_TURN':
        this.advanceTurn(room, true);
        break;
      case 'VOTING':
        this.evaluateVotes(room);
        break;
      case 'IMPOSTER_GUESS':
        this.transitionPhase(room, 'RESULTS');
        break;
      case 'RESULTS':
        this.finishRound(room);
        break;
    }
  }

  getRoom(code: string): RoomState | undefined {
    return this.rooms.get(code);
  }

  private generateRoomCode(): string {
    let length = MIN_CODE_LENGTH;
    while (length <= MAX_CODE_LENGTH) {
      const code = Array.from({ length })
        .map(() => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)])
        .join('');
      if (!this.rooms.has(code)) return code;
      length++;
    }
    throw new Error('Unable to allocate room code');
  }

  private requireRoom(code: string): RoomState {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Room not found');
    return room;
  }

  private requireRound(room: RoomState): RoundState {
    if (!room.round) throw new Error('Round not initialised');
    return room.round;
  }

  private beginRound(room: RoomState, roundNumber: number): void {
    room.history = room.history || [];
    room.phase = 'WORD_REVEAL';
    const packWords = this.selectWords(room);
    const category = packWords.category;
    const word = packWords.word.word;
    const playersInRound = this.shuffle(room.players.filter((p) => p.connected));
    const imposterIndex = Math.floor(Math.random() * playersInRound.length);
    const imposterId = playersInRound[imposterIndex].id;
    room.players.forEach((p) => {
      p.isImposter = p.id === imposterId;
    });
    const round: RoundState = {
      roundNumber,
      word,
      category,
      imposterId,
      turnOrder: playersInRound.map((p) => p.id),
      turnIndex: 0,
      clues: [],
      votes: [],
      timer: { phase: 'WORD_REVEAL', endsAt: null },
      votingComplete: false,
      imposterWin: null
    };
    room.round = round;
    this.scheduleTimer(room, room.settings.clueSeconds * 1000, () => {
      this.transitionPhase(room, 'CLUE_TURN');
    });
    this.emitWordReveal(room, word, category);
    this.emitUpdate(room, 'round:begin');
  }

  private transitionPhase(room: RoomState, phase: GamePhase): void {
    if (!room.round) return;
    room.phase = phase;
    room.round.timer = { phase, endsAt: null };
    this.clearTimer(room.code);
    switch (phase) {
      case 'CLUE_TURN': {
        room.round.turnIndex = 0;
        this.scheduleTimer(room, room.settings.clueSeconds * 1000, () => this.advanceTurn(room, true));
        break;
      }
      case 'VOTING': {
        this.scheduleTimer(room, room.settings.voteSeconds * 1000, () => this.evaluateVotes(room));
        break;
      }
      case 'IMPOSTER_GUESS': {
        this.scheduleTimer(room, room.settings.voteSeconds * 1000, () => this.transitionPhase(room, 'RESULTS'));
        break;
      }
      case 'RESULTS': {
        this.scheduleTimer(room, 8000, () => this.finishRound(room));
        break;
      }
      case 'GAME_SUMMARY':
        this.clearTimer(room.code);
        break;
      case 'WORD_REVEAL': {
        this.scheduleTimer(room, room.settings.clueSeconds * 1000, () => this.transitionPhase(room, 'CLUE_TURN'));
        this.emitWordReveal(room, room.round.word ?? '', room.round.category);
        break;
      }
    }
    this.emitUpdate(room, `phase:${phase.toLowerCase()}`);
  }

  private advanceTurn(room: RoomState, timeout = false): void {
    const round = this.requireRound(room);
    if (room.phase !== 'CLUE_TURN') return;
    if (timeout) {
      const skipIndex = round.turnIndex % round.turnOrder.length;
      round.clues.push({ playerId: round.turnOrder[skipIndex], clue: '(skipped)' });
    }
    round.turnIndex += 1;
    if (round.turnIndex >= round.turnOrder.length * room.settings.clueRounds) {
      this.transitionPhase(room, 'VOTING');
      return;
    }
    this.scheduleTimer(room, room.settings.clueSeconds * 1000, () => this.advanceTurn(room, true));
    this.emitUpdate(room, 'turn:advance');
  }

  private evaluateVotes(room: RoomState): void {
    const round = this.requireRound(room);
    if (room.phase !== 'VOTING') return;
    const voteTally = new Map<string, number>();
    for (const vote of round.votes) {
      if (!vote.suspectId) continue;
      voteTally.set(vote.suspectId, (voteTally.get(vote.suspectId) ?? 0) + 1);
    }
    const sorted = Array.from(voteTally.entries()).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
      round.imposterWin = true;
      const imposter = room.players.find((p) => p.id === round.imposterId);
      if (imposter) imposter.score += 2;
      this.transitionPhase(room, 'RESULTS');
      return;
    }
    const [topSuspect, topVotes] = sorted[0];
    const ties = sorted.filter(([, count]) => count === topVotes);
    if (ties.length > 1) {
      round.imposterWin = true;
      const imposter = room.players.find((p) => p.id === round.imposterId);
      if (imposter) imposter.score += 2;
      this.transitionPhase(room, 'RESULTS');
      return;
    }
    const imposterChosen = topSuspect === round.imposterId;
    if (!imposterChosen) {
      round.imposterWin = true;
      const imposter = room.players.find((p) => p.id === round.imposterId);
      if (imposter) imposter.score += 2;
      this.transitionPhase(room, 'RESULTS');
      return;
    }
    this.transitionPhase(room, 'IMPOSTER_GUESS');
  }

  private finishRound(room: RoomState): void {
    const round = this.requireRound(room);
    room.history.push({ ...round });
    const nextRoundNumber = round.roundNumber + 1;
    if (nextRoundNumber > room.settings.rounds) {
      room.phase = 'GAME_SUMMARY';
      room.round = null;
      this.emitUpdate(room, 'game:summary');
      return;
    }
    this.beginRound(room, nextRoundNumber);
  }

  private allVotesPresent(round: RoundState): boolean {
    return round.votes.every((vote) => vote.suspectId !== undefined);
  }

  private selectWords(room: RoomState): { word: WordEntry; category?: string } {
    const packNames = room.settings.wordPacks.filter((name) =>
      name === 'Custom' ? room.wordPackCustom?.length : defaultPackNames.includes(name)
    );
    const availablePacks = packNames.length ? packNames : ['General'];
    const chosenPack = this.pick(availablePacks);
    const words = chosenPack === 'Custom' ? room.wordPackCustom ?? [] : defaultWordPacks[chosenPack];
    const categoryFilter =
      room.settings.categoryMode === 'fixed'
        ? room.settings.categoryValue && CATEGORY_CHOICES.includes(room.settings.categoryValue)
          ? room.settings.categoryValue
          : CATEGORY_CHOICES[0]
        : undefined;
    const candidates = categoryFilter ? words.filter((entry) => entry.category === categoryFilter) : words;
    const pool = candidates.length ? candidates : words;
    const wordEntry = this.pick(pool);
    const category =
      room.settings.categoryMode === 'none'
        ? undefined
        : room.settings.categoryMode === 'fixed'
          ? categoryFilter ?? wordEntry.category
          : wordEntry.category;
    return { word: wordEntry, category };
  }

  private shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  private pick<T>(items: T[]): T {
    if (!items.length) {
      throw new Error('No items to choose from');
    }
    return items[Math.floor(Math.random() * items.length)];
  }

  private scheduleTimer(room: RoomState, durationMs: number, cb: () => void): void {
    this.clearTimer(room.code);
    const endsAt = Date.now() + durationMs;
    if (room.round) {
      room.round.timer = { phase: room.phase, endsAt };
    }
    const handle = setTimeout(() => {
      this.clearTimer(room.code);
      cb();
    }, durationMs);
    this.timers.set(room.code, handle);
  }

  private clearTimer(code: string): void {
    const existing = this.timers.get(code);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(code);
    }
  }

  private normalizeClue(clue: string, room: RoomState): string {
    let normalized = clue.trim().toLowerCase();
    if (!room.settings.allowEmoji) {
      normalized = normalized.replace(/[\p{Emoji}\p{Extended_Pictographic}]/gu, '');
    }
    const emojiClass = room.settings.allowEmoji ? '\\p{Emoji}\\p{Extended_Pictographic}' : '';
    const patternSource = room.settings.allowNumbers
      ? `[^a-z0-9'\\-\\s${emojiClass}]`
      : `[^a-z'\\-\\s${emojiClass}]`;
    const pattern = new RegExp(patternSource, 'giu');
    normalized = normalized.replace(pattern, '');
    normalized = normalized.replace(/\s+/g, ' ');
    if (normalized.includes(' ')) {
      throw new Error('Clue must be a single word');
    }
    if (normalized.length < 2 || normalized.length > 20) {
      throw new Error('Clue must be 2-20 characters');
    }
    const filtered = this.profanity.filter(normalized, room.settings.profanityMode);
    return filtered;
  }

  private awardKnowerPoints(room: RoomState): void {
    const round = this.requireRound(room);
    room.players.forEach((player) => {
      if (!player.isImposter) {
        player.score += 2;
      }
    });
    round.votes.forEach((vote) => {
      if (vote.suspectId === round.imposterId) {
        const voter = room.players.find((p) => p.id === vote.voterId);
        if (voter) {
          voter.score += 1;
        }
      }
    });
  }

  private transferHost(room: RoomState): void {
    const nextHost = room.players.find((p) => p.connected);
    if (!nextHost) {
      room.hostId = null;
      return;
    }
    room.hostId = nextHost.id;
    nextHost.isHost = true;
    this.emitUpdate(room, 'host:transfer');
  }

  private emitUpdate(room: RoomState, reason: string): void {
    this.emit('room:update', { room, reason });
  }

  private emitWordReveal(room: RoomState, word: string, category?: string): void {
    const knowers = room.players.filter((p) => !p.isImposter).map((p) => p.id);
    this.emit('word:reveal', { roomCode: room.code, word, category, playerIds: knowers });
  }
}
