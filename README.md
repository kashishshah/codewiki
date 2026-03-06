# Codewiki

Codewiki is a CLI tool that parses codebases, builds a graph of code entities (functions, structs, classes, modules, etc.), and serves an interactive web visualization. Click through the graph, view source code with syntax highlighting, and chat with your codebase.

## Features

- **Multi-language** — Rust, Python, and Elixir via tree-sitter
- **Code graph** — parses source files into a graph of functions, structs, classes, enums, traits, impls, modules, constants, and type aliases
- **Interactive visualization** — force-directed D3.js graph with zoom, pan, drag, and color-coded node types
- **File tree sidebar** — navigate the project structure, click to focus the graph
- **Source code panel** — syntax-highlighted code viewer with full-screen expand mode
- **Call graph edges** — visualize function-to-function call relationships
- **Chat with codebase** — select code nodes as context, ask questions via Claude/Codex CLI or OpenAI-compatible APIs
- **Search** — fuzzy search across all symbols in the codebase
- **Filters** — filter by node kind, language, min lines, and hide tests
- **Respects .gitignore** — only indexes files tracked by git
- **Extensible** — add new language support by implementing a single trait

## Supported languages

| Language   | Extensions    | Entities extracted                                                                         |
| ---------- | ------------- | ------------------------------------------------------------------------------------------ |
| **Rust**   | `.rs`         | functions, structs, enums, traits, impls, modules, constants, type aliases, calls, imports |
| **Python** | `.py`         | functions, classes, calls, imports                                                         |
| **Elixir** | `.ex`, `.exs` | modules, functions, protocols, impls, calls, imports                                       |

## Installation

```sh
curl -fsSL https://raw.githubusercontent.com/kashishshah/codewiki/master/scripts/install.sh | sh
```

This checks all prerequisites, builds the frontend, then installs codewiki via `cargo install`. Works on macOS and Linux.

Prerequisites checked by the script:

- [Rust](https://rustup.rs/) (nightly)
- [Bun](https://bun.sh/) (for building the frontend)
- `git`
- Chat backend (optional): `ANTHROPIC_API_KEY`, `OPENAI_API_BASE`, or [Claude CLI](https://docs.anthropic.com/en/docs/claude-code)

To uninstall:

```sh
cargo uninstall codewiki
```

## Quick start

```sh
# Visualize any project by just doing `cd` into it and run codewiki
cd /path/to/my-project
codewiki

# Or pass a path directly
codewiki /path/to/my-project
```

## Usage

```sh
codewiki                                    # Index and serve current directory
codewiki /path/to/project                   # Index and serve a specific project
codewiki -p 8080                            # Use a custom port
codewiki --backend claude-api               # Force Anthropic API for chat
codewiki --backend openai                   # Force OpenAI-compatible API
codewiki --backend claude-cli               # Force Claude CLI (with session reuse)

codewiki serve /path/to/project -p 8080     # Explicit serve subcommand
codewiki index /path/to/project             # Index only, save to .codewiki/graph.json
```

Running `codewiki` with no subcommand is equivalent to `codewiki serve .`.

Run `codewiki --help` for the full list of CLI flags and subcommands.

## Chat

Codewiki supports chatting with your codebase using any LLM. Select code nodes as context (double-click in the graph), then ask questions in the chat panel.

Use `--backend` to pick a specific backend, or leave it as `auto` (default) to auto-detect from environment:

| Backend           | Flag                   | Env vars                                                       | Notes                                                             |
| ----------------- | ---------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| OpenAI-compatible | `--backend openai`     | `OPENAI_API_BASE` (required), `OPENAI_API_KEY`, `OPENAI_MODEL` | Ollama, LM Studio, vLLM, etc.                                     |
| Anthropic API     | `--backend claude-api` | `ANTHROPIC_API_KEY` (required)                                 | Claude via HTTP API                                               |
| Claude CLI        | `--backend claude-cli` | —                                                              | Uses `claude` binary, supports session reuse across chat messages |
| Auto-detect       | `--backend auto`       | —                                                              | Tries: OPENAI_API_BASE → ANTHROPIC_API_KEY → claude CLI           |

The Claude CLI backend reuses sessions across chat messages — the first message creates a session, and subsequent messages resume it with `--resume`, preserving conversation context.

## Development

```sh
# Backend
cargo build
cargo clippy --all-targets -- -D warnings
cargo test

# Frontend
cd web
bun install
bun run build      # production build
bun run dev        # dev server with hot reload (proxies API to localhost:3000)
```

## License

MIT
