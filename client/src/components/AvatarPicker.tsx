import { useState } from 'react';
import clsx from 'clsx';

const AVATARS = ['astronaut', 'robot', 'ninja', 'wizard', 'pirate', 'alien'];

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function AvatarPicker({ value, onChange }: Props) {
  const [focused, setFocused] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap gap-3" role="listbox" aria-label="Choose an avatar">
      {AVATARS.map((avatar) => (
        <button
          key={avatar}
          type="button"
          role="option"
          aria-selected={value === avatar}
          onFocus={() => setFocused(avatar)}
          onBlur={() => setFocused(null)}
          onClick={() => onChange(avatar)}
          className={clsx(
            'rounded-full border px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2',
            value === avatar
              ? 'border-primary bg-primary/20 text-white'
              : 'border-slate-600 bg-slate-800 text-slate-200 hover:border-primary',
            focused === avatar && 'ring-2 ring-primary'
          )}
        >
          {avatar}
        </button>
      ))}
    </div>
  );
}
