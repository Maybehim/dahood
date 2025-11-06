import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.js';
import * as store from '../state/useGameStore.js';

vi.mock('../state/useGameStore.js', async () => {
  const actual = await vi.importActual<typeof store>('../state/useGameStore.js');
  return {
    ...actual,
    useGameStore: (selector: any) =>
      selector({
        connect: vi.fn(),
        room: undefined
      })
  };
});

describe('App', () => {
  it('renders home screen when not in room', () => {
    render(<App />);
    expect(screen.getByText(/Word Imposter/i)).toBeInTheDocument();
  });
});
