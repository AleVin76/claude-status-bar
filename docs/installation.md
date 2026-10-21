# Installazione

## Automatica (consigliata)

Vedi il [README](../README.md#automatica). Gli script sono idempotenti: eseguirli di nuovo aggiorna il mod invece di installarla due volte.

Cosa modificano:

| File / comando | Modifica |
|---|---|
| `claude plugin marketplace add AleVin76/claude-status-bar` | Aggiunge `claude-status-bar` sotto `extraKnownMarketplaces` in `~/.claude/settings.json` |
| `claude plugin install statusbar@claude-status-bar --scope user --config locale=system` | Installa il plugin per tutti i progetti e ne salva l'opzione (`pluginConfigs`) |
| `claude plugin enable statusbar@claude-status-bar --scope user` | Imposta `enabledPlugins."statusbar@claude-status-bar": true`, anche dopo l'aggiornamento di un plugin disattivato |
| `~/.claude/settings.json` | Rimuove `statusLine` (salvo `-KeepStatusLine` / `--keep-statusline`); imposta `promptCacheTtl` con `-CacheTtl` / `--cache-ttl`; elimina l'opzione `cacheTtl` precedente alla 1.3.0 |
| `~/.claude/settings.json.<yyyyMMdd-HHmmss>.bak` | Backup scritto prima di qualsiasi modifica elencata sopra |

Su Windows `~` corrisponde a `%USERPROFILE%`.

### Criteri di esecuzione (Windows)

`irm … | iex` esegue lo script in memoria e non è soggetto ai criteri di esecuzione. Per eseguire invece una copia scaricata:

```powershell
irm https://raw.githubusercontent.com/AleVin76/claude-status-bar/main/scripts/install.ps1 -OutFile install.ps1
powershell -ExecutionPolicy Bypass -File .\install.ps1 -CacheTtl 1h
```

## Gestore dei plugin

Dal prompt di Claude Code:

```
/plugin install statusbar --marketplace AleVin76/claude-status-bar
```

Oppure dalla shell:

```bash
claude plugin marketplace add AleVin76/claude-status-bar
claude plugin install statusbar@claude-status-bar
```

## Manuale (da una cartella locale)

1. Clona il repository o scarica lo ZIP:

   ```bash
   git clone https://github.com/AleVin76/claude-status-bar.git
   ```

2. Carica la cartella in ogni sessione aggiungendola a `~/.claude/settings.json`:

   ```json
   {
     "env": {
       "CLAUDE_CODE_PLUGIN_DIRS": "C:\\path\\to\\claude-status-bar"
     }
   }
   ```

   Più cartelle si separano con `;` su Windows e con `:` su macOS/Linux. Per una singola sessione usa invece `claude --plugin-dir <folder>`.

3. Rimuovi il blocco `statusLine` dallo stesso file se vuoi solo questa barra.

Una cartella caricata in questo modo viene letta come `statusbar@inline`; vedi [configurazione](configuration.md) per come vengono salvate le sue opzioni.

## Verifica

L'installer termina con `statusbar@claude-status-bar <version> installed and enabled`. Per controllare a mano:

```bash
claude plugin list
```

La voce `statusbar@claude-status-bar` deve risultare attivata. In caso contrario, esegui `claude plugin enable statusbar@claude-status-bar`.

Cosa impedisce il caricamento di un plugin attivato:

| Causa | Soluzione |
|---|---|
| `"disableAllHooks": true` in `settings.json` (l'installer lo segnala) | Impostalo a `false`; riattiva anche gli altri tuoi hook |
| `"enabledPlugins": { "statusbar@claude-status-bar": false }` nel file `.claude/settings.json` di un progetto | Rimuovi quella voce dal progetto |
| Criteri dell'organizzazione (`allowManagedModsOnly`, `allowManagedHooksOnly`) | Chiedi al tuo amministratore |
| Sessione avviata con `--safe-mode` o `--bare` | Avviala senza il flag |

In Claude Code esegui `/plugin`: la riga sotto le schede mostra `1 mod active · statusbar` (o l'elenco dei mod attivi). Se la barra non compare, vedi [Come funziona → Risoluzione dei problemi](how-it-works.md#risoluzione-dei-problemi).
