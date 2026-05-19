from utils.llm import ask_llm

SYSTEM_PROMPT = """
You are a precise software file generation agent.

Your job:
- generate the complete content for exactly one file
- follow the requested file path and purpose
- produce runnable, minimal code
- do not include markdown code fences
- do not include explanations outside the file content
- keep implementation simple
- avoid unnecessary dependencies

Rules:
- Output ONLY the raw file content.
- No ``` fences.
- No commentary.
- No emojis.
- If the file is TypeScript, write valid TypeScript.
- If the file is TSX, write valid React TSX.
- If the file is JSON, write valid JSON.
- If the file is Markdown, write Markdown.
- If vite.config.ts imports "@vitejs/plugin-react-swc", frontend/package.json must include "@vitejs/plugin-react-swc" in devDependencies.
- If vite.config.ts imports "@vitejs/plugin-react", frontend/package.json must include "@vitejs/plugin-react" in devDependencies.
- Keep Vite React plugin choice consistent across vite.config.ts and package.json.
- Prefer "@vitejs/plugin-react" unless SWC is explicitly requested.
"""

def run(project_spec, file_path, file_purpose, all_files):

    return ask_llm(
        SYSTEM_PROMPT,
        f"""
Project Spec:
{project_spec}

All Files In Project:
{all_files}

Generate content for this file only:

File Path:
{file_path}

Purpose:
{file_purpose}
"""
    )