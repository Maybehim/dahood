# Word Imposter

Word Imposter is a real-time, browser-based party game for 3–12 players. One player is secretly the imposter and must deduce the hidden word while the rest of the table works together to expose them with clever single-word clues.

## Features

- Lobby-based multiplayer with create/join flows and shareable invite links
- Host configuration for round length, timers, profanity controls, and word packs
- Real-time Socket.IO gameplay with authoritative server state and reconnection handling
- Responsive React UI with accessibility-first interactions, keyboard support, and dark theme
- 300+ curated words across six categories with CSV import for custom packs
- Persistent scoring, animated timers, and clear round/game summaries
- Comprehensive Docker + npm scripts for local development, build, and testing

## Getting Started

### Prerequisites

- Node.js 20+
- npm 9+

### Install dependencies

```bash
npm install
```

> **Note:** If you are working behind a strict proxy you may need to configure npm mirrors for dependency downloads.

### Development server

Runs both the API server (port 4000) and Vite client (port 3000) concurrently.

```bash
npm run dev
```

Open `http://localhost:3000` in multiple browser windows to simulate a full table.

### Tests

- Client unit tests (Vitest + Testing Library)
- Server unit tests (Vitest)

```bash
npm test
```

### Production build

```bash
npm run build
```

- Client assets are emitted to `client/dist`
- Server bundle is emitted to `server/dist`

### Docker

Build and run everything in a single container using Docker Compose:

```bash
docker-compose up --build
```

This will expose the game client on port 3000 and the Socket.IO/Express server on port 4000.

## Configuration

Environment variables (optional):

- `PORT` – API server port (defaults to `4000`). The client proxies WebSocket traffic to this port.

## Project Structure

```
client/   # React + Vite front-end
server/   # Express + Socket.IO back-end
server/words/default.csv  # Seeded word lists
```

Key scripts:

- `npm run dev` – run client and server in watch mode
- `npm run build` – compile both workspaces
- `npm run test` – execute unit and integration suites

## Accessibility & Internationalization

- Keyboard navigable UI with focus outlines and ARIA annotations
- Color-contrast compliant Tailwind theme with light/dark toggle
- i18next scaffold (`client/src/i18n`) for future locale expansion

## License

MIT © 2024 Word Imposter Contributors
