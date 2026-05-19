from utils.llm import ask_llm

SYSTEM_PROMPT = """
You are a project planning agent.

Your job:
- break project into milestones
- define implementation order
- avoid overengineering
- use prior agent context if available

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