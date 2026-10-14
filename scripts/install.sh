#!/usr/bin/env bash
# Installs (or updates) the Claude Status Bar mod for Claude Code on macOS/Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/AleVin76/claude-status-bar/main/scripts/install.sh | bash
#   curl -fsSL .../install.sh | bash -s -- --cache-ttl 1h --keep-statusline
set -euo pipefail

REPO="${CSB_SOURCE:-AleVin76/claude-status-bar}"
MARKETPLACE="claude-status-bar"
PLUGIN_ID="statusbar@${MARKETPLACE}"
MIN_VERSION="2.1.287"
CACHE_TTL="${CSB_CACHE_TTL:-5m}"
KEEP_STATUSLINE="${CSB_KEEP_STATUSLINE:-0}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cache-ttl) CACHE_TTL="$2"; shift 2 ;;
    --keep-statusline) KEEP_STATUSLINE=1; shift ;;
    -h|--help) sed -n '2,6p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

[[ "$CACHE_TTL" == "5m" || "$CACHE_TTL" == "1h" ]] || { echo "--cache-ttl must be 5m or 1h" >&2; exit 1; }

step() { printf '\033[36m==> %s\033[0m\n' "$1"; }

command -v claude >/dev/null || { echo "Claude Code ('claude') not found in PATH." >&2; exit 1; }

version="$(claude --version | grep -oE '^[0-9]+(\.[0-9]+)+')"
if [[ "$(printf '%s\n%s\n' "$MIN_VERSION" "$version" | sort -V | head -1)" != "$MIN_VERSION" ]]; then
  echo "Claude Code $version is too old: mods need $MIN_VERSION or later. Run 'claude update'." >&2
  exit 1
fi
step "Claude Code $version"

if claude plugin marketplace list --json | grep -q "\"name\": *\"${MARKETPLACE}\""; then
  step "Updating marketplace ${MARKETPLACE}"
  claude plugin marketplace update "$MARKETPLACE"
else
  step "Adding marketplace ${REPO}"
  claude plugin marketplace add "$REPO"
fi

if claude plugin list --json | grep -q "\"id\": *\"${PLUGIN_ID}\""; then
  step "Updating ${PLUGIN_ID}"
  claude plugin update "$PLUGIN_ID"
else
  step "Installing ${PLUGIN_ID} (cacheTtl=${CACHE_TTL})"
  claude plugin install "$PLUGIN_ID" --config "cacheTtl=${CACHE_TTL}"
fi

settings="${HOME}/.claude/settings.json"
if [[ "$KEEP_STATUSLINE" != "1" && -f "$settings" ]]; then
  # Python is used for JSON editing because it ships with macOS and most Linux distributions
  if command -v python3 >/dev/null; then
    backup="${settings}.$(date +%Y%m%d-%H%M%S).bak"
    removed="$(python3 - "$settings" "$backup" <<'PY'
import json, shutil, sys
path, backup = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
if "statusLine" in data:
    shutil.copy2(path, backup)
    del data["statusLine"]
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("yes")
PY
)"
    [[ "$removed" == "yes" ]] && step "Removed 'statusLine' from settings.json (backup: ${backup})"
  else
    echo "python3 not found: remove \"statusLine\" from ${settings} manually." >&2
  fi
fi

printf '\n\033[32mClaude Status Bar installed. Restart Claude Code (or run /reload-plugins).\033[0m\n'
