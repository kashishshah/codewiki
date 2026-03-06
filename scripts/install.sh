#!/usr/bin/env sh
# install.sh — check prerequisites and install codewiki

set -eu

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { printf "  ${GREEN}✓${NC}  %s\n" "$1"; }
warn() { printf "  ${YELLOW}!${NC}  %s\n" "$1"; }
fail() { printf "  ${RED}✗${NC}  %s\n" "$1"; }

MISSING=0

echo ""
echo "Checking prerequisites..."
echo ""

# --- Rust (required) ---
if command -v cargo >/dev/null 2>&1; then
    ok "cargo $(cargo --version 2>/dev/null | awk '{print $2}')"
else
    fail "cargo not found — install Rust: https://rustup.rs/"
    MISSING=$((MISSING + 1))
fi

# --- Bun (required for frontend build) ---
if command -v bun >/dev/null 2>&1; then
    ok "bun $(bun --version 2>/dev/null)"
else
    fail "bun not found — install Bun: https://bun.sh/"
    MISSING=$((MISSING + 1))
fi

# --- git (required) ---
if command -v git >/dev/null 2>&1; then
    ok "git $(git --version | awk '{print $3}')"
else
    fail "git not found — install git: https://git-scm.com/downloads"
    MISSING=$((MISSING + 1))
fi

# --- Chat backends (optional) ---
CHAT_OK=0

if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    ok "ANTHROPIC_API_KEY set"
    CHAT_OK=1
fi

if [ -n "${OPENAI_API_BASE:-}" ]; then
    ok "OPENAI_API_BASE set"
    CHAT_OK=1
fi

if command -v claude >/dev/null 2>&1; then
    ok "claude CLI found"
    CHAT_OK=1
fi

if command -v codex >/dev/null 2>&1; then
    ok "codex CLI found"
    CHAT_OK=1
fi

if [ $CHAT_OK -eq 0 ]; then
    warn "no chat backend detected — set ANTHROPIC_API_KEY, OPENAI_API_BASE, or install Claude/Codex CLI for chat support"
fi

echo ""

if [ $MISSING -ne 0 ]; then
    echo "$MISSING required dependency/dependencies missing. Install them and re-run this script."
    echo ""
    exit 1
fi

echo "Building frontend..."
echo ""

# Clone to temp dir, build frontend, then install
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

git clone --depth 1 https://github.com/kashishshah/codewiki.git "$TMPDIR/codewiki"
cd "$TMPDIR/codewiki/web"
bun install --frozen-lockfile 2>/dev/null || bun install
bun run build

echo ""
echo "Installing codewiki..."
echo ""

cd "$TMPDIR/codewiki"
cargo install --path .

echo ""
echo "Done. Run 'codewiki' in any project directory to get started."
echo ""
