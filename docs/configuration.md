# Configurazione

## Opzioni

| Opzione | Valori | Predefinito | Descrizione |
|---|---|---|---|
| `blocks` | `default` oppure id dei blocchi separati da virgole, `/` tra le righe | `default` | Blocchi mostrati, con ordine e riga, vedi [Blocchi](#blocchi) |
| `locale` | `system` oppure un tag BCP 47 (`it-IT`, `en-GB`, …) | `system` | Impostazioni locali per date e orari di reset. `system` (o vuoto) usa le impostazioni internazionali del sistema operativo (vedi [Come funziona → Formato di data e ora](how-it-works.md#formato-di-data-e-ora)). |
| `soundOnComplete` | `true`, `false` | `true` | Suono di completamento |
| `soundOnQuestion` | `true`, `false` | `true` | Suono di domanda |
| `completeSound` | `default` oppure il percorso di un file WAV | `default` | File per il suono di completamento |
| `questionSound` | `default` oppure il percorso di un file WAV | `default` | File per il suono di domanda |
| `completeMinSeconds` | numero ≥ 0 | `15` | Le risposte più brevi di questo valore non riproducono il suono di completamento |

## Modificare un'opzione

**Da Claude Code**: apri `/config` e modifica la riga **Formato di data e ora**. Il mod si ricarica con il nuovo valore.

**In fase di installazione**:

```bash
claude plugin install statusbar@claude-status-bar --config locale=it-IT
```

**In `settings.json`**: le opzioni stanno sotto `pluginConfigs`, con l'id del plugin come chiave:

```json
{
  "pluginConfigs": {
    "statusbar@claude-status-bar": {
      "options": {
        "blocks": "default",
        "locale": "system",
        "soundOnComplete": true,
        "soundOnQuestion": true,
        "completeSound": "C:\\Suoni\\fatto.wav",
        "questionSound": "default",
        "completeMinSeconds": 15
      }
    }
  }
}
```

Per una cartella caricata con `--plugin-dir` o `CLAUDE_CODE_PLUGIN_DIRS`, la chiave è `statusbar@inline`.

## Blocchi

L'opzione `blocks` elenca i blocchi da mostrare, nell'ordine in cui compaiono. Ometti un blocco per nasconderlo; `default` (o vuoto) mostra tutti i blocchi nell'ordine predefinito su una sola riga. Una `/` inizia una nuova riga, così la barra può occupare due righe.

| Id | Blocco |
|---|---|
| `cache` | ⏳ Countdown della cache del prompt |
| `context` | 🧠 Uso della finestra di contesto |
| `5h` | 🕒 Limite del piano a 5 ore |
| `7d` | 📅 Limite settimanale del piano |
| `model` | 🤖 Modello e livello di effort |
| `speed` | ⚡ Token di output al secondo dell'ultima risposta |
| `cost` | 💲 Costo equivalente API |

Esempi:

| `blocks` | Riga |
|---|---|
| `default` | `⏳ … \| 🧠 … \| 🕒 … \| 📅 … \| 🤖 … \| ⚡ … \| 💲 …` |
| `model, speed, context` | `🤖 … \| ⚡ … \| 🧠 …` |
| `5h, 7d, cache` | `🕒 … \| 📅 … \| ⏳ …` |
| `cache, context, 5h, 7d / model, speed, cost` | due righe: `⏳ … \| 🧠 … \| 🕒 … \| 📅 …` sopra `🤖 … \| ⚡ … \| 💲 …` |

Il modo più semplice è l'editor: **[≡] → ⚙ Blocchi e righe…** apre un pannello che elenca tutti i blocchi sotto *Riga 1*, *Riga 2* e *Nascosti*:

| Pulsante | Effetto |
|---|---|
| `↑` `↓` | Sposta il blocco all'interno della sua riga |
| `→ Riga 2` / `→ Riga 1` | Sposta il blocco in fondo all'altra riga |
| `Nascondi` / `Mostra` | Nasconde il blocco, o lo mostra di nuovo in fondo alla riga 1 |
| `Barra: sì` / `Barra: no` | Mostra o nasconde la barra di avanzamento di ⏳ 🧠 🕒 📅; il valore mantiene il suo colore |
| `Salva` | Applica e memorizza il layout (come opzione `blocks`) |
| `Predefiniti` | Tutti i blocchi su una riga, in ordine predefinito |
| `Annulla` (o Esc) | Chiude senza modifiche |

Spostati tra i pulsanti con Tab e premili con Invio, oppure cliccali. Una riga di anteprima mostra il risultato prima del salvataggio.

Lo stesso layout si può scrivere in `/config` (**Blocchi e righe**) o in `settings.json`:

```json
"pluginConfigs": {
  "statusbar@claude-status-bar": { "options": { "blocks": "model, speed, context, 5h, 7d" } }
}
```

Aggiungi `:nobar` a un blocco con barra (`cache`, `context`, `5h`, `7d`) per mostrarne solo il valore, sempre colorato in base al livello: `cache, context:nobar, 5h:nobar, 7d / model, speed, cost`.

Gli id sconosciuti vengono ignorati e segnalati in un avviso all'avvio della sessione. Un blocco elencato due volte viene mostrato nella prima posizione in cui compare. Il menu [≡] è sempre visibile, all'estremità destra dell'ultima riga, e si apre sopra tutte le righe. Una riga che non ha ancora nulla da mostrare (i limiti del piano prima della prima risposta) non occupa spazio.

## Suoni

- **Attivazione/disattivazione**: dal menu **[≡]** (`🔔 Suono completamento`, `🔔 Suono domanda`), da `/config` o in `settings.json`. Il menu scrive tramite `/config`, quindi i tre restano sempre allineati.
- **Un suono personalizzato**: imposta `completeSound` / `questionSound` sul percorso assoluto di un file **WAV** (il formato che Windows riproduce senza componenti aggiuntivi). In JSON raddoppia le barre rovesciate: `"C:\\Suoni\\fatto.wav"`. Se il file non esiste, viene usato quello incluso, con un avviso.
- **Provali**: `▶ Prova suoni` nel menu.

| Sistema | Lettore |
|---|---|
| Windows | PowerShell `System.Media.SoundPlayer` |
| macOS | `afplay` |
| Linux | `paplay`, altrimenti `aplay` |

## Durata della cache

La durata (TTL) della cache è un'impostazione di Claude Code, non un'opzione del mod: il mod la legge per gestire il countdown ⏳ e ti permette di cambiarla dalla barra.

| Come | Effetto |
|---|---|
| **Menu ≡ → ⇄ Cache** sulla barra | Alterna tra `5m` e `1h` scrivendo `promptCacheTtl` in `~/.claude/settings.json`. Vale dalla richiesta successiva |
| `"promptCacheTtl": "5m"` o `"1h"` in `settings.json` | Uguale, a mano |
| Installer `-CacheTtl` / `--cache-ttl` | Uguale, in fase di installazione |
| Variabile d'ambiente `CLAUDE_CODE_PROMPT_CACHE_TTL=5m` / `1h` | Prevale sull'impostazione; la voce di menu mostra 🔒 e non è selezionabile |
| Variabile d'ambiente `FORCE_PROMPT_CACHING_5M=1` | Forza 5 minuti su tutto; la voce di menu mostra 🔒 |
| Nessuna impostazione | Automatico: 1 ora con un abbonamento Claude entro i suoi limiti, 5 minuti con una API key, Bedrock, Vertex o Foundry |

La cache da 1 ora mantiene il prefisso in cache anche durante pause più lunghe, ma con una API key le scritture vengono fatturate a una tariffa più alta.

Un `promptCacheTtl` nel file `.claude/settings.local.json` o `.claude/settings.json` di un progetto prevale su quello utente: in quel caso il pulsante segnala che il progetto impone un altro valore.

Le organizzazioni con impostazioni gestite che limitano i mod possono impedire al mod di scrivere `settings.json`; in quel caso il pulsante non ha effetto.

Le versioni precedenti alla 1.3.0 avevano un'opzione del plugin `cacheTtl` che cambiava solo il countdown. Ora viene ignorata e l'installer la rimuove.

## Convivenza con `statusLine`

Il mod disegna nella fascia subito sopra il prompt. Non sostituisce l'impostazione `statusLine` basata su comando: se è ancora configurata, vengono mostrate entrambe. L'installer la rimuove per te; altrimenti elimina il blocco `statusLine` da `settings.json`.

## Disattivazione

- Per una sessione: avvia Claude Code con `--safe-mode`.
- In modo permanente: disattiva il plugin in `/plugin` → **Installed**, oppure disinstallalo (vedi il [README](../README.md#disinstallazione)).
