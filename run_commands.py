import subprocess
from pathlib import Path
from rich import print
from utils.spec_loader import load_build_spec
from datetime import datetime


DANGEROUS_PATTERNS = [
    "rm -rf",
    "del /s",
    "format",
    "shutdown",
    "reboot",
    "reg delete",
    "diskpart",
    "mkfs",
    ":(){",
    "sudo",
    "chmod 777",
]


def is_dangerous(command: str) -> bool:
    lowered = command.lower()

    for pattern in DANGEROUS_PATTERNS:
        if pattern in lowered:
            return True

    return False


def write_log(text: str):
    log_path = Path("memory") / "command_logs.md"
    log_path.parent.mkdir(parents=True, exist_ok=True)

    with log_path.open("a", encoding="utf-8") as f:
        f.write(text)
        f.write("\n\n")


def markdown_block(title: str, content: str, lang: str = "txt") -> str:
    return (
        f"## {title}\n\n"
        f"```{lang}\n"
        f"{content}\n"
        f"```\n"
    )


def run_command(command: str, cwd: Path) -> int:
    print(f"\n[bold cyan]Running:[/bold cyan] {command}")
    print(f"[dim]CWD: {cwd}[/dim]")

    started = datetime.now().isoformat(timespec="seconds")

    initial_log = (
        "# Command Run\n\n"
        + markdown_block("Time", started)
        + markdown_block("Command", command, "bash")
        + markdown_block("Working Directory", str(cwd))
    )

    write_log(initial_log)

    try:
        result = subprocess.run(
            command,
            cwd=str(cwd),
            shell=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace"
        )

        stdout = result.stdout.strip()
        stderr = result.stderr.strip()

        print(f"[bold]Exit code:[/bold] {result.returncode}")

        if stdout:
            print("\n[green]STDOUT:[/green]")
            print(stdout)

        if stderr:
            print("\n[red]STDERR:[/red]")
            print(stderr)

        result_log = (
            markdown_block("Exit Code", str(result.returncode))
            + markdown_block("STDOUT", stdout)
            + markdown_block("STDERR", stderr)
        )

        write_log(result_log)

        return result.returncode

    except Exception as e:
        print(f"[bold red]Command failed to execute:[/bold red] {e}")

        error_log = markdown_block("Execution Error", str(e))
        write_log(error_log)

        return -1


def choose_commands(spec):
    commands = spec.get("commands", {})

    setup_commands = commands.get("setup", [])
    test_commands = commands.get("test", [])

    selected = []

    if setup_commands:
        print("\n[bold yellow]Setup commands found:[/bold yellow]")
        for i, cmd in enumerate(setup_commands, start=1):
            print(f"{i}. {cmd}")

        choice = input("\nRun setup commands? (y/n): ").strip().lower()
        if choice == "y":
            selected.extend(setup_commands)

    if test_commands:
        print("\n[bold yellow]Test/build commands found:[/bold yellow]")
        for i, cmd in enumerate(test_commands, start=1):
            print(f"{i}. {cmd}")

        choice = input("\nRun test/build commands? (y/n): ").strip().lower()
        if choice == "y":
            selected.extend(test_commands)

    return selected


def main():
    spec = load_build_spec()

    project_root = Path("workspace") / spec["project_slug"]

    if not project_root.exists():
        raise FileNotFoundError(
            f"Project folder not found: {project_root}. Run builder.py first."
        )

    selected_commands = choose_commands(spec)

    if not selected_commands:
        print("[yellow]No commands selected.[/yellow]")
        return

    print("\n[bold cyan]Commands selected:[/bold cyan]")
    for cmd in selected_commands:
        print(f"- {cmd}")

    confirm = input("\nFinal confirmation. Execute selected commands? (y/n): ").strip().lower()

    if confirm != "y":
        print("[yellow]Cancelled.[/yellow]")
        return

    for command in selected_commands:
        if is_dangerous(command):
            print(f"[bold red]Blocked dangerous command:[/bold red] {command}")

            blocked_log = markdown_block("Blocked Dangerous Command", command, "bash")
            write_log(blocked_log)

            continue

        exit_code = run_command(command, project_root)

        if exit_code != 0:
            print("[bold red]Command failed. Stopping command chain.[/bold red]")
            print("[yellow]Check memory/command_logs.md for details.[/yellow]")
            break

    print("\n[bold green]Command runner finished.[/bold green]")
    print("[yellow]Logs saved to memory/command_logs.md[/yellow]")


if __name__ == "__main__":
    main()