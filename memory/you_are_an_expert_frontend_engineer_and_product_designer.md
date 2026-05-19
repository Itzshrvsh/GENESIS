
# PROJECT IDEA

You are an expert frontend engineer and product designer.


# ARCHITECT OUTPUT

## 1. Project Overview  

A modern, single‑page web application (SPA) that delivers a clean, responsive UI and can be extended with additional product features.  
Key goals:

| Goal | Reason |
|------|--------|
| **Fast iteration** | Designers and engineers should see changes instantly. |
| **Low entry barrier** | New team members can start contributing within a day. |
| **Scalable UI** | Component reuse and clear separation of concerns. |
| **Maintainable codebase** | Strong typing, linting, and testing out‑of‑the‑box. |
| **Deploy‑anywhere** | Build artifacts are static assets, suitable for CDNs or serverless hosts. |

---

## 2. Technology Stack  

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **UI Library** | **React 18** (function components, hooks) | De‑facto standard, huge ecosystem, excellent dev tools. |
| **Language** | **TypeScript 5** | Compile‑time safety, self‑documenting APIs. |
| **Build / Dev Server** | **Vite** | Lightning‑fast HMR, zero‑config for JSX/TSX, works with ES modules. |
| **Styling** | **Tailwind CSS** (utility‑first) + **PostCSS** | Rapid UI prototyping, no CSS‑in‑JS runtime cost, easy theming. |
| **State Management** | **React Context + useReducer** (for global UI state) <br> **React Query (TanStack Query)** (for server data) | Keeps the core library lightweight; React Query provides caching, deduplication, and automatic refetching. |
| **Routing** | **React Router v6** | Declarative nested routes, URL‑based code‑splitting. |
| **Testing** | **Jest** + **React Testing Library** | Unit + component tests with DOM‑like assertions. |
| **Lint / Formatting** | **ESLint** (recommended + Airbnb) <br> **Prettier** | Consistent code style, early error detection. |
| **CI / CD** | **GitHub Actions** (run lint, type‑check, test; build artifact) <br> **Vercel / Netlify** (static deploy) | Free tier, instant preview URLs, automatic rollbacks. |

*All of the above are open‑source and have first‑class TypeScript support.*

---

## 3. High‑Level Architecture  

```
src/
├─ app/                 # Root bootstrap (index.tsx, global providers)
├─ assets/              # Images, fonts, SVG sprites
├─ components/          # Reusable UI atoms/molecules
│   ├─ ui/              # Buttons, inputs, icons (Tailwind + classnames)
│   └─ layout/          # Header, Footer, Sidebar, Grid
├─ features/            # Domain‑focused modules (each with its own slice)
│   ├─ auth/            # Login, registration, auth context
│   ├─ dashboard/       # Dashboard page + sub‑components
│   └─ product/         # Product list, details, cart, etc.
├─ hooks/               # Custom React hooks (useAuth, useFetch)
├─ routes/              # Route definitions (React Router)
├─ services/            # API client (axios instance) + query hooks
├─ store/               # Context providers + reducers (if needed)
├─ styles/              # Tailwind config, global css
└─ tests/               # Test utilities, integration tests
```

### 3.1. Modules (Feature‑sliced)  

*Each feature folder contains:*

| File | Purpose |
|------|---------|
| `index.tsx` | Feature entry point (page component or lazy‑loaded bundle). |
| `components/` | Feature‑specific UI that is **not** shared globally. |
| `hooks/` | Data fetching / domain logic encapsulated as hooks. |
| `store/` | Local reducer & context (if feature needs isolated state). |
| `types/` | TypeScript interfaces/types for the feature. |
| `tests/` | Unit / component tests scoped to the feature. |

This **feature‑slice** pattern keeps code discoverable and reduces accidental coupling.

### 3.2. Data Flow  

1. **UI → Action** – Component calls a custom hook (`useCreateItem`) which invokes a **React Query mutation**.  
2. **React Query** handles the async request, updates its cache, and triggers **optimistic UI** updates if configured.  
3. **Components** subscribe to queries (`useQuery`) and automatically re‑render when cached data changes.  
4. **Global UI state** (e.g., theme, toast notifications) lives in **React Context + useReducer** and is consumed via `useContext`.  

---

## 4. Core UI Components  

| Component | Description | Why It Exists |
|-----------|-------------|---------------|
| **`<AppLayout>`** | Wraps every page with `<Header>`, `<Sidebar>` (optional), and `<Footer>`. Handles responsive breakpoints via Tailwind utilities. | Guarantees a consistent visual frame and navigation pattern. |
| **`<Header>`** | Logo, main navigation links, user avatar + dropdown. | Entry point for global navigation, accessible markup. |
| **`<Footer>`** | Legal links, small site map, optional language selector. | Low‑priority content, stays at bottom on all pages. |
| **`<Button>`** | Variants: primary, secondary, destructive, disabled. Uses `class-variance-authority` for consistent styling. | Central styling source, avoids duplicated class strings. |
| **`<Input>`** | Text, number, password, with built‑in label + error display. | Aligns form UX, integrates with React Hook Form if needed. |
| **`<Card>`** | Container with shadow, rounded corners, padding. Used for list items, panels, etc. | Reduces boilerplate for common UI containers. |
| **`<Modal>`** | Portal‑based overlay, accessible (focus trap, ESC to close). | Standard pattern for dialogs, confirmations, forms. |
| **`<ToastProvider>` + `<Toast>`** | Global notification system, auto‑dismiss, stacking. | Provides feedback without coupling to individual components. |

All components are **unstyled by default**, relying on Tailwind utility classes for visual variants. This keeps the CSS surface area minimal and makes them easy to theme.

---

## 5. Development Workflow  

1. **Clone & Install**  
   ```bash
   git clone <repo>
   cd <repo>
   npm ci
   ```

2. **Start Dev Server** – Hot‑module replacement, TypeScript type checking, and Tailwind JIT.  
   ```bash
   npm run dev
   ```

3. **Feature Branch** – Follow GitHub Flow (`feature/xyz`).  

4. **Lint & Type Check** – Pre‑commit hook via `husky` runs `npm run lint` and `npm run type-check`.  

5. **Testing** – Write unit/component tests alongside the feature code; run with:  
   ```bash
   npm test   # jest watch mode
   ```

6. **Pull Request** – CI runs lint, tests, builds. If successful, merge to `main`.  

7. **Deploy** – `main` push triggers GitHub Action that builds and publishes to Vercel/Netlify. Preview URLs are automatically generated for PRs.

---

## 6. Build & Deployment Artifacts  

| Step | Command | Output |
|------|---------|--------|
| **Build** | `npm run build` (Vite) | `dist/` – static HTML, JS bundles (code‑split), CSS |
| **Static Host** | Upload `dist/` to CDN (Vercel, Netlify, Cloudflare Pages) | Instant global delivery, automatic cache invalidation |
| **Optional SSR** | If SEO is required, replace Vite with **Next.js** (still TypeScript + Tailwind) | Server‑rendered pages + static generation for critical routes |

The default static build is sufficient for most product dashboards, SaaS admin panels, and consumer‑facing SPAs.

---

## 7. Summary  

* **Stack** – React + TypeScript, Vite, Tailwind, React Query, React Router.  
* **Architecture** – Feature‑sliced folders, global UI state via Context, data fetching via React Query, declarative routing.  
* **Core Components** – Layout primitives (`Header`, `Footer`, `AppLayout`), UI primitives (`Button`, `Input`, `Card`, `Modal`, `Toast`).  
* **Workflow** – Fast local dev with HMR, lint + type‑check pre‑commit, Jest testing, GitHub Actions CI/CD, static deployment.  

This setup delivers a **simple yet extensible** foundation that lets designers iterate on the UI rapidly while keeping the codebase maintainable for engineers.

# PLANNER OUTPUT

## Project Plan – SPA Foundation (React + TypeScript + Vite)

### Overview
The goal is to deliver a **minimal‑viable, production‑ready foundation** that matches the architecture outlined in the ARCHITECT OUTPUT.  
All work is organized into **milestones** that can be completed sequentially.  
Each milestone lists **deliverables**, **key tasks**, and **dependency notes**.  
The plan deliberately avoids building optional layers (e.g., server‑side rendering, advanced state libraries) until they become a clear requirement.

---

## Milestone 1 – Repo Bootstrap & Tooling (1 day)

| Deliverable | Tasks |
|-------------|-------|
| **Repository initialized** (GitHub) | • Create repo, set branch protection on `main`.<br>• Add `CODEOWNERS` for core dirs. |
| **Package & Build setup** | • `npm init -y` → install `react`, `react-dom`, `typescript`, `vite`.<br>• Add Vite config (`vite.config.ts`) with React + JSX support.<br>• Create `tsconfig.json` (strict mode, `jsx: react-jsx`). |
| **Lint / Format pipeline** | • Install `eslint`, `eslint-config-airbnb`, `eslint-plugin-react`, `@typescript-eslint/parser`.<br>• Install `prettier` + `eslint-config-prettier`.<br>• Add `.eslintrc.cjs`, `.prettierrc`. |
| **Pre‑commit hooks** | • Install `husky` & `lint-staged`.<br>• Hook runs `npm run lint && npm run type-check`. |
| **CI workflow (GitHub Actions)** | • Lint, type‑check, unit‑test, build steps.<br>• Cache `node_modules` & Vite build output. |
| **Initial README** | • Project description, dev workflow, npm scripts. |

**Success criteria** – `npm run dev` launches a blank Vite app; CI passes on the first commit.

---

## Milestone 2 – Core Architecture & Global Providers (2 days)

| Deliverable | Tasks |
|-------------|-------|
| **Folder scaffolding** (as per ARCHITECT OUTPUT) | Create `src/app`, `src/assets`, `src/components/ui`, `src/components/layout`, `src/hooks`, `src/routes`, `src/services`, `src/store`, `src/styles`, `src/tests`. |
| **Tailwind CSS integration** | • Install `tailwindcss`, `postcss`, `autoprefixer`.<br>• Generate `tailwind.config.cjs` with JIT mode.<br>• Add `src/styles/tailwind.css` and import it in `main.tsx`. |
| **Global CSS reset & base styles** | Use Tailwind’s `preflight` + a minimal `src/styles/globals.css`. |
| **Root bootstrap (`src/app/index.tsx`)** | • Render `<React.StrictMode>`.<br>• Wrap app in `<BrowserRouter>`, `<ToastProvider>`, `<ThemeContextProvider>` (simple context). |
| **React Query client** | • Install `@tanstack/react-query`.<br>• Create `src/services/queryClient.ts` and provide it via `<QueryClientProvider>`. |
| **Global UI state (Theme, Toast)** | • Implement `ThemeContext` (light/dark toggle).<br>• Implement `ToastProvider` using React Context + `useReducer`. |
| **Error boundary component** | Simple fallback UI for uncaught errors. |

**Success criteria** – Application loads with Tailwind styling, a theme toggle works, and a toast can be shown from any component.

---

## Milestone 3 – Base Layout & UI Primitives (2 days)

| Deliverable | Tasks |
|-------------|-------|
| **Layout components** | • `<AppLayout>` (renders `<Header>`, optional `<Sidebar>`, `<Footer>`).<br>• `<Header>` (logo + nav placeholder).<br>• `<Footer>` (static links). |
| **UI primitives** | • `<Button>` – variants via `class-variance-authority` (install if needed).<br>• `<Input>` – label + error message handling.<br>• `<Card>` – generic container.<br>• `<Modal>` – portal‑based, focus‑trap, ESC close.<br>• `<Toast>` – toast list component (appears via `ToastProvider`). |
| **Utility hooks** | • `useToggle` (boolean state helper).<br>• `useOutsideClick` (for modal dismiss). |
| **Story/Example page** | Add a temporary route (`/sandbox`) that demonstrates each primitive for visual QA. |
| **Tests** | Basic Jest + RTL tests for each component (render, variant class, accessibility). |

**Success criteria** – All primitives render correctly, respect Tailwind theming, and pass unit tests. The sandbox route is viewable in dev server.

---

## Milestone 4 – Routing & Sample Feature Modules (3 days)

| Deliverable | Tasks |
|-------------|-------|
| **React Router configuration** | • Create `src/routes/index.tsx` with `<Routes>`.<br>• Define public routes: `/`, `/login`, `/dashboard`, `/sandbox`.<br>• Implement lazy‑loading via `React.lazy` + `Suspense`. |
| **Feature‑slice skeleton** | For three core features (Auth, Dashboard, Product):<br> • `src/features/auth` – `LoginPage.tsx`, context placeholder.<br> • `src/features/dashboard` – `DashboardPage.tsx` with a couple of `<Card>` widgets.<br> • `src/features/product` – `ProductList.tsx` (static mock data). |
| **API service layer** | • Install `axios`.<br>• Create shared `apiClient.ts` with base URL & interceptors (placeholder).<br>• Export custom hooks (`useProducts`) that wrap `useQuery`. |
| **State integration** | • Add a simple **auth context** (token stored in memory).<br>• Protect `/dashboard` and `/product/*` routes with a `RequireAuth` wrapper. |
| **Tests** | • Integration test for navigation flow (login → dashboard). |
| **Documentation** | • Update README with feature‑slice conventions. |

**Success criteria** – Navigation works, lazy loading splits bundles, and mock data renders in dashboard & product list. Protected routes redirect to login when unauthenticated.

---

## Milestone 5 – CI/CD Pipeline & Production Build (1 day)

| Deliverable | Tasks |
|-------------|-------|
| **GitHub Actions workflow** | • Extend existing workflow to run `npm run build` after lint/type‑check/tests.<br>• Upload `dist/` as an artifact.<br>• Deploy to Vercel (or Netlify) using respective Action (`vercel-action` / `netlify-action`). |
| **Environment variables** | • Add preview‑only `.env.example` (API base URL placeholder). |
| **Branch strategy** | • Enforce `feature/*` → PR → merge to `main`.<br>• Enable “Deploy Preview” for PRs (Vercel/Netlify auto). |
| **Production sanity check** | • Verify that `npm run build` generates a correctly hashed `dist/` folder.<br>• Deploy a test commit; ensure app loads, routing works, and static assets are served via CDN. |

**Success criteria** – Every push to `main` automatically publishes a live preview; a pull request creates a separate preview URL. Build size is under 200 KB gzipped (baseline SPA).

---

## Milestone 6 – Polish, Documentation & Handoff (1 day)

| Deliverable | Tasks |
|-------------|-------|
| **Component library docs** | • Add a minimal **Storybook** configuration (optional – if time permits) or a static Markdown catalog linking to component source files. |
| **Onboarding guide** | • Explain folder structure, how to add a new feature slice, UI primitive usage, testing conventions. |
| **Performance checklist** | • Verify Lighthouse scores (performance > 90, accessibility > 90).<br>• Add `@vitejs/plugin-legacy` only if IE11 support is later required. |
| **Final QA** | • Run full test suite (`npm test --runInBand`).<br>• Perform a one‑click “add new feature” dry‑run to ensure no hidden blockers. |

**Success criteria** – New developer can clone the repo, run `npm ci && npm run dev`, and see the sandbox page within an hour. All documentation is committed to `docs/` and linked from the README.

---

## Implementation Order Summary (Critical Path)

1. **Milestone 1** – Repo & toolchain (foundation).  
2. **Milestone 2** – Global providers (Tailwind, React Query, Context).  
3. **Milestone 3** – UI primitives (reusable building blocks).  
4. **Milestone 4** – Routing + sample feature slices (real‑world usage).  
5. **Milestone 5** – CI/CD & production build (automation).  
6. **Milestone 6** – Documentation & handoff (knowledge transfer).

Each milestone is **independent enough** to be reviewed and merged on its own, keeping the CI pipeline green at every step and preventing large, monolithic PRs.

---

## Estimated Timeline (8 working days)

| Day | Milestone |
|-----|-----------|
| 1 | Milestone 1 |
| 2‑3 | Milestone 2 |
| 4‑5 | Milestone 3 |
| 6‑8 | Milestone 4 |
| 9 | Milestone 5 |
| 10 | Milestone 6 (polish & handoff) |

*If a team works in parallel (e.g., one developer on UI primitives while another sets up routing), the overall calendar can be compressed by 1‑2 days.*

---

### Next Steps
1. **Create the repository** and push an initial commit with Milestone 1 tasks.  
2. Assign the **first developer** to finish Milestone 1 + early parts of Milestone 2.  
3. Schedule a **short sync** (30 min) after Milestone 2 to confirm the global providers are stable before moving to UI primitives.

Following this plan will produce a clean, extensible SPA scaffold ready for rapid product feature development while keeping the codebase approachable for newcomers.

# CRITIC OUTPUT

# Engineering Critique of the Proposed SPA Foundation

---

## 1. Key Risks

| Area | Description | Impact if Unaddressed |
|------|-------------|-----------------------|
| **Complex Global State** | Two parallel state systems (React Context + useReducer for UI state **and** React Query for server data). | Unnecessary mental overhead; risk of duplicated state (e.g., toast visibility stored both in context and query cache). |
| **Feature‑Slice Boilerplate** | Every domain gets its own `components/`, `hooks/`, `store/`, `tests/` sub‑folders. | Early contributors must navigate a deep folder hierarchy for tiny features, increasing onboarding time and likelihood of misplaced files. |
| **Lazy‑Loading Overhead** | All routes are wrapped in `React.lazy` + `Suspense` with a single fallback. | If the fallback UI is generic, users may see a blank screen for several seconds on low‑end devices, harming perceived performance. |
| **Missing Accessibility Foundations** | No explicit plan for ARIA, keyboard navigation, or contrast testing beyond “accessible markup”. | Failing WCAG compliance can cause legal risk and a poor experience for assistive‑technology users. |
| **Security Assumptions** | Auth context only stores a token in memory; no refresh‑token flow, no CSRF protection, no secure cookie handling. | In production this will be insufficient for any real API; token leakage could lead to compromised accounts. |
| **Testing Scope** | Unit tests for UI primitives are mentioned, but integration/e2e testing (e.g., Cypress, Playwright) is absent. | Critical bugs in routing, auth guards, or data fetching may surface only in production. |
| **CI·CD Cache Invalidation** | GitHub Actions cache will store `node_modules`; dependency updates may be silently ignored if the cache key isn’t version‑aware. | Stale dependencies can cause build failures that are hard to debug. |
| **Assumed Deploy Target** | Vercel/Netlify static hosting is baked in, yet no fallback plan for environments that require an SSR edge (e.g., SEO‑critical pages). | Future requirement changes may force a costly rewrite to Next.js. |

---

## 2. Over‑Engineering Observations

| Component | Why It May Be Unnecessary at MVP Stage |
|-----------|----------------------------------------|
| **React Query** – Full caching, deduplication, background refetch, automatic retries. | If the initial product only consumes a few read‑only endpoints, a simple `fetch` wrapper with manual caching could suffice, reducing bundle size and learning curve. |
| **Class‑Variance‑Authority (CVA) for `<Button>` variants** | Adds another dependency and abstraction; Tailwind’s “variant groups” or a small utility function can achieve the same without extra runtime code. |
| **Separate `store/` folder for global UI reducers** | The only global UI state described is theme and toast. These can live directly in `src/app/context` without an extra top‑level directory. |
| **Storybook** (optional, listed in Milestone 6) | Valuable for large component libraries, but adds build time and maintenance for a starter scaffold; a simple Markdown component catalog is enough initially. |
| **Full Feature‑Slice Pattern** | Enforces strict module boundaries that are great for large teams, but for a small team the extra folders (`features/<x>/store`, `features/<x>/tests`) increase boilerplate without immediate benefit. |

---

## 3. Simplification Opportunities

1. **Consolidate Global UI State**
   * Create a single `src/context` directory containing `ThemeContext`, `ToastContext`, and (later) `AuthContext`.  
   * Export a combined `<AppProviders>` component that composes `ThemeProvider`, `ToastProvider`, `QueryClientProvider`, and `BrowserRouter`.  
   * Remove the separate `store/` top‑level folder.

2. **Reduce Feature‑Slice Boilerplate**
   * Start with a flat `src/pages` structure (e.g., `LoginPage.tsx`, `DashboardPage.tsx`, `ProductListPage.tsx`).  
   * Introduce the deeper slice pattern only when a feature grows beyond a few components.  
   * Keep shared UI primitives in `src/components/ui` and place feature‑specific components next to the page file (e.g., `DashboardPage.tsx` + `DashboardWidget.tsx`).

3. **Swap React Query for a Light Wrapper (optional)**
   * Provide a tiny `src/services/api.ts` that returns `Promise<T>` from `fetch` or `axios`.  
   * Add a simple `useFetch<T>(url)` hook that internally uses `useEffect` + `useState`.  
   * Keep the React Query dependency on standby for later scaling.

4. **Simplify Styling Variants**
   * Use Tailwind’s built‑in `@apply` in a small `src/styles/components.css` file for common variants (e.g., `.btn-primary { @apply bg-blue-600 text-white; }`).  
   * Remove CVA unless the component library expands to > 20 variants.

5. **Streamline CI Cache Keys**
   * Include `package-lock.json` hash in the cache key (`${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}`) to guarantee fresh installs on dependency changes.

---

## 4. Weak Assumptions & Challenges

| Assumption | Why It May Be Flawed | Suggested Mitigation |
|------------|----------------------|----------------------|
| *“Low entry barrier = one‑day onboarding”* | The stack combines React, TypeScript, Vite, Tailwind, React Query, Context, and a feature‑slice folder convention. New hires may be unfamiliar with any of these pieces. | Provide a **quick‑start guide** that includes a “Hello World” walkthrough covering each technology, plus a cheat‑sheet for the folder layout. |
| *“Static hosting is sufficient for all pages”* | Some future pages (e.g., Marketing landing, SEO‑heavy blog) may need server‑side rendering or prerendering. | Adopt a **static‑site generation** approach early (e.g., Vite SSR plug‑in) or keep the option to migrate to Next.js without rewriting UI components. |
| *“React Context + useReducer can handle all global UI state”* | As the app scales, frequent updates to a large context can cause unnecessary re‑renders across the tree. | Evaluate a lightweight store (Zustand, Jotai) for high‑frequency UI state (e.g., drag‑and‑drop, real‑time notifications). |
| *“Tailwind JIT + PostCSS covers all theming needs”* | Dynamic theming (runtime color palettes, dark mode toggles) may require CSS variables or runtime injection. | Use Tailwind’s `dark:` modifier combined with a CSS‑variable based approach for true runtime theming. |
| *“Unit tests + Jest/RTL are enough for confidence”* | UI/UX regressions often surface only in the browser (routing, scroll positions, lazy loading). | Add a minimal **end‑to‑end** test suite (Playwright) for critical flows (login → dashboard). |
| *“Pre‑commit hook runs lint and type‑check”* | `npm run type-check` (tsc) can be slow on large codebases, causing developers to skip commits. | Use `eslint` with `@typescript-eslint/parser` for fast type‑aware linting and run `tsc --noEmit` only in CI. |

---

## 5. Recommendations & Actionable Items

1. **Trim the initial scaffold**  
   * Remove `store/` and `features/<x>/store` directories.  
   * Collapse `features/` into `pages/` until a feature reaches > 5 components.

2. **Re‑evaluate data‑fetching strategy**  
   * Start with a thin wrapper around `axios` (or native `fetch`).  
   * Introduce React Query only after the first real API endpoint exhibits caching needs.

3. **Formalize accessibility**  
   * Add `eslint-plugin-jsx-a11y`.  
   * Create a checklist (ARIA labels on custom components, focus management on `<Modal>`, visible focus outline).  
   * Include an automated a11y test (axe-core) in the CI pipeline.

4. **Secure Auth Boilerplate**  
   * Store JWT in `httpOnly` secure cookie via a backend endpoint (even if mocked).  
   * Implement token refresh flow skeleton with an `axios` interceptor.

5. **Add End‑to‑End Tests Early**  
   * Install Playwright.  
   * Write two tests: (a) navigation to `/dashboard` redirects to login when unauthenticated; (b) successful login displays a toast.

6. **Documentation Focus**  
   * Keep the onboarding guide concise (≤ 5 minutes read).  
   * Provide a “Feature‑Slice Migration Guide” that explains when and how to reorganize a page into a slice.

7. **Performance Baseline**  
   * Run Lighthouse after Milestone 4; target **≥ 90** on Performance, Accessibility, Best Practices.  
   * If the bundle exceeds 200 KB gzipped, consider code‑splitting the UI primitives (e.g., lazy load `<Modal>`).

8. **Future‑Proof CI/CD**  
   * Add a `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` secret to the GitHub Action.  
   * Keep the Netlify option as a commented alternative rather than a parallel workflow.

---

## 6. Revised Minimal Roadmap (8 working days)

| Day | Goal | Deliverables |
|-----|------|--------------|
| 1 | Repo & tooling | GitHub repo, Vite + TS, ESLint/Prettier, husky, CI (lint + type‑check) |
| 2 | Global providers & Tailwind | `src/context/*`, `QueryClientProvider`, Tailwind integration, simple theme toggle |
| 3 | Core UI primitives | `<Button>`, `<Input>`, `<Card>`, `<Modal>`, `<Toast>` (no CVA) |
| 4 | Simple routing + pages | `src/pages/*` (`Login`, `Dashboard`, `ProductList`), lazy‑loaded routes, `RequireAuth` guard |
| 5 | Light API layer | `apiClient.ts` (axios), `useFetch` hook, mock product data, basic auth context |
| 6 | CI enhancements & e2e | Add Playwright tests, cache key fix, deploy preview (Vercel) |
| 7 | Accessibility & security audit | eslint‑plugin‑jsx‑a11y, a11y test, secure cookie placeholder, token handling docs |
| 8 | Documentation & handoff | Onboarding guide, component catalog, performance checklist, final CI green run |

This plan retains the **core benefits** (fast dev loop, typed code, reusable UI) while **eliminating unnecessary complexity** early on, thereby delivering a truly low‑entry‑barrier foundation that can be incrementally expanded as the product grows.

