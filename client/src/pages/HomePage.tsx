import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AvatarPicker } from '../components/AvatarPicker.js';
import { useGameStore } from '../state/useGameStore.js';

export default function HomePage() {
  const { t } = useTranslation();
  const createRoom = useGameStore((state) => state.createRoom);
  const joinRoom = useGameStore((state) => state.joinRoom);
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('astronaut');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [spectator, setSpectator] = useState(false);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createRoom({ name: nickname, avatar });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await joinRoom({ code, name: nickname, avatar, spectator });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 p-6">
      <header className="text-center">
        <h1 className="text-4xl font-black text-primary">{t('title')}</h1>
        <p className="mt-2 text-sm text-slate-300">A real-time party game of suspicion and clever clues.</p>
      </header>

      <section aria-labelledby="nickname-heading" className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <div>
          <h2 id="nickname-heading" className="text-lg font-semibold text-white">
            {t('home.nickname')}
          </h2>
          <p className="text-sm text-slate-400">Pick a name and avatar to represent you in the game.</p>
        </div>
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          <span>Nickname</span>
          <input
            type="text"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 focus:border-primary focus:outline-none"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={20}
            required
          />
        </label>
        <AvatarPicker value={avatar} onChange={setAvatar} />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <form
          aria-label="Create room"
          onSubmit={handleCreate}
          className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-6"
        >
          <h2 className="text-lg font-semibold text-white">{t('home.createRoom')}</h2>
          <p className="text-sm text-slate-400">Start a fresh lobby and invite your friends with a room code.</p>
          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-4 py-3 text-center text-sm font-bold text-white shadow transition hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={!nickname || loading}
          >
            {loading ? 'Starting…' : t('home.createRoom')}
          </button>
        </form>

        <form
          aria-label="Join room"
          onSubmit={handleJoin}
          className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-6"
        >
          <h2 className="text-lg font-semibold text-white">{t('home.joinRoom')}</h2>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span>{t('home.enterCode')}</span>
            <input
              type="text"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 uppercase focus:border-primary focus:outline-none"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              pattern="[A-Z0-9]{4,6}"
              required
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-slate-700 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={!nickname || !code || loading}
          >
            {loading ? 'Joining…' : t('home.joinRoom')}
          </button>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={spectator}
              onChange={(event) => setSpectator(event.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900"
            />
            Join as spectator
          </label>
        </form>
      </section>

      {error && (
        <div role="alert" className="rounded-lg border border-red-500 bg-red-500/20 p-4 text-sm text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
