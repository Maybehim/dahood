import { describe, expect, it } from 'vitest';
import { RoomManager } from '../src/game/roomManager.js';

const AVATAR = 'astronaut';

describe('RoomManager', () => {
  it('creates and starts a game', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('host', 'Host', AVATAR);
    manager.joinRoom(room.code, 'p2', 'Player 2', AVATAR, false);
    manager.joinRoom(room.code, 'p3', 'Player 3', AVATAR, false);
    expect(room.players).toHaveLength(3);
    manager.startGame(room.code);
    const started = manager.getRoom(room.code);
    expect(started?.phase).toBe('WORD_REVEAL');
    expect(started?.round?.turnOrder.length).toBeGreaterThan(0);
  });

  it('awards imposter when votes fail', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('host', 'Host', AVATAR);
    manager.joinRoom(room.code, 'p2', 'Player 2', AVATAR, false);
    manager.joinRoom(room.code, 'p3', 'Player 3', AVATAR, false);
    manager.startGame(room.code);
    const current = manager.getRoom(room.code)!;
    current.phase = 'VOTING';
    current.round!.imposterId = current.round!.turnOrder[0];
    manager.submitVote(room.code, current.round!.turnOrder[1], current.round!.turnOrder[2]);
    manager.submitVote(room.code, current.round!.turnOrder[2], current.round!.turnOrder[1]);
    expect(current.round!.imposterWin).toBe(true);
  });
});
