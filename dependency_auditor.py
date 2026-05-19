import json
from pathlib import Path
from rich import print
from utils.spec_loader import load_build_spec


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data):
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def ensure_dev_dependency(package_json: dict, name: str, version: str = "latest"):
    package_json.setdefault("devDependencies", {})

    if name not in package_json["devDependencies"]:
        package_json["devDependencies"][name] = version
        return True

    return False


def audit_frontend_dependencies(project_root: Path):
    frontend = project_root / "frontend"
    package_path = frontend / "package.json"
    vite_config_path = frontend / "vite.config.ts"

    if not package_path.exists():
        print("[yellow]frontend/package.json not found. Skipping frontend dependency audit.[/yellow]")
        return

    package_json = load_json(package_path)
    changed = False

    if vite_config_path.exists():
        vite_config = vite_config_path.read_text(encoding="utf-8")

        if "@vitejs/plugin-react-swc" in vite_config:
            if ensure_dev_dependency(package_json, "@vitejs/plugin-react-swc"):
                print("[green]Added missing devDependency:[/green] @vitejs/plugin-react-swc")
                changed = True

        if "@vitejs/plugin-react" in vite_config and "@vitejs/plugin-react-swc" not in vite_config:
            if ensure_dev_dependency(package_json, "@vitejs/plugin-react"):
                print("[green]Added missing devDependency:[/green] @vitejs/plugin-react")
                changed = True

    if changed:
        save_json(package_path, package_json)
        print(f"[bold green]Updated:[/bold green] {package_path}")
    else:
        print("[green]Frontend dependency audit passed.[/green]")


def main():
    spec = load_build_spec()
    project_root = Path("workspace") / spec["project_slug"]

    if not project_root.exists():
        raise FileNotFoundError(f"Project folder not found: {project_root}")

    audit_frontend_dependencies(project_root)


if __name__ == "__main__":
    main()