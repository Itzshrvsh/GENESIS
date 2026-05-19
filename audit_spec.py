from pathlib import Path
from rich import print
from agents.spec_auditor import run as auditor_run
import json


def clean_json_output(text: str):
    text = text.strip()

    if text.startswith("```"):
        lines = text.splitlines()

        if lines and lines[0].startswith("```"):
            lines = lines[1:]

        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]

        text = "\n".join(lines).strip()

    return text


def audit_spec():
    spec_path = Path("memory/BUILD_SPEC.json")

    if not spec_path.exists():
        raise FileNotFoundError("memory/BUILD_SPEC.json not found.")

    raw_spec = spec_path.read_text(encoding="utf-8")

    print("[bold cyan]Running Spec Auditor Agent...[/bold cyan]")

    audited = auditor_run(raw_spec)
    audited = clean_json_output(audited)

    # Validate JSON before writing
    try:
        parsed = json.loads(audited)
    except json.JSONDecodeError as e:
        print("[bold red]Auditor returned invalid JSON.[/bold red]")
        print(str(e))
        print(audited)
        return

    output_path = Path("memory/BUILD_SPEC_AUDITED.json")
    output_path.write_text(
        json.dumps(parsed, indent=2),
        encoding="utf-8"
    )

    print("[bold green]Audited spec written to memory/BUILD_SPEC_AUDITED.json[/bold green]")


if __name__ == "__main__":
    audit_spec()