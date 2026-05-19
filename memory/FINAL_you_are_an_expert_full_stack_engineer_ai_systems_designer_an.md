# FINAL_PLAN.md  

## 1. Project Goal  
Deliver a **minimum‑viable web‑based AI‑enabled simulation platform** that lets a user  

1. Authenticate via a single OAuth2 provider (Auth0).  
2. Create, edit and store simulation “scenarios”.  
3. Launch a simulation, receive **real‑time telemetry** through a WebSocket, and download the final result artifact.  
4. Access simple AI helpers (template generation, result explanation, parameter suggestions) that call OpenAI’s GPT‑4o via a thin Node wrapper.

All components are containerised, startable locally with **Docker‑Compose**, and can be deployed to a managed Kubernetes cluster via a **single Helm chart**. The design intentionally avoids unnecessary micro‑service sprawl, heavy observability stacks, and duplicated authentication solutions.

---

## 2. Simplified Technology Stack  

| Layer | Technology | Reason |
|-------|------------|--------|
| **Frontend** | React 18 + Vite, TypeScript, MUI, React‑Query, native WebSocket (`ws`) | Fast hot‑reload, component library, data‑fetch caching, lightweight realtime |
| **API Gateway** | Node 20, Express (TypeScript) | Single‑language entry point, easy JWT middleware |
| **Simulation Engine** | Python 3.11, FastAPI, Celery (Redis broker) | Rich scientific ecosystem, async API, background workers |
| **AI Wrapper** | Express routes that call OpenAI SDK (or vLLM behind a flag) | No extra language runtime, easy to replace later |
| **Realtime** | Redis Pub/Sub → Node WebSocket bridge | Simple, reliable, low‑latency |
| **Data Store** | PostgreSQL (managed in prod, Docker image locally) | Relational storage for users, scenarios, simulation metadata |
| **Cache / Message Bus** | Redis | Pub/Sub for telemetry, Celery broker, optional rate‑limit |
| **Object Storage** | MinIO (S3‑compatible) | Stores large simulation artefacts; replaceable with AWS S3 in prod |
| **Auth** | Auth0 (OAuth2 Authorization Code with PKCE) | SaaS solution eliminates self‑hosted Keycloak complexity |
| **Container / Orchestration** | Docker‑Compose (dev) → Helm chart on GKE/EKS/AKS (prod) |
| **CI/CD** | GitHub Actions | Lint → Unit tests → Docker image → Helm deploy |
| **Observability (MVP)** | Prometheus client + `/metrics` endpoint in every service, Grafana dashboard | Minimal but sufficient for early monitoring |
| **Testing** | Jest + React Testing Library, Pytest, Cypress (E2E) | Layered test strategy |

---

## 3. High‑Level Architecture (MVP)

```
+-------------------+   HTTPS   +---------------------------+   HTTP   +-----------------------+
|   SPA (React)    | --------> | API Gateway (Node/Express) | -----> | Simulation Engine      |
| (Vite, MUI, JWT) |           |  - JWT auth                |          | (FastAPI + Celery)    |
+-------------------+           |  - REST CRUD              |          +-----------------------+
        |                       |  - WebSocket server       |
        |                       |  - AI helper routes       |
        v                       +---------------------------+
   Auth0 (OAuth2)                     |
                                      |
                                 +---------+
                                 | Redis   |
                                 | (Pub/Sub|
                                 | + Celery|
                                 +---------+
                                      |
                                +-------------+
                                | PostgreSQL   |
                                +-------------+
                                      |
                                +-------------+
                                | MinIO (S3)   |
                                +-------------+
```

* **Auth0** issues a JWT; the SPA stores it in memory (or an `httpOnly` cookie).  
* Every request to the API Gateway validates the JWT.  
* The **WebSocket** endpoint (`/ws/sim/:runId`) is guarded by the same JWT middleware.  
* Simulation workers publish telemetry to Redis channel `sim:{runId}`; the Node WebSocket server forwards each message to the corresponding socket room.  
* AI helpers are regular Express routes that internally call the OpenAI SDK; prompts are stored in `src/ai/prompts/*.json` for easy swapping.  

---

## 4. Repository Layout (monorepo)

```
root/
├─ .github/                     # GitHub Actions workflows
│   └─ workflows/
│       └─ ci.yml
├─ helm/                        # Single Helm chart
│   └─ simulation-platform/
│       ├─ Chart.yaml
│       ├─ values.yaml
│       └─ templates/
│           ├─ deployment.yaml
│           ├─ service.yaml
│           └─ ... 
├─ docker-compose.yml           # Dev stack
├─ README.md
├─ docs/                        # MkDocs / Swagger UI
├─ frontend/                    # React SPA
│   ├─ src/
│   │   ├─ api/                 # generated TS client
│   │   ├─ components/
│   │   ├─ pages/
│   │   ├─ sockets/
│   │   └─ App.tsx
│   ├─ public/
│   ├─ vite.config.ts
│   ├─ tsconfig.json
│   └─ package.json
├─ backend/                     # Node API Gateway
│   ├─ src/
│   │   ├─ routes/
│   │   │   ├─ auth.ts
│   │   │   ├─ scenarios.ts
│   │   │   ├─ simulations.ts
│   │   │   └─ ai.ts
│   │   ├─ middleware/
│   │   │   ├─ jwt.ts
│   │   │   └─ errorHandler.ts
│   │   ├─ socket/
│   │   │   └─ index.ts
│   │   ├─ db/
│   │   │   └─ prisma/            # Prisma schema + client
│   │   ├─ services/
│   │   │   └─ openai.ts
│   │   └─ app.ts
│   ├─ prisma/
│   │   └─ schema.prisma
│   ├─ Dockerfile
│   ├─ tsconfig.json
│   └─ package.json
├─ simulation/                  # Python simulation microservice
│   ├─ app/
│   │   ├─ main.py               # FastAPI entry point
│   │   ├─ worker.py              # Celery task definitions
│   │   ├─ schemas.py
│   │   └─ utils.py
│   ├─ requirements.txt
│   ├─ Dockerfile
│   └─ celery_worker.sh
├─ ai-service/ (optional stub)  # Not required for MVP; kept for future split
│   └─ (empty)
└─ scripts/
    └─ generate-openapi-client.sh
```

**Key files to create (exact names)**  

| Path | Purpose |
|------|---------|
| `docker-compose.yml` | Starts `frontend`, `backend`, `simulation`, `postgres`, `redis`, `minio`, `auth0-sample` (optional mock) |
| `frontend/src/api/client.ts` | Generated TypeScript client (via OpenAPI) |
| `backend/src/app.ts` | Express app creation, middleware wiring, route mounting |
| `backend/src/routes/auth.ts` | `/api/auth/callback` – exchanges Auth0 code for JWT (optional if using Auth0 SPA flow) |
| `backend/src/routes/scenarios.ts` | CRUD endpoints (`GET /api/scenarios`, `POST /api/scenarios`) |
| `backend/src/routes/simulations.ts` | `POST /api/simulations` (forward to Python service) + status endpoint |
| `backend/src/routes/ai.ts` | `/api/ai/template`, `/api/ai/explain`, `/api/ai/optimize` |
| `backend/src/socket/index.ts` | WebSocket server, subscribes to Redis `sim:{runId}` and forwards messages |
| `backend/src/middleware/jwt.ts` | Express JWT verification using Auth0 JWKS |
| `backend/prisma/schema.prisma` | DB schema (users, scenarios, simulations, ai_requests) |
| `simulation/app/main.py` | FastAPI routes: `POST /run`, health, metrics |
| `simulation/app/worker.py` | Celery task `run_simulation(payload)` that publishes to Redis |
| `simulation/requirements.txt` | `fastapi`, `uvicorn`, `celery[redis]`, `redis`, `numpy`, `pydantic`, `boto3` (MinIO client) |
| `helm/simulation-platform/templates/*` | Deployments, services, configmaps, secrets for all containers |
| `.github/workflows/ci.yml` | Lint, unit tests, Docker build, Helm deploy to staging cluster |

---

## 5. Implementation Roadmap (Milestones)

| # | Milestone | Core Deliverables | Approx. Effort |
|---|-----------|-------------------|----------------|
| 1 | **Environment & CI** | Docker‑Compose file, GitHub Actions (lint + unit tests), README | 1 wk |
| 2 | **Auth0 Integration** | SPA login flow (PKCE), `jwt` middleware, protected API routes | 1 wk |
| 3 | **Backend CRUD API** | Express app, Prisma migrations, OpenAPI spec for `scenarios` & `simulations` | 2 wks |
| 4 | **Frontend Scaffold** | Vite + React project, routing, login page, dashboard (list scenarios), TS client generation | 2 wks |
| 5 | **Simulation Service – Dummy Run** | FastAPI `/run` that sleeps 5 s per tick, Celery worker, Redis Pub/Sub, MinIO placeholder output | 3 wks |
| 6 | **WebSocket Telemetry** | Node WebSocket server, Redis → socket bridge, frontend `WebSocketProvider`, live chart | 2 wks |
| 7 | **Result Persistence** | Store final artefact in MinIO, DB update, signed‑URL download endpoint, UI viewer | 2 wks |
| 8 | **AI Helper Wrapper** | Express routes that call OpenAI SDK, prompt files in JSON, UI buttons for “Generate template”, “Explain”, “Suggest” | 2 wks |
| 9 | **Production Helm Chart** | Single chart deploying all services, Ingress TLS (cert‑manager), HPA for Celery workers, secret handling | 3 wks |
|10 | **Observability & Metrics** | Prometheus client in each container (`/metrics`), Grafana dashboard for request latency, worker queue length | 1 wk |
|11 | **End‑to‑End Tests** | Cypress suite covering login → scenario CRUD → simulation launch → live telemetry → AI calls; integrate into CI | 2 wks |
|12 | **Domain‑Specific Engine Swap** (optional after MVP) | Replace dummy loop with PyBullet / SimPy / SUMO, add domain‑specific UI fields | TBD |
|13 | **Documentation** | MkDocs site with architecture diagram, API reference (Swagger UI), deployment guide | 1 wk |

*The first nine milestones constitute the **MVP**; all are buildable with the folder structure above.*

---

## 6. Data Model (PostgreSQL)

```prisma
model User {
  id          String   @id @default(uuid())
  email       String   @unique
  name        String?
  createdAt   DateTime @default(now())
  scenarios   Scenario[]
  aiRequests  AIRequest[]
}

model Scenario {
  id          String   @id @default(uuid())
  ownerId     String   @relation(fields: [ownerId], references: [id])
  name        String
  configJson  Json
  createdAt   DateTime @default(now())
  simulations Simulation[]
}

model Simulation {
  id          String   @id @default(uuid())
  scenarioId  String   @relation(fields: [scenarioId], references: [id])
  status      SimulationStatus @default(PENDING)
  startedAt   DateTime?
  endedAt     DateTime?
  resultPath  String?   // S3 key
  createdAt   DateTime @default(now())
}

enum SimulationStatus {
  PENDING
  RUNNING
  DONE
  FAILED
}

model AIRequest {
  id          String   @id @default(uuid())
  userId      String   @relation(fields: [userId], references: [id])
  type        String   // TEMPLATE, EXPLAIN, OPTIMIZE
  prompt      String
  response    String?
  createdAt   DateTime @default(now())
}
```

*Prisma generates a type‑safe client used by the backend (`backend/src/db/prisma`).*

---

## 7. API Contracts (OpenAPI v3 – simplified)

*All paths are prefixed with `/api/v1`.*

```yaml
openapi: 3.0.3
info:
  title: Simulation Platform API
  version: 0.1.0
paths:
  /scenarios:
    get:
      summary: List user scenarios
      security: [{ bearerAuth: [] }]
      responses:
        '200':
          description: Array of scenarios
    post:
      summary: Create a scenario
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ScenarioCreate'
      responses:
        '201':
          description: Created scenario
  /scenarios/{id}:
    put:
      summary: Update scenario config
      security: [{ bearerAuth: [] }]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ScenarioUpdate'
      responses:
        '200': { description: Updated }
  /simulations:
    post:
      summary: Launch simulation
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SimulationRun'
      responses:
        '202':
          description: Simulation accepted
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SimulationStartResponse'
  /simulations/{id}/status:
    get:
      summary: Poll simulation status (fallback)
      security: [{ bearerAuth: [] }]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SimulationStatusResponse'
  /ws/simulations/{id}:
    get:
      summary: WebSocket stream of telemetry
      security: [{ bearerAuth: [] }]
  /ai/template:
    post:
      summary: Generate scenario template
      security: [{ bearerAuth: [] }]
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                additionalProperties: true
  /ai/explain:
    post:
      summary: Explain simulation results
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                simulationId: { type: string }
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  explanation: { type: string }
  /ai/optimize:
    post:
      summary: Suggest parameter tweaks
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/OptimizationRequest'
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OptimizationResponse'
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    ScenarioCreate:
      type: object
      required: [name, configJson]
      properties:
        name: { type: string }
        configJson: { type: object }
    ScenarioUpdate:
      type: object
      required: [configJson]
      properties:
        configJson: { type: object }
    SimulationRun:
      type: object
      required: [scenarioId]
      properties:
        scenarioId: { type: string }
    SimulationStartResponse:
      type: object
      properties:
        runId: { type: string }
    SimulationStatusResponse:
      type: object
      properties:
        status: { type: string, enum: [PENDING,RUNNING,DONE,FAILED] }
    OptimizationRequest:
      type: object
      required: [scenarioId]
      properties:
        scenarioId: { type: string }
    OptimizationResponse:
      type: object
      properties:
        suggestedConfig: { type: object }
```

*The TypeScript client (`frontend/src/api/client.ts`) is generated from this spec via `openapi-generator-cli`.*

---

## 8. CI / CD Workflow (`.github/workflows/ci.yml`)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  lint-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports: ["5432:5432"]
      redis:
        image: redis:7
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install backend deps
        working-directory: backend
        run: npm ci
      - name: Lint backend
        working-directory: backend
        run: npm run lint
      - name: Test backend
        working-directory: backend
        run: npm test
      - name: Install frontend deps
        working-directory: frontend
        run: npm ci
      - name: Lint frontend
        working-directory: frontend
        run: npm run lint
      - name: Test frontend
        working-directory: frontend
        run: npm test
      - name: Install Python deps
        working-directory: simulation
        run: pip install -r requirements.txt
      - name: Pytest
        working-directory: simulation
        run: pytest

  build-push:
    needs: lint-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build & push images
        run: |
          docker build -t ghcr.io/${{ github.repository }}/frontend:latest ./frontend
          docker build -t ghcr.io/${{ github.repository }}/backend:latest ./backend
          docker build -t ghcr.io/${{ github.repository }}/simulation:latest ./simulation
          docker push ghcr.io/${{ github.repository }}/frontend:latest
          docker push ghcr.io/${{ github.repository }}/backend:latest
          docker push ghcr.io/${{ github.repository }}/simulation:latest

  deploy:
    needs: build-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Set up kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'v1.27.0'
      - name: Helm upgrade
        env:
          KUBE_CONFIG_DATA: ${{ secrets.KUBE_CONFIG }}
        run: |
          echo "$KUBE_CONFIG_DATA" | base64 -d > $HOME/.kube/config
          helm upgrade --install simulation-platform ./helm/simulation-platform \
            --set image.frontend=ghcr.io/${{ github.repository }}/frontend:latest \
            --set image.backend=ghcr.io/${{ github.repository }}/backend:latest \
            --set image.simulation=ghcr.io/${{ github.repository }}/simulation:latest \
            --namespace prod --create-namespace
```

*Only the essential steps are present; additional stages (e.g., security scan) can be added later.*

---

## 9. Minimal Observability Setup  

1. **Prometheus client** (`prom-client` in Node, `prometheus_fastapi_instrumentator` in Python).  
2. Each service exposes `/metrics` on its internal port.  
3. Deploy a **Prometheus** instance via the Helm chart’s `prometheus` sub‑chart.  
4. A **Grafana** dashboard (import JSON) displays:  
   * API request latency (`http_request_duration_seconds`)  
   * Celery queue length (`celery_worker_tasks`)  
   * Simulation status counts (`simulation_status_total`)  
   * WebSocket messages per second (`ws_messages_total`)  

No Loki or Jaeger is added in the MVP; they can be layered later if tracing becomes a bottleneck.

---

## 10. Testing Strategy  

| Level | Tool | Target |
|------|------|--------|
| Unit (backend) | Jest + supertest | Route handlers, JWT middleware, DB repository |
| Unit (frontend) | Jest + React Testing Library | Component rendering, API client hooks |
| Unit (simulation) | Pytest | Celery task logic, FastAPI endpoints |
| Integration | Docker‑Compose composition test | Spin up full stack, run a scenario, verify end‑to‑end flow |
| E2E | Cypress | User journey: login → create scenario → launch simulation → watch live chart → request AI explanation → download result |
| Load | k6 (optional after MVP) | 50 concurrent simulation launches, monitor queue length |

All tests are executed in the CI pipeline; the Cypress run is gated behind a “staging” environment that the GitHub Action deploys after a successful build.

---

## 11. Documentation  

* **MkDocs** (`docs/`) hosts:  
  * Architecture diagram (updated from the simplified version)  
  * API reference (automatically generated from the OpenAPI spec)  
  * Local development guide (Docker‑Compose commands)  
  * Deployment guide (Helm values)  
* **README.md** provides quick‑start commands:  
  ```bash
  cp .env.example .env
  docker compose up -d
  npm --prefix frontend run dev
  ```  

* **Swagger UI** is served by the backend at `/api/docs` for developers.

---

## 12. Summary of Key Decisions (to avoid contradictions)

| Area | Decision (MVP) | Rationale |
|------|----------------|-----------|
| Auth | **Auth0 only** (OAuth2 PKCE) | Removes self‑hosted Keycloak, reduces ops |
| AI | **Node wrapper** calling OpenAI SDK; prompts stored as JSON | No extra FastAPI service, easy to replace later |
| Realtime | **Native WebSocket** + Redis Pub/Sub | Simpler than Socket.IO, sufficient for low‑latency telemetry |
| Observability | **Prometheus + Grafana only** | Keeps container count low; Loki/Jaeger added later if needed |
| Micro‑service count | **Three core services** (frontend, Node API, Python simulation) | Avoids sprawl while keeping language boundaries for scientific code |
| Deployment | **Docker‑Compose (dev) + single Helm chart (prod)** | Fast local iteration, production‑grade reproducibility |
| Simulation worker | **Celery (Redis)** | Handles long‑running jobs, scales horizontally |

With these constraints the project stays lean, testable, and deployable within a few weeks while preserving a clear path to later enhancements (GPU workers, richer AI orchestration, multi‑tenant auth).