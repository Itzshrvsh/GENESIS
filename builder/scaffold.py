import os
import json
import re
from pathlib import Path


def slugify_project_name(name: str) -> str:
    name = name.strip().lower()
    name = re.sub(r"[^a-z0-9]+", "_", name)
    name = re.sub(r"_+", "_", name)
    return name.strip("_") or "generated_project"


def safe_join(base: Path, relative_path: str) -> Path:
    target = base / relative_path

    resolved_base = base.resolve()
    resolved_target = target.resolve()

    if not str(resolved_target).startswith(str(resolved_base)):
        raise ValueError(f"Unsafe path detected: {relative_path}")

    return target


def load_build_spec(path="memory/BUILD_SPEC.json"):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def create_readme(project_dir: Path, spec: dict):
    readme_path = project_dir / "README.md"

    content = f"""# {spec.get("project_name", "Generated Project")}

## Description

{spec.get("description", "No description provided.")}

## Stack

{spec.get("stack", "Unknown")}

## Setup Commands

```bash
{chr(10).join(spec.get("commands", {}).get("setup", []))}