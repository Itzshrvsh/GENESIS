# Whiteboard – Collaborative Real‑Time Drawing App

## Overview

**Whiteboard** is a minimal collaborative whiteboard application that lets multiple users draw together in real time. The project combines a **React + TypeScript** frontend with a **Node.js (Express) + Socket.IO** backend to handle drawing events, board management, and user presence.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Vite, Socket.IO client |
| Backend | Node.js, Express, TypeScript, Socket.IO server |
| Communication | WebSockets (Socket.IO) |
| Build / Run | npm scripts, Vite (frontend), ts-node (backend) |

## Project Structure

```
/backend
  src/
    app.ts                # Express app + Socket.IO integration
    server.ts             # HTTP server startup
    config/
      env.ts              # Environment variable loading
    middleware/
      auth.ts             # Placeholder auth middleware
      errorHandler.ts    # Central API error formatter
    routes/
      auth.ts             # Authentication endpoints
      boards.ts           # Board CRUD endpoints
    sockets/
      boardNamespace.ts  # Socket.IO namespace for board events
    utils/
      batcher.ts          # Buffers mouse points for efficient emission
  tsconfig.json
  package.json

/frontend
  index.html
  src/
    main.tsx              # React entry point
    App.tsx               # Top‑level component with routing
    components/
      Toolbar.tsx         # Tool selection UI
    context/
      AuthContext.tsx     # Authentication state provider
      BoardContext.tsx    # Board state & socket handling
    api/
      client.ts           # Fetch wrapper for API calls
    sockets/
      useBoardSocket.ts   # Hook that creates the Socket.IO client
    utils/
      debounce.ts         # Debounce helper
  tsconfig.json
  package.json
  vite.config.ts
```

## Getting Started

### Prerequisites

- **Node.js** (v18 or later)
- **npm** (v9 or later)

### Setup

```bash
# Frontend
cd frontend
npm install

# Backend
cd backend
npm install
```

### Development

```bash
# Start the backend (watch mode)
cd backend
npm run dev

# Start the frontend (Vite dev server)
cd frontend
npm run dev
```

The frontend will be served at `http://localhost:5173` and will proxy API calls to the backend running on `http://localhost:3000` (adjust ports in the `.env` files if needed).

### Building for Production

```bash
# Build the frontend bundle
cd frontend
npm run build

# Build the backend TypeScript files
cd backend
npm run build
```

You can then serve the compiled backend with `node dist/server.js` and serve the static frontend files from the `frontend/dist` directory (or configure a reverse‑proxy/web server of your choice).

## Environment Variables

Create a `.env` file in the `backend` directory (copy from `.env.example` if provided) with at least the following keys:

```
PORT=3000
JWT_SECRET=your-secret-key
```

The frontend uses Vite’s env loading (`VITE_API_URL`) automatically from `.env` files at the project root.

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Starts the server in watch mode (backend) or Vite dev server (frontend). |
| `npm run build` | Compiles TypeScript to JavaScript (backend) or builds the production bundle (frontend). |
| `npm start` | Runs the compiled backend (`node dist/server.js`). |
| `npm lint` *(optional)* | Lints the codebase if linting config is added. |

## License

This project is provided for educational purposes and is licensed under the MIT License.