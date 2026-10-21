# Sviluppo

## Struttura

```
.claude-plugin/
  plugin.json        Manifest del plugin (nome, versione, userConfig)
  marketplace.json   Rende il repository installabile con /plugin install
hooks/
  hooks.json         Indica a Claude Code il modulo degli hook
  register.ts        Il mod
  sounds.ts          Riproduzione e impostazioni dei suoni
  register.test.ts   Test eseguiti da `claude plugin test`
sounds/
  complete.wav / question.wav    Suoni inclusi
scripts/
  install.ps1 / install.sh       Installer automatici
  uninstall.ps1 / uninstall.sh   Disinstallazione
docs/                Documentazione
```

## Aggiungere un'azione al menu

Le azioni del menu sono le voci restituite da `menuItems()` in `hooks/register.ts`:

```ts
{ key: 'my-action', label: '✱ My action', onPress: async () => { /* ... */ } }
```

Una voce senza `onPress` viene disegnata attenuata e non si può selezionare. Il menu si chiude prima che venga eseguito `onPress`.

## Eseguire da una copia di lavoro

```bash
claude --plugin-dir .
```

La cartella è monitorata: salvando `hooks/register.ts` il mod si ricarica nella sessione aperta.

## Validazione e test

```bash
claude plugin validate .
claude plugin test .
```

`validate` elenca gli eventi a cui il modulo si aggancia e le chiamate API che effettua:

```
hooks: session.start, session.measure, turn.step, classic.ConfigChange, session.end, ui.render{component=AbovePrompt}
calls: $.clock.every, $.clock.now, $.env.get, $.fs.exists, $.fs.read, $.fs.write, $.process.run, $.session.model, $.session.usage, $.settings.read, $.ui.invalidate, $.ui.resolve, $.ui.toast
```

## Controllo dei tipi

Dopo che il mod è stato caricato con `--plugin-dir`, Claude Code scrive le dichiarazioni dell'API in `.claude-plugin/types/` (ignorata da git) insieme a un `tsconfig.json`:

```bash
tsc -p .
```

## Provare gli installer su un clone locale

```bash
CSB_SOURCE="$PWD" ./scripts/install.sh --cache-ttl 1h
./scripts/uninstall.sh --restore-statusline
```

```powershell
$env:CSB_SOURCE = (Get-Location).Path; .\scripts\install.ps1 -CacheTtl 1h
.\scripts\uninstall.ps1 -RestoreStatusLine
```

## Rilascio

1. Aggiorna `version` in `.claude-plugin/plugin.json` e aggiungi una voce a `CHANGELOG.md`.
2. Fai commit, crea il tag (`git tag v1.1.0`) e fai push insieme ai tag.
3. Gli utenti la ottengono con l'installer o con `claude plugin update statusbar@claude-status-bar`.
