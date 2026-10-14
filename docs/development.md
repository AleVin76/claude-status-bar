# Development

## Layout

```
.claude-plugin/
  plugin.json        Plugin manifest (name, version, userConfig)
  marketplace.json   Makes the repository installable with /plugin install
hooks/
  hooks.json         Points Claude Code at the hooks module
  register.ts        The mod
  register.test.ts   Tests run by `claude plugin test`
scripts/
  install.ps1 / install.sh       Automatic installers
  uninstall.ps1 / uninstall.sh   Uninstallers
docs/                Documentation
```

## Run from a working copy

```bash
claude --plugin-dir .
```

The folder is watched: saving `hooks/register.ts` reloads the mod in the open session.

## Validate and test

```bash
claude plugin validate .
claude plugin test .
```

`validate` lists the events the module hooks and the API calls it makes:

```
hooks: session.start, session.measure, turn.step, session.end
calls: $.clock.every, $.clock.now, $.session.model, $.session.usage, $.ui.status
```

## Type checking

Once the mod has been loaded with `--plugin-dir`, Claude Code writes the API declarations to `.claude-plugin/types/` (ignored by git) together with a `tsconfig.json`:

```bash
tsc -p .
```

## Test the installers against a local clone

```bash
CSB_SOURCE="$PWD" ./scripts/install.sh --cache-ttl 1h
./scripts/uninstall.sh --restore-statusline
```

```powershell
$env:CSB_SOURCE = (Get-Location).Path; .\scripts\install.ps1 -CacheTtl 1h
.\scripts\uninstall.ps1 -RestoreStatusLine
```

## Release

1. Bump `version` in `.claude-plugin/plugin.json` and add an entry to `CHANGELOG.md`.
2. Commit, tag (`git tag v1.1.0`) and push with tags.
3. Users get it with the installer or `claude plugin update statusbar@claude-status-bar`.
