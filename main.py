from rich import print
from agents.architect import run as architect_run
from agents.planner import run as planner_run
from agents.critic import run as critic_run
from agents.synthesizer import run as synthesizer_run
from agents.specifier import run as specifier_run
from agents.spec_auditor import run as auditor_run

import os
import re
import json
from pathlib import Path


def safe_filename(text):
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = text.strip("_")
    return text[:60] or "project"


def clean_json_output(text):
    text = text.strip()

    if text.startswith("```"):
        lines = text.splitlines()

        if lines and lines[0].startswith("```"):
            lines = lines[1:]

        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]

        text = "\n".join(lines).strip()

    return text


PROJECT_IDEA = input("Enter project idea: ")
PROJECT_KEY = safe_filename(PROJECT_IDEA)

os.makedirs("memory", exist_ok=True)
os.makedirs("workspace", exist_ok=True)

shared_context = ""

print("\n[bold cyan]Running Architect Agent...[/bold cyan]\n")
architect_output = architect_run(PROJECT_IDEA, shared_context)

shared_context += f"""
# ARCHITECT OUTPUT

{architect_output}
"""

print("\n[bold green]Running Planner Agent...[/bold green]\n")
planner_output = planner_run(PROJECT_IDEA, shared_context)

shared_context += f"""
# PLANNER OUTPUT

{planner_output}
"""

print("\n[bold red]Running Critic Agent...[/bold red]\n")
critic_output = critic_run(PROJECT_IDEA, shared_context)

shared_context += f"""
# CRITIC OUTPUT

{critic_output}
"""

combined = f"""
# PROJECT IDEA

{PROJECT_IDEA}

{shared_context}
"""

shared_path = Path("memory") / f"{PROJECT_KEY}.md"
shared_path.write_text(combined, encoding="utf-8")

print("\n[bold magenta]Running Synthesizer Agent...[/bold magenta]\n")
final_plan = synthesizer_run(PROJECT_IDEA, shared_context)

final_plan_path = Path("memory") / f"FINAL_{PROJECT_KEY}.md"
final_plan_path.write_text(final_plan, encoding="utf-8")

print("\n[bold blue]Running Specifier Agent...[/bold blue]\n")

build_spec = specifier_run(final_plan)
build_spec = clean_json_output(build_spec)

build_spec_path = Path("memory") / "BUILD_SPEC.json"
build_spec_path.write_text(build_spec, encoding="utf-8")

print("\n[bold blue]Running Spec Auditor Agent...[/bold blue]\n")

audited_spec = auditor_run(build_spec)
audited_spec = clean_json_output(audited_spec)

try:
    parsed = json.loads(audited_spec)

    audited_spec_path = Path("memory") / "BUILD_SPEC_AUDITED.json"
    audited_spec_path.write_text(
        json.dumps(parsed, indent=2),
        encoding="utf-8"
    )

    print("[bold green]Audited spec validated and written.[/bold green]")

except json.JSONDecodeError as e:
    print("[bold red]Auditor returned invalid JSON.[/bold red]")
    print(str(e))

    failed_path = Path("memory") / "BUILD_SPEC_AUDITED_FAILED.txt"
    failed_path.write_text(audited_spec, encoding="utf-8")

    print("[yellow]Raw failed auditor output saved to memory/BUILD_SPEC_AUDITED_FAILED.txt[/yellow]")


print(f"\n[bold yellow]Shared memory written to {shared_path}[/bold yellow]")
print(f"[bold yellow]Final plan written to {final_plan_path}[/bold yellow]")
print("[bold yellow]Build spec written to memory/BUILD_SPEC.json[/bold yellow]")
print("[bold yellow]Audited build spec written to memory/BUILD_SPEC_AUDITED.json if valid[/bold yellow]")