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
  # Every plugin option gets a stored value: an unset one makes Claude Code ask to configure the plugin
  claude plugin install "$PLUGIN_ID" --scope user \
    --config "locale=system" --config "soundOnComplete=true" --config "soundOnQuestion=true" \
    --config "completeSound=default" --config "questionSound=default" --config "completeMinSeconds=15"
fi

# An update keeps a plugin that was disabled disabled: enable it explicitly
enable_out="$(claude plugin enable "$PLUGIN_ID" --scope user --json 2>&1)" || {
  grep -q '"alreadyInGoalState":true' <<<"$enable_out" || { echo "Enable step failed:" >&2; echo "$enable_out" >&2; exit 1; }
}
grep -q '"alreadyInGoalState":true' <<<"$enable_out" || step "Enabled ${PLUGIN_ID}"

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
# Before 1.3.2 an empty locale meant "system"; an unset option makes Claude Code ask to configure the plugin
plugin_options = data.setdefault("pluginConfigs", {}).setdefault(plugin_id, {}).setdefault("options", {})
# Options added by later versions, and an empty locale (before 1.3.2 it meant "system"), get their default
defaults = {"locale": "system", "soundOnComplete": True, "soundOnQuestion": True,
            "completeSound": "default", "questionSound": "default", "completeMinSeconds": 15}
for name, value in defaults.items():
    current = plugin_options.get(name)
    if current is None or (isinstance(current, str) and not current.strip()):
        plugin_options[name] = value
        changes.append(f"statusbar option '{name}' = {json.dumps(value)}")
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

# Verify: installed, enabled, and not switched off by disableAllHooks
entry="$(claude plugin list --json | python3 -c '
import json, sys
for p in json.load(sys.stdin):
    if p["id"] == sys.argv[1]:
        print(p["version"], "enabled" if p.get("enabled") else "disabled")
' "$PLUGIN_ID")"
[[ -n "$entry" ]] || { echo "${PLUGIN_ID} is not listed by 'claude plugin list' after installation." >&2; exit 1; }
[[ "$entry" == *" enabled" ]] || { echo "${PLUGIN_ID} is installed but still disabled. Run: claude plugin enable ${PLUGIN_ID}" >&2; exit 1; }
step "${PLUGIN_ID} ${entry% enabled} installed and enabled"

if [[ -f "$settings" ]] && python3 -c 'import json,sys; sys.exit(0 if json.load(open(sys.argv[1])).get("disableAllHooks") is True else 1)' "$settings" 2>/dev/null; then
  printf '\033[33mWarning: "disableAllHooks" is true in %s: Claude Code loads no mod, so the status bar stays hidden.\nSet it to false (it also re-enables your other hooks) to see the bar.\033[0m\n' "$settings" >&2
fi

printf '\n\033[32mClaude Status Bar installed. Restart Claude Code (or run /reload-plugins).\033[0m\n'
