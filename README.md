# GENESIS - AI-Powered Project Builder

GENESIS is an AI-driven system that automates project scaffolding, development, and testing using LLM-based agents. It helps you build full-stack applications with automatic code generation, auditing, and specification management.

## Quick Start

### Prerequisites
- Python 3.8+
- Git
- Node.js 16+ (for frontend projects)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Itzshrvsh/GENESIS.git
   cd GENESIS
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv venv
   ```

3. **Activate the virtual environment**
   
   **Windows:**
   ```bash
   venv\Scripts\activate
   ```
   
   **macOS/Linux:**
   ```bash
   source venv/bin/activate
   ```

4. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

### Running GENESIS

**Option 1: Using the batch file (Windows)**
```bash
run.bat
```

**Option 2: Using Python directly**
```bash
python main.py
```

**Option 3: Using the terminal command**
```bash
python run_commands.py
```

## Project Structure

```
genesis/
├── agents/              # LLM-based agent modules
│   ├── architect.py    # System architecture design
│   ├── planner.py      # Project planning
│   ├── specifier.py    # Specification generation
│   ├── synthesizer.py  # Code synthesis
│   ├── file_writer.py  # File generation
│   ├── tester.py       # Testing agent
│   ├── fixer.py        # Bug fixing
│   └── critic.py       # Code review
├── builder/            # Build utilities
├── workspace/          # Generated project workspaces
├── memory/             # Build specifications and logs
├── utils/              # Utility functions
│   ├── llm.py         # LLM integration
│   └── spec_loader.py # Specification loading
├── main.py            # Entry point
└── genesis.py         # Core orchestration
```

## Commands

### Main Commands

- **`python main.py`** - Start the Genesis system
- **`python run_commands.py`** - Execute specific commands
- **`python builder.py`** - Build projects from specifications
- **`python dependency_auditor.py`** - Audit project dependencies
- **`python audit_spec.py`** - Audit build specifications

## Environment Variables

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=your_api_key_here
LLM_MODEL=gpt-4
```

## Dependencies

Core dependencies are listed in `requirements.txt`. Key packages:
- Python LLM integration libraries
- File generation and templating
- JSON specification handling
- Project building and scaffolding

## Features

- 🤖 AI-powered code generation using multiple specialized agents
- 📋 Automatic specification generation and auditing
- 🏗️ Full-stack project scaffolding (Frontend + Backend)
- 🧪 Automated testing and validation
- 🔧 Dependency management and auditing
- 📝 Comprehensive build logs and memory management

## Generated Projects

The workspace directory contains example projects:
- `realtime_collaborative_whiteboard/` - Real-time collaborative app
- `ai_fullstack/` - Full-stack AI application
- `simulation_platform/` - AI simulation platform
- `spa_scaffold/` - Single Page Application template

## Troubleshooting

**Virtual environment not activating:**
- Ensure Python 3.8+ is installed
- Try: `python -m venv venv --upgrade-deps`

**Missing dependencies:**
- Reinstall packages: `pip install --upgrade -r requirements.txt`

**LLM API errors:**
- Check `.env` file configuration
- Verify API key is correct
- Ensure you have API credits

## Development

To modify agents or add new functionality:
1. Edit files in the `agents/` directory
2. Update specifications in `memory/` directory
3. Test changes using `python main.py`

## License

See LICENSE file for details.

## Support

For issues or questions, please open an issue on GitHub:
https://github.com/Itzshrvsh/GENESIS/issues
