import sys
import json
import os
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


def run_fixer(feedback):
    try:
        spec = load_build_spec()
    except Exception as e:
        print(f"[red]Could not load build spec:[/red] {e}")
        return

    project_slug = spec.get("project_slug")
    if not project_slug:
        print("[red]No project slug found.[/red]")
        return
        
    project_root = ROOT / "workspace" / project_slug
    if not project_root.exists():
        print(f"[red]Project root {project_root} not found.[/red]")
        return
        
    files = get_all_file_contents(project_root)
    
    context = "Here are the current files in the project:\n\n"
    for path, content in files.items():
        context += f"--- {path} ---\n{content}\n\n"
        
    system_prompt = """You are an expert debugging and coding agent.
The user has an error or feedback regarding their codebase.
You are provided with the current file contents.
You must output a JSON object containing the files to create or modify.

The JSON should have this EXACT structure and no markdown formatting outside of it:
{
  "files": [
    {
      "path": "relative/path/to/file.ext",
      "content": "new full file content here"
    }
  ],
  "explanation": "A short explanation of what you fixed."
}

Rules:
1. ONLY output valid JSON. No markdown fences, no extra text outside the JSON.
2. Provide the FULL content of any file you are modifying. Do not output partial files or diffs.
3. Use exact relative paths as provided in the context (e.g. backend/server.js).
"""
    
    user_prompt = f"Feedback/Error:\n{feedback}\n\nProject Files:\n{context}"
    
    print("[dim]Analyzing codebase and generating fixes...[/dim]")
    response = ask_llm(system_prompt, user_prompt)
    
    try:
        response = response.strip()
        if response.startswith("```json"):
            response = response[7:]
        if response.startswith("```"):
            response = response[3:]
        if response.endswith("```"):
            response = response[:-3]
            
        data = json.loads(response.strip())
        
        explanation = data.get("explanation", "")
        print(f"\n[green]Explanation:[/green] {explanation}\n")
        
        for file_mod in data.get("files", []):
            path = file_mod["path"]
            content = file_mod["content"]
            
            # security: prevent directory traversal
            if ".." in path:
                print(f"[red]Skipping unsafe path:[/red] {path}")
                continue
                
            full_path = project_root / path
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content, encoding='utf-8')
            print(f"[bold blue]Updated file:[/bold blue] {path}")
            
    except Exception as e:
        print(f"[red]Failed to parse or apply fixes.[/red]")
        print(f"[red]Error:[/red] {e}")
        print("[dim]Raw response:[/dim]")
        print(response)


if __name__ == "__main__":
    feedback = sys.stdin.read().strip()
    if feedback:
        run_fixer(feedback)
    else:
        print("[red]No feedback provided.[/red]")
