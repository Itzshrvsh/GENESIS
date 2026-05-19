# Simulation Platform

A minimal web‑based simulation platform with real‑time telemetry powered by **React 18**, **Vite**, **TypeScript**, **Node.js 20**, **Express**, and **Socket.IO**.

---

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Running the Application](#running-the-application)
- [Testing & Build](#testing--build)
- [Project Structure](#project-structure)
- [Contribution Guidelines](#contribution-guidelines)
- [License](#license)

---

## Features

- SPA front‑end built with React 18 and Vite.
- Type‑safe API client generated from an OpenAPI spec.
- Express backend with REST endpoints for authentication, scenario management, and simulation control.
- Real‑time telemetry streaming via Socket.IO.
- Simple JWT placeholder middleware for authentication.
- CI pipeline (GitHub Actions) to lint, build, and create Docker images.

---

## Prerequisites

- **Node.js** version >= 20
- **npm** (comes with Node)
- **Git**

---

## Setup

```bash
# Clone the repository
git clone <repository-url>
cd simulation-platform

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

---

## Running the Application

Start the backend (Express + Socket.IO) in one terminal:

```bash
cd backend
npm run dev
```

Start the frontend (Vite React app) in another terminal:

```bash
cd frontend
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

The React app will automatically connect to the Socket.IO server for telemetry updates.

---

## Testing & Build

```bash
# Backend build (produces ./dist)
cd backend
npm run build

# Frontend build (produces ./dist)
cd ../frontend
npm run build
```

Both commands will also run TypeScript type‑checking and linting as defined in the respective `package.json` scripts.

---

## Project Structure

```
simulation-platform/
│
├─ .github/workflows/ci.yml          # CI pipeline
├─ README.md                         # 📄 This file
│
├─ frontend/
│   ├─ package.json
│   ├─ tsconfig.json
│   ├─ vite.config.ts
│   ├─ index.html
│   └─ src/
│       ├─ main.tsx
│       ├─ App.tsx
│       └─ api/
│           └─ client.ts   # Generated OpenAPI client
│
└─ backend/
    ├─ package.json
    ├─ tsconfig.json
    └─ src/
        ├─ server.ts
        ├─ routes/
        │   ├─ auth.ts
        │   ├─ scenarios.ts
        │   └─ simulations.ts
        ├─ socket/
        │   └─ index.ts
        └─ middleware/
            └─ jwt.ts
```

---

## Contribution Guidelines

1. **Fork** the repository and create a new branch for your feature or bug fix.
2. **Follow** the existing code style (Prettier + ESLint configured in the CI). Run `npm run lint` locally before committing.
3. **Write** tests where applicable and ensure they pass (`npm run test` if added in the future).
4. **Update** documentation (including this README) if you add or change functionality.
5. **Submit** a Pull Request with a clear description of your changes.
6. **Pass** all CI checks before merging.

---

## License

This project is licensed under the MIT License. See `LICENSE` for details.