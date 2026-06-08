#!/usr/bin/env bash
# SessionStart hook: prepare the environment for Claude Code on the web so tests,
# linters, and the dev servers are runnable immediately.
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "[session-setup] installing pipeline deps (uv)…"
( cd pipelines && uv sync --extra dev >/dev/null 2>&1 ) && echo "[session-setup]   pipelines ✓" || echo "[session-setup]   pipelines ✗ (run: cd pipelines && uv sync --extra dev)"

echo "[session-setup] installing web deps (npm)…"
( cd web && npm install --no-audit --no-fund >/dev/null 2>&1 ) && echo "[session-setup]   web ✓" || echo "[session-setup]   web ✗ (run: cd web && npm install)"
