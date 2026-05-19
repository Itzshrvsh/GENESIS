# FINAL_PLAN.md

## 1. Goal  
Deliver a minimal full‑stack web application that lets an authenticated user submit a text prompt, receive model‑generated output, store the result, and optionally search past results by embedding similarity.

## 2. Simplified Architecture  

| Component | Technology | Reason for inclusion |
|-----------|------------|----------------------|
| **Frontend** | Next.js (React) + Tailwind CSS + React Query + NextAuth.js | SSR, fast UI development, built‑in auth helpers |
| **Backend** | Single FastAPI service (gateway + inference) | One HTTP hop, shared code base, easy scaling of GPU pods |
| **Database** | PostgreSQL with **PGVector** extension | Relational data + efficient vector search in one DB |
| **Cache / Session store** | Redis (optional – for session revocation or token blacklist) | Simple key‑value store, optional for future token revocation |
| **Background work** | FastAPI `BackgroundTasks` (for on‑demand embeddings) | No additional broker for the MVP |
| **Containerisation** | Docker + Docker‑Compose for local dev | One‑command spin‑up |
| **Production orchestration** | Single Helm chart (or Kustomize overlay) that deploys all containers as pods | Keeps YAML surface small while still enabling K8s |
| **Observability** | `prometheus_fastapi_instrumentator` for metrics + standard Python JSON logging | Minimal but useful, can be replaced by full OTEL later |
| **CI/CD** | GitHub Actions – lint → unit tests → Docker build → push → Helm upgrade (staging) | Automated quality gate and reproducible builds |

> **Note:** The original “separate inference service” and “Celery + Redis” are omitted for the MVP. They can be introduced later if load testing shows a need.

## 3. Repository Layout  

```
ai-fullstack/
├─ .github/
│   └─ workflows/
│       └─ ci.yml                     # Lint, test, build, optional deploy
├─ helm/
│   └─ chart/
│       ├─ Chart.yaml
│       ├─ values.yaml
│       └─ templates/
│           ├─ deployment.yaml
│           ├─ service.yaml
│           └─ ... (Ingress, ConfigMap, Secret)
├─ docker/
│   ├─ frontend.Dockerfile
│   └─ backend.Dockerfile
├─ frontend/
│   ├─ pages/
│   │   ├─ api/
│   │   │   └─ generate.ts   # forwards to FastAPI
│   │   ├─ index.tsx
│   │   ├─ login.tsx
│   │   └─ register.tsx
│   ├─ components/
│   │   ├─ PromptForm.tsx
│   │   └─ ResultViewer.tsx
│   ├─ lib/
│   │   ├─ apiClient.ts      # axios wrapper with JWT
│   │   └─ reactQueryHooks.ts
│   ├─ styles/
│   │   └─ globals.css
│   ├─ tailwind.config.js
│   ├─ postcss.config.js
│   └─ next.config.js
├─ backend/
│   ├─ app/
│   │   ├─ main.py           # FastAPI entry point
│   │   ├─ dependencies.py   # DB, model lazy loader, auth utils
│   │   ├─ routers/
│   │   │   ├─ auth.py
│   │   │   ├─ predict.py      # /predict, /embed
│   │   │   ├─ results.py     # /save, /search
│   │   │   └─ health.py
│   │   └─ models/
│   │       └─ schema.py      # Pydantic models
│   ├─ alembic/              # migrations
│   ├─ requirements.txt
│   └─ pyproject.toml
├─ docker-compose.yml
├─ .env.example
└─ README.md
```

### Key Files (to be created)

| Path | Purpose |
|------|---------|
| `docker-compose.yml` | Starts `frontend`, `backend`, `postgres`, `redis` (optional). |
| `frontend/Dockerfile` | Builds Next.js app for production. |
| `backend/Dockerfile` | Installs Python dependencies, downloads model weights (CPU‑only image for dev, GPU‑enabled tag for prod). |
| `backend/app/main.py` | FastAPI app, includes router registration, health endpoint, Prometheus exporter. |
| `backend/app/dependencies.py` | Provides DB session (`SQLAlchemy`), lazy model loader, JWT verification (using public key from NextAuth). |
| `backend/app/routers/predict.py` | `/predict` (text generation / classification) and `/embed`. |
| `backend/app/routers/results.py` | `/save` stores prompt/result and optional embedding, `/search` performs vector similarity. |
| `backend/app/routers/auth.py` | Endpoint to verify NextAuth JWT and optionally rotate refresh token. |
| `backend/alembic/versions/*` | Migration scripts for `users`, `audit_log`, `generated_results`, `embeddings`. |
| `helm/chart/values.yaml` | Default image tags, replica counts, resource requests, secret names. |
| `.github/workflows/ci.yml` | Lint (ESLint/Prettier, ruff/flake8), unit tests (`pytest` + `pytest-asyncio`), Docker build, optional Helm upgrade on `main`. |

## 4. Implementation Order  

| Milestone | Deliverable | Core Tasks | Acceptance Criteria |
|-----------|-------------|-----------|---------------------|
| **M0 – Foundations** | Repo, CI, Docker‑Compose, docs | <ul><li>Create repo with the folder layout above.</li><li>Add `README.md` and architecture diagram (ASCII or PlantUML).</li><li>Write `.github/workflows/ci.yml` that runs lint & unit tests and builds both Docker images.</li><li>Write `docker-compose.yml` wiring `frontend`, `backend`, `postgres`, `redis` (optional).</li><li>Provide `.env.example`.</li></ul> | `git push` triggers CI, all steps pass. `docker compose up` starts all containers; `curl http://localhost:8000/health` returns 200. |
| **M1 – Backend Core (FastAPI)** | Working API with auth, DB, model loading | <ul><li>Set up SQLAlchemy + Alembic; create migrations for `users`, `audit_log`, `generated_results`, `embeddings`.</li><li>Implement JWT verification middleware (use `python-jose` to decode token signed by NextAuth). </li><li>Write lazy model loader that on first request downloads `distilbert-base-uncased` (CPU) and keeps it in memory.</li><li>Expose `/predict` (returns dummy text for now) and `/embed` (returns random vector).</li><li>Expose `/save` (stores prompt/output; optionally calls background task for embedding).</li><li>Expose `/search` using PGVector ` <=> ` operator.</li><li>Add Prometheus metrics (`/metrics`).</li></ul> | Unit tests cover each route (mock DB, mock model). Integration test: POST `/predict` → JSON response within 2 s, DB row created on `/save`. |
| **M2 – Frontend Core** | UI with login, prompt, result display | <ul><li>Run `npx create-next-app .` inside `frontend/`.</li><li>Install Tailwind, configure `tailwind.config.js` and global CSS.</li><li>Add NextAuth configuration (CredentialsProvider + Google optional). Store JWT in HttpOnly cookie.</li><li>Create `lib/apiClient.ts` (axios instance) that automatically adds `Authorization: Bearer <token>`.</li><li>Build React Query hooks (`useGenerate`, `useSave`).</li><li>Page `index.tsx` with `PromptForm` (textarea + Generate button) and `ResultViewer`.</li><li>Pages `login.tsx` & `register.tsx` with simple form validation.</li></ul> | A user can register, log in, submit a prompt, see generated text, click “Save” and receive a toast confirming persistence. |
| **M3 – End‑to‑End Flow & Persistence** | Full round‑trip stored & searchable | <ul><li>Connect `/save` to store result and call background embedding generation (`BackgroundTasks`).</li><li>Implement `/search` route and a UI component to query past results (input query string → show top‑k matches).</li><li>Write Cypress e2e test covering login → generate → save → search.</li></ul> | Cypress test passes on CI; saved results appear in DB; search results are relevant (embedding distance < 0.8). |
| **M4 – Production‑Ready Packaging** | Helm chart, deployment scripts, monitoring | <ul><li>Write single Helm chart (`helm/chart/`) that deploys all pods, creates a PVC for Postgres, configures secret env vars.</li><li>Add K8s HorizontalPodAutoscaler for `backend` (CPU) and optional GPU‑based HPA for inference (use `nvidia.com/gpu` resource).</li><li>Deploy Prometheus + Grafana via Helm (optional – can be external). Enable metrics scraping of `/metrics`.</li><li>Extend CI workflow: on push to `main`, build images, push to GitHub Container Registry, run `helm upgrade --install` into a staging GKE/EKS cluster.</li></ul> | `helm install` on a Kind cluster brings up the whole stack; `/metrics` appears in Prometheus; UI reachable via Ingress; logs are JSON. |
| **M5 – Optional Extensions (post‑MVP)** | Fine‑tuning UI, multi‑model routing, rate‑limiting | Implement only after core MVP is stable; each feature lives in its own branch and follows same CI pipeline. |

## 5. Detailed File Creation Checklist  

| File | Content Summary |
|------|-----------------|
| `docker-compose.yml` | Services: `frontend` (build context `frontend/`), `backend` (build `backend/`), `postgres` (image `postgres:15`, env vars, volume `pg_data`), `redis` (image `redis:7`). Network `ai_net`. |
| `frontend/Dockerfile` | `node:20-alpine` → `npm ci` → `npm run build` → `next start`. |
| `backend/Dockerfile` | Base `python:3.11-slim`. Install `build-essential`, `git`. `pip install -r requirements.txt`. Download model in a `RUN python -c "from transformers import AutoModel; AutoModel.from_pretrained('distilbert-base-uncased')"` for dev (CPU). For production, use a separate tag with CUDA (`nvidia/cuda:12.2.0-runtime-ubuntu22.04`). |
| `backend/requirements.txt` | `fastapi`, `uvicorn[standard]`, `sqlalchemy`, `psycopg2-binary`, `pydantic`, `python-jose[cryptography]`, `transformers[torch]`, `torch`, `prometheus_fastapi_instrumentator`, `redis`, `aiofiles`. |
| `backend/app/main.py` | ```python\nfrom fastapi import FastAPI\nfrom .routers import auth, predict, results, health\nfrom prometheus_fastapi_instrumentator import Instrumentator\n\napp = FastAPI()\napp.include_router(auth.router)\napp.include_router(predict.router)\napp.include_router(results.router)\napp.include_router(health.router)\nInstrumentator().instrument(app).expose(app)\n``` |
| `backend/app/dependencies.py` | Functions: `get_db()` (SQLAlchemy session), `get_current_user(token: str = Depends(oauth2_scheme))`, `get_model()` (lazy load singleton). |
| `backend/app/routers/auth.py` | `/auth/verify` that decodes NextAuth JWT and returns user payload; optional `/auth/logout` that deletes refresh token from Redis. |
| `backend/app/routers/predict.py` | `@router.post("/predict")` → receives `{prompt: str}` → calls `model.generate(prompt)` (placeholder returns `"Generated text"`). <br>`@router.post("/embed")` → returns list of floats. |
| `backend/app/routers/results.py` | `/save` (stores to `generated_results`, enqueues `BackgroundTasks` to compute embedding if not provided). <br>`/search` (accepts `query: str, top_k: int = 5` → computes embedding, runs `SELECT ... ORDER BY embedding <=> query_vector LIMIT top_k`). |
| `backend/alembic/env.py` & migrations | Standard Alembic env; migration scripts creating tables with appropriate types (`Vector` column from `pgvector`). |
| `frontend/lib/apiClient.ts` | ```ts\nimport axios from 'axios';\nconst client = axios.create({ baseURL: '/api', withCredentials: true });\nclient.interceptors.request.use(config => {\n  // JWT stored in httpOnly cookie is automatically sent; if a refresh token is needed,\n  // you can call /api/auth/refresh here.\n  return config;\n});\nexport default client;\n``` |
| `frontend/lib/reactQueryHooks.ts` | `useGenerate`, `useSaveResult`, `useSearch` using `react-query`'s `useMutation` / `useQuery`. |
| `frontend/pages/api/generate.ts` | API route that extracts JWT from cookies, forwards the request to `http://backend:8000/predict` with the same Authorization header, and returns the JSON response. |
| `helm/chart/templates/deployment.yaml` | Deployment spec with placeholders for image, replica count, resource limits, envFrom secretRef. |
| `.github/workflows/ci.yml` | Steps: checkout → setup Python & Node → cache pip/ npm → lint (flake8, eslint) → unit tests (`pytest`) → build Docker images → (if `push` event on `main`) → push images → helm upgrade (using `--set imageTag=${{ github.sha }}`). |
| `.env.example` | `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=postgres`, `POSTGRES_DB=aiapp`, `JWT_SECRET=change_me`, `NEXTAUTH_URL=http://localhost:3000`, `REDIS_URL=redis://redis:6379/0`. |
| `README.md` | Project description, prerequisites, how to run locally (`docker compose up --build`), how to run tests, how to deploy with Helm. |

## 6. Testing Strategy  

| Layer | Tools | Scope |
|-------|-------|-------|
| Unit (Python) | `pytest`, `pytest-asyncio`, `respx` (HTTP mock) | FastAPI routers, DB models, auth utils |
| Integration (Python) | `testcontainers` (Postgres) + `httpx.AsyncClient` | End‑to‑end API call flow (predict → save → search) |
| Frontend Unit | `jest`, `@testing-library/react` | Component rendering, hook behavior |
| E2E | `cypress` | Full user journey (register → login → generate → save → search) against Docker‑Compose stack |
| Lint/Formatting | `ruff` / `flake8`, `black`, `prettier`, `eslint` | Code quality enforcement in CI |

All tests must pass before a merge to `main`. Coverage threshold: **80 %** for backend Python code.

## 7. Deployment Checklist (Production)

1. **Build images** with tags `<repo>/frontend:<git_sha>` and `<repo>/backend:<git_sha>`.
2. **Push to registry** (GitHub Container Registry or Docker Hub).
3. **Create or update Kubernetes Secret** `ai-secret` with:
   - `POSTGRES_PASSWORD`
   - `JWT_SECRET`
   - Any third‑party API keys.
4. **Run Helm upgrade**:  
   ```
   helm upgrade --install ai-fullstack ./helm/chart \
     --namespace ai \
     --set imageTag=${GIT_SHA} \
     --set envFromSecret=ai-secret
   ```
5. **Verify**:
   - `kubectl port-forward svc/frontend 3000:80` → UI loads.
   - `/health` endpoint returns 200.
   - Prometheus metrics are scraped.
   - Logs are JSON and appear in Loki/Grafana (if installed).

## 8. Future Extensions (post‑MVP)

| Feature | Where it fits | Minimal addition |
|---------|----------------|-----------------|
| Fine‑tuning UI | New `/fine-tune` page → backend route that enqueues a Celery task (add Celery + Redis broker) | Add Celery worker Dockerfile, update `docker-compose.yml`. |
| Multi‑model routing | `/predict?model_id=xyz` → backend loads model lazily per ID (store paths in DB) | Extend `get_model` to a factory; expose admin endpoint to list models. |
| Rate limiting | Ingress (NGINX) `limit_req` or Redis token‑bucket middleware | Add middleware to FastAPI that checks Redis counters. |
| External vector DB | Replace PGVector queries with Pinecone SDK calls | Abstract `EmbeddingRepository` and implement a Pinecone version. |
| Full OpenTelemetry | Collector sidecar, OTLP exporter in both services | Add `opentelemetry-instrumentation-fastapi` and `opentelemetry-exporter-otlp`. |

These can be added as isolated branches; the core MVP remains untouched.

---

**End of plan.** All deliverables are defined, folder structure is concrete, implementation order minimizes risk, and unnecessary complexity has been removed. Follow the milestones sequentially to obtain a working, production‑ready full‑stack AI system within the projected timeline.