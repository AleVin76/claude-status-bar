# Claude Status Bar

Un [mod di Claude Code](https://code.claude.com/docs/it/plugins/mods/overview) che aggiunge, subito sopra il prompt, una barra di stato colorata con tutto quello che conviene tenere d'occhio durante una sessione:

```
⏳ ███████░░░ 3:41 | 🧠 █░░░░░░░░░   6.00% | 🕒 █░░░░░░░░░   5% (11:00) | 📅 ░░░░░░░░░░   1% (20/10 11:00) | 🤖 Opus 5.5 me | ⚡  75 tok/s | 💲 1.23        [≡] [-]
```

| Blocco | Significato |
|---|---|
| ⏳ | Tempo che manca alla scadenza della cache del prompt (`--:--` prima della prima richiesta, `scaduta` quando è scaduta) |
| 🧠 | Utilizzo della finestra di contesto |
| 🕒 | Limite del piano sulle 5 ore, con l'ora di rinnovo. A limite raggiunto: tempo che manca al rinnovo (`2:15:30`) |
| 📅 | Limite settimanale del piano, con data e ora di rinnovo. A limite raggiunto: tempo che manca al rinnovo (`2g 3:04:05`) |
| ⚡ | Velocità di generazione dell'ultima risposta, in token di output al secondo |
| 🤖 | Modello ed effort, indicato con le prime due lettere e colorato in base alla forza: `lo` grigio, `me` verde, `hi` giallo, `xh` arancione, `ma` rosso e grassetto |
| 💲 | Quanto sarebbe costata la sessione ai prezzi delle API, in dollari USA |
| [≡] | Menu, allineato a destra in fondo alla riga, nel colore `suggestion` del tema (parentesi e cornice del menu). Cliccalo (o Tab + Invio) per aprire sopra la barra un elenco di azioni, una per riga; si chiude con una scelta, con **Chiudi** o premendolo di nuovo |

Azioni del menu:

| Azione | Effetto |
|---|---|
| `⇄ Cache 1h → 5m` | Passa la durata della cache del prompt di Claude Code da `5m` a `1h` e viceversa. Compare come `🔒 Cache 5m (…)` quando la fissa una variabile d'ambiente |
| `⚙ Blocchi e righe…` | Apre l'editor dei blocchi: mostra, nascondi, ordina e sposta ogni blocco sulla riga 1 o 2, con la barra di avanzamento attivabile per blocco e un'anteprima |
| `🔔 Suono completamento: on` | Attiva o disattiva il suono di completamento |
| `🔔 Suono domanda: on` | Attiva o disattiva il suono di domanda |
| `▶ Prova suoni` | Riproduce i due suoni, per provarli |

Le barre sono **verdi** sotto il 50%, **gialle** dal 50% e **rosse** dall'80%, e il valore accanto a ogni barra prende lo stesso colore. Ogni barra si può nascondere singolarmente, lasciando il solo valore colorato. La barra ⏳ si svuota man mano che la cache invecchia e cambia colore in base al tempo trascorso. I colori seguono il tema di Claude Code (`success`, `warning`, `error`). Date e ore di rinnovo seguono le impostazioni internazionali del sistema operativo.

Quali blocchi compaiono, in che ordine e su quale delle due righe si decide con l'opzione `blocks` o con l'editor del menu: vedi [Configurazione → Blocchi](docs/configuration.md#blocchi).

## Suoni

| Suono | Quando suona | File predefinito |
|---|---|---|
| Completamento | Claude termina una risposta durata almeno 15 secondi (non per le risposte interrotte né per i subagent) | `sounds/complete.wav`, tre note ascendenti |
| Domanda | Claude ti chiede qualcosa: una domanda a scelta multipla, un permesso, un input richiesto da un server MCP. Un solo suono per gruppo di richieste | `sounds/question.wav`, due note ascendenti |

Ogni suono si attiva o disattiva singolarmente e può usare un tuo file WAV: vedi [Configurazione → Suoni](docs/configuration.md#suoni). I suoni escono dal computer su cui gira Claude Code (terminale o sessioni locali dell'app Desktop); le sessioni in cloud restano mute.

## Requisiti

- Claude Code **2.1.287** o successivo (`claude --version`)
- Terminale o scheda Code dell'app Claude Desktop (vedi [Dove funziona](docs/how-it-works.md#dove-funziona))

## Installazione

### Automatica

**Windows (PowerShell)**

```powershell
irm https://raw.githubusercontent.com/AleVin76/claude-status-bar/main/scripts/install.ps1 | iex
```

**macOS / Linux**

```bash
curl -fsSL https://raw.githubusercontent.com/AleVin76/claude-status-bar/main/scripts/install.sh | bash
```

L'installer:

1. controlla la versione di Claude Code;
2. registra questo repository come marketplace di plugin (o lo aggiorna);
3. installa il mod `statusbar` a livello utente (o lo aggiorna se è già installato);
4. lo attiva, anche se era stato disattivato (un semplice aggiornamento lascerebbe disattivato un plugin disattivato);
5. modifica `~/.claude/settings.json`, dopo averne salvato accanto una copia di backup con data e ora: rimuove la vecchia `statusLine`, imposta `promptCacheTtl` se passi `-CacheTtl`, assegna un valore a ogni opzione del mod non ancora impostata e rimuove l'opzione `cacheTtl` delle versioni precedenti alla 1.3.0;
6. verifica con `claude plugin list` che il mod sia installato **e attivo**, altrimenti si ferma con un errore. Avvisa anche se `disableAllHooks` vale `true`, perché quell'impostazione impedisce il caricamento di qualsiasi mod.

Poi riavvia Claude Code, oppure esegui `/reload-plugins` in una sessione aperta.

Opzioni dell'installer:

| PowerShell | Bash | Variabile d'ambiente (riga singola) | Effetto |
|---|---|---|---|
| `-CacheTtl 1h` | `--cache-ttl 1h` | `CSB_CACHE_TTL=1h` | Imposta la durata della cache del prompt di Claude Code (`promptCacheTtl`) a `5m` o `1h`. Se omessa, resta l'impostazione attuale |
| `-KeepStatusLine` | `--keep-statusline` | `CSB_KEEP_STATUSLINE=1` | Lascia invariata la `statusLine` in `settings.json` |
| — | — | `CSB_SOURCE=<owner/repo o percorso>` | Installa da un fork o da un clone locale |

Esempio con opzioni su una sola riga:

```powershell
$env:CSB_CACHE_TTL = '1h'; irm https://raw.githubusercontent.com/AleVin76/claude-status-bar/main/scripts/install.ps1 | iex
```

```bash
curl -fsSL https://raw.githubusercontent.com/AleVin76/claude-status-bar/main/scripts/install.sh | bash -s -- --cache-ttl 1h
```

### Da Claude Code

```
/plugin install statusbar --marketplace AleVin76/claude-status-bar
```

Rispondi `y` per aggiungere il marketplace, poi scegli l'ambito. Questa strada non tocca la `statusLine`: se vuoi una sola barra, rimuovila tu da `settings.json`.

### Manuale

Vedi [docs/installation.md](docs/installation.md).

## Aggiornamento

Esegui di nuovo l'installer: riconosce l'installazione esistente e la aggiorna. In alternativa:

```
claude plugin marketplace update claude-status-bar
claude plugin update statusbar@claude-status-bar
```

## Disinstallazione

**Windows**

```powershell
irm https://raw.githubusercontent.com/AleVin76/claude-status-bar/main/scripts/uninstall.ps1 -OutFile uninstall.ps1
.\uninstall.ps1 -RestoreStatusLine
```

**macOS / Linux**

```bash
curl -fsSL https://raw.githubusercontent.com/AleVin76/claude-status-bar/main/scripts/uninstall.sh | bash -s -- --restore-statusline
```

`-RestoreStatusLine` / `--restore-statusline` ripristina la `statusLine` salvata nel backup più recente.

## Documentazione

- [Installazione](docs/installation.md): installazione automatica, dal gestore dei plugin e manuale
- [Configurazione](docs/configuration.md): opzioni, blocchi, suoni e dove vengono salvati
- [Come funziona](docs/how-it-works.md): origine dei dati, conto alla rovescia della cache, limitazioni
- [Sviluppo](docs/development.md): struttura del progetto, validazione, test, rilascio

## Licenza

[MIT](LICENSE)
