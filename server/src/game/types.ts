export type GamePhase =
  | 'LOBBY'
  | 'WORD_REVEAL'
  | 'CLUE_TURN'
  | 'VOTING'
  | 'IMPOSTER_GUESS'
  | 'RESULTS'
  | 'GAME_SUMMARY';

export interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isImposter: boolean;
  connected: boolean;
  score: number;
}

export interface Spectator {
  id: string;
  name: string;
  avatar: string;
  connected: boolean;
}

export interface RoomSettings {
  rounds: number;
  clueSeconds: number;
  voteSeconds: number;
  allowEmoji: boolean;
  allowNumbers: boolean;
  profanityMode: 'replace' | 'block';
  wordPacks: string[];
  categoryMode: 'random' | 'fixed' | 'none';
  categoryValue?: string;
  clueRounds: number;
  minPlayers: number;
  maxPlayers: number;
}

export interface ClueEntry {
  playerId: string;
  clue: string;
}

export interface VoteEntry {
  voterId: string;
  suspectId: string | null;
}

export interface TimerInfo {
  phase: GamePhase;
  endsAt: number | null;
}

export interface RoundState {
  roundNumber: number;
  word?: string;
  category?: string;
  imposterId?: string;
  turnOrder: string[];
  turnIndex: number;
  clues: ClueEntry[];
  votes: VoteEntry[];
  timer: TimerInfo;
  votingComplete: boolean;
  imposterGuess?: string;
  imposterWin: boolean | null;
}

export interface RoomState {
  code: string;
  createdAt: number;
  hostId: string | null;
  players: Player[];
  spectators: Spectator[];
  settings: RoomSettings;
  phase: GamePhase;
  round: RoundState | null;
  history: RoundState[];
  wordPackCustom?: WordEntry[];
}

export interface WordEntry {
  word: string;
  category: string;
}

export interface ServerConfig {
  clueSkipGraceMs: number;
  disconnectGraceMs: number;
}
