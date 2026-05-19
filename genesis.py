import subprocess
from pathlib import Path
from rich import print
import shutil
import re
import sys


ROOT = Path(__file__).parent.resolve()
MEMORY_DIR = ROOT / "memory"
WORKSPACE_DIR = ROOT / "workspace"


def safe_slug(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = text.strip("_")
    return text[:80] or "generated_project"


def run_step(name: str, command: list[str], input_text: str | None = None, stop_on_fail=True):
    print(f"\n[bold cyan]=== {name} ===[/bold cyan]")
    print(f"[dim]Command: {' '.join(command)}[/dim]")

    result = subprocess.run(
        command,
        cwd=str(ROOT),
        input=input_text,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    if result.returncode != 0:
        print(f"[bold red]Step failed:[/bold red] {name}")
        print(f"[red]Exit code:[/red] {result.returncode}")

        if stop_on_fail:
            sys.exit(result.returncode)

    print(f"[bold green]Completed:[/bold green] {name}")
    return result.returncode


def clean_old_memory():
    MEMORY_DIR.mkdir(exist_ok=True)

    files_to_delete = [
        "BUILD_SPEC.json",
        "BUILD_SPEC_AUDITED.json",
        "BUILD_SPEC_AUDITED_FAILED.txt",
        "command_logs.md",
        "ERROR_REPORT.md",
    ]

    for file_name in files_to_delete:
        path = MEMORY_DIR / file_name
        if path.exists():
            path.unlink()
            print(f"[yellow]Deleted old memory file:[/yellow] {path}")


def load_project_slug_from_spec():
    import json

    spec_path = MEMORY_DIR / "BUILD_SPEC_AUDITED.json"

    if not spec_path.exists():
        spec_path = MEMORY_DIR / "BUILD_SPEC.json"

    if not spec_path.exists():
        return None

    try:
        spec = json.loads(spec_path.read_text(encoding="utf-8"))
        project_name = spec.get("project_name", "generated_project")
        return safe_slug(project_name)
    except Exception:
        return None


def clean_old_workspace(project_slug: str):
    project_path = WORKSPACE_DIR / project_slug

    if project_path.exists():
        print(f"\n[yellow]Existing generated project found:[/yellow] {project_path}")
        choice = input("Delete and regenerate it? (y/n): ").strip().lower()

        if choice == "y":
            shutil.rmtree(project_path)
            print(f"[red]Deleted:[/red] {project_path}")
        else:
            print("[yellow]Keeping existing project. New files may create backups.[/yellow]")


def run_commands_automatically():
    """
    Feeds answers to run_commands.py:
    y = run setup commands
    y = run test/build commands
    y = final confirmation
    """
    auto_input = "y\ny\ny\n"

    return run_step(
        "Run setup/build commands",
        [sys.executable, "run_commands.py"],
        input_text=auto_input,
        stop_on_fail=False,
    )


def main():
    print("[bold magenta]GENESIS FULL PIPELINE[/bold magenta]")
    print("[dim]Idea → agents → audited spec → project skeleton → generated files → setup/build[/dim]\n")

    project_idea = input("Enter project idea: ").strip()

    if not project_idea:
        print("[bold red]Project idea cannot be empty.[/bold red]")
        return

    clean_old_memory()

    # main.py itself asks for input, so we pass project_idea into stdin.
    run_step(
        "Generate plan and build spec",
        [sys.executable, "main.py"],
        input_text=project_idea + "\n",
    )

    project_slug = load_project_slug_from_spec()

    if project_slug:
        clean_old_workspace(project_slug)
    else:
        print("[yellow]Could not detect project slug before building. Continuing anyway.[/yellow]")

    run_step(
        "Create project skeleton",
        [sys.executable, "builder.py"],
    )

    run_step(
        "Generate source files",
        [sys.executable, "generate_files.py"],
    )

    run_step(
        "Audit dependencies",
        [sys.executable, "dependency_auditor.py"],
    )

    command_exit = run_commands_automatically()

    print("\n[bold magenta]=== PIPELINE FINISHED ===[/bold magenta]")

    if command_exit == 0:
        print("[bold green]Setup/build command runner finished successfully.[/bold green]")
    else:
        print("[bold yellow]Command runner finished with errors. Check memory/command_logs.md[/bold yellow]")

    final_slug = load_project_slug_from_spec()

    if final_slug:
        project_path = WORKSPACE_DIR / final_slug
        print(f"\n[bold cyan]Generated project:[/bold cyan] {project_path}")

        print("\n[bold yellow]If build passed, run app manually in two terminals:[/bold yellow]")
        print(f"\n[bold]Backend:[/bold]\ncd {project_path / 'backend'}\nnpm run dev")
        print(f"\n[bold]Frontend:[/bold]\ncd {project_path / 'frontend'}\nnpm run dev")

    print("\n[dim]Logs: memory/command_logs.md[/dim]")
    print("[dim]Audited spec: memory/BUILD_SPEC_AUDITED.json[/dim]")

    # Interactive Debugging Loop
    while True:
        try:
            print("\n[bold cyan]=== INTERACTIVE DEBUGGING ===[/bold cyan]")
            feedback = input("[?] Options:\n  - Type an error message or change request\n  - Type 'test' to run the autonomous test/fix agent\n  - Type 'no' or press Enter to exit\n> ").strip()
            
            if not feedback or feedback.lower() in ('no', 'n', 'exit', 'quit'):
                break

            if feedback.lower() == 'test':
                print(f"\n[bold magenta]Running Autonomous Tester...[/bold magenta]")
                run_step(
                    "Autonomous Tester",
                    [sys.executable, str(ROOT / "agents" / "tester.py")],
                    stop_on_fail=False
                )
            else:
                run_step(
                    "Apply Fixes",
                    [sys.executable, str(ROOT / "agents" / "fixer.py")],
                    input_text=feedback + "\n",
                    stop_on_fail=False
                )
            
                choice = input("\n[?] Do you want to re-run the build/setup commands? (y/n): ").strip().lower()
                if choice == 'y':
                    run_commands_automatically()

        except KeyboardInterrupt:
            break

if __name__ == "__main__":
    main()