export interface PlayerView {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  connected: boolean;
  score: number;
}

export interface SpectatorView {
  id: string;
  name: string;
  avatar: string;
  connected: boolean;
}

export interface RoundView {
  roundNumber: number;
  category?: string;
  imposterId?: string;
  clues: { playerId: string; clue: string }[];
  votes: { voterId: string; suspectId: string | null }[];
  timer: { phase: string; endsAt: number | null };
  turnOrder: string[];
  turnIndex: number;
  word?: string;
  imposterGuess?: string;
  imposterWin: boolean | null;
}

export interface RoomView {
  code: string;
  hostId: string | null;
  phase: string;
  settings: Record<string, unknown>;
  players: PlayerView[];
  spectators: SpectatorView[];
  round: RoundView | null;
  history: RoundView[];
}
