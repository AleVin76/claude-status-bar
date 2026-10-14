#!/usr/bin/env bash
# Installs (or updates) the Claude Status Bar mod for Claude Code on macOS/Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/AleVin76/claude-status-bar/main/scripts/install.sh | bash
#   curl -fsSL .../install.sh | bash -s -- --cache-ttl 1h --keep-statusline
#
#   --cache-ttl 5m|1h   sets Claude Code's prompt cache TTL (promptCacheTtl); left out, the setting is kept
set -euo pipefail

REPO="${CSB_SOURCE:-AleVin76/claude-status-bar}"
MARKETPLACE="claude-status-bar"
PLUGIN_ID="statusbar@${MARKETPLACE}"
MIN_VERSION="2.1.287"
CACHE_TTL="${CSB_CACHE_TTL:-}"
KEEP_STATUSLINE="${CSB_KEEP_STATUSLINE:-0}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cache-ttl) CACHE_TTL="$2"; shift 2 ;;
    --keep-statusline) KEEP_STATUSLINE=1; shift ;;
    -h|--help) sed -n '2,6p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

[[ -z "$CACHE_TTL" || "$CACHE_TTL" == "5m" || "$CACHE_TTL" == "1h" ]] || { echo "--cache-ttl must be 5m or 1h" >&2; exit 1; }

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
  step "Installing ${PLUGIN_ID}"
  claude plugin install "$PLUGIN_ID"
fi

settings="${HOME}/.claude/settings.json"
# Python is used for JSON editing because it ships with macOS and most Linux distributions
if command -v python3 >/dev/null; then
  backup="${settings}.$(date +%Y%m%d-%H%M%S).bak"
  summary="$(python3 - "$settings" "$backup" "$KEEP_STATUSLINE" "$CACHE_TTL" "$PLUGIN_ID" <<'PY'
import json, os, shutil, sys
path, backup, keep_statusline, cache_ttl, plugin_id = sys.argv[1:6]
data = {}
if os.path.exists(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
changes = []
if keep_statusline != "1" and "statusLine" in data:
    del data["statusLine"]
    changes.append("removed 'statusLine'")
if cache_ttl:
    data["promptCacheTtl"] = cache_ttl
    changes.append(f"promptCacheTtl = {cache_ttl}")
options = data.get("pluginConfigs", {}).get(plugin_id, {}).get("options", {})
if "cacheTtl" in options:
    del options["cacheTtl"]
    changes.append("removed obsolete statusbar option 'cacheTtl'")
if changes:
    if os.path.exists(path):
        shutil.copy2(path, backup)
        changes.append(f"backup: {backup}")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
print(", ".join(changes))
PY
)"
  [[ -n "$summary" ]] && step "settings.json: ${summary}"
else
  echo "python3 not found: edit ${settings} by hand (remove \"statusLine\", set \"promptCacheTtl\")." >&2
fi

printf '\n\033[32mClaude Status Bar installed. Restart Claude Code (or run /reload-plugins).\033[0m\n'
