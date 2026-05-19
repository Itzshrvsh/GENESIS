from pathlib import Path
from rich import print
from utils.spec_loader import load_build_spec


def ensure_parent_folder(file_path):
    file_path.parent.mkdir(parents=True, exist_ok=True)


def create_project_from_spec():
    spec = load_build_spec()

    project_root = Path("workspace") / spec["project_slug"]
    project_root.mkdir(parents=True, exist_ok=True)

    print(f"[bold cyan]Creating project:[/bold cyan] {project_root}")

    # Create folders from spec
    for folder in spec.get("folders", []):
        folder_path = project_root / folder
        folder_path.mkdir(parents=True, exist_ok=True)
        print(f"[green]Created folder:[/green] {folder_path}")

    # Create files from spec
    for file_info in spec.get("files", []):
        relative_path = file_info["path"]
        purpose = file_info.get("purpose", "")

        file_path = project_root / relative_path
        ensure_parent_folder(file_path)

        if not file_path.exists():
            file_path.write_text(
                f"""/*
Purpose:
{purpose}

This is a placeholder file generated from BUILD_SPEC.json.
*/
""",
                encoding="utf-8"
            )
            print(f"[yellow]Created file:[/yellow] {file_path}")
        else:
            print(f"[blue]Skipped existing file:[/blue] {file_path}")

    # Create project metadata
    metadata_path = project_root / "PROJECT_SPEC.md"
    metadata_path.write_text(
        f"""# {spec["project_name"]}

## Stack

{spec["stack"]}

## Description

{spec["description"]}

## Setup Commands

{chr(10).join(f"- `{cmd}`" for cmd in spec["commands"].get("setup", []))}

## Run Commands

{chr(10).join(f"- `{cmd}`" for cmd in spec["commands"].get("run", []))}

## Test Commands

{chr(10).join(f"- `{cmd}`" for cmd in spec["commands"].get("test", []))}
""",
        encoding="utf-8"
    )

    print(f"[bold green]Project skeleton created successfully:[/bold green] {project_root}")


if __name__ == "__main__":
    create_project_from_spec()