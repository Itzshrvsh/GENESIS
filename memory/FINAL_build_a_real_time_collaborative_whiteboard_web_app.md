# FINAL_PLAN.md

## 1. Goal  
Deliver a **Minimum Viable Product (MVP)** for a real‑time collaborative whiteboard:

* Users sign‑up / log‑in with e‑mail & password.  
* A board is created via a short URL (`/board/:id`).  
* Multiple participants see each other’s drawings instantly.  
* Basic tools: free‑hand stroke, rectangle, text, colour/width picker.  
* Presence cursors for all participants.  
* Board state is persisted and re‑loaded when a user joins.  

All code is **TypeScript** and lives in a single monorepo. The backend is a **single NestJS service** that serves both REST endpoints and a Socket.io gateway. The front‑end is a React SPA that draws on the native Canvas API (no heavy external canvas library).  

Scalability features (Redis adapter, OAuth, CDN, multi‑pod deployment) are **optional extensions** that will be added only after the MVP is validated.

---

## 2. Repository Layout  

```
/ (repo root)
├─ .github/
│   └─ workflows/
│       └─ ci.yml                     # GitHub Actions CI
├─ client/                            # React front‑end
│   ├─ public/
│   │   └─ index.html
│   ├─ src/
│   │   ├─ App.tsx
│   │   ├─ main.tsx
│   │   ├─ components/
│   │   │   ├─ Whiteboard.tsx        # Canvas wrapper + drawing logic
│   │   │   ├─ Toolbar.tsx
│   │   │   └─ CursorOverlay.tsx    # Remote cursors
│   │   ├─ hooks/
│   │   │   ├─ useWebSocket.ts      # socket.io client wrapper
│   │   │   └─ useWhiteboard.ts     # whiteboard state & ops handling
│   │   ├─ types/
│   │   │   └─ index.ts             # shared TS interfaces (draw ops, cursor)
│   │   ├─ utils/
│   │   │   └─ uuid.ts               # simple UUID generator
│   │   └─ index.css
│   ├─ vite.config.ts
│   ├─ tsconfig.json
│   ├─ package.json
│   └─ .eslintrc.cjs
├─ server/                            # NestJS back‑end (REST + WS)
│   ├─ src/
│   │   ├─ main.ts
│   │   ├─ app.module.ts
│   │   ├─ auth/
│   │   │   ├─ auth.module.ts
│   │   │   ├─ auth.service.ts
│   │   │   ├─ local.strategy.ts    # email/password validation
│   │   │   ├─ jwt.strategy.ts
│   │   │   ├─ auth.controller.ts
│   │   │   └─ dto/
│   │   │       ├─ login.dto.ts
│   │   │       └─ register.dto.ts
│   │   ├─ board/
│   │   │   ├─ board.module.ts
│   │   │   ├─ board.service.ts
│   │   │   ├─ board.controller.ts
│   │   │   ├─ board.gateway.ts      # Socket.io gateway
│   │   │   └─ entities/
│   │   │       ├─ user.entity.ts
│   │   │       ├─ board.entity.ts
│   │   │       └─ board-operation.entity.ts
│   │   ├─ common/
│   │   │   ├─ guards/
│   │   │   │   └─ jwt-auth.guard.ts
│   │   │   └─ decorators/
│   │   │       └─ user.decorator.ts
│   │   └─ migrations/               # TypeORM migration files
│   ├─ Dockerfile
│   ├─ ormconfig.ts                  # TypeORM connection config
│   ├─ tsconfig.json
│   ├─ package.json
│   └─ .eslintrc.cjs
├─ prisma/                            # Optional if Prisma is preferred over TypeORM
│   └─ schema.prisma
├─ docker-compose.yml
├─ .env.example
└─ README.md
```

*All files listed above are **required** for the MVP; optional files (e.g., `prisma/`) can be omitted if the chosen ORM is TypeORM.*

---

## 3. Core Data Model (TypeORM entities)

```ts
// src/board/entities/user.entity.ts
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string; // bcrypt

  @Column({ nullable: true })
  name?: string;

  @CreateDateColumn()
  createdAt: Date;
}

// src/board/entities/board.entity.ts
@Entity('boards')
export class Board {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('jsonb')
  snapshot: any; // latest full canvas state (JSON)

  @Column('bigint', { default: 0 })
  version: string; // incremented per operation

  @Column('jsonb', { default: {} })
  acl: Record<string, 'read' | 'write'>; // userId → permission

  @ManyToOne(() => User)
  owner: User;

  @CreateDateColumn()
  createdAt: Date;
}

// src/board/entities/board-operation.entity.ts
@Entity('board_operations')
export class BoardOperation {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('uuid')
  boardId: string;

  @Column('uuid')
  opId: string; // client‑generated UUID

  @Column('jsonb')
  payload: any; // full operation payload (type, data, timestamp, userId)

  @CreateDateColumn()
  createdAt: Date;
}
```

*The `snapshot` column stores the full canvas JSON (the same format emitted by the client on snapshot send). The `version` column is used to slice incremental ops when a client reconnects.*

---

## 4. Shared Types (client ↔ server)

```ts
// client/src/types/index.ts
export type DrawOp = {
  opId: string;
  boardId: string;
  type: 'stroke' | 'rect' | 'text';
  data: any; // shape‑specific payload (points, bounds, text, style)
  userId: string;
  createdAt: number; // epoch ms
};

export type CursorMove = {
  boardId: string;
  userId: string;
  x: number;
  y: number;
  color: string;
};
```

These interfaces are imported by both the front‑end (`hooks`) and the back‑end (`board.gateway.ts`) via the monorepo path alias `@shared/types`.

---

## 5. Implementation Order  

| Milestone | Duration | Tasks | Acceptance Criteria |
|-----------|----------|-------|----------------------|
| **0 – Foundations** | 1 week | • Initialise monorepo (`npm init -w client -w server`). <br>• Docker‑Compose with `postgres` & `redis` (Redis disabled by default). <br>• CI workflow: `npm run lint` + unit tests for both packages. <br>• TypeORM connection (`ormconfig.ts`) and first migration creating the three tables. | Repo builds, `docker compose up` launches API, WS, DB, and React dev server. |
| **1 – Auth (email/password)** | 2 weeks | • `User` entity + bcrypt registration. <br>• `AuthService` issuing **JWT** signed with HS256. <br>• `JwtStrategy` + `JwtAuthGuard` for REST routes. <br>• Socket.io middleware validates the same JWT once on connection and stores `socket.data.user`. <br>• Front‑end login & registration pages storing token in **memory** (React context). | POST `/auth/register` + `/auth/login` return JWT; WS connection is accepted only with `Authorization: Bearer <jwt>` header. |
| **2 – Board CRUD + ACL (owner + read/write)** | 1 week | • `POST /boards` creates a board, sets owner ACL (`write`). <br>• `GET /boards/:id` returns metadata + latest snapshot. <br>• `PATCH /boards/:id` (owner only) to edit title or ACL. <br>• Minimal UI: “New Board” button → redirects to `/board/:id`. | Boards can be created, listed, and opened; ACL stored as JSONB. |
| **3 – Socket.io Gateway (real‑time core)** | 2 weeks | • `BoardGateway` registers events: `joinBoard`, `drawOp`, `cursorMove`, `requestSnapshot`. <br>• On `joinBoard`, server loads snapshot from DB (or from Redis cache if present) and emits `snapshot` event. <br>• `drawOp` handler validates `write` permission, inserts into `board_operations`, increments board `version`, then broadcasts to the same room (`this.server.to(boardId).emit('drawOp', op)`). <br>• `cursorMove` broadcast (non‑persisted). <br>• Simple **in‑process** room management (no Redis adapter yet). | Two separate browser windows can join the same board, draw, and see each other’s strokes immediately. |
| **4 – Front‑end Canvas & Optimistic UI** | 2 weeks | • `Whiteboard` component sets up a `<canvas>` element with a 2‑D context. <br>• `useWhiteboard` hook converts mouse/touch events into a `DrawOp`, sends via `socket.emit('drawOp', ...)`, and **immediately draws** locally (optimistic). <br>• Hook listens for incoming `drawOp` events and renders them. <br>• `Toolbar` provides colour picker, line width, shape selector. <br>• `CursorOverlay` shows other users’ cursors from `cursorMove` events (no persistence). | A user can draw free‑hand strokes, rectangles, and text; all participants see the changes in < 200 ms. |
| **5 – Snapshot & Cleanup Logic** | 1 week | • After every **500 ops** (or when snapshot size > 1 MB) the server reads current board state from the in‑memory canvas (clients can request a snapshot by emitting `requestSnapshot`). <br>• Server **stores snapshot JSON** in `boards.snapshot` and updates `version`. <br>• In the same DB transaction, delete `board_operations` with `createdAt` older than the snapshot timestamp (optional archiving). <br>• Add a small Redis cache layer (`GET board:{id}:snapshot`) that can be toggled via env var. | Joining a board now loads a snapshot + only the few ops after it; DB size stays bounded. |
| **6 – Global Undo/Redo (linear, server‑ordered)** | 1 week | • Client maintains a **local undo stack** of its own ops. <br>• When a user clicks “Undo”, client emits `drawOp` with a special `type: 'undo'` and payload containing the original `opId`. <br>• Server treats it like any other op (persists, broadcasts). <br>• All participants see the stroke disappear. <br>• Redo works similarly. | Undo/Redo works for all participants and is persisted. |
| **7 – Rate Limiting (token bucket)** | 1 week | • Simple **in‑memory** limiter per socket: max 30 ops per second. <br>• If limit exceeded, server emits `error` and drops the offending op. <br>• When Redis is added later, replace with Redis‑based bucket. | No client can flood the server; normal drawing remains smooth. |
| **8 – CI/CD & Docker Production Image** | 1 week | • Multi‑stage Dockerfile: `builder` (npm ci → build) → `runtime` (node). <br>• `docker-compose.yml` sets env vars, exposes ports 3000 (API/WS) and 5173 (Vite dev). <br>• GitHub Actions builds both images on push to `main`, runs unit tests, pushes to Docker Hub (or GHCR). <br>• Simple **health‑check** endpoint (`/health`) in NestJS. | Pushing to main produces a deployable Docker image; `docker compose up -d` runs the full stack. |
| **9 – MVP Validation & Polish** | 2 weeks | • Manual user testing: latency, drawing smoothness, reconnection handling. <br>• Fix any out‑of‑order ops (server orders by DB `id`). <br>• Add fallback reconnection flow: on `reconnect`, client emits `requestSnapshot` and reapplies missing ops. <br>• Write a short README with start‑up instructions. | All MVP features work reliably; documentation ready for beta release. |

**Total estimated time:** **≈12 weeks** (fits a typical 3‑month sprint). All optional scaling pieces (Redis adapter, OAuth, CDN, Helm charts) are *not* part of the MVP and can be added later.

---

## 6. File‑by‑File Creation Checklist  

| Path | Purpose |
|------|---------|
| `client/package.json` | Vite + React + TypeScript dependencies (`react`, `react-dom`, `socket.io-client`, `uuid`). |
| `client/vite.config.ts` | Build config, proxy `/api` to NestJS (`http://localhost:3000`). |
| `client/src/main.tsx` | Bootstrap React, provide AuthContext, initialize WebSocket connection. |
| `client/src/App.tsx` | Router (`/`, `/login`, `/register`, `/board/:id`). |
| `client/src/components/Whiteboard.tsx` | Canvas element, drawing event listeners, render operations. |
| `client/src/components/Toolbar.tsx` | UI for colour, width, shape selection. |
| `client/src/components/CursorOverlay.tsx` | Render remote cursors using absolute positioned `<div>`s. |
| `client/src/hooks/useWebSocket.ts` | Wrapper around `socket.io-client`, auto‑reconnect, expose `emit`, `on`. |
| `client/src/hooks/useWhiteboard.ts` | State machine handling local ops, incoming ops, snapshot merging. |
| `client/src/types/index.ts` | Shared TS interfaces (`DrawOp`, `CursorMove`). |
| `client/src/utils/uuid.ts` | Simple `crypto.randomUUID()` wrapper. |
| `server/package.json` | NestJS core, `@nestjs/websockets`, `socket.io`, `@nestjs/passport`, `passport-jwt`, `bcrypt`, `class-validator`, `typeorm`, `pg`. |
| `server/src/main.ts` | Bootstrap NestJS, enable CORS, attach socket.io adapter (optional Redis). |
| `server/src/app.module.ts` | Import `AuthModule` and `BoardModule`. |
| `server/src/auth/auth.module.ts` | Provides `AuthService`, registers strategies. |
| `server/src/auth/auth.service.ts` | Register/Login, bcrypt hashing, JWT signing. |
| `server/src/auth/local.strategy.ts` | Validates email/password for login. |
| `server/src/auth/jwt.strategy.ts` | Validates JWT for protected routes & WS. |
| `server/src/auth/auth.controller.ts` | `POST /auth/register`, `POST /auth/login`. |
| `server/src/auth/dto/*.dto.ts` | DTOs with `class-validator`. |
| `server/src/common/guards/jwt-auth.guard.ts` | Extends `AuthGuard('jwt')`. |
| `server/src/common/decorators/user.decorator.ts` | `@User()` param decorator. |
| `server/src/board/board.module.ts` | Registers `BoardService`, `BoardController`, `BoardGateway`. |
| `server/src/board/board.service.ts` | CRUD, snapshot handling, operation insertion. |
| `server/src/board/board.controller.ts` | REST endpoints for boards. |
| `server/src/board/board.gateway.ts` | Socket.io event handlers (`joinBoard`, `drawOp`, `cursorMove`, `requestSnapshot`). |
| `server/src/board/entities/*.entity.ts` | TypeORM entities (User, Board, BoardOperation). |
| `server/src/migrations/*` | Initial schema migration files. |
| `server/ormconfig.ts` | DB connection options (read from `.env`). |
| `docker-compose.yml` | Services: `api` (NestJS), `client` (Vite dev), `postgres`, `redis`. |
| `.github/workflows/ci.yml` | Install, lint, test, build Docker images. |
| `.env.example` | Example env vars (`POSTGRES_HOST`, `JWT_SECRET`, etc.). |
| `README.md` | Project description, dev setup, deployment steps. |

---

## 7. Environment Variables (required for local dev & production)

| Variable | Description |
|----------|-------------|
| `POSTGRES_HOST` | Hostname of PostgreSQL container (e.g., `postgres`). |
| `POSTGRES_PORT` | Default `5432`. |
| `POSTGRES_USER` | DB username. |
| `POSTGRES_PASSWORD` | DB password. |
| `POSTGRES_DB` | Database name (`whiteboard`). |
| `JWT_SECRET` | Secret for signing JWTs (minimum 32 chars). |
| `JWT_EXPIRES_IN` | Token TTL (e.g., `1h`). |
| `SERVER_PORT` | NestJS HTTP & WS port (`3000`). |
| `REDIS_HOST` | Optional; if set, socket.io adapter will use Redis. |
| `RATE_LIMIT_OPS_PER_SEC` | Ops allowed per socket (default `30`). |

Copy `.env.example` to `.env` before running `docker compose up`.

---

## 8. Testing Strategy  

*Unit Tests* (Jest) – located alongside each file (`*.spec.ts`).  
*Integration Tests* – spin up a test PostgreSQL container, start NestJS, use `socket.io-client` to verify `joinBoard` and `drawOp` flow.  
*End‑to‑end* – optional Cypress script that opens two browser windows, draws a line, and asserts both canvases match.

All tests run in CI; the pipeline fails the build if any test fails.

---

## 9. Post‑MVP Extension Roadmap (optional)  

| Feature | When to add | What changes |
|---------|-------------|--------------|
| Redis adapter for Socket.io | > 2 k concurrent sockets | Install `@socket.io/redis-adapter`, set `REDIS_HOST`. |
| OAuth (Google/GitHub) | Need social login | Add `@nestjs/passport` OAuth strategies, UI button. |
| CDN for static assets | Traffic > 10 k users | Serve `client/dist` from Cloudflare/NGINX. |
| Helm charts & K8s autoscaling | Moving to production cluster | Convert `docker-compose.yml` to Helm, enable HPA. |
| Yjs CRDT integration | Complex concurrent object edits | Replace custom op handling with Yjs updates. |
| Export (PNG/SVG) | User request | Add client‑side canvas `toDataURL` endpoint. |
| Version history & replay | Product differentiation | Persist snapshots per timestamp, UI timeline. |

These items can be tackled iteratively after the MVP has been released and real usage metrics have been collected.

---

## 10. Summary  

The plan above delivers a **complete, production‑ready MVP** within ~12 weeks while keeping the architecture **minimal**:

* One NestJS service (REST + WebSocket) → no need for a Redis adapter initially.  
* Native Canvas API → small bundle, fast load on mobile.  
* Simple JWT bearer authentication → single source of truth for both HTTP and WS.  
* Persistent operation log + snapshot keeps board reload fast and DB size bounded.  

All required files, folder structure, and implementation milestones are explicitly listed, allowing the team to start coding immediately and avoid unnecessary complexity.