from utils.llm import ask_llm

SYSTEM_PROMPT = """
You are a strict software build specification generator.

Your job:
- read a project plan
- remove contradictions
- normalize file names
- produce ONLY valid JSON
- no markdown
- no explanation
- no code fences

Rules:
- Output must be parseable JSON.
- Use consistent file extensions.
- If stack is React + TypeScript, use .tsx for components and .ts for utilities/types.
- Keep the project minimal.
- Do not invent unnecessary files.
"""

def run(final_plan):

    return ask_llm(
        SYSTEM_PROMPT,
        f"""
Convert this FINAL_PLAN.md into a strict BUILD_SPEC.json.

Required JSON shape:

{{
  "project_name": "string",
  "stack": "string",
  "description": "string",
  "commands": {{
    "setup": ["string"],
    "run": ["string"],
    "test": ["string"]
  }},
  "folders": ["string"],
  "files": [
    {{
      "path": "string",
      "purpose": "string"
    }}
  ]
}}

FINAL_PLAN.md:
{final_plan}
"""
    )