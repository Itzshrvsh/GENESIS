
# PROJECT IDEA

Build a real-time collaborative whiteboard web app.


# ARCHITECT OUTPUT

## Real‑time Collaborative Whiteboard – High‑level Architecture

| Layer | Responsibility | Recommended Technology |
|-------|----------------|------------------------|
| **Client** | UI, drawing primitives, local state, optimistic updates | **React** + **TypeScript** + **Canvas / SVG** (via a library such as `fabric.js` or `react‑canvas-draw`) |
| **Transport** | Low‑latency bi‑directional messages | **WebSocket** (socket.io) |
| **Server (Realtime Engine)** | Session management, broadcast of drawing ops, conflict‑free merging | **Node.js** (v20) + **NestJS** (modular, TypeScript‑first) + **socket.io** server |
| **Persistence** | Store board state, version history, user & permissions | **PostgreSQL** (for relational data) + **Redis** (in‑memory pub/sub & session cache) |
| **Auth** | JWT based authentication, optional OAuth2 (Google, GitHub) | **NestJS Passport** + **Auth0** (or self‑hosted) |
| **Hosting / CI‑CD** | Container orchestration, zero‑downtime deployments | **Docker** + **Kubernetes** (or managed service like GKE/EKS) + **GitHub Actions** |
| **Static Assets** | Serve front‑end bundle | **CDN** (e.g., Cloudflare) + **NGINX** (optional) |

---

## 1. Core Design Principles

1. **Simplicity** – Use a single language (TypeScript) across client and server.
2. **Separation of concerns** – UI, realtime engine, and persistence are isolated services.
3. **Optimistic UI & CRDT** – Clients apply local drawing ops instantly and later merge with the server‑generated state using a Conflict‑free Replicated Data Type (CRDT) or Operational Transformation (OT) stub.
4. **Scalability** – Stateless HTTP endpoints, WebSocket connections managed by a horizontally‑scalable gateway, Redis for pub/sub cross‑instance broadcast.
5. **Security** – JWT for every request, board‑level ACLs, HTTPS everywhere.

---

## 2. System Overview (ASCII)

```
+-------------------+          WebSocket          +-------------------+
|   Browser (SPA)   | <-------------------------> |   WS Gateway      |
|  React + Canvas   |   (socket.io client)        | (NestJS + socket.io)|
+-------------------+                              |
          |                                        |
          |  HTTP/HTTPS (REST)                     |  Pub/Sub (Redis)
          v                                        v
+-------------------+          +-------------------------------+
|   API Server      | <----> | Redis (pub/sub, session cache)|
| (NestJS REST)     |        +-------------------------------+
+-------------------+                |
          |                         |
          v                         v
+-------------------+      +-------------------+
| PostgreSQL (RDBMS) |      |   File Store (optional) |
+-------------------+      +-------------------+
```

*All services are Dockerised; the WS gateway and API server can be scaled independently.*

---

## 3. Detailed Component Breakdown

### 3.1 Front‑end (React SPA)

| Concern | Implementation |
|---------|----------------|
| **Canvas** | `fabric.js` (object model + serialization) or native Canvas API wrapped in React hooks. |
| **State sync** | `socket.io-client` listens for `draw-op` events; local ops are queued and sent immediately (optimistic). |
| **Board model** | Each stroke/shape = immutable object `{ id, type, points, style, createdAt, userId }`. |
| **Undo/Redo** | Local history stack; server receives “undo” as a reverse operation. |
| **Authentication** | `@auth0/auth0-spa-js` (or custom JWT storage in HttpOnly cookie). |
| **Routing** | React Router – `/board/:boardId`. |
| **Bundle** | Vite or Create‑React‑App (TS). |

### 3.2 Real‑time Engine (NestJS + socket.io)

*Runs as a single entry point for all WebSocket connections.*

- **Connection lifecycle**  
  1. Client presents JWT → `AuthGuard` validates and attaches `user` to the socket.  
  2. `joinBoard(boardId)` puts socket into a *room* (`socket.join(boardId)`).  
  3. Server loads current board state from PostgreSQL (or cache) and sends initial snapshot.

- **Message types**  
  - `draw-op` – Payload: `{ opId, type, payload }`. Server validates, persists (append‑only log), then broadcasts to the room.  
  - `undo-op` / `redo-op` – Treated as inverse ops.  
  - `cursor-move` – Small payload for showing remote cursors (not persisted).  
  - `request-snapshot` – Server sends the latest board version.

- **Persistence strategy**  
  - **Append‑only operation log** table `board_operations(id, board_id, op_json, created_at)`.  
  - Periodic **snapshot** (materialized board state) stored in `boards` table (JSONB) for fast load.  
  - On board load: send latest snapshot + operations after the snapshot timestamp.

- **Scalability**  
  - Socket.io adapter = **Redis** – all instances share rooms & broadcast.  
  - Horizontal scaling: each pod runs the same NestJS server; state is externalised.

### 3.3 API Server (NestJS – REST)

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `GET /boards/:id` | Metadata + latest snapshot (if client wants to fetch via HTTP) | JWT |
| `POST /boards` | Create new board (owner, ACL) | JWT |
| `PATCH /boards/:id` | Update ACL, title, etc. | Owner only |
| `GET /boards/:id/ops?since=timestamp` | Incremental fetch (fallback for lost connectivity) | JWT |
| `GET /users/me` | Current user profile | JWT |

All routes use NestJS **Guards** for auth and **Interceptors** for validation (class‑validator).

### 3.4 Persistence Layer

#### PostgreSQL Schema (simplified)

```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE boards (
  id          UUID PRIMARY KEY,
  owner_id    UUID REFERENCES users(id),
  title       TEXT,
  snapshot    JSONB,                -- latest full board state
  version     BIGINT NOT NULL DEFAULT 0,
  acl         JSONB,                -- { userId: "read|write", ... }
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE board_operations (
  id          BIGSERIAL PRIMARY KEY,
  board_id    UUID REFERENCES boards(id),
  op_id       UUID NOT NULL,       -- client‑generated operation identifier
  op_json     JSONB NOT NULL,      -- raw operation payload
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

- **Indexes** on `board_id + created_at` for efficient incremental pulls.
- **Snapshot update** runs every N ops (e.g., 500) or on a timed background job.

#### Redis

- **socket.io adapter** for pub/sub.
- **session cache**: `board:{id}:snapshot` (TTL 5 min) to avoid DB hit on frequent joins.
- **rate‑limit** per user (optional) using `redis-rate-limiter`.

### 3.5 Authentication & Authorization

1. **Login** → Auth provider returns JWT (`sub` = userId).  
2. **WebSocket** handshake includes `Authorization: Bearer <jwt>`.  
3. **Guard** extracts userId and loads board ACL from DB (cached).  
4. **Permission checks**:  
   - `read` → can join room, receive ops.  
   - `write` → can emit `draw-op`, `undo`, `cursor-move`.

### 3.6 Deployment & DevOps

- **Dockerfile** (multi‑stage) for both client and server.
- **Kubernetes manifests**:  
  - `Deployment` for API + WS (same pod or separate, both expose via Service).  
  - `HorizontalPodAutoscaler` based on CPU / WebSocket connection count.  
  - `Ingress` with TLS termination (let’s encrypt via cert‑manager).  
  - `StatefulSet` optional for PostgreSQL; otherwise managed DB (e.g., CloudSQL).  
- **CI/CD** using GitHub Actions: lint → unit tests → build Docker images → push → Helm upgrade.

---

## 4. Data Flow Example (User draws a line)

1. **User action** → Canvas library creates an operation object `{ opId, type:'stroke', points:[...], style:{color, width}, createdAt }`.
2. **Client** sends `draw-op` via socket.io to the WS gateway.
3. **Gateway** validates JWT → authorizes `write`.
4. **Gateway** writes the operation to `board_operations` (async) and increments board version.
5. **Gateway** publishes the operation to Redis; all WS instances receive it.
6. **Each instance** broadcasts the operation to every socket in the board’s room (except the origin if desired).
7. **Remote clients** receive the op, apply it to their local canvas immediately.
8. **Periodically** a background worker compacts the operation log into a new snapshot stored in `boards.snapshot` and removes old ops.

If a client loses connection:

- On reconnection, it emits `request-snapshot`.  
- Server replies with latest snapshot + ops after the snapshot’s `version`.  
- Client re‑applies incremental ops to catch up.

---

## 5. Alternatives & Why This Stack Was Chosen

| Alternative | Why Not Chosen (for simplicity) |
|-------------|----------------------------------|
| **Go + Fiber + NATS** | Adds a second language; Go excels at concurrency but requires extra DevOps expertise for binary deployment and bridging to TypeScript front‑end. |
| **Firebase Realtime DB / Firestore** | Handles realtime sync out‑of‑box but offers limited control over conflict resolution and cost scales poorly with heavy binary canvas data. |
| **Elixir/Phoenix Channels** | Very powerful for websockets, but the learning curve and ecosystem for a small team is higher than a familiar Node/TS stack. |
| **GraphQL Subscriptions** | Adds schema complexity; WebSocket messaging for drawing ops is simple enough to use a lightweight custom protocol. |
| **CRDT library (Yjs, Automerge)** | Provides robust conflict‑free merging but introduces a non‑trivial data model and extra bundle size; for a whiteboard where ops are largely additive, a simple append‑only log with server‑side ordering is sufficient. |

---

## 6. Minimal Viable Product (MVP) Checklist

| Feature | Implementation Priority |
|---------|------------------------|
| Create / join board (URL sharing) | ✅ |
| Real‑time drawing (stroke, line, rectangle, text) | ✅ |
| User authentication (email/password or OAuth) | ✅ |
| Presence cursors & user list | ✅ |
| Undo/Redo (local + broadcast) | ✅ |
| Board persistence & reload | ✅ |
| Basic ACL (owner + read/write) | ✅ |
| Mobile‑friendly UI | ✅ |
| CI pipeline & Docker build | ✅ |
| Deploy to a small K8s cluster (or Docker‑Compose for local dev) | ✅ |

Once the MVP is stable, iterate on:

- **Version history / replay** (store snapshots per timestamp).  
- **Export / import** (PNG, SVG).  
- **Collaborative text boxes** (rich‑text).  
- **Performance optimizations** (binary delta compression, WebRTC fallback).  

---

### TL;DR

- **Stack:** React + TypeScript front‑end, NestJS (Node + TypeScript) back‑end with socket.io, PostgreSQL + Redis, Docker/Kubernetes for deployment.
- **Architecture:** Thin stateless HTTP API + scalable WebSocket gateway; board state persisted as append‑only operation log + periodic snapshots.
- **Core components:** Canvas UI, socket.io client/server, auth guard, operation log, snapshot manager, Redis pub/sub, PostgreSQL schema.
- **Why it stays simple:** Single language across stack, minimal external services, clear separation of realtime vs. REST concerns, and use of proven libraries (socket.io, NestJS, fabric.js).

# PLANNER OUTPUT

## Real‑time Collaborative Whiteboard – Project Plan  

### Overview  
The plan follows the high‑level architecture already defined (React + TypeScript front‑end, NestJS + socket.io back‑end, PostgreSQL + Redis, Docker/K8s).  
Milestones are ordered to deliver a **Minimum Viable Product (MVP)** quickly while keeping the code base simple and extensible.

---

## Milestone 0 – Foundations (1 week)

| # | Task | Owner | Acceptance Criteria |
|---|------|-------|----------------------|
| 0.1 | Create monorepo (e.g., Nx or Turborepo) housing `client/`, `api/`, `ws/` packages | Dev Lead | `npm run build` succeeds for all packages; CI lint job passes |
| 0.2 | Set up shared TypeScript configuration and linting (ESLint, Prettier) | Dev Lead | Consistent formatting, no lint errors across repo |
| 0.3 | Docker‑file scaffolding for each service (multi‑stage) | DevOps | `docker build` works locally for client, api, ws |
| 0.4 | GitHub Actions pipeline (install → lint → test → build → push image) | DevOps | Pipeline runs on every PR, artifacts archived |
| 0.5 | Define PostgreSQL schema (users, boards, board_operations) in migration files (e.g., TypeORM, Prisma) | Backend Engineer | `npm run migrate` creates tables; basic CRUD works via a test script |
| 0.6 | Spin up local development stack with Docker‑Compose (Postgres, Redis, API, WS, client) | DevOps | `docker compose up` launches all services, client reachable at `http://localhost:3000` |

**Goal:** A reproducible development environment and CI foundation; no business logic yet.

---

## Milestone 1 – Authentication & Authorization (2 weeks)

| # | Task | Owner | Acceptance Criteria |
|---|------|-------|----------------------|
| 1.1 | Implement JWT‑based auth in NestJS (login, register endpoints) using **Passport‑JWT** | Backend Engineer | `POST /auth/login` returns a signed JWT; token validates on protected routes |
| 1.2 | Add optional OAuth2 (Google) flow (using `@nestjs/passport` strategy) | Backend Engineer | Users can log in with Google; JWT still issued |
| 1.3 | Store JWT in **HttpOnly Secure** cookie + expose `GET /users/me` endpoint | Backend Engineer | Browser automatically sends cookie on WebSocket handshake |
| 1.4 | Front‑end auth flow (Auth0 SDK or custom login UI) – persist token in memory, attach to socket.io client | Front‑end Engineer | After login, socket connection is established and `user` object available in React context |
| 1.5 | Implement **AuthGuard** for both HTTP and socket.io connections | Backend Engineer | Unauthorized connections are rejected (401) |
| 1.6 | Basic ACL model: board owner → full rights, others → read‑only (pre‑MVP) | Backend Engineer | Owner can create/join board; non‑owners can view but cannot emit draw ops |

**Goal:** Secure entry point for all later features; foundation for ACL extensions.

---

## Milestone 2 – Core Real‑time Engine (3 weeks)

| # | Task | Owner | Acceptance Criteria |
|---|------|-------|----------------------|
| 2.1 | Set up NestJS **WebSocket gateway** with `socket.io` (ws/ package) | Backend Engineer |
| 2.2 | Connection lifecycle: validate JWT, attach user, `joinBoard(boardId)` puts socket into a room | Backend Engineer | `socket.join` called, user stored in `socket.data` |
| 2.3 | Define message contracts (TypeScript interfaces) for `draw-op`, `undo-op`, `cursor-move`, `request-snapshot` | Backend & Front‑end Engineer | Types are shared via monorepo `@shared/types` |
| 2.4 | Implement **append‑only operation log**: on `draw-op`, persist to `board_operations` table, broadcast to room via Redis adapter | Backend Engineer | Operation appears in DB and other clients receive it |
| 2.5 | Implement **snapshot loading** on board join: fetch latest snapshot from Redis cache (fallback to DB) and send to client | Backend Engineer | New client receives full board state within 200 ms |
| 2.6 | Client‑side **optimistic updates**: on local drawing, emit `draw-op` and immediately render on canvas | Front‑end Engineer | No visible latency for the author |
| 2.7 | Remote **cursor presence**: broadcast small `cursor-move` messages, render peer cursors on canvas | Front‑end Engineer | Cursor positions of other users are shown in real time |
| 2.8 | Simple **undo/redo**: client sends inverse op (`undo-op`), server treats it like a regular op and broadcasts | Front‑end & Backend Engineer | Undo appears for all participants |

**Goal:** Functional real‑time collaboration with persistent state, ready for UI integration.

---

## Milestone 3 – Canvas UI & Drawing Primitives (2 weeks)

| # | Task | Owner | Acceptance Criteria |
|---|------|-------|----------------------|
| 3.1 | Integrate **fabric.js** (or `react-canvas-draw`) into React app, wrap in custom hook (`useWhiteboard`) | Front‑end Engineer |
| 3.2 | Implement basic drawing tools: free‑hand stroke, straight line, rectangle, ellipse, text box | Front‑end Engineer |
| 3.3 | Serialize each object to the **operation format** defined in Milestone 2 | Front‑end Engineer |
| 3.4 | Render remote operations received via socket.io onto the same fabric canvas | Front‑end Engineer |
| 3.5 | Toolbar UI (tool selection, color picker, line width) and board title bar | Front‑end Engineer |
| 3.6 | Responsive layout: works on desktop browsers and tablets (touch events) | Front‑end Engineer |
| 3.7 | Add **board URL sharing**: `/board/:boardId` loads board and auto‑joins via socket.io | Front‑end Engineer |

**Goal:** Users can create and see drawings in real time; UI sufficiently polished for MVP testing.

---

## Milestone 4 – Persistence Enhancements & Snapshots (1 week)

| # | Task | Owner | Acceptance Criteria |
|---|------|-------|----------------------|
| 4.1 | Implement **background snapshot worker** (NestJS scheduled task) that compresses every N ops into a new JSONB snapshot | Backend Engineer |
| 4.2 | Update board version counter on each persisted op | Backend Engineer |
| 4.3 | Adjust board‑join flow to send **snapshot + incremental ops** (since snapshot version) | Backend Engineer |
| 4.4 | Add **expire‑old operations** logic (e.g., keep ops for last 24 h or last 10 k entries) | Backend Engineer |
| 4.5 | Cache latest snapshots in Redis with 5‑minute TTL, fall back to DB on cache miss | Backend Engineer |

**Goal:** Faster board loading for large sessions; DB size stays bounded.

---

## Milestone 5 – ACL Expansion & Permissions (1 week)

| # | Task | Owner | Acceptance Criteria |
|---|------|-------|----------------------|
| 5.1 | Extend board `acl` JSONB to store per‑user `read|write` rights | Backend Engineer |
| 5.2 | API endpoints to **invite** users (by email) and set permissions (`POST /boards/:id/invite`) | Backend Engineer |
| 5.3 | Enforce ACL on WebSocket gateway: reject `draw-op`/`undo-op` if user lacks `write` | Backend Engineer |
| 5.4 | UI for board owners to manage collaborators (list, change role, revoke) | Front‑end Engineer |
| 5.5 | Unit tests for permission matrix (both HTTP and WS) | QA Engineer |

**Goal:** Boards can be shared securely with appropriate read/write access.

---

## Milestone 6 – CI/CD & Production Deployment (1 week)

| # | Task | Owner | Acceptance Criteria |
|---|------|-------|----------------------|
| 6.1 | Write Helm chart (or Kustomize) for API, WS, PostgreSQL, Redis | DevOps |
| 6.2 | Configure **Ingress** with TLS (cert‑manager + Let's Encrypt) | DevOps |
| 6.3 | Set up **HorizontalPodAutoscaler** based on CPU & socket connections count | DevOps |
| 6.4 | Add **health‑check endpoints** (`/health`) for liveness/readiness probes | Backend Engineer |
| 6.5 | Extend GitHub Actions to push Docker images to container registry and run `helm upgrade --install` on `main` branch | DevOps |
| 6.6 | Smoke test deployment in a staging cluster (board creation, real‑time drawing) | QA Engineer |

**Goal:** One‑click deployment to a Kubernetes environment, with zero‑downtime upgrades.

---

## Milestone 7 – MVP Validation & Polish (2 weeks)

| # | Task | Owner | Acceptance Criteria |
|---|------|-------|----------------------|
| 7.1 | Conduct user testing session (internal stakeholders) – gather feedback on latency, UI ergonomics, error handling | Product Owner |
| 7.2 | Fix any **race conditions** discovered (e.g., duplicate opIds, out‑of‑order snapshots) | Backend Engineer |
| 7.3 | Add **offline reconnection flow**: on reconnect, client emits `request-snapshot`, applies missing ops | Front‑end Engineer |
| 7.4 | Implement **basic analytics** (board creation count, active users) via lightweight event logging (e.g., Google Analytics or self‑hosted) | Backend Engineer |
| 7.5 | Prepare **documentation**: README, API spec (OpenAPI), contribution guide | Documentation Lead |
| 7.6 | Tag release `v1.0.0` and publish Docker images to public registry | DevOps |

**Goal:** A stable, usable product ready for public beta.

---

## Optional Post‑MVP Enhancements (Backlog)

| Feature | Rationale |
|---------|----------|
| Export board to PNG / SVG | Users often need a static artifact |
| Version history & replay | Supports “undo everything” and audit |
| Rich‑text collaborative editing (Yjs integration) | Turns whiteboard into a full‑featured brainstorming tool |
| Binary diff compression for ops | Reduce bandwidth for large drawings |
| WebRTC fallback for low‑latency peer‑to‑peer | Improves performance on high‑load clusters |
| Multi‑language support (i18n) | Wider audience reach |
| Server‑side rate limiting (Redis‑based) | Prevent abuse / DoS |

These can be scheduled after the MVP is validated.

---

## Implementation Order Summary  

1. **Foundations** – repo, Docker, CI, DB schema.  
2. **Auth** – JWT, login, guard, basic ACL.  
3. **Real‑time Engine** – socket.io gateway, op persistence, snapshot loading, optimistic UI.  
4. **Canvas UI** – drawing tools, toolbar, presence cursors, URL sharing.  
5. **Snapshot worker & caching** – keep board load fast.  
6. **Full ACL** – invite & permission management.  
7. **Production pipeline** – Helm, autoscaling, TLS.  
8. **MVP validation** – testing, polish, documentation, release.  

Each milestone builds directly on the previous one, minimizing re‑work and keeping the code base lean.  

---  

**Prepared by:** Project Planning Agent  
**Date:** 2026‑05‑19  

# CRITIC OUTPUT

# Engineering Critique – Real‑time Collaborative Whiteboard  

Below is a concise risk‑analysis, simplification guide, and challenge of the key assumptions made in the **Architecture** and **Project Plan** you provided.  The goal is to keep the MVP lean, avoid unnecessary operational overhead, and surface technical debt early.

---

## 1. High‑Level Risks  

| Area | Specific Risk | Impact on MVP | Mitigation |
|------|----------------|---------------|------------|
| **WebSocket scalability** | Relying on a Redis‑backed Socket.io adapter from day‑one assumes you will run >1 pod. In a single‑instance deployment the adapter adds latency and another moving part. | premature complexity; possible performance regressions when scaling later. | Start with a **single NestJS instance** that hosts both HTTP and WS. Add the Redis adapter only when you actually need horizontal scaling (post‑MVP). |
| **State persistence model** | Append‑only `board_operations` table grows linearly; periodic snapshots mitigate read performance but do not purge old ops automatically. | DB size explosion, long‑running migrations, slower recovery after a crash. | Implement **hard roll‑up**: after each snapshot delete ops older than the snapshot (or archive them to cold storage). Consider a **document‑oriented store** (e.g., MongoDB) for the operation log, which handles large arrays more efficiently. |
| **Conflict resolution** | The plan mentions “CRDT or OT stub” but never defines which algorithm will be used. Without a concrete model, race conditions (duplicate `opId`, out‑of‑order ops) will surface. | Inconsistent canvases, user‑visible “jumps”. | Adopt a **well‑tested CRDT library** (Yjs or Automerge) *or* commit to a **strict server‑side total order** (auto‑increment `version` and reject out‑of‑order ops). Pick one early and lock the message contract. |
| **Authentication surface** | JWT is stored in an HttpOnly cookie *and* sent as a header on WebSocket handshake. Mixing cookie‑based and bearer‑token authentication can lead to CSRF or token‑leak bugs. | Security gaps, hard‑to‑debug auth failures. | Choose **one** method: either (a) Cookie‑only with SameSite=Strict + CSRF‑token for any REST calls, **or** (b) Bearer token in `Authorization` header for both HTTP and WS. |
| **Kubernetes for MVP** | Full Helm chart, HPA, TLS automation, separate StatefulSet for PostgreSQL – all add ~2‑3 weeks of DevOps work before any user can draw. | Delayed feedback, higher operational cost for early users. | Use **Docker‑Compose** locally, then **single‑node K8s** (e.g., Kind or GKE Autopilot) for staging. Promote to a full multi‑node cluster only after traffic justifies it. |
| **Third‑party auth (Auth0)** | Adding Auth0 (or self‑hosted equivalent) introduces a subscription cost and extra integration points before the core drawing functionality is even proven. | Unnecessary expense, longer onboarding for contributors. | For MVP, implement **simple email/password** with bcrypt + JWT. Add OAuth2 as an optional “social login” later. |
| **Canvas library choice** | `fabric.js` is feature‑rich but heavyweight; the bundle size can exceed 500 KB gzipped, which hurts mobile performance. | Poor first‑load times on slow networks, higher memory usage on low‑end devices. | Start with the **native Canvas API** wrapped in a thin React hook. Only bring in a library once you need complex objects (e.g., text editing, vector shapes). |
| **Undo/Redo model** | Treating undo as an inverse operation that is persisted can cause **operation explosion** (every undo generates a new op). | Log grows faster than drawing ops, complicates snapshot logic. | Implement **client‑side undo stack** that does **not** create a new persisted op. Only send a “clear‑to‑version” command when a user wants to revert to a prior snapshot (e.g., after a “reset” action). |
| **Rate limiting & abuse** | No explicit plan for protecting the WS endpoint from malicious flood (e.g., a bot emitting thousands of ops per second). | Service outage, degraded latency for legitimate users. | Add a **lightweight token bucket** in Redis (or in‑process for single‑instance) early; configure a max ops/sec per socket. |

---

## 2. Over‑Engineering Spots  

| Component | Why it’s Overkill for MVP | Suggested Simplification |
|-----------|---------------------------|--------------------------|
| Separate **API** and **WS** services (both NestJS) | Two deployments, duplicated config, extra networking. | Merge into **one NestJS app** that exposes both REST endpoints and the Socket.io gateway. |
| Full **Kubernetes + Helm** pipeline | Requires clusters, RBAC, secrets management, monitoring before any users exist. | Use **Docker‑Compose** for dev & CI, and a **single‑node K8s** for staging if required. |
| **Auth0** (or self‑hosted OAuth server) | External vendor onboarding, cost, token introspection. | Simple **email‑+‑password + JWT** flow; add OAuth later. |
| **Redis** for pub/sub + session cache | Adds an extra stateful service; for <10k concurrent sockets a single Node process can handle rooms natively. | Defer Redis until you actually run >1 WS pod. Keep an in‑memory `Map<boardId, Set<socketId>>` for room tracking. |
| **PostgreSQL JSONB snapshots** | JSONB parsing and indexing can be slower than a dedicated document store for large canvas state. | Consider **MongoDB** (or even a flat file on S3 for snapshots) for the snapshot blob, while still using Postgres for user/board metadata. |
| **CRDT/OT stub** without concrete library | Risks buggy conflict resolution; building your own OT is non‑trivial. | Pick **Yjs** (already browser‑compatible) and let it handle op ordering, awareness (cursors), and persistence hooks. |
| **Background snapshot worker** scheduled every N ops | Adds a separate process; the same can be done synchronously after every X ops with minimal impact for small boards. | Inline snapshot creation after **500 ops** in the same NestJS process; move to an async worker only when snapshot latency becomes measurable. |
| **Separate static asset CDN** (NGINX + Cloudflare) | For a low‑traffic MVP, a single Vite dev server serving the bundle from the same pod is sufficient. | Deploy the front‑end as a **static build** served by the NestJS app (or a simple Nginx container) and add CDN later. |
| **Comprehensive CI pipeline** (lint → test → build → push image) for every PR | Good practice, but the first iteration can skip heavy Docker image pushes and rely on **npm pack** for fast feedback. | Keep a **lean CI** for PRs (lint + unit tests); do full image build only on `main` merges. |

---

## 3. Weak / Unvalidated Assumptions  

| Assumption | Why It May Fail | How to Validate / Adjust |
|------------|-----------------|--------------------------|
| **"Operations are additive, no conflicts"** | Even free‑hand strokes can overlap; concurrent edits to the same object (e.g., moving a rectangle) cause conflicts. | Write a quick **integration test** where two clients edit the same shape simultaneously; observe divergence. If divergence occurs, switch to a proper CRDT. |
| **"Redis pub/sub scales to any number of rooms"** | Redis channel count can balloon; each board as a channel may hit limit in small Redis instances. | Simulate >10k rooms locally; monitor Redis command latency. If high, consider **sharding** or a *single* channel with payload filtering. |
| **"JWT verification is cheap enough for every WS message"** | Verifying a JWT per incoming message adds ~0.5 ms per op; at 100 ops/sec per socket this becomes noticeable. | Cache the **decoded payload** on the socket after the handshake; only verify the token once. |
| **"Snapshot every 500 ops is sufficient for performance"** | Large boards with thousands of points per stroke may cause a snapshot to be >1 MB, slowing load. | Measure snapshot size after a real user session; adjust threshold based on **bytes per op** rather than count. |
| **"Docker‑Compose can emulate production latency"** | In‑process WS communication on localhost hides network latency and NAT effects present in cloud. | Use a **network‑latency emulation tool** (e.g., `tc` or `toxiproxy`) in CI to test 50–150 ms round‑trip and verify UI remains responsive. |
| **"One‑node PostgreSQL will not become a bottleneck"** | Write‑heavy workloads (operation log) can hammer the WAL; concurrent inserts may queue. | Benchmark `INSERT` of 10k ops per second on the chosen instance type; if the DB saturates, move the op log to **TimescaleDB** or **Cassandra**. |
| **"Users will stay on a single board for the entire session"** | In practice, users switch boards frequently; each switch triggers a snapshot load, potentially causing “cold‑start” spikes. | Log board‑switch frequency in a test group; consider **pre‑warming** the cache for popular boards. |
| **"Undo/Redo will be a simple stack"** | Collaborative undo must be *global* (all participants see the same history); a per‑client stack diverges. | Determine whether you need **global linear undo** (hard) or **per‑client undo** (simple). Prototype both before committing to a data model. |

---

## 4. Simplified MVP Architecture  

Below is a **leaner** stack that satisfies the same functional goals while reducing operational overhead.  You can evolve toward the original design later if metrics demand it.

```
+----------------------+      WebSocket/HTTP (NestJS)      +----------------------+
|  Browser (React TS)  | <------------------------------> |  Single NestJS App    |
|  - Canvas (native)   |   socket.io-client  /  REST API  |  - REST endpoints   |
|  - Simple toolbar   |                                   |  - socket.io gateway |
|  - JWT (bearer)      |                                   |  - In‑process rooms |
+----------------------+                                   +----------------------+
          |                                                        |
          |   (optional)                                            |
          v                                                        v
+----------------------+                               +----------------------+
|  PostgreSQL (RDS)    |                               |  Redis (optional)   |
|  - users, boards    |    <-- Op Log (JSON) -->       |  - Pub/Sub for WS   |
|  - snapshots (JSON) |                               |  - Rate limiting   |
+----------------------+                               +----------------------+

Static assets can be served by the same NestJS HTTP server (or a tiny Nginx container).  
All services run as Docker containers; Docker‑Compose is sufficient for dev and early staging.
```

### Key Simplifications  

1. **Single NestJS Service** – eliminates duplicate config, reduces deployment surface.  
2. **Native Canvas + small React wrapper** – <150 KB bundle, good mobile performance.  
3. **JWT bearer token only** – store in `localStorage` for simplicity (ensure `SameSite=Strict` for any cookie fallback).  
4. **Redis optional** – start without it; use built‑in Socket.io rooms. Add only when you need horizontal scaling.  
5. **Snapshot after N ops *or* size threshold** – persisted synchronously; delete old ops in the same transaction.  
6. **Docker‑Compose + GitHub Actions** – build images, run unit tests, push to registry; deploy to a single‑node K8s only when you have >50 concurrent boards.  

---

## 5. Revised Milestone Timeline (Lean)

| Week | Focus | Deliverable |
|------|-------|-------------|
| 0 | **Foundations** – monorepo, Docker‑Compose, CI lint/test, DB migrations. | Repo builds, local dev stack runs. |
| 1‑2 | **Auth & Guard** – email/password JWT, `AuthGuard` for HTTP & WS. | Secure login, token‑validated socket connection. |
| 3‑4 | **Realtime Core** – single NestJS WS gateway, in‑process rooms, operation log + snapshot logic (no Redis). | Real‑time draw, optimistic UI, persistence. |
| 5‑6 | **Canvas UI** – native Canvas wrapper, free‑hand + rectangle + text, toolbar, URL sharing. | Users can draw together instantly. |
| 7 | **Snapshot & Cleanup** – periodic roll‑up, delete old ops, Redis added only for rate‑limit if needed. |
| 8 | **ACL Expansion** – board ACL JSON column, invite endpoint, UI for collaborator list. |
| 9 | **Production‑Ready Docker** – single Dockerfile, health checks, simple ingress (NGINX). |
| 10 | **MVP Validation** – user testing, latency/throughput profiling, fix race conditions. |
| 11‑12 | **Optional Enhancements** – OAuth2, CDN for static assets, Helm chart for future scaling. |

> **Note:** The above timeline compresses the original 11‑week plan by *removing* the separate WS service, Redis‑backed adapter, and full K8s deployment until after the MVP is proven.  

---

## 6. Actionable Checklist for the Team  

- [ ] **Decide on conflict model**: pick *server‑ordered ops* **or** integrate Yjs now.  
- [ ] **Remove Redis from the dev compose**; add a flag to enable it later.  
- [ ] **Consolidate API + WS** into a single NestJS project.  
- [ ] **Replace fabric.js** with a thin Canvas wrapper; benchmark bundle size.  
- [ ] **Implement snapshot roll‑up** that also deletes old ops in a transaction.  
- [ ] **Store JWT only in Authorization header**; drop the cookie path for now.  
- [ ] **Add simple rate limiter** (token bucket) in the WS connection handler.  
- [ ] **Write integration test** for concurrent edits on the same shape.  
- [ ] **Benchmark DB insert throughput** with realistic op payloads (≈200 bytes/op).  
- [ ] **Set up Docker‑Compose CI** that runs the full stack and executes a basic “draw‑two‑clients” functional test.  

---

## 7. When to Re‑introduce the “Full” Stack  

| Trigger | What to Add |
|--------|-------------|
| **> 2 k concurrent WS connections** | Deploy **Redis adapter**, split WS into its own service, enable HorizontalPodAutoscaler. |
| **> 5 k active boards** | Move operation log to a **document store** (MongoDB, DynamoDB) for better append performance. |
| **Security audit** | Add **Auth0/OAuth** for SSO, enforce **SameSite=Strict** cookies, rotate JWT signing keys. |
| **Global latency** | Introduce **CDN** for static assets, enable TLS termination at edge, consider **WebRTC data channels** for peer‑to‑peer drawing. |
| **Version history** | Store periodic snapshots in **object storage** (S3/GS) and serve replay via a lightweight worker. |

---

### Bottom Line  

The original architecture is solid for a **large‑scale production** system but introduces a lot of moving parts before the core product—**real‑time drawing**—has been validated.  By stripping back to a single NestJS process, native Canvas, and an optional Redis layer, you can ship a functional MVP in 8–10 weeks, gather real‑world usage data, and then invest in the additional components *only where metrics justify them*.  

---  

*Prepared by: Senior Engineering Critic*  
*Date: 2026‑05‑19*  

