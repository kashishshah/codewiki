# Codewiki

Codewiki is a CLI tool that parses codebases, builds a graph of code entities (functions, structs, traits, etc.), and serves an interactive web visualization. Click through a force-directed graph, view source code with syntax highlighting, and chat with your codebase.

## Features

- **Code graph** — parses source files into a graph of functions, structs, enums, traits, impls, modules, constants, and type aliases
- **Interactive visualization** — force-directed D3.js graph with zoom, pan, drag, and color-coded node types
- **File tree sidebar** — navigate the project structure, click to focus the graph
- **Source code panel** — syntax-highlighted code viewer with metadata (file, line range, visibility)
- **Call graph edges** — visualize function-to-function call relationships
- **Chat with codebase** — select code nodes as context, ask Claude questions via API or CLI
- **Streaming responses** — chat responses stream in real-time via SSE
- **Search** — fuzzy search across all symbols in the codebase
- **Respects .gitignore** — only indexes files tracked by git
- **Extensible** — add new language support by implementing a single trait

## Supported languages

- **Rust** — full support via tree-sitter (functions, structs, enums, traits, impls, modules, constants, type aliases, calls, imports)

More languages can be added by implementing the `LanguageParser` trait and adding tree-sitter queries.

## Installation

Prerequisites:

- [Rust](https://rustup.rs/) (nightly)
- [Node.js](https://nodejs.org/) with [Bun](https://bun.sh/) (for building the frontend)

```sh
git clone https://github.com/kashishshah/codewiki.git
cd codewiki

# Build frontend
cd web && bun install && bun run build && cd ..

# Build and install
cargo install --path .
```

## Quick start

```sh
# Visualize any Rust project
codewiki serve /path/to/my-rust-project

# Just index without starting the server
codewiki index /path/to/my-rust-project
```

## Usage

```sh
codewiki serve                              # Index current directory and start visualization
codewiki serve /path/to/project             # Index a specific project
codewiki serve -p 8080                      # Use a custom port
codewiki serve --no-open                    # Don't auto-open browser
codewiki serve --backend claude-cli         # Force Claude CLI (with session reuse)
codewiki serve --backend claude-api         # Force Anthropic API
codewiki serve --backend openai             # Force OpenAI-compatible API

codewiki index                              # Index current directory, save to .codewiki/graph.json
codewiki index /path/to/project             # Index a specific project
```

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

## Adding a new language

1. Add the tree-sitter grammar crate to `Cargo.toml`
2. Create `src/parser/<lang>.rs` implementing the `LanguageParser` trait
3. Add tree-sitter queries in `src/parser/queries/<lang>.scm`
4. Register in `ParserRegistry::new()` in `src/parser/mod.rs`

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
