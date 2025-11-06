import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { ClipboardDocumentIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { TimerDisplay } from '../components/TimerDisplay.js';
import { PlayerBadge } from '../components/PlayerBadge.js';
import { useGameStore } from '../state/useGameStore.js';
import type { PlayerView } from '../types.js';

export default function RoomPage() {
  const room = useGameStore((state) => state.room);
  const playerId = useGameStore((state) => state.playerId);
  const toggleTheme = useGameStore((state) => state.toggleTheme);
  const leaveRoom = useGameStore((state) => state.leaveRoom);
  const startGame = useGameStore((state) => state.startGame);
  const updateSettings = useGameStore((state) => state.updateSettings);
  const secretWord = useGameStore((state) => state.secretWord);
  const submitClue = useGameStore((state) => state.submitClue);
  const submitVote = useGameStore((state) => state.submitVote);
  const submitImposterGuess = useGameStore((state) => state.submitImposterGuess);
  const [settingsDraft, setSettingsDraft] = useState<Record<string, unknown>>({});
  const [clue, setClue] = useState('');
  const [vote, setVote] = useState<string | null>(null);
  const [guess, setGuess] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const me = room?.players.find((player) => player.id === playerId);
  const isHost = room?.hostId === playerId;
  const currentWordPacks = Array.isArray(room?.settings.wordPacks)
    ? (room?.settings.wordPacks as string[])
    : [];
  const packOptions = ['General', 'Categories', 'Food', 'Animals', 'Objects', 'Places', 'School', 'Tech', 'Custom'];

  const currentTurnPlayer = useMemo(() => {
    if (!room?.round) return undefined;
    const turnCount = room.round.turnOrder.length;
    const index = room.round.turnIndex % turnCount;
    return room.round.turnOrder[index];
  }, [room?.round]);
  const categoryOptions = ['Food', 'Animals', 'Objects', 'Places', 'School', 'Tech'];
  const selectedWordPacks = Array.isArray(settingsDraft.wordPacks)
    ? (settingsDraft.wordPacks as string[])
    : currentWordPacks;
  const categoryModeSetting = (settingsDraft.categoryMode as string | undefined) ?? (room.settings.categoryMode as string);
  const categoryValueSetting =
    (settingsDraft.categoryValue as string | undefined) ?? ((room.settings as Record<string, unknown>).categoryValue as string | undefined);
  const allowEmojiSetting =
    (settingsDraft.allowEmoji as boolean | undefined) ?? (room.settings.allowEmoji as boolean);
  const allowNumbersSetting =
    (settingsDraft.allowNumbers as boolean | undefined) ?? (room.settings.allowNumbers as boolean);
  const profanityModeSetting =
    (settingsDraft.profanityMode as string | undefined) ?? (room.settings.profanityMode as string);

  if (!room || !me) {
    return null;
  }

  const copyInvite = async () => {
    const link = `${window.location.origin}?room=${room.code}`;
    await navigator.clipboard.writeText(link);
    setFeedback('Invite link copied!');
    setTimeout(() => setFeedback(null), 3000);
  };

  const onStartGame = async () => {
    try {
      await startGame();
    } catch (error) {
      setFeedback((error as Error).message);
    }
  };

  const handleSettingsSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await updateSettings(settingsDraft);
      setFeedback('Settings saved');
    } catch (error) {
      setFeedback((error as Error).message);
    }
  };

  const handleClueSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await submitClue(clue);
      setClue('');
    } catch (error) {
      setFeedback((error as Error).message);
    }
  };

  const handleVoteSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await submitVote(vote);
    } catch (error) {
      setFeedback((error as Error).message);
    }
  };

  const handleGuessSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await submitImposterGuess(guess);
      setGuess('');
    } catch (error) {
      setFeedback((error as Error).message);
    }
  };

  const handlePackUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length || !room) return;
    const file = event.target.files[0];
    setUploading(true);
    try {
      const text = await file.text();
      const response = await fetch(`/rooms/${room.code}/word-pack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Upload failed');
      }
      setFeedback('Custom word pack uploaded');
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const renderPhase = () => {
    switch (room.phase) {
      case 'LOBBY':
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Waiting for the host to start the game. Share the room code with friends!
            </p>
            {isHost && (
              <button
                onClick={onStartGame}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
              >
                Start Game
              </button>
            )}
          </div>
        );
      case 'WORD_REVEAL':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Secret Word</h3>
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-center text-3xl font-black uppercase tracking-wide text-primary">
              {secretWord ?? 'You might be the imposter…'}
            </div>
          </div>
        );
      case 'CLUE_TURN': {
        const isMyTurn = currentTurnPlayer === playerId;
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Clue Round</h3>
            <p className="text-sm text-slate-400">Current speaker: {playerName(room.players, currentTurnPlayer)}</p>
            {isMyTurn ? (
              <form onSubmit={handleClueSubmit} className="flex gap-3" aria-label="Submit clue">
                <input
                  value={clue}
                  onChange={(event) => setClue(event.target.value)}
                  placeholder="Enter a single-word clue"
                  maxLength={20}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 focus:border-primary focus:outline-none"
                  required
                />
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  Submit
                </button>
              </form>
            ) : (
              <p className="text-sm text-slate-400">Waiting for {playerName(room.players, currentTurnPlayer)} to share their clue.</p>
            )}
            <ul className="space-y-2">
              {room.round?.clues.map((entry, index) => (
                <li key={index} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                  <strong>{playerName(room.players, entry.playerId)}:</strong> {entry.clue}
                </li>
              ))}
            </ul>
          </div>
        );
      }
      case 'VOTING':
        return (
          <form onSubmit={handleVoteSubmit} className="space-y-4" aria-label="Vote for the imposter">
            <h3 className="text-lg font-semibold text-white">Vote for the Imposter</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {room.players.map((player) => (
                <PlayerBadge
                  key={player.id}
                  player={player}
                  highlight={vote === player.id}
                  onClick={() => setVote(player.id)}
                />
              ))}
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
              >
                Submit Vote
              </button>
              <button
                type="button"
                onClick={() => setVote(null)}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-primary"
              >
                Abstain
              </button>
            </div>
          </form>
        );
      case 'IMPOSTER_GUESS':
        return room.round?.imposterId === playerId ? (
          <form onSubmit={handleGuessSubmit} className="space-y-4" aria-label="Imposter guess">
            <h3 className="text-lg font-semibold text-white">Final Guess</h3>
            <input
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              placeholder="Guess the secret word"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 focus:border-primary focus:outline-none"
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Submit Guess
            </button>
          </form>
        ) : (
          <p className="text-sm text-slate-300">Waiting for the imposter to guess the secret word…</p>
        );
      case 'RESULTS':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Round Results</h3>
            <p className="text-sm text-slate-300">Secret word: {room.round?.word ?? 'unknown'}</p>
            <p className="text-sm text-slate-300">Imposter: {playerName(room.players, room.round?.imposterId)}</p>
            <h4 className="text-sm font-semibold text-slate-300">Votes</h4>
            <ul className="space-y-2">
              {room.round?.votes.map((vote) => (
                <li key={vote.voterId} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                  {playerName(room.players, vote.voterId)} voted for{' '}
                  {vote.suspectId ? playerName(room.players, vote.suspectId) : 'no one'}
                </li>
              ))}
            </ul>
          </div>
        );
      case 'GAME_SUMMARY':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Final Standings</h3>
            <ol className="space-y-2">
              {room.players
                .slice()
                .sort((a, b) => b.score - a.score)
                .map((player, index) => (
                  <li key={player.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                    <span>
                      {index + 1}. {player.name}
                    </span>
                    <span className="font-semibold text-primary">{player.score}</span>
                  </li>
                ))}
            </ol>
            <button
              type="button"
              onClick={onStartGame}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Play Again
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  const handleSettingChange = (key: string, value: unknown) => {
    setSettingsDraft((draft) => ({ ...draft, [key]: value }));
  };

  const togglePack = (pack: string) => {
    const current = Array.isArray(settingsDraft.wordPacks)
      ? (settingsDraft.wordPacks as string[])
      : currentWordPacks;
    const next = current.includes(pack) ? current.filter((item) => item !== pack) : [...current, pack];
    handleSettingChange('wordPacks', next);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Room {room.code}</h1>
          <p className="text-sm text-slate-400">Share this code: {room.code}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={copyInvite}
            className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-primary"
          >
            <ClipboardDocumentIcon className="h-4 w-4" /> Copy invite
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg border border-slate-700 p-2 text-slate-200 hover:border-primary"
            aria-label="Toggle theme"
          >
            <SunIcon className="hidden h-5 w-5 dark:block" />
            <MoonIcon className="h-5 w-5 dark:hidden" />
          </button>
          <button
            type="button"
            onClick={leaveRoom}
            className="rounded-lg border border-red-600 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-600/20"
          >
            Leave
          </button>
        </div>
      </header>

      {room.round?.timer && <TimerDisplay phase={room.round.timer.phase} endsAt={room.round.timer.endsAt} />}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/80 p-6">
          {renderPhase()}
        </section>

        <aside className="space-y-6">
          <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-6">
            <h2 className="text-lg font-semibold text-white">Players</h2>
            <div className="mt-3 grid gap-3">
              {room.players.map((player) => (
                <PlayerBadge key={player.id} player={player} highlight={player.id === currentTurnPlayer} />
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-6">
            <h2 className="text-lg font-semibold text-white">Spectators</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {room.spectators.length === 0 && <li>No spectators yet.</li>}
              {room.spectators.map((spectator) => (
                <li key={spectator.id}>{spectator.name}</li>
              ))}
            </ul>
          </section>

          {isHost && (
            <form
              onSubmit={handleSettingsSubmit}
              className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/80 p-6"
              aria-label="Host settings"
            >
              <h2 className="text-lg font-semibold text-white">Host Controls</h2>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                <span>Rounds</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  defaultValue={room.settings.rounds as number}
                  onChange={(event) => handleSettingChange('rounds', Number(event.target.value))}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                <span>Clue timer (seconds)</span>
                <input
                  type="number"
                  min={10}
                  max={60}
                  defaultValue={room.settings.clueSeconds as number}
                  onChange={(event) => handleSettingChange('clueSeconds', Number(event.target.value))}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                <span>Vote timer (seconds)</span>
                <input
                  type="number"
                  min={15}
                  max={60}
                  defaultValue={room.settings.voteSeconds as number}
                  onChange={(event) => handleSettingChange('voteSeconds', Number(event.target.value))}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                <span>Clue rounds per player</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  defaultValue={room.settings.clueRounds as number}
                  onChange={(event) => handleSettingChange('clueRounds', Number(event.target.value))}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                />
              </label>
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
                <label className="flex flex-col gap-2">
                  <span>Minimum players</span>
                  <input
                    type="number"
                    min={3}
                    max={12}
                    defaultValue={room.settings.minPlayers as number}
                    onChange={(event) => handleSettingChange('minPlayers', Number(event.target.value))}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span>Maximum players</span>
                  <input
                    type="number"
                    min={3}
                    max={12}
                    defaultValue={room.settings.maxPlayers as number}
                    onChange={(event) => handleSettingChange('maxPlayers', Number(event.target.value))}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  />
                </label>
              </div>
              <div className="grid gap-2 text-sm text-slate-300">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(allowEmojiSetting)}
                    onChange={(event) => handleSettingChange('allowEmoji', event.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                  />
                  Allow emoji clues
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(allowNumbersSetting)}
                    onChange={(event) => handleSettingChange('allowNumbers', event.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                  />
                  Allow numbers in clues
                </label>
              </div>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                <span>Profanity filter</span>
                <select
                  value={profanityModeSetting}
                  onChange={(event) => handleSettingChange('profanityMode', event.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                >
                  <option value="replace">Replace offensive words</option>
                  <option value="block">Block offensive words</option>
                </select>
              </label>
              <fieldset className="space-y-2 text-sm text-slate-300">
                <legend className="font-semibold text-white">Word packs</legend>
                <p className="text-xs text-slate-400">Pick at least one pack to build the secret word pool.</p>
                <div className="grid grid-cols-2 gap-2">
                  {packOptions.map((pack) => (
                    <label key={pack} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedWordPacks.includes(pack)}
                        onChange={() => togglePack(pack)}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                      />
                      {pack}
                    </label>
                  ))}
                </div>
                <label className="flex flex-col gap-2 text-xs text-slate-400">
                  <span>Upload custom CSV (word,category)</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handlePackUpload}
                    disabled={uploading}
                    className="text-sm text-slate-200 file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-white"
                  />
                </label>
              </fieldset>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                <span>Category selection</span>
                <select
                  value={categoryModeSetting}
                  onChange={(event) => handleSettingChange('categoryMode', event.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                >
                  <option value="random">Random category per round</option>
                  <option value="fixed">Use a fixed category</option>
                  <option value="none">Hide categories</option>
                </select>
              </label>
              {categoryModeSetting === 'fixed' && (
                <label className="flex flex-col gap-2 text-sm text-slate-300">
                  <span>Fixed category</span>
                  <select
                    value={categoryValueSetting ?? categoryOptions[0]}
                    onChange={(event) => handleSettingChange('categoryValue', event.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  >
                    {categoryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
              >
                Save Settings
              </button>
            </form>
          )}
        </aside>
      </div>

      {feedback && (
        <div role="status" className="rounded-lg border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-200">
          {feedback}
        </div>
      )}
    </div>
  );
}

function playerName(players: PlayerView[], id?: string) {
  const player = players.find((p) => p.id === id);
  return player ? player.name : 'Unknown';
}
