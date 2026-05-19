# FINAL_PLAN.md  

## 1. Goal  
Create a **minimal, production‑ready SPA scaffold** that matches the original architecture while keeping the codebase small, easy to understand, and fast to start developing on.

* React 18 + TypeScript  
* Vite for dev + build (instant HMR)  
* Tailwind CSS (JIT) for styling  
* Light global state (React Context) for theme, toast, and auth  
* Simple `axios` wrapper for data fetching (React Query can be added later)  
* React Router v6 for routing, lazy‑loaded pages  
* Jest + React Testing Library for unit tests + Playwright for a couple of critical E2E tests  
* GitHub Actions CI that lints, type‑checks, tests and builds, then deploys to Vercel (preview URLs for PRs)  

---

## 2. Folder structure (final)

```
repo-root/
├─ .github/
│   └─ workflows/
│       └─ ci.yml                # CI/CD pipeline
├─ public/
│   └─ vite.svg                  # Vite default logo (replace later)
├─ src/
│   ├─ app/
│   │   ├─ App.tsx               # Top‑level component (routes + providers)
│   │   └─ main.tsx              # Vite entry point (ReactDOM.createRoot)
│   ├─ assets/                   # Images, icons, fonts
│   ├─ components/
│   │   ├─ layout/
│   │   │   ├─ AppLayout.tsx
│   │   │   ├─ Header.tsx
│   │   │   └─ Footer.tsx
│   │   └─ ui/
│   │       ├─ Button.tsx
│   │       ├─ Card.tsx
│   │       ├─ Input.tsx
│   │       ├─ Modal.tsx
│   │       └─ Toast.tsx
│   ├─ context/
│   │   ├─ AuthContext.tsx
│   │   ├─ ThemeContext.tsx
│   │   └─ ToastContext.tsx
│   ├─ hooks/
│   │   ├─ useToggle.ts
│   │   └─ useOutsideClick.ts
│   ├─ pages/
│   │   ├─ DashboardPage.tsx
│   │   ├─ LoginPage.tsx
│   │   ├─ ProductListPage.tsx
│   │   └─ SandboxPage.tsx      # visual QA for UI primitives
│   ├─ routes/
│   │   └─ index.tsx            # <Routes> definition
│   ├─ services/
│   │   ├─ apiClient.ts         # axios instance + interceptors
│   │   └─ productApi.ts         # data‑fetching hooks (useProducts)
│   ├─ styles/
│   │   ├─ tailwind.css
│   │   └─ globals.css
│   └─ tests/
│       ├─ unit/
│       │   └─ components/      # Jest + RTL tests for UI primitives
│       └─ e2e/
│           └─ login-flow.spec.ts
├─ .eslintrc.cjs
├─ .prettierrc
├─ .gitignore
├─ index.html
├─ package.json
├─ postcss.config.cjs
├─ tailwind.config.cjs
├─ tsconfig.json
└─ vite.config.ts
```

**Explanation of key top‑level folders**

| Folder | Purpose |
|--------|---------|
| `src/app` | Bootstrap (`main.tsx`) and the `<App>` component that composes all providers and the router. |
| `src/components` | Reusable UI pieces. `layout/` holds structural components (`Header`, `Footer`, `AppLayout`). `ui/` holds primitive building blocks (`Button`, `Card`, etc.). |
| `src/context` | Global React Contexts: theme (light/dark), toast notification system, simple auth storage (in‑memory token). |
| `src/hooks` | Small generic hooks (`useToggle`, `useOutsideClick`). |
| `src/pages` | One file per route (Login, Dashboard, Product list, Sandbox). Feature‑slice folders can be introduced later when a page grows beyond a handful of components. |
| `src/routes` | Central routing configuration using React Router v6, with lazy loading via `React.lazy`. |
| `src/services` | `apiClient.ts` sets up an `axios` instance (base URL, interceptors). Domain‑specific API hooks live next to the pages that consume them. |
| `src/styles` | Tailwind entry point (`tailwind.css`) and any global CSS overrides (`globals.css`). |
| `src/tests` | Unit tests (`unit/`) and a minimal E2E suite (`e2e/`). |

---

## 3. Files to create (with brief content)

| Path | Description |
|------|-------------|
| `package.json` | Scripts: `dev`, `build`, `preview`, `lint`, `type-check`, `test`, `test:e2e`. Dependencies listed below. |
| `vite.config.ts` | Vite config with React plugin, alias `@/` → `src/`, and Tailwind CSS integration. |
| `tsconfig.json` | Strict TypeScript config, `"jsx": "react-jsx"`. |
| `tailwind.config.cjs` | JIT mode, content paths `./src/**/*.{tsx,ts,js,jsx}`, dark mode `'class'`. |
| `postcss.config.cjs` | Tailwind + autoprefixer plugins. |
| `src/app/main.tsx` | `ReactDOM.createRoot(document.getElementById('root')!).render(<App />);` |
| `src/app/App.tsx` | Wraps `<BrowserRouter>`, `<QueryClientProvider>` (if later added), `<ThemeProvider>`, `<ToastProvider>`, `<AuthProvider>` and renders `<Routes/>`. |
| `src/routes/index.tsx` | `<Routes>` with `Route` elements for `/`, `/login`, `/dashboard`, `/products`, `/sandbox`. Uses `React.lazy` + `Suspense` with a simple spinner fallback. |
| `src/components/layout/Header.tsx` | Simple header with logo placeholder and navigation links (`/dashboard`, `/products`). |
| `src/components/layout/Footer.tsx` | Static footer with placeholder text. |
| `src/components/layout/AppLayout.tsx` | Layout component that renders `<Header>`, `<main>{children}</main>`, `<Footer>`. |
| `src/components/ui/Button.tsx` | Props: `variant?` (`primary | secondary | destructive`), `className?`, `...rest`. Uses Tailwind class strings; no external CVA. |
| `src/components/ui/Card.tsx` | Simple container with Tailwind shadow, rounded corners, padding. |
| `src/components/ui/Input.tsx` | `<label>` + `<input>` with Tailwind styling and error message prop. |
| `src/components/ui/Modal.tsx` | Portal to `document.body`, backdrop, ESC close, focus trap using `useEffect`. |
| `src/components/ui/Toast.tsx` | Renders toast list; each toast auto‑dismisses after 3 s. |
| `src/context/ThemeContext.tsx` | Provides `theme` (`light | dark`) and `toggleTheme`. Persists choice in `localStorage`. |
| `src/context/ToastContext.tsx` | `addToast(message, type?)` and internal reducer to manage toast array. |
| `src/context/AuthContext.tsx` | Stores `token?: string`, `login(credentials)`, `logout()`. Token kept in memory (placeholder for real secure cookie implementation later). |
| `src/hooks/useToggle.ts` | Returns `[value, setTrue, setFalse, toggle]`. |
| `src/hooks/useOutsideClick.ts` | Detects clicks outside a ref element, calls provided callback. |
| `src/pages/LoginPage.tsx` | Simple form (email + password) using `<Input>` and `<Button>`. On submit calls `login` from `AuthContext`. Shows a toast on success/failure. |
| `src/pages/DashboardPage.tsx` | Uses `<AppLayout>`, shows a few `<Card>` widgets with static placeholder data. |
| `src/pages/ProductListPage.tsx` | Calls `useProducts` hook (defined in `services/productApi.ts`) which returns mock data; renders list of `<Card>` items. |
| `src/pages/SandboxPage.tsx` | Demonstrates all UI primitives with different variants; useful for visual QA. |
| `src/services/apiClient.ts` | `axios.create({ baseURL: import.meta.env.VITE_API_URL })`; interceptor adds Authorization header if token exists in `AuthContext`. |
| `src/services/productApi.ts` | `export const useProducts = () => { const { data, error, isLoading } = useQuery('products', () => apiClient.get('/products').then(r => r.data)); return { data, error, isLoading }; }` – placeholder; actual endpoint not required for MVP (mock in `src/mocks`). |
| `src/styles/tailwind.css` | `@tailwind base; @tailwind components; @tailwind utilities;` |
| `src/styles/globals.css` | Optional small reset or custom utilities, imported after Tailwind. |
| `src/tests/unit/components/ui/Button.test.tsx` | Render button with each variant, assert class names, click handling. |
| `src/tests/e2e/login-flow.spec.ts` | Playwright test: visit `/login`, fill form, submit, expect toast & redirected to `/dashboard`. |
| `.eslintrc.cjs` | `eslint:recommended`, `plugin:react/recommended`, `plugin:@typescript-eslint/recommended`, `plugin:jsx-a11y/recommended`, `airbnb`, `prettier`. |
| `.prettierrc` | Basic Prettier config (single quotes, trailing commas). |
| `.github/workflows/ci.yml` | Steps: checkout → cache node_modules (key includes `package-lock.json`) → install → lint → type‑check (`tsc --noEmit`) → unit tests (`npm test`) → build (`npm run build`) → upload artifact → deploy to Vercel (using `vercel-action`). |
| `README.md` | Project overview, quick‑start guide, folder map, how to add a new page, how to run tests, CI/CD notes. |
| `docs/` (optional) | `onboarding.md`, `component-catalog.md` – simple markdown files linked from README. |

---

## 4. Implementation order (critical path)

| Day | Milestone | Key tasks (in order) |
|-----|-----------|----------------------|
| **1** | **Repo & tooling** | Create repo, `npm init -y`, install React, React‑DOM, Vite, TypeScript. Add ESLint, Prettier, Husky + lint‑staged, CI workflow (lint + type‑check only). Verify `npm run dev` shows blank page. |
| **2** | **Tailwind & global providers** | Install Tailwind, PostCSS, autoprefixer; add config files; create `src/styles/tailwind.css` and import in `main.tsx`. Implement `ThemeContext`, `ToastContext`, `AuthContext` (in‑memory). Wrap app with providers in `App.tsx`. Add a simple UI toggle in `Header` to switch theme. |
| **3** | **Core UI primitives** | Implement `<Button>`, `<Input>`, `<Card>`, `<Modal>`, `<Toast>`. Write unit tests for each (Jest + RTL). Add `SandboxPage` route to showcase them. |
| **4** | **Routing & pages** | Create `src/routes/index.tsx` with lazy‑loaded routes and a spinner fallback. Add `LoginPage`, `DashboardPage`, `ProductListPage`, `SandboxPage`. Implement `RequireAuth` wrapper using `AuthContext`. Verify navigation flow manually. |
| **5** | **Data‑fetching layer** | Install `axios`. Create `apiClient.ts` and a mock interceptor returning static product data. Add `useProducts` hook and use it in `ProductListPage`. Add simple unit test for the hook (mock axios). |
| **6** | **CI enhancements & E2E** | Extend CI to run unit tests, build, and deploy preview to Vercel. Add Playwright, write `login-flow.spec.ts`, run in CI (optional but highly recommended). Fix any caching key issues (`package-lock.json` hash). |
| **7** | **Accessibility & security hardening** | Add `eslint-plugin-jsx-a11y`. Add a11y tests in CI (`npm run test:axe`). Update `Modal` to trap focus, ensure `Button` has accessible `aria-label` when needed. Document that real token storage should be via httpOnly cookie; add placeholder comment in `AuthContext`. |
| **8** | **Documentation & handoff** | Write concise onboarding guide (clone, `npm ci`, `npm run dev`). Add component catalog (markdown with import paths). Add performance checklist (run Lighthouse, keep bundle < 200 KB gzipped). Final QA: run full test suite, verify preview URL works, merge to `main`. |

Each milestone produces a **self‑contained PR** that can be merged independently, keeping CI green throughout.

---

## 5. Dependency list (exact versions as of project start)

```bash
# Core
npm i react@18 react-dom@18
npm i -D vite@5 @vitejs/plugin-react@4

# TypeScript
npm i -D typescript@5 @types/react @types/react-dom

# Styling
npm i -D tailwindcss@3 postcss@8 autoprefixer@10
npm i -D @tailwindcss/forms   # optional, for better input styling

# Routing & state
npm i react-router-dom@6
npm i -D @types/react-router-dom

# Data fetching
npm i axios@1

# Lint / format
npm i -D eslint@8 eslint-config-airbnb@19 eslint-config-prettier@9 eslint-plugin-import@2 eslint-plugin-jsx-a11y@6 eslint-plugin-react@7 eslint-plugin-react-hooks@4 prettier@3 husky@9 lint-staged@13

# Testing
npm i -D jest@29 @types/jest@29 ts-jest@29
npm i -D @testing-library/react@14 @testing-library/jest-dom@6 @testing-library/user-event@14

# E2E
npm i -D playwright@1.44

# GitHub Actions
# (no npm install – use actions in workflow yaml)
```

All dependencies are **TypeScript‑ready** and have no runtime CSS‑in‑JS cost.

---

## 6. Success criteria (what “done” looks like)

| Criterion | How to verify |
|-----------|----------------|
| **Dev server boots** | `npm run dev` opens `http://localhost:5173` showing the Sandbox page with all UI primitives. |
| **Theme toggle works** | Clicking the toggle in the header switches Tailwind dark mode and persists across reloads. |
| **Login flow** | Submitting the login form stores a token in `AuthContext`, shows a toast, and redirects to `/dashboard`. |
| **Protected routes** | Accessing `/dashboard` when not logged in redirects to `/login`. |
| **Product list renders** | `/products` displays at least three `<Card>` items from the mock API. |
| **Unit tests** | `npm test` passes all component tests (≥ 90 % coverage is optional). |
| **E2E test** | Playwright test runs in CI and passes (login → dashboard). |
| **CI pipeline** | GitHub Actions finishes with *All checks passed* and a Vercel preview URL is posted. |
| **Bundle size** | `npm run build` creates `dist/assets/*.js` where the biggest file is < 200 KB gzipped. |
| **Accessibility** | `npm run axe` (or similar) reports no violations on the Sandbox page. |
| **Documentation** | New developer can follow the README, run the app, and understand folder purpose within 30 minutes. |

When all rows are met, the SPA foundation is ready for feature development.

--- 

### End of plan

The above plan delivers a **compact, well‑tested, and deployable** starter that can be expanded incrementally without the overhead of unnecessary abstractions. It respects the original architectural goals while incorporating the simplifications identified in the critique.