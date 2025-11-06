import { useEffect, useState } from 'react';

interface Props {
  endsAt: number | null;
  phase: string;
}

export function TimerDisplay({ endsAt, phase }: Props) {
  const [remaining, setRemaining] = useState<number>(calculateRemaining(endsAt));

  useEffect(() => {
    const tick = () => setRemaining(calculateRemaining(endsAt));
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [endsAt]);

  if (!endsAt) return null;

  return (
    <div className="rounded bg-slate-800 px-4 py-2 text-sm font-semibold text-primary">
      {phase} · {Math.max(0, remaining)}s
    </div>
  );
}

function calculateRemaining(endsAt: number | null): number {
  if (!endsAt) return 0;
  return Math.ceil((endsAt - Date.now()) / 1000);
}
