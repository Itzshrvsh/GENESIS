import sys
import json
import os
import subprocess
from pathlib import Path

# Add root directory to sys.path so we can import utils
ROOT = Path(__file__).parent.parent.resolve()
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.spec_loader import load_build_spec
from utils.llm import ask_llm
from rich import print


def get_all_file_contents(project_root):
    contents = {}
    for root, dirs, files in os.walk(project_root):
        if 'node_modules' in dirs: dirs.remove('node_modules')
        if '.git' in dirs: dirs.remove('.git')
        if 'venv' in dirs: dirs.remove('venv')
        if '__pycache__' in dirs: dirs.remove('__pycache__')
        
        for file in files:
            if file.endswith('.bak') or file.endswith('.png') or file.endswith('.jpg') or file.endswith('.ico'): 
                continue
            path = Path(root) / file
            try:
                contents[str(path.relative_to(project_root))] = path.read_text(encoding='utf-8')
            except:
                pass
    return contents


def apply_fixes(project_root, response_text):
    try:
        response_text = response_text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
            
        data = json.loads(response_text.strip())
        explanation = data.get("explanation", "")
        print(f"\n[green]Tester Fix Explanation:[/green] {explanation}\n")
        
        for file_mod in data.get("files", []):
            path = file_mod["path"]
            content = file_mod["content"]
            if ".." in path: continue
            
            full_path = project_root / path
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content, encoding='utf-8')
            print(f"[bold blue]Tester Updated file:[/bold blue] {path}")
            
    except Exception as e:
        print(f"[red]Tester failed to parse or apply fixes:[/red] {e}")


def run_command_with_auto_fix(command, cwd, project_root, max_retries=3):
    for attempt in range(1, max_retries + 1):
        print(f"\n[bold cyan]Running (Attempt {attempt}/{max_retries}):[/bold cyan] {command}")
        
        result = subprocess.run(
            command,
            cwd=str(cwd),
            shell=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace"
        )
        
        if result.returncode == 0:
            print(f"[bold green]Success:[/bold green] {command}")
            return True
            
        print(f"[bold yellow]Command failed with exit code {result.returncode}. Attempting auto-fix...[/bold yellow]")
        if result.stdout.strip():
            print(f"[dim]STDOUT:[/dim]\n{result.stdout.strip()}")
        if result.stderr.strip():
            print(f"[dim]STDERR:[/dim]\n{result.stderr.strip()}")
        
        error_context = f"Command: {command}\nExit Code: {result.returncode}\n\nSTDOUT:\n{result.stdout.strip()}\n\nSTDERR:\n{result.stderr.strip()}"
        
        files = get_all_file_contents(project_root)
        file_context = "Project Files:\n"
        for path, content in files.items():
            file_context += f"--- {path} ---\n{content}\n\n"
            
        system_prompt = """You are an autonomous testing and debugging agent.
The user ran a command that failed. You are provided with the error output and the current codebase.
You must fix the code to make the command succeed.

Output ONLY a JSON object exactly like this:
{
  "files": [
    {
      "path": "relative/path/to/file.ext",
      "content": "full updated content of the file"
    }
  ],
  "explanation": "What you fixed"
}

Rules:
1. ONLY output valid JSON. No markdown fences outside the JSON.
2. Provide the FULL content of any file you modify. Do not output partial files.
3. Ensure syntax is 100% valid.
"""
        user_prompt = f"Failed Command Output:\n{error_context}\n\n{file_context}"
        
        print("[dim]Analyzing failure and generating fixes using LLM...[/dim]")
        response = ask_llm(system_prompt, user_prompt)
        apply_fixes(project_root, response)

    print(f"[bold red]Failed to fix after {max_retries} attempts:[/bold red] {command}")
    return False


def run_tester():
    try:
        spec = load_build_spec()
    except Exception as e:
        print(f"[red]Could not load build spec:[/red] {e}")
        return

    project_slug = spec.get("project_slug")
    project_root = ROOT / "workspace" / project_slug
    
    if not project_root.exists():
        print(f"[red]Project root {project_root} not found.[/red]")
        return
    
    commands = spec.get("commands", {})
    setup_commands = commands.get("setup", [])
    test_commands = commands.get("test", [])
    
    all_commands = setup_commands + test_commands
    
    if not all_commands:
        print("[yellow]No setup or test commands found in spec to run.[/yellow]")
        return

    print("\n[bold magenta]=== AUTONOMOUS TESTER STARTED ===[/bold magenta]")
    
    for cmd in all_commands:
        success = run_command_with_auto_fix(cmd, project_root, project_root)
        if not success:
            print("[bold red]Tester aborted due to unfixable error in command:[/bold red] " + cmd)
            return
            
    print("\n[bold green]=== ALL COMMANDS PASSED SUCCESSFULLY ===[/bold green]")


if __name__ == "__main__":
    run_tester()
