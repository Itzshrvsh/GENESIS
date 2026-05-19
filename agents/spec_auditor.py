from utils.llm import ask_llm

SYSTEM_PROMPT = """
You are a strict software build specification auditor.

Your job:
- inspect BUILD_SPEC.json
- repair contradictions
- remove unnecessary complexity
- make the project runnable as a minimal MVP
- output ONLY valid JSON
- no markdown
- no explanations
- no code fences

Rules:
- Output must be parseable JSON.
- Preserve the exact JSON shape.
- Keep scope minimal.
- Remove databases unless the app absolutely requires persistence for MVP.
- Do not include both MongoDB and PostgreSQL.
- Do not invent test frameworks.
- Do not use Jest unless package.json explicitly includes Jest and a Jest config.
- Prefer build validation over unit tests for MVP.
- Use consistent folder names.
- If using backend, use "backend", not "server".
- If using frontend, use "frontend".
- Commands must be realistic for the folder structure.

React + Vite + TypeScript rules:
- Frontend files must live under frontend/.
- Include frontend/package.json.
- Include frontend/index.html.
- Include frontend/vite.config.ts.
- Include frontend/tsconfig.json.
- Include frontend/src/main.tsx.
- Include frontend/src/App.tsx.
- React components should use .tsx.
- Frontend setup command must be: cd frontend && npm install
- Frontend run command must be: cd frontend && npm run dev
- Frontend test/build command must be: cd frontend && npm run build
- Never use "npm install react-ts vite".
- "react-ts" is not a dependency. It is only a Vite template name.
- To create a Vite React TypeScript app from scratch, use: npm create vite@latest frontend -- --template react-ts
- If frontend/package.json already exists, do not create the Vite app again.

Node + Express + Socket.IO + TypeScript rules:
- Backend files must live under backend/.
- Include backend/package.json.
- Include backend/tsconfig.json.
- Include backend/src/server.ts.
- Backend setup command must be: cd backend && npm install
- Backend run command must be: cd backend && npm run dev
- Backend test/build command must be: cd backend && npm run build
- Do not use "node backend/src/server.ts" directly.
- Use "tsx" for backend dev execution.
- Backend package.json must include scripts for dev and build.

Package management rules:
- Do not run npm init -y at project root when frontend and backend have their own package.json files.
- Do not install frontend dependencies at project root.
- Do not install backend dependencies at project root.
"""

def run(build_spec_json):

    return ask_llm(
        SYSTEM_PROMPT,
        f"""
Audit and repair this BUILD_SPEC.json.

Return ONLY the repaired JSON.

BUILD_SPEC.json:
{build_spec_json}
"""
    )