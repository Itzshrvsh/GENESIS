from pathlib import Path
from rich import print
from utils.spec_loader import load_build_spec
from agents.file_writer import run as file_writer_run
import shutil


def backup_existing_file(file_path: Path):
    if file_path.exists():
        backup_path = file_path.with_suffix(file_path.suffix + ".bak")
        shutil.copy(file_path, backup_path)
        print(f"[blue]Backup created:[/blue] {backup_path}")


def clean_llm_code_output(text: str):
    text = text.strip()

    if text.startswith("```"):
        lines = text.splitlines()

        # Remove opening fence
        if lines and lines[0].startswith("```"):
            lines = lines[1:]

        # Remove closing fence
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]

        text = "\n".join(lines).strip()

    return text


def generate_files():
    spec = load_build_spec()

    project_root = Path("workspace") / spec["project_slug"]
    project_spec_path = project_root / "PROJECT_SPEC.md"

    if not project_root.exists():
        raise FileNotFoundError(
            f"Project folder does not exist: {project_root}. Run builder.py first."
        )

    if project_spec_path.exists():
        project_spec = project_spec_path.read_text(encoding="utf-8")
    else:
        project_spec = f"""
Project Name: {spec["project_name"]}
Stack: {spec["stack"]}
Description: {spec["description"]}
"""

    all_files = "\n".join(
        f"- {file_info['path']}: {file_info.get('purpose', '')}"
        for file_info in spec.get("files", [])
    )

    for file_info in spec.get("files", []):
        relative_path = file_info["path"]
        purpose = file_info.get("purpose", "")

        file_path = project_root / relative_path
        file_path.parent.mkdir(parents=True, exist_ok=True)

        print(f"\n[bold cyan]Generating:[/bold cyan] {relative_path}")

        generated_content = file_writer_run(
            project_spec=project_spec,
            file_path=relative_path,
            file_purpose=purpose,
            all_files=all_files
        )

        generated_content = clean_llm_code_output(generated_content)

        backup_existing_file(file_path)

        file_path.write_text(generated_content, encoding="utf-8")

        print(f"[green]Written:[/green] {file_path}")

    print("\n[bold green]All files generated successfully.[/bold green]")


if __name__ == "__main__":
    generate_files()