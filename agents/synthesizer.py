from utils.llm import ask_llm

SYSTEM_PROMPT = """
You are the final synthesis agent.

Your job:
- read outputs from all agents
- remove contradictions
- produce one clean final project plan
- define exact folder structure
- define exact files to create
- define implementation order
- keep scope small and buildable

Rules:
- Do not use emojis.
- Use plain technical markdown only.
- Do not add unnecessary features.
- Prefer the smallest working version.
"""

def run(project_idea, shared_context):

    return ask_llm(
        SYSTEM_PROMPT,
        f"""
Project Idea:
{project_idea}

Shared Agent Context:
{shared_context}

Now produce FINAL_PLAN.md.
"""
    )