# FINAL_PLAN.md  

## 1. Goal  
Deliver a **minimum‑viable collaborative whiteboard** that lets a registered user:

* create a board,  
* open the board in a browser,  
* draw free‑hand strokes, rectangles, ellipses and text,  
* see other participants’ cursors and drawings in real time,  
* undo/redo their own actions, and  
* have the board persisted in PostgreSQL.  

All code is written in **TypeScript** and runs in a single Docker‑Compose‑based development environment.  
Later scaling (Redis adapter, Kubernetes, snapshots, image storage, sharing links) can be added without touching the MVP code.

---

## 2. High‑Level Design (simplified)

```
+------------------+   HTTP / WS   +-----------------------+
| Browser (SPA)    | <-----------> | Node.js (Express)     |
| React + TS +     |               | + Socket.IO (single  |
| Konva canvas)   |               |   process)            |
+--------+---------+               +----------+------------+
         |                                 |
         |   Prisma (PostgreSQL)           |
         v                                 v
+------------------+               +-------------------+
| PostgreSQL       |               | In‑process room   |
| (boards, elements)               | state (Socket.IO) |
+------------------+               +-------------------+

# Optional components (added after MVP)
#   • Redis + socket.io‑redis adapter (multi‑node scaling)
#   • board_snapshot table (periodic snapshot)
#   • Object storage for images
```

* **Authentication** – HttpOnly + SameSite‑Strict cookies for a short‑lived access JWT (≈15 min) and a longer refresh token. No token is sent in the WebSocket payload.  
* **Real‑time** – Socket.IO rooms keyed by `board:{id}`.  
* **Batch drawing** – mouse points are buffered (≈30 ms) and sent as a single `draw-path` event.  
* **Persistence** – Prisma models `User`, `Board`, `Element`. Each completed shape is stored as one row (`Element.data` holds Konva JSON).  
* **Undo/Redo** – client‑side stacks; the server simply overwrites the element row and broadcasts the new state.  
* **Presence** – cursor position is broadcast to the room; no separate Redis store is required while the API runs as a single instance.  

---

## 3. Folder Structure  

```
whiteboard/
│
├─ .github/
│   └─ workflows/
│        └─ ci.yml                     # GitHub Actions CI
│
├─ docker/
│   ├─ backend.Dockerfile
│   └─ frontend.Dockerfile
│
├─ docker-compose.yml                # dev environment
│
├─ backend/
│   ├─ src/
│   │   ├─ app.ts                     # Express + Socket.IO bootstrap
│   │   ├─ server.ts                  # http server start
│   │   ├─ config/
│   │   │   └─ env.ts                 # env‑var helpers
│   │   ├─ middleware/
│   │   │   ├─ auth.ts                # JWT validation, cookie parser
│   │   │   └─ errorHandler.ts
│   │   ├─ routes/
│   │   │   ├─ auth.ts                # /api/auth/*
│   │   │   └─ boards.ts              # /api/boards/*
│   │   ├─ sockets/
│   │   │   └─ boardNamespace.ts      # Socket.IO room logic
│   │   ├─ prisma/
│   │   │   ├─ schema.prisma
│   │   │   └─ client.ts              # Prisma client export
│   │   └─ utils/
│   │       └─ batcher.ts            # draw‑point buffering
│   ├─ tests/
│   │   ├─ unit/
│   │   └─ integration/
│   ├─ tsconfig.json
│   ├─ package.json
│   └─ prettier.eslint.json
│
├─ frontend/
│   ├─ src/
│   │   ├─ index.tsx                 # React entry point
│   │   ├─ App.tsx
│   │   ├─ routes/
│   │   │   ├─ PrivateRoute.tsx
│   │   │   └─ BoardPage.tsx
│   │   ├─ pages/
│   │   │   ├─ Login.tsx
│   │   │   ├─ Register.tsx
│   │   │   └─ BoardList.tsx
│   │   ├─ components/
│   │   │   ├─ Toolbar.tsx
│   │   │   ├─ PresenceOverlay.tsx
│   │   │   └─ UndoRedoButtons.tsx
│   │   ├─ canvas/
│   │   │   ├─ CanvasStage.tsx       # Konva <Stage>/<Layer>
│   │   │   └─ drawingHooks.ts       # useDrawPath, useCursor
│   │   ├─ context/
│   │   │   ├─ AuthContext.tsx
│   │   │   └─ BoardContext.tsx
│   │   ├─ api/
│   │   │   └─ client.ts             # fetch wrapper with CSRF & cookies
│   │   ├─ sockets/
│   │   │   └─ useBoardSocket.ts
│   │   └─ utils/
│   │       └─ debounce.ts
│   ├─ public/
│   ├─ tsconfig.json
│   ├─ package.json
│   └─ vite.config.ts               # or CRA config
│
└─ README.md
```

*All files are **TypeScript** (`.ts` / `.tsx`).*  

---

## 4. Implementation Order (8 – 10 weeks)

| Sprint | Focus | Key Deliverables |
|-------|-------|-------------------|
| **S0 – Foundations (1 wk)** | Repo init, Docker‑Compose, CI skeleton | `git` repo, `docker-compose.yml`, GitHub Actions workflow (lint + unit tests), Dockerfiles |
| **S1 – DB & Prisma (1 wk)** | Prisma schema, migrations, client wrapper | `prisma/schema.prisma`, `prisma/client.ts`, initial migration (`users`, `boards`, `elements`) |
| **S2 – Auth (1 wk)** | HttpOnly cookie JWT, refresh endpoint, auth middleware | `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `middleware/auth.ts` |
| **S3 – Single Express + Socket.IO server (1 wk)** | Combine REST and WS, shared auth, room join logic | `app.ts` mounts routes & Socket.IO, `boardNamespace.ts` implements `join-board`, `draw-path`, `cursor-move`, `undo`, `redo` |
| **S4 – Front‑end Scaffold (1 wk)** | Vite/CRA, routing, AuthContext, API client | `index.tsx`, `App.tsx`, `AuthContext`, `api/client.ts`, `PrivateRoute` |
| **S5 – Canvas & Toolbar (2 wks)** | Konva Stage, drawing hooks, toolbar UI, batcher | `CanvasStage.tsx`, `Toolbar.tsx`, `useDrawPath` (30 ms buffer), `batcher.ts`, first shape (free‑hand stroke) |
| **S6 – Persistence Hook‑up (1 wk)** | Save completed elements, load `initial-state` on join | `boardNamespace.ts` writes via Prisma, client populates canvas on `initial-state` |
| **S7 – Collaboration Extras (1 wk)** | PresenceOverlay (cursor broadcast), Undo/Redo stacks, version check | `PresenceOverlay.tsx`, `UndoRedoButtons.tsx`, client‑side undo/redo + server replace logic |
| **S8 – Testing & Quality (1 wk)** | Unit tests, integration (supertest + socket.io‑client), E2E (Cypress) | Test suites under `backend/tests/*` and `frontend/tests/*`, CI runs them |
| **S9 – CI/CD Polish & Production Prep (1 wk)** | Docker image tags, health endpoint, simple Helm chart (optional) | `Dockerfile`s multi‑stage, `docker compose up --build`, `README` with run instructions |
| **S10 – Polish (optional 1 wk)** | Export PNG (`stage.toDataURL()`), UI polishing, error toasts | Export button, minor UX tweaks, final bug‑fixes |

**Parallel work:** While S1‑S3 are backend‑centric, a second developer can start S4 (frontend scaffold) concurrently, as they share only the API contract (auth endpoints) which is already defined in S2.

---

## 5. Detailed Task Breakdown  

### 5.1 Backend Core  

| File | Responsibility |
|------|-----------------|
| `src/app.ts` | Create Express app, apply `json`, `cookieParser`, `auth` middleware, mount routers, create Socket.IO server (`io.of('/board')`). |
| `src/server.ts` | Start HTTP server on `process.env.PORT` (default 4000). |
| `src/config/env.ts` | Load env vars (`DATABASE_URL`, `JWT_SECRET`, `COOKIE_DOMAIN`). |
| `src/middleware/auth.ts` | Verify JWT from HttpOnly cookie, attach `req.user`. |
| `src/middleware/errorHandler.ts` | Central error formatter for API responses. |
| `src/routes/auth.ts` | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`. Uses `bcrypt` for password hashing, `jwt.sign`. |
| `src/routes/boards.ts` | CRUD endpoints (`GET /api/boards`, `POST /api/boards`, `GET /api/boards/:id`, `PATCH`, `DELETE`). All require `auth` middleware. |
| `src/prisma/schema.prisma` | ```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  password  String
  boards    Board[]  @relation("Owner")
}
model Board {
  id        String    @id @default(uuid())
  title     String
  ownerId   String
  owner     User      @relation("Owner", fields: [ownerId], references: [id])
  elements  Element[]
  createdAt DateTime  @default(now())
}
model Element {
  id        String   @id @default(uuid())
  boardId   String
  board     Board    @relation(fields: [boardId], references: [id])
  type      String
  data      Json
  zIndex    Int
  version   Int      @default(0)
}
``` |
| `src/prisma/client.ts` | `export const prisma = new PrismaClient();` |
| `src/sockets/boardNamespace.ts` | Handles `connection` event → validates auth (uses `auth` middleware logic), `socket.join(room)`, emits `initial-state`, listens for `draw-path`, `update-element`, `delete-element`, `cursor-move`, `undo`, `redo`. Writes via Prisma, increments `version`. |
| `src/utils/batcher.ts` | Helper to accumulate mouse points and flush after timeout (used by client). |
| `tests/unit/*` | Jest tests for routes, middleware, socket handlers (mock Prisma). |
| `tests/integration/*` | Supertest for API, socket.io‑client for WS flow. |

### 5.2 Frontend Core  

| File | Responsibility |
|------|-----------------|
| `src/index.tsx` | Render `<App />` inside `<BrowserRouter>`. |
| `src/App.tsx` | Define routes: `/login`, `/register`, `/boards`, `/board/:id`. Wrap with `AuthProvider`. |
| `src/context/AuthContext.tsx` | Provides `user`, `login`, `logout`, auto‑refresh logic, reads HttpOnly cookie via a `/api/auth/me` endpoint (optional). |
| `src/api/client.ts` | Wrapper around `fetch` that includes `credentials: 'include'`, parses JSON, throws on non‑2xx. |
| `src/pages/Login.tsx` & `Register.tsx` | Simple forms posting to `/api/auth/login` or `/api/auth/register`. |
| `src/pages/BoardList.tsx` | Fetch `/api/boards`, display list, button to create new board (POST). |
| `src/pages/BoardPage.tsx` | Loads board metadata (`/api/boards/:id`), creates socket via `useBoardSocket(boardId)`, renders `<Toolbar />`, `<CanvasStage />`, `<PresenceOverlay />`, `<UndoRedoButtons />`. |
| `src/components/Toolbar.tsx` | Buttons for *Pen*, *Rect*, *Ellipse*, *Text*, colour picker, thickness slider. Calls context hook `useTool()` to set current tool. |
| `src/components/PresenceOverlay.tsx` | Renders small circles with usernames at positions received via `cursor-move` events. |
| `src/components/UndoRedoButtons.tsx` | Calls `undo()` / `redo()` from `BoardContext`. |
| `src/canvas/CanvasStage.tsx` | Sets up `<Stage>` & `<Layer>`. Listens to context events (`addElement`, `updateElement`, `removeElement`). Uses Konva’s `add`, `setAttrs`, `destroy`. |
| `src/canvas/drawingHooks.ts` | `useDrawPath` – captures mouse down/up/move, buffers points (30 ms), emits `draw-path` via socket. Also `useCursor` for sending cursor position (`cursor-move`). |
| `src/context/BoardContext.tsx` | Holds board state (`elements` map, `undoStack`, `redoStack`). Provides dispatcher functions that both update local state **and** emit the matching socket event. |
| `src/sockets/useBoardSocket.ts` | Hook that creates a Socket.IO client (`io(`${API_URL}/board`, { withCredentials: true })`), handles `initial-state`, `draw-path`, `update-element`, `delete-element`, `cursor-move`, `undo`, `redo`. |
| `src/utils/debounce.ts` | Generic debounce for UI callbacks (e.g., colour picker). |
| `tests/unit/*` | React Testing Library + Jest for components and hooks. |
| `tests/e2e/*` | Cypress tests that register two users, open same board, draw, verify remote updates. |

### 5.3 DevOps / CI  

| File | Purpose |
|------|----------|
| `docker/backend.Dockerfile` | Multi‑stage: `node:20-alpine` → build (`npm ci`, `tsc`) → runtime (`node dist/app.js`). |
| `docker/frontend.Dockerfile` | Multi‑stage: `node:20-alpine` → `npm run build` → serve with `nginx:alpine`. |
| `docker-compose.yml` | Services: `api` (backend), `web` (frontend), `db` (postgres), `adminer` (optional). Maps ports 4000 and 3000. |
| `.github/workflows/ci.yml` | Steps: checkout → set up Node → install deps → lint → type‑check → unit tests → build Docker images → push to GitHub Packages (optional). |
| `README.md` | How to start dev environment (`docker compose up --build`), environment variables, testing commands. |

---

## 6. Minimal Production Deployment (optional)

When the MVP is stable, the following files can be added without changing the application code:

* `helm/whiteboard/Chart.yaml`, `values.yaml` – Helm chart with two Deployments (`api`, `web`), a Service, and an Ingress (TLS).  
* `k8s/redis.yaml` – if horizontal scaling is needed later.  
* `docker-compose.prod.yml` – for a single‑node production Docker deployment (no hot‑reload).  

All of these are **outside the MVP scope** and can be introduced in a later sprint.

---

## 7. Risk Mitigation Summary  

| Risk | Mitigation in MVP |
|------|-------------------|
| Token leakage | HttpOnly, SameSite‑Strict cookies; never send JWT in WS payload. |
| Excessive WS traffic | Buffer mouse points (30 ms) → one `draw-path` per batch. |
| DB write burst | Persist only **completed** elements; batch insert is not needed for MVP. |
| Conflicting edits | Simple `version` per element; server rejects stale version with `error` event. |
| Scaling before need | No Redis or Kubernetes initially; single Node process keeps complexity low. |
| Large boards | Snapshot strategy is deferred; board with a few thousand elements loads fine. |
| Image storage | Image upload is out of scope for MVP; can be added later with a URL field. |

---

## 8. Acceptance Criteria (MVP)

1. **Auth** – Users can register, log in, and stay authenticated via cookies.  
2. **Board CRUD** – Owner can create, rename, delete boards; list shows only owned boards.  
3. **Real‑time drawing** – Two browsers on the same board see each other’s strokes within <200 ms.  
4. **Presence** – Each participant’s cursor (name + colour) is visible to others.  
5. **Undo/Redo** – A user can undo/redo their own last action; the change propagates to all participants.  
6. **Persistence** – Refreshing the page reloads the board with all previously saved elements.  
7. **Tests** – ≥80 % unit‑test coverage for backend, ≥70 % for frontend; E2E test passes for the real‑time flow.  
8. **CI** – All checks run on every push; Docker images can be built locally with `docker compose build`.  

Meeting the above marks the MVP ready for a production deployment.

--- 

**End of plan.**