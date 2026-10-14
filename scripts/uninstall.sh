#!/usr/bin/env bash
# Removes the Claude Status Bar mod.
#   uninstall.sh [--restore-statusline] [--keep-marketplace]
set -euo pipefail

MARKETPLACE="claude-status-bar"
PLUGIN_ID="statusbar@${MARKETPLACE}"
RESTORE=0
KEEP_MARKETPLACE=0

for arg in "$@"; do
  case "$arg" in
    --restore-statusline) RESTORE=1 ;;
    --keep-marketplace) KEEP_MARKETPLACE=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

claude plugin uninstall "$PLUGIN_ID"
[[ "$KEEP_MARKETPLACE" == "1" ]] || claude plugin marketplace remove "$MARKETPLACE"

if [[ "$RESTORE" == "1" ]]; then
  settings="${HOME}/.claude/settings.json"
  backup="$(ls -t "${settings}".*.bak 2>/dev/null | head -1 || true)"
  if [[ -z "$backup" ]]; then
    echo "No settings.json backup found: statusLine not restored." >&2
  else
    python3 - "$settings" "$backup" <<'PY'
import json, sys
path, backup = sys.argv[1], sys.argv[2]
with open(backup, encoding="utf-8") as f:
    old = json.load(f)
with open(path, encoding="utf-8") as f:
    data = json.load(f)
if "statusLine" in old:
    data["statusLine"] = old["statusLine"]
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
PY
    echo "statusLine restored from ${backup}"
  fi
fi

echo "Claude Status Bar removed. Restart Claude Code."
