# Come funziona

Il mod è un unico modulo di hook, [`hooks/register.ts`](../hooks/register.ts), che gira dentro Claude Code. Tiene in memoria una piccola istantanea dello stato e disegna una riga nella fascia sopra il prompt (hook `ui.render` sul punto `AbovePrompt`). A differenza di `$.ui.status`, quel punto accetta testo colorato e non mostra l'etichetta del plugin.

## Colori

| Livello | Colore (chiave del tema) |
|---|---|
| < 50% | verde (`success`) |
| 50–79% | giallo (`warning`) |
| ≥ 80% | rosso (`error`) |

Il valore accanto a una barra (percentuale, conto alla rovescia, ora del reset) ha lo stesso colore della barra, anche quando la barra è nascosta con `:nobar`. Le soglie sono `WARNING_FROM` ed `ERROR_FROM`, in cima a `hooks/register.ts`. La barra ⏳ mostra il tempo rimanente, mentre il colore si basa sulla quota già trascorsa: verde subito dopo una richiesta, rosso vicino alla scadenza.

## Da dove arrivano i dati

| Segmento | Fonte | Aggiornamento |
|---|---|---|
| ⏳ Cache | Ora dell'ultima risposta API del loop principale (hook `turn.step`) più la durata (TTL) usata da quella richiesta | Ogni secondo (`$.clock.every` + `$.ui.invalidate`) |
| ≡ → ⇄ Cache | Stesso ordine usato da Claude Code (vedi sotto) | Avvio della sessione, ogni richiesta, ogni variazione dei limiti del piano, ogni modifica di `settings.json` |
| 🧠 Contesto | `context.tokens / context.window` (il `context.percent` di Claude Code è arrotondato all'intero) | `session.measure` |
| 🕒 Limite di 5 ore | Voce `five_hour` di `rateLimits` (`percentUsed`, `resetsAt`) | `session.measure` |
| 📅 Limite settimanale | Voce `seven_day` di `rateLimits` | `session.measure` |
| 🤖 Modello | `$.session.model()` | Avvio della sessione e ogni richiesta |
| 🤖 Effort | `effort` che il motore invia con la richiesta corrente (`turn.step`), salvato così che ricaricando il mod nella stessa sessione venga mostrato di nuovo | Inizio di ogni richiesta |
| ⚡ Velocità | Token di output dell'ultima risposta del loop principale (thinking incluso) divisi per il tempo dal primo blocco di output alla fine (stream di `turn.step`) | Fine di ogni richiesta |
| 💲 Costo | `cost.usd`, lo stesso totale di `/cost`, in dollari USA | `session.measure` |

Claude Code genera `session.measure` dopo ogni turno e ogni volta che un limite del piano cambia, quindi quei segmenti riportano gli stessi valori della status line nativa.

## Formato di data e ora

Le etichette del reset mostrano l'ora per la finestra di 5 ore e data + ora (senza anno) per la finestra settimanale. Il formato viene determinato una volta per sessione:

| Fonte | Usata quando |
|---|---|
| Opzione `locale` | È impostata a un valore non vuoto |
| Windows: formati brevi di data e ora di `Get-Culture` | Windows. Rispetta i formati personalizzati impostati in **Impostazioni → Data/ora e lingua → Area geografica** (ordine della data, separatori, 12/24 h) |
| `LC_ALL`, `LC_TIME`, `LANG` | macOS/Linux con un locale nell'ambiente |
| `defaults read -g AppleLocale` | macOS senza un locale nell'ambiente |
| `en-US` | Nessuna delle fonti precedenti è disponibile |

Esempi per il reset settimanale: `20/10 11:00` (it-IT, `dd/MM/yyyy` + `HH:mm`), `10/20 11:00 AM` (en-US), `20.10 11:00` (de-DE).

Il runtime del mod non eredita da solo il locale di sistema, per questo viene letto esplicitamente.

## Colori dell'effort

L'effort è mostrato con le sue prime due lettere dopo il nome del modello.

| Effort | Mostrato | Colore (chiave del tema) |
|---|---|---|
| `low` | `lo` | grigio (`inactive`) |
| `medium` | `me` | verde (`success`) |
| `high` | `hi` | giallo (`warning`) |
| `xhigh` | `xh` | arancione (`claude`) |
| `max` | `ma` | rosso, grassetto (`error`) |

Un effort numerico non ha un livello con nome e viene mostrato nel colore predefinito. La corrispondenza è `EFFORT_STYLE`, in cima a `hooks/register.ts`.

## Suoni

| Suono | Evento | Condizione |
|---|---|---|
| Completamento | `turn.complete` | Conversazione principale, `reason` `answer`, `durationMs` ≥ `completeMinSeconds` |
| Domanda | `tool.call` su `AskUserQuestion`, `classic.PermissionRequest`, `classic.Elicitation`, `classic.Notification` (avvisi di permesso e di input) | Al massimo un suono ogni 3 secondi, così una domanda e la relativa finestra di permesso producono un solo suono |

Sulle macchine gestite e sui piani Team o Enterprise, la protezione integrata di Claude Code tiene i mod utente lontane da `PermissionRequest`. In quel caso il suono di permesso arriva dall'avviso che Claude Code genera quando una richiesta di permesso è in attesa da 6 secondi, quindi suona con quel ritardo. Un avviso per una richiesta che ha già suonato viene ignorato.

Il suono gira in un processo separato in background: l'hook inoltra subito l'evento e un suono che non riesce a partire viene ignorato. `$.audio.play` non è usato perché ha un player solo su macOS.

## Precisione delle percentuali

| Segmento | Decimali | Perché |
|---|---|---|
| 🧠 Contesto | 2, esatti | Calcolati dal conteggio dei token. Parte intera su 3 colonne: `  6.06%`, ` 85.06%`, `100.00%` |
| 🕒 / 📅 Limiti del piano | Come ricevuti, senza zeri di riempimento. Parte intera su 3 colonne: `  5%`, ` 23.5%`, `100%` | Anthropic comunica l'uso del piano già arrotondato e Claude Code tiene al massimo un decimale. Nessun valore più preciso arriva a Claude Code |

Il riempimento usa uno spazio numerico (U+2007), largo quanto una cifra, così le colonne restano allineate nel terminale e nell'app Desktop.

## Limiti raggiunti

Quando una finestra del piano arriva al 100%, il suo segmento toglie la percentuale e la data del reset e mostra al loro posto un conto alla rovescia in tempo reale fino al reset, con la barra piena e rossa:

```
🕒 ██████████ 2:15:30 | 📅 ██████████ 2g 3:04:05
```

Il formato è `m:ss`, `h:mm:ss`, oppure `Ng h:mm:ss` oltre il giorno. Quando l'ora del reset è passata ma Claude Code non ha ancora comunicato i nuovi valori, il segmento mostra `reset in corso` fino alla risposta successiva.

## Conto alla rovescia della cache

La cache del prompt di Anthropic conserva un prefisso per un tempo fisso (5 minuti di default, 1 ora se estesa) e ogni richiesta che la legge fa ripartire il timer. Per questo il mod:

- registra l'ora in cui si completa ogni richiesta del loop principale (i subagent lavorano su un prefisso proprio e vengono ignorati);
- mostra `ttl - (now - last request)` come barra e come conto alla rovescia `m:ss` / `h:mm:ss`;
- mostra `scaduta` quando il tempo è finito: la richiesta successiva scriverà di nuovo la cache (costo più alto, primo token più lento);
- torna a `--:--` dopo `/clear`, che avvia una nuova conversazione.

Il conto alla rovescia è una stima calcolata sul client: presuppone che il prefisso sia stato messo in cache dall'ultima richiesta con la durata (TTL) in vigore in quel momento. Cambiare durata non modifica la voce già in cache: il conto alla rovescia segue il nuovo valore dalla richiesta successiva.

### Quale durata è in vigore

Il mod determina la durata (TTL) nello stesso ordine di Claude Code:

1. `FORCE_PROMPT_CACHING_5M` → `5m` (bloccata)
2. `CLAUDE_CODE_PROMPT_CACHE_TTL` → il suo valore (bloccata)
3. `promptCacheTtl` nelle impostazioni unite
4. `ENABLE_PROMPT_CACHING_1H` → `1h`
5. Automatica: `1h` quando i limiti del piano vengono comunicati e nessuno è esaurito (un abbonamento entro i suoi limiti), altrimenti `5m`

Prima della prima risposta di una sessione nessun limite del piano è ancora noto, quindi fino ad allora una durata automatica risulta `5m`.

## Costo

`💲` è quanto sarebbe costata la sessione ai prezzi di listino dell'API. Claude Code lo calcola per ogni sessione, comprese quelle con abbonamento Pro/Max, dove non viene addebitato.

## Limitazioni

- 🕒 e 📅 compaiono solo con un piano in abbonamento: con una chiave API non ci sono finestre del piano da mostrare.
- L'effort compare quando parte la prima richiesta di una sessione, e una modifica fatta con `/effort` si vede dalla richiesta successiva. Le impostazioni non vengono usate per indovinarlo: il livello effettivo dipende anche da `--effort`, dalle impostazioni per modello e dai default del modello, che solo Claude Code risolve.
- Gli orari di reset sono mostrati nel fuso orario locale del computer.

## Dove funziona

| Dove | Mostrata |
|---|---|
| `claude` in un terminale (compresi i terminali degli IDE e il plugin JetBrains) | Sì |
| Scheda Code di Claude Desktop | Sì |
| Pannello chat dell'estensione VS Code, `claude -p`, Agent SDK | Gli hook girano, ma non viene disegnato nulla |
| Sessioni WSL in Claude Desktop | No (lì i plugin non sono disponibili) |

## Risoluzione dei problemi

| Sintomo | Cosa controllare |
|---|---|
| Nessuna barra | `claude --version` ≥ 2.1.287; `/plugin` elenca il mod come attivo; `disableAllHooks` non è `true` in `settings.json` |
| Due barre | `statusLine` è ancora in `settings.json`: rimuovilo |
| La riga sparisce per un attimo | Un sondaggio sta usando la fascia sopra il prompt; la riga torna quando si chiude |
| ⏳ sempre `--:--` | Nessuna richiesta ancora inviata in questa sessione |
| 🕒 / 📅 assenti | Accesso con chiave API, oppure nessuna risposta ancora ricevuta |
| Errori | Avvia con `claude --debug` e cerca le righe che iniziano con `statusbar:` |
