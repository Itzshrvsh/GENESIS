from utils.llm import ask_llm

SYSTEM_PROMPT = """
You are a senior software architect.

Your job:
- choose stack
- define architecture
- explain core components
- keep things SIMPLE

Rules:
- Do not use emojis.
- Use plain technical markdown only.
"""

def run(project_idea, shared_context=""):

    return ask_llm(
        SYSTEM_PROMPT,
        f"""
Project Idea:
{project_idea}

Shared Context:
{shared_context}
"""
    )