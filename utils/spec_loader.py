import json
import re
from pathlib import Path


def slugify_project_name(name):
    name = name.lower()
    name = re.sub(r"[^a-z0-9]+", "_", name)
    name = name.strip("_")
    return name or "generated_project"


def load_build_spec(path=None):
    if path is None:
        audited = Path("memory/BUILD_SPEC_AUDITED.json")
        original = Path("memory/BUILD_SPEC.json")

        if audited.exists():
            path = audited
        else:
            path = original

    spec_path = Path(path)

    if not spec_path.exists():
        raise FileNotFoundError(f"Build spec not found: {path}")

    raw = spec_path.read_text(encoding="utf-8")

    try:
        spec = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid BUILD_SPEC.json: {e}")

    required_keys = ["project_name", "stack", "description", "commands", "folders", "files"]

    for key in required_keys:
        if key not in spec:
            raise ValueError(f"Missing required key in BUILD_SPEC.json: {key}")

    spec["project_slug"] = slugify_project_name(spec["project_name"])

    return spec