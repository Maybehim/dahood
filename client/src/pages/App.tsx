import { useEffect } from 'react';
import HomePage from './HomePage.js';
import RoomPage from './RoomPage.js';
import { useGameStore } from '../state/useGameStore.js';

export default function App() {
  const connect = useGameStore((state) => state.connect);
  const room = useGameStore((state) => state.room);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', true);
  }, []);

  return <div className="min-h-screen bg-slate-950 text-slate-50">{room ? <RoomPage /> : <HomePage />}</div>;
}
