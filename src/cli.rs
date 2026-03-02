use clap::{Parser, Subcommand, ValueEnum};
use std::path::PathBuf;

#[derive(Parser)]
#[command(
    name = "codewiki",
    about = "Interactive codebase visualization and chat"
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Subcommand)]
pub enum Command {
    /// Parse a codebase and build the code graph index
    Index {
        /// Path to the project root (defaults to current directory)
        #[arg(default_value = ".")]
        path: PathBuf,
    },
    /// Index the codebase and start the web visualization server
    Serve {
        /// Path to the project root (defaults to current directory)
        #[arg(default_value = ".")]
        path: PathBuf,

        /// Port to serve on
        #[arg(short, long, default_value = "3000")]
        port: u16,

        /// Don't open browser automatically
        #[arg(long)]
        no_open: bool,

        /// Chat backend to use [default: auto-detect]
        #[arg(long, value_enum, default_value = "auto")]
        backend: Backend,

        /// Model to use for chat (overrides backend default)
        #[arg(long)]
        model: Option<String>,
    },
}

#[derive(Clone, ValueEnum)]
pub enum Backend {
    /// Auto-detect: OPENAI_API_BASE → ANTHROPIC_API_KEY → claude CLI
    Auto,
    /// Anthropic Messages API (requires ANTHROPIC_API_KEY)
    ClaudeApi,
    /// Claude CLI binary (supports session reuse)
    ClaudeCli,
    /// OpenAI-compatible API (requires OPENAI_API_BASE)
    Openai,
}
