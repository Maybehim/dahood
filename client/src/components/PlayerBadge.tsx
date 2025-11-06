import clsx from 'clsx';
import type { PlayerView } from '../types.js';

interface Props {
  player: PlayerView;
  highlight?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export function PlayerBadge({ player, highlight, onClick, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition focus:outline-none focus:ring-2',
        highlight
          ? 'border-primary bg-primary/20 text-white'
          : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-primary',
        disabled && 'opacity-50'
      )}
    >
      <span className="flex items-center gap-3">
        <span className="text-xl" aria-hidden>
          {emojiForAvatar(player.avatar)}
        </span>
        <span>
          <span className="block text-sm font-semibold">{player.name}</span>
          <span className="block text-xs text-slate-400">{player.connected ? 'Online' : 'Disconnected'}</span>
        </span>
      </span>
      <span className="text-sm font-bold text-primary">{player.score}</span>
    </button>
  );
}

function emojiForAvatar(avatar: string) {
  switch (avatar) {
    case 'robot':
      return '🤖';
    case 'ninja':
      return '🥷';
    case 'wizard':
      return '🧙';
    case 'pirate':
      return '🏴‍☠️';
    case 'alien':
      return '👽';
    default:
      return '👩‍🚀';
  }
}
