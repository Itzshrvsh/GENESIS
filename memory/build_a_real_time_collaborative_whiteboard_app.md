
# PROJECT IDEA

Build a real-time collaborative whiteboard app


# ARCHITECT OUTPUT

# Real‑time Collaborative Whiteboard – Architecture Overview

| Layer | Technology | Reason |
|-------|------------|--------|
| **Client** | React + TypeScript, **Konva** (canvas abstraction), **Socket.IO‑client** | Modern UI, strong typing, easy drawing primitives, built‑in WebSocket support |
| **API / Real‑time server** | Node.js + TypeScript, **Express**, **Socket.IO**, **JWT** auth | Minimal runtime, single code‑base for HTTP + WS, mature ecosystem |
| **Persistence** | PostgreSQL (via **TypeORM**) + **Redis** (pub/sub & presence) | Relational storage for board data, fast in‑memory store for session/room coordination |
| **Infrastructure** | Docker Compose (dev), Kubernetes (prod optional) | Consistent environment, easy scaling |
| **CI/CD** | GitHub Actions → Docker build → Helm/Kustomize (K8s) or Docker‑Compose deploy | Automated, reproducible pipeline |

---

## 1. High‑level System Diagram  

```
+-------------------+          WebSocket          +-------------------+
|   Browser (SPA)   | <-------------------------> |   Node.js Server  |
|  React + Konva    |   HTTP (REST) & WS Events   | Express + SocketIO|
+--------+----------+                               |
         |                                        |
         |   REST (auth, board CRUD)              |
         v                                        v
+-------------------+          SQL            +-------------------+
|  PostgreSQL (RDB) | <----------------------> |   TypeORM (ORM)   |
+-------------------+                           |
                                               |
+-------------------+          Pub/Sub          |
|    Redis (Cache)  | <--------------------------+
+-------------------+
```

* All real‑time messages flow through **Socket.IO**; they are broadcast only to users in the same board (room).
* Board state changes are persisted asynchronously to PostgreSQL.
* Redis stores:
  * Active room membership for presence indicators.
  * Socket.IO adapter (horizontal scaling).

---

## 2. Core Components  

### 2.1 Front‑end

| Component | Responsibility |
|-----------|-----------------|
| **App Router** | Handles login, board list, and board URL (`/board/:id`). |
| **AuthProvider** | Wraps app, stores JWT in memory (or HttpOnly cookie), injects auth header for API calls. |
| **BoardPage** | Loads board metadata, creates a Socket.IO connection for the board’s room. |
| **CanvasLayer** (Konva) | Renders shapes, strokes, images. Exposes API `addElement`, `updateElement`, `removeElement`. |
| **Toolbar** | UI for selecting tool (pen, rect, ellipse, text, image), color, thickness. |
| **CollaborationLayer** | Subscribes to Socket.IO events, updates CanvasLayer in real time. |
| **PresenceOverlay** | Shows other users’ cursors & names (position streamed via `cursor-move` events). |
| **Undo/Redo Stack** | Local operation history; on undo it emits a `undo` event to the server, which rebroadcasts. |

**Message Flow (client → server)**  

| Event | Payload |
|-------|---------|
| `join-board` | `{ boardId, token }` – server validates and adds socket to room. |
| `draw-element` | `{ id, type, data, version }` – broadcast to others & persisted. |
| `update-element` | `{ id, data, version }` |
| `delete-element` | `{ id }` |
| `cursor-move` | `{ userId, x, y }` (throttled). |
| `undo` / `redo` | `{ elementId }` – server reverts state and broadcasts. |

### 2.2 Back‑end

#### 2.2.1 API Layer (Express)

* **Auth routes** – `/api/auth/login`, `/api/auth/register` → issue JWT (HS256, short‑lived, refresh token optional).  
* **Board CRUD** – `/api/boards` (GET, POST), `/api/boards/:id` (GET, PATCH, DELETE).  
* **Middleware** – JWT validation, request body validation (Zod).

#### 2.2.2 Real‑time Engine (Socket.IO)

* **Namespace** `/board` – each board is a Socket.IO **room** (`board:{boardId}`).
* **Connection flow**:  
  1. Client emits `join-board` with JWT.  
  2. Server validates token, checks board access, `socket.join(room)`.  
  3. Server emits current board state (`initial-state`) – list of elements ordered by `zIndex`.  
* **Event handlers**: `draw-element`, `update-element`, `delete-element`, `cursor-move`, `undo`, `redo`.  
* **Versioning** – each element carries an integer `version`. Server increments on every change; helps detecting stale updates.

#### 2.2.3 Persistence Layer (TypeORM)

```ts
@Entity()
class Board {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string;

  @OneToMany(() => Element, (e) => e.board, { cascade: true })
  elements: Element[];
}

@Entity()
class Element {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Board, (b) => b.elements)
  board: Board;

  @Column()
  type: 'stroke' | 'rect' | 'ellipse' | 'text' | 'image';

  @Column('jsonb')
  data: any; // Konva shape attributes

  @Column()
  zIndex: number;

  @Column()
  version: number;
}
```

* **Write path** – on each drawing event the server writes the element (or update) asynchronously (`await repo.save(element)`).  
* **Read path** – initial board load uses a simple `findOne` with `relations: ['elements']`.

#### 2.2.4 Presence & Scaling (Redis)

* **Socket.IO adapter** – `socket.io-redis` uses Redis pub/sub so multiple server instances share rooms.  
* **Presence store** – `HSET board:{id}:presence userId '{"x":123,"y":456}'`. Clients poll (or receive `presence-update` events) for list of active cursors.

### 2.3 Data Model Summary

| Table | Key fields |
|-------|------------|
| `users` | `id (uuid)`, `email`, `name`, `passwordHash` |
| `boards` | `id`, `ownerId`, `title`, `createdAt` |
| `elements` | `id`, `boardId`, `type`, `data (jsonb)`, `zIndex`, `version` |
| `board_access` (optional) | `boardId`, `userId`, `role` (viewer/editor) |

---

## 3. API Design (REST)

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST | `/api/auth/register` | Create user | `{ email, password, name }` | `{ token, user }` |
| POST | `/api/auth/login` | Login | `{ email, password }` | `{ token, user }` |
| GET | `/api/boards` | List boards user can access | – | `Board[]` |
| POST | `/api/boards` | Create new board | `{ title }` | `Board` |
| GET | `/api/boards/:id` | Get board metadata | – | `Board` |
| PATCH | `/api/boards/:id` | Rename / change settings | `{ title? }` | `Board` |
| DELETE | `/api/boards/:id` | Delete board | – | `{ success: true }` |

All routes require `Authorization: Bearer <jwt>` header except register/login.

---

## 4. Real‑time Message Protocol (Socket.IO)

All payloads are JSON. Version numbers are required for conflict detection.

| Event | Direction | Payload |
|-------|------------|---------|
| `join-board` | C→S | `{ boardId: string, token: string }` |
| `initial-state` | S→C | `{ elements: Element[] }` |
| `draw-element` | C↔S | `{ element: Element }` |
| `update-element` | C↔S | `{ id: string, data: any, version: number }` |
| `delete-element` | C↔S | `{ id: string }` |
| `cursor-move` | C↔S (throttled 30 Hz) | `{ userId: string, x: number, y: number }` |
| `presence-update` | S→C (broadcast) | `{ users: [{ userId, x, y }] }` |
| `undo` / `redo` | C↔S | `{ elementId: string }` |
| `error` | S→C | `{ code, message }` |

---

## 5. Security Considerations

1. **JWT** – short expiration (15 min) + refresh token endpoint. Store token in HttpOnly cookie or memory; never in localStorage if possible.  
2. **Input Validation** – use **Zod** on both client and server for all JSON payloads.  
3. **Authorization** – every Socket.IO `join-board` validates token and board ACL.  
4. **Rate limiting** – Express‑rate‑limit on REST endpoints; Socket.IO throttling for `cursor-move` and drawing events.  
5. **CORS** – restrict origins to the deployed front‑end domain.  
6. **Data sanitisation** – restrict `data` fields to allowed Konva attributes; reject unknown keys to prevent injection.  

---

## 6. Deployment & Operations

### 6.1 Development (Docker‑Compose)

```yaml
version: "3.9"
services:
  api:
    build: ./backend
    ports: ["4000:4000"]
    environment:
      - DATABASE_URL=postgres://postgres:postgres@db:5432/whiteboard
      - REDIS_URL=redis://redis:6379
    depends_on: [db, redis]

  web:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      - REACT_APP_API_URL=http://localhost:4000

  db:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes: ["db-data:/var/lib/postgresql/data"]

  redis:
    image: redis:7

volumes:
  db-data:
```

* `npm run dev` for both client and server with hot reload.

### 6.2 Production (Kubernetes – optional)

* Deploy **API** and **Web** as separate Deployments (replicas ≥2).  
* Use **Redis** and **PostgreSQL** managed services (or StatefulSets).  
* Attach **socket.io‑redis** adapter to share rooms across API pods.  
* Ingress with TLS termination (Let’s Encrypt).  
* Horizontal Pod Autoscaler on API based on CPU & WebSocket connections.  

### 6.3 Monitoring & Logging

* **Prometheus** + **Grafana** – scrape `process_cpu_seconds_total`, `nodejs_eventloop_lag_seconds`, and Redis connection metrics.  
* **ELK** or ** Loki** for log aggregation.  
* Health endpoints: `/healthz` (Express) returning DB & Redis connectivity status.  

---

## 7. Development Workflow (GitFlow Lite)

1. `main` – stable release.  
2. Feature branches `feat/<name>` → PR → Review → Merge into `develop`.  
3. CI runs unit tests (Jest for both front & back), lint, build Docker images.  
4. Merge to `main` triggers production pipeline (Docker tag `latest` + Helm upgrade).  

---

## 8. Scaling Path

| Scale Trigger | Action |
|---------------|--------|
| **More concurrent users per board** | Add more API replicas; ensure socket.io‑redis is provisioned with enough pub/sub capacity. |
| **Large board history** | Introduce **snapshot** mechanism: every N operations write a board snapshot; clients load latest snapshot + incremental ops. |
| **Offline editing** | Optional CRDT layer on the client; out of scope for MVP. |
| **Geographical latency** | Deploy API & Redis in multiple regions + use a global load balancer with sticky sessions for WebSocket affinity. |

---

## 9. MVP Feature Checklist

| ✅ | Feature |
|----|---------|
| ✔ | User registration / login (JWT) |
| ✔ | Board list & creation |
| ✔ | Real‑time drawing of free‑hand strokes, rectangles, ellipses, text |
| ✔ | Cursor presence with user name |
| ✔ | Undo / redo (local + broadcast) |
| ✔ | Persistence of board state in PostgreSQL |
| ✔ | Basic permission: board owner can delete |
| ✔ | Docker‑Compose dev environment |
| ☐ | Export board as PNG / SVG |
| ☐ | Invite link / share permissions |
| ☐ | Version history / rollback |
| ☐ | Mobile‑friendly gestures |

---

**Takeaway:** This stack (React + Konva, Node + Express + Socket.IO, PostgreSQL + Redis) gives a low‑learning‑curve, single‑language (TypeScript) code‑base while supporting real‑time collaboration, persistence, and horizontal scaling. All core components are isolated, well‑documented, and can be replaced independently as the product evolves.

# PLANNER OUTPUT

# Real‑time Collaborative Whiteboard – Project Plan  

Below is a **milestone‑driven** plan that translates the architecture you provided into a concrete implementation roadmap.  
The focus is on delivering a **minimum viable product (MVP)** quickly, then iterating to add polish and scalability features.  

---

## 1. Milestones Overview  

| Milestone | Goal (MVP Scope) | Approx. Duration | Primary Owner(s) |
|-----------|------------------|------------------|------------------|
| **M0 – Project Foundations** | Repo setup, CI pipeline, dev environment (Docker‑Compose) | 1 week | DevOps / Lead |
| **M1 – Authentication & Core API** | User register/login, JWT handling, board CRUD endpoints, basic validation | 2 weeks | Backend |
| **M2 – Real‑time Engine (Socket.IO)** | Join board, broadcast draw/update/delete events, cursor presence, versioning | 2 weeks | Backend |
| **M3 – Front‑end Skeleton** | React + TypeScript scaffolding, routing, auth provider, global state (Redux/Context) | 1 week | Frontend |
| **M4 – Canvas & Drawing Tools** | Konva integration, free‑hand pen, rectangle, ellipse, text, image upload, element model | 3 weeks | Frontend |
| **M5 – Persistence Hook‑up** | Persist elements on draw/update/delete to PostgreSQL (via TypeORM), initial‑state load | 2 weeks | Backend |
| **M6 – Collaboration Features** | Presence overlay (cursors + names), undo/redo stack with broadcast, basic conflict handling | 2 weeks | Full‑stack |
| **M7 – Testing & Quality** | Unit tests (Jest), integration tests for API & WS, end‑to‑end (Cypress) for core flows | 2 weeks | QA |
| **M8 – CI/CD & Deployment (Dev)** | GitHub Actions, Docker image publishing, Docker‑Compose dev deployment, health checks | 1 week | DevOps |
| **M9 – Production‑Ready Infra** | Kubernetes manifests (or Helm), Redis adapter for Socket.IO, autoscaling, TLS ingress | 2 weeks | DevOps |
| **M10 – Polish & Optional Features** | Export PNG/SVG, board sharing links, basic permission management, UI/UX refinements | 2 weeks | Full‑stack |
| **M11 – Release & Monitoring** | Release to production, Prometheus/Grafana dashboards, log aggregation, post‑mortem plan | 1 week | Ops / All |

**Total estimated time:** ~20 weeks (≈5 months). Adjust based on team size and sprint cadence.

---

## 2. Detailed Implementation Order  

The milestones are **sequentially dependent** only where necessary; parallel work is encouraged where tasks do not clash.

### Milestone 0 – Project Foundations  

| Task | Description | Output |
|------|-------------|--------|
| Repo initialization | Create monorepo (e.g., `nx` or simple two‑folder layout). Add `README`, LICENSE, CODE_OF_CONDUCT. | Git repo |
| Docker‑Compose skeleton | `frontend`, `backend`, `db`, `redis` services (as per architecture). Include env‑file templates. | `docker-compose.yml` |
| GitHub Actions CI | Lint, type‑check, unit‑test, build Docker images. Block merges on CI failures. | `.github/workflows/ci.yml` |
| Pre‑commit hooks | `husky` + `lint‑staged` for formatting & linting. | Hook config |

### Milestone 1 – Authentication & Core API  

| Sub‑task | Owner | Acceptance Criteria |
|----------|-------|---------------------|
| User entity & migrations | Backend | `users` table with `email`, `passwordHash`, `name`, timestamps |
| JWT service | Backend | Sign & verify tokens, short‑lived access + refresh endpoint |
| Auth routes (`/api/auth/*`) | Backend | Register & login return `{ token, user }` |
| Board entity & CRUD routes | Backend | Create, read, update, delete boards; owner enforcement |
| Request validation | Backend | Zod schemas for all payloads, proper 400 responses |
| Security hardening | Backend | CORS whitelist, rate limiting middleware, Helmet headers |
| Integration tests for auth & board API | QA | 100 % pass on happy & error paths |

### Milestone 2 – Real‑time Engine  

| Sub‑task | Owner | Acceptance Criteria |
|----------|-------|---------------------|
| Socket.IO server setup (namespace `/board`) | Backend | Clients can open WS connection |
| `join-board` handshake | Backend | Valid JWT → socket joins `board:{id}` room |
| Event handlers: `draw-element`, `update-element`, `delete-element` | Backend | Broadcast to room, version increment, async DB write |
| Cursor handling (`cursor-move`) with throttling | Backend | ≤30 Hz per client, presence broadcast |
| Redis adapter wiring | Backend | Multiple API instances share rooms |
| Basic error handling (`error` event) | Backend | Consistent error payloads |
| Unit tests for socket handlers (mocked Redis) | QA | Coverage >80 % |

### Milestone 3 – Front‑end Skeleton  

| Sub‑task | Owner | Acceptance Criteria |
|----------|-------|---------------------|
| React + TypeScript project (Create‑React‑App or Vite) | Frontend | Compile without errors |
| Router (`react-router-dom`) | Frontend | Routes: `/login`, `/boards`, `/board/:id` |
| AuthProvider (Context) | Frontend | Stores JWT in memory, injects `Authorization` header |
| Global state (Redux Toolkit or React Context) | Frontend | Holds user, board list, current board meta |
| UI layout (header, sidebar, main canvas area) | Frontend | Responsive 1024 px+ layout |
| API client wrapper (axios/fetch) with interceptor | Frontend | Automatic token header, error handling |

### Milestone 4 – Canvas & Drawing Tools  

| Sub‑task | Owner | Acceptance Criteria |
|----------|-------|---------------------|
| Konva integration on `BoardPage` | Frontend | `<Stage>` + `<Layer>` renders |
| Shape abstraction (`Element`) matching backend model | Frontend | `id`, `type`, `data`, `zIndex`, `version` |
| Toolbar UI (pen, rect, ellipse, text, image upload) | Frontend | Selecting tool updates cursor mode |
| Free‑hand drawing (pen) | Frontend | Stroke captured as points, emitted as `draw-element` |
| Rect / ellipse creation (`onMouseDown` → `onMouseUp`) | Frontend | Shape added with proper attributes |
| Text insertion (inline edit) | Frontend | Text element created, supports edit |
| Image upload (client‑side file → base64 URL) | Frontend | Image displayed, `draw-element` payload includes data URL |
| Local element registry & Z‑index handling | Frontend | New elements appear on top, can be reordered later |

### Milestone 5 – Persistence Hook‑up  

| Sub‑task | Owner | Acceptance Criteria |
|----------|-------|---------------------|
| TypeORM entities (`Board`, `Element`) | Backend | Matching DB schema |
| Service layer: `saveElement`, `updateElement`, `deleteElement` | Backend | Handles async DB ops, returns persisted entity |
| `initial-state` emission on `join-board` | Backend | Client receives full element list ordered by `zIndex` |
| Client side: on `initial-state` populate Konva layer | Frontend | Board re‑creates all elements exactly |
| Error fallback (if DB write fails) | Backend + Frontend | Retry logic / UI toast, no silent loss |

### Milestone 6 – Collaboration Features  

| Sub‑task | Owner | Acceptance Criteria |
|----------|-------|---------------------|
| PresenceOverlay component | Frontend | Shows other users’ cursors with names |
| Throttled cursor emission (30 Hz) | Frontend | Uses `requestAnimationFrame` + debounce |
| Undo/Redo stack (client‑side) | Frontend | `Ctrl+Z / Ctrl+Y` triggers `undo`/`redo` events |
| Server‑side undo/redo handling | Backend | Reverts element version, broadcasts updated state |
| Conflict detection via `version` field | Backend | Stale updates rejected with `error` event |
| Simple permission (owner can delete board) | Backend | 403 on unauthorized actions |
| UI feedback for remote changes (e.g., highlight updated element) | Frontend | Brief animation on incoming updates |

### Milestone 7 – Testing & Quality  

| Layer | Tools | Target |
|-------|-------|--------|
| Unit | Jest (TS), ts‑jest | 80 % coverage backend, 75 % frontend |
| Integration (API) | supertest + in‑memory PostgreSQL (pg‑mem) | All auth & board routes |
| WebSocket integration | socket.io‑client + mocked Redis | Event flow correctness |
| E2E | Cypress (or Playwright) | Register → login → create board → draw → open second browser → see updates |
| Lint/Format | ESLint + Prettier | No lint errors on CI |

### Milestone 8 – CI/CD & Development Deployment  

| Task | Details |
|------|---------|
| GitHub Actions workflow | `build`, `test`, `docker build`, `push` to GitHub Packages |
| Docker‑Compose dev script | `npm run dev` starts frontend & backend with hot reload |
| Health endpoints (`/healthz`) | Return 200 only if DB & Redis reachable |
| Automated PR preview (optional) | Deploy preview stack on a separate namespace using `docker compose up` in cloud CI runner |

### Milestone 9 – Production‑Ready Infrastructure  

| Component | Action |
|-----------|--------|
| Kubernetes manifests | Deployments for `api` and `web`, Service (ClusterIP), Ingress (TLS) |
| Helm chart (or Kustomize) | Parameterised values: image tag, replica count, resource limits |
| Redis adapter configuration | `socket.io-redis` with connection URL from secret |
| Autoscaling | HPA based on CPU & custom metric `socket.io_active_connections` |
| Secrets management | GitHub Secrets → Kubernetes `Secret` (DB URL, JWT secret) |
| Monitoring stack | Prometheus‐exporter for Node, Redis, PostgreSQL; Grafana dashboards |
| Log aggregation | Loki + Promtail or ELK; include request IDs for tracing |

### Milestone 10 – Polish & Optional Features  

| Feature | Rationale (MVP vs. later) |
|---------|---------------------------|
| Export board as PNG / SVG | Nice‑to‑have; can use Konva `stage.toDataURL()` |
| Shareable invite link (read‑only) | Requires additional ACL table; postpone until core stable |
| Role‑based permissions (viewer/editor) | Future growth, not needed for MVP |
| Snapshot mechanism for large boards | Improves load time for boards with >10 k elements; later optimization |
| Mobile touch gestures | Already works via Konva; UI polish in this sprint |

### Milestone 11 – Release & Monitoring  

| Activity | Owner |
|----------|-------|
| Production rollout (blue‑green) | DevOps |
| Smoke test checklist (login → board → draw) | QA |
| Enable alerts (CPU, latency, WS disconnects) | Ops |
| Post‑release retrospective | All |

---

## 3. Resource Allocation (Example for a 4‑person team)

| Role | Team Member(s) | Primary Milestones |
|------|----------------|--------------------|
| **Backend Lead** | Engineer A | M0‑M2, M5‑M6, M9 |
| **Frontend Lead** | Engineer B | M0‑M4, M6‑M7, M10 |
| **Full‑stack / QA** | Engineer C | M1‑M3, M7‑M8, M11 |
| **DevOps / Infra** | Engineer D | M0, M8‑M9, Monitoring setup |

*Cross‑functional pairing* (e.g., Backend+Frontend on M2) reduces hand‑off friction.

---

## 4. Risk Mitigation & Over‑Engineering Guardrails  

| Risk | Mitigation | Over‑engineering Check |
|------|-------------|------------------------|
| **Real‑time data loss** (network drop) | Server writes every event to PostgreSQL before broadcasting ACK; client retries on socket reconnect. | Do not implement full CRDT or OT in MVP; simple version check + retry suffices. |
| **Scaling before need** | Start with single API replica; add Redis adapter only when second instance is introduced (still add early for code simplicity). | Keep scaling config (Helm values) separate; do not provision auto‑scaling until load testing indicates need. |
| **Too many drawing tools** | Implement core shapes first (pen, rect, ellipse, text). Defer image upload & advanced brushes. | Add a “tool registry” only if you anticipate many future tools; otherwise hard‑code the four. |
| **Complex permission system** | Start with owner‑only edit/delete. Store simple `ownerId` on `Board`. | Delay ACL tables and role management until a sharing feature is requested. |
| **Heavy client state management** | Use React Context + simple reducers for MVP. | Avoid introducing Redux Toolkit or MobX until the state graph grows beyond a few dozen items. |
| **Monolithic repo complexity** | Use a single repo with two `package.json` workspaces; keep Dockerfiles separate but minimal. | Do not split into micro‑services unless a clear need for independent deployment arises. |

---

## 5. Deliverables Summary  

| Milestone | Key Deliverable(s) |
|-----------|--------------------|
| M0 | Git repo, Docker‑Compose, CI pipeline |
| M1 | Auth & board REST API, DB migrations |
| M2 | Socket.IO server with core events, Redis adapter |
| M3 | React app skeleton, routing, auth context |
| M4 | Fully functional Konva canvas with 4 drawing tools |
| M5 | Persistent storage of elements, `initial-state` sync |
| M6 | Presence cursors, undo/redo, basic conflict handling |
| M7 | Full test suite (unit, integration, E2E) |
| M8 | Automated CI/CD, dev deployment script |
| M9 | Production‑ready K8s manifests, monitoring |
| M10 | Export PNG/SVG, share link stub, UI polish |
| M11 | Production release, alerting, post‑mortem documentation |

---

### Next Step  

*Kick‑off meeting*: Agree on sprint cadence (2‑week sprints), assign owners for Milestones 0–2, and spin up the shared Docker‑Compose environment.  

From there, each sprint will deliver a **shippable increment** that can be demoed to stakeholders, ensuring early feedback and preventing scope creep.

# CRITIC OUTPUT

# Engineering Critique of the Proposed Real‑time Collaborative Whiteboard

Below is a systematic review of the architecture and project plan you provided.  
The focus is on **risk exposure**, **unnecessary complexity**, **questionable assumptions**, and **opportunities to simplify** while still meeting the MVP goals.

---

## 1. High‑Level Risk Assessment

| Area | Specific Risk | Impact | Mitigation / Simplification |
|------|---------------|--------|------------------------------|
| **Authentication** | JWT stored in memory on the client, optional HttpOnly cookie not enforced. | Token leakage via XSS, session loss on page refresh. | Prefer **HttpOnly, SameSite‑Strict cookies** for access tokens; keep short‑lived JWT **only on the server** and use a refresh endpoint if you need long sessions. |
| **Real‑time bandwidth** | Every low‑level drawing operation (e.g., each mouse move point) is sent as a separate Socket.IO event and persisted individually. | DB write amplification, network congestion, latency spikes on busy boards. | **Throttle/batch** drawing points (e.g., send points in chunks of 10‑20, debounce at 30‑50 ms). Persist only the final shape or a compact path representation. |
| **Data consistency** | Simple integer `version` per element; no conflict‑resolution strategy beyond rejecting stale updates. | Lost updates if two users edit the same element almost simultaneously; undo/redo may diverge. | For MVP, **lock the element while a user is editing** (send a `lock-element` event). Consider a lightweight **operational transform (OT)** or **CRDT** only if you see real conflict cases later. |
| **Scaling assumption** | Redis is added early for Socket.IO adapter & presence store. | Operational overhead (cluster config, persistence, monitoring) before a single‑node deployment actually needs it. | Start with **in‑process Socket.IO rooms**. Add `socket.io-redis` only when you spin up a second API replica (post‑MVP). |
| **Persistence model** | Each element is stored as a row with a JSONB `data` column. | Large boards can create thousands of rows, leading to heavy queries on load (`SELECT * FROM elements`). | Implement **snapshotting** early: after every N operations (e.g., 200) write a full board image or compressed JSON blob; on board load, fetch the latest snapshot plus incremental deltas. |
| **Authentication flow** | Short‑lived JWT + optional refresh token; the plan mentions both but does not specify a refresh endpoint. | Users may be forced to re‑login frequently; token revocation becomes hard. | Define a **single refresh endpoint** (`POST /api/auth/refresh`) that issues a new access token while the refresh token lives longer (httpOnly cookie). |
| **Security** | No explicit mention of **CSRF** protection for JWT stored in cookies, nor of **Content Security Policy**. | Potential CSRF on state‑changing REST endpoints. | Enforce **SameSite=strict** on auth cookies, use **CSRF tokens** for any non‑GET request if you store tokens in cookies. |
| **Testing coverage** | Unit tests defined, but **load / stress testing** for WS throughput is missing. | You may discover performance bottlenecks only after release. | Add a **simple load test** (e.g., k6 or artillery) with 50‑100 concurrent sockets drawing simultaneously before production hand‑off. |
| **Team capacity** | Plan assumes a 4‑person team delivering ~20 weeks of work. | Hidden dependencies (e.g., DB migrations, CI integration) can cause schedule slips. | Maintain a **thin “definition of done”** per milestone; split large tickets (e.g., “Canvas & Drawing Tools”) into tiny, test‑first increments. |

---

## 2. Over‑engineering Spots

| Component | Why It May Be Overkill for MVP | Suggested Simpler Alternative |
|-----------|--------------------------------|-------------------------------|
| **TypeORM** (full ORM with lazy loading, cascade, etc.) | Adds compile‑time boilerplate, migrations, runtime reflection; limited benefit for simple CRUD on `boards` & `elements`. | Use **Prisma** (schema‑first, auto‑generated types) **or** plain **node‑postgres** with typed queries. |
| **Kubernetes** (Helm/Kustomize) for production | Complex CI/CD, secret management, monitoring stack that isn’t needed until >2‑3 API replicas. | Deploy via **Docker Compose** on a single VM or a managed **Render / Fly.io** container service; add K8s later if traffic justifies. |
| **Redis presence store** (hash per board for cursor positions) | Cursor positions are transient; broadcasting directly via Socket.IO is sufficient for a few hundred users. | Keep cursor data **in‑memory** on each node and broadcast to room; drop Redis for presence until you need multiple nodes. |
| **Full Undo/Redo broadcast** (server‑side state reversal) | Requires version tracking, event reversal logic, and extra DB writes. | Implement **client‑only undo/redo** for the MVP; if a user disconnects, simply reload the board state from DB. |
| **Separate API + WS servers** (same Node process but distinct logical layers) | Adds duplicated routing & auth middleware. | Consolidate into a **single Express app** that registers both REST routes and Socket.IO; share the same auth middleware. |
| **Role‑based ACL tables** (viewer/editor) | Not needed for core “owner‑only” sharing scenario. | Keep a simple `ownerId` column. Add an ACL table only when a sharing feature is explicitly requested. |
| **Image upload as base64 data URL** stored in `Element.data` | Increases DB size quickly; risk of hitting row size limits. | Store images in **object storage** (e.g., S3‑compatible MinIO) and keep only the URL in the element JSON. |
| **Extensive CI pipelines** (Docker build, Helm lint, security scanning) before any code is merged. | While valuable, may block early iteration. | Start with **linters + unit tests**; add security scans and Helm validation after the first stable release. |

---

## 3. Weak Assumptions & Questions to Re‑evaluate

| Assumption | Why It May Not Hold | Probing Questions |
|------------|---------------------|-------------------|
| “All users will draw on the same board at the same time” | Real usage may involve many idle viewers, few active editors. | What is the expected **ratio of viewers to editors**? Should we prioritize read‑scale (caching) over write‑scale? |
| “WebSocket + Socket.IO is the best choice for real‑time” | Socket.IO abstracts away native WebSocket but adds extra overhead (fallback transports, packet framing). | Would **pure WebSocket** (or a lightweight library like `ws`) be sufficient for the low‑latency drawing use‑case? |
| “PostgreSQL can handle per‑stroke writes” | High‑frequency writes could exhaust connection pools. | Have you benchmarked **writes per second** for the chosen schema? Would **batch inserts** or an **append‑only event table** be more performant? |
| “Clients will keep a full copy of the board in memory” | Large boards (>10k elements) may exhaust browser memory. | Do you need a **virtualized canvas** (render only visible elements) for large boards? |
| “Token validation on every Socket.IO emit is cheap” | Re‑validating JWT for each event can be CPU‑intensive at scale. | Could you **authenticate once** on `join-board` and then store the user ID on the socket context? |
| “Undo/redo can be done by simply re‑broadcasting the last operation” | Complex actions (grouped strokes, image moves) need scoped undo groups. | How will you **group related events** (e.g., a multi‑point stroke) into a single undo action? |
| “Docker Compose dev environment is enough for all developers” | Some devs may need hot‑reload of both client and server simultaneously; networking can be flaky. | Do you have a **monorepo with `concurrently` scripts** to start both services with shared TypeScript watch? |

---

## 4. Recommendations to Simplify & De‑risk the MVP

### 4.1 Consolidate the Runtime Stack

1. **Single Express + Socket.IO app** – expose REST routes under `/api/*` and mount Socket.IO directly. Share the same JWT auth middleware; avoid duplicate server processes.
2. **Replace TypeORM with Prisma** (or even plain queries). Prisma’s generated types give the same type safety with less configuration, migrations are straightforward, and you avoid the “entity‑relationship” overhead of a full ORM.
3. **Drop Redis initially** – use the built‑in Socket.IO in‑process adapter for rooms. Add `socket.io-redis` only when you need >1 API replica.

### 4.2 Trim Real‑time Payloads

* **Batch drawing points** – client buffers mouse move events (30 ms interval) and sends a single `draw-path` payload: `{ id, points: [{x,y},…], style }`.
* **Persist only the final shape** – after the user finishes a stroke (`mouseup`), write the completed element to DB; intermediate points can be in‑memory only.
* **Versioning** – keep a simple monotonically increasing board version; send it with each broadcast. Clients can ignore stale messages rather than handling per‑element versions.

### 4.3 Authentication & Session Handling

* Issue **HttpOnly, SameSite‑Strict** cookies for the **access token** (15 min). Store a **refresh token** (long‑lived) also as HttpOnly cookie.
* On **WebSocket connection**, read the cookie server‑side (Socket.IO can access HTTP headers). No need to pass the token in the payload.
* Provide a **`POST /api/auth/refresh`** endpoint; the client silently calls it when it receives a `401` on any REST call.

### 4.4 Persistence Strategy for Large Boards

* **Snapshot Table** – `board_snapshots (boardId, snapshotJson, createdAt)`. Write a snapshot after every **N** operations (e.g., 200) or every 30 seconds.
* **Delta Table** – optional for future scaling; for MVP you can simply replace the board’s `elements` rows on each operation (DELETE+INSERT) without delta storage.

### 4.5 Undo/Redo (MVP Scope)

* Keep **client‑side stacks** (`undoStack`, `redoStack`). When a user triggers undo, emit `undo-element` with the element’s full previous state.
* Server validates that the element belongs to the user (or board owner) and simply **replaces** the element in DB, then broadcasts the new state.
* No need to implement **global operation logs** or **CRDT** until a real conflict scenario emerges.

### 4.6 Dev / CI Simplification

| Stage | Suggested Tooling |
|-------|-------------------|
| **Lint / Type checking** | ESLint + Prettier + `tsc --noEmit` (run on every PR). |
| **Unit tests** | Jest (frontend + backend) – 80 % coverage on core modules only. |
| **Integration** | Supertest for REST; `socket.io-client` with in‑memory Redis mock for WS. |
| **E2E** | Cypress (two browsers – one acting as user A, another as user B). |
| **CI pipeline** | GitHub Actions: `install → lint → test → build image → push`. Skip Helm lint until you create the Helm chart. |
| **Local dev** | `docker compose up --build` + `npm run dev` inside each container (watch mode). Consider using **VS Code Remote Containers** for a single‑click dev environment. |

### 4.7 Progressive Scaling Path

| Scale Trigger | Action |
|---------------|--------|
| **2nd API replica** | Add `socket.io-redis` adapter, migrate Redis config to a dedicated service. |
| **>5 k elements per board** | Enable **snapshot loading**, lazy‑render off‑screen elements. |
| **Geographic latency** | Deploy **regional API instances** behind a Global Load Balancer with sticky sessions (WebSocket affinity). |
| **High write volume** | Switch to **batch inserts** or a **write‑ahead log** (e.g., Kafka) and off‑load the DB writes to a background worker. |

---

## 5. Revised Minimal‑Viable Architecture (Diagram)

```
+-------------------+          HTTP/WS          +-------------------+
|   Browser (SPA)   | <-----------------------> |   Node (Express)  |
| React + TS +      |   REST endpoints + WS    |   + Socket.IO    |
| Konva canvas      |                          |   (single process)|
+--------+----------+                          +--------+----------+
         |                                           |
         |   PostgreSQL (via Prisma)                |
         |   (board, element tables)                |
         v                                           v
+-------------------+                        +-------------------+
|   PostgreSQL      |                        |   In‑process      |
|   (persistent)    |                        |   room state     |
+-------------------+                        +-------------------+

# Optional (post‑MVP)
#   Redis -> socket.io-redis adapter for multi‑node scaling
#   Snapshot table for large boards
```

Key points:

* **One server process** – no separate “real‑time server” binary.
* **Prisma** for type‑safe DB access (replace TypeORM).
* **Redis only when scaling out**; otherwise omitted.
* **Auth via HttpOnly cookies** – no token in WS payload.
* **Batch drawing payloads** – reduces WS traffic and DB writes.

---

## 6. Immediate Action Items (First 2‑Week Sprint)

| Task | Owner | Deliverable |
|------|-------|-------------|
| Set up monorepo with `frontend/` and `backend/` directories, shared ESLint/Prettier config. | DevOps / Lead | Repo, Dockerfiles, `docker-compose.yml`. |
| Replace TypeORM with Prisma schema, generate client, write simple migration for `users`, `boards`, `elements`. | Backend | Prisma models + `prisma migrate dev`. |
| Implement JWT auth with **HttpOnly + refresh** cookies; basic `/api/auth/*` endpoints. | Backend | Auth API, middleware, unit tests. |
| Build a single Express app that serves both REST routes and mounts Socket.IO. | Backend | `app.ts` with shared auth middleware. |
| Add a **canvas stub** (Konva Stage) that connects to Socket.IO, joins a hard‑coded room, and displays a remote cursor. | Frontend | Minimal real‑time connection demo. |
| Write a **WebSocket throttling utility** (30 ms batch) and integrate it into the drawing flow. | Frontend | Buffered `draw-path` events. |
| Add CI workflow that runs lint + unit tests on PRs. | DevOps | GitHub Actions file. |

Completing these items will give you a **working end‑to‑end loop** (auth → WS join → remote cursor) with a **much reduced code surface**. From there, you can iteratively add board CRUD, element persistence, undo/redo, and UI polish.

---

### Bottom Line

*The proposed architecture is solid but contains several layers of complexity that are unnecessary for delivering the first usable version.*  
By **consolidating the server**, **dropping Redis and TypeORM early**, **batching drawing data**, and **using cookie‑based auth**, you can ship a functional collaborative whiteboard within ~8‑10 weeks, then grow the stack only when concrete scaling or feature demands appear. This approach minimizes operational risk, reduces technical debt, and keeps the team focused on the core user experience.

