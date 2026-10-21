# Registro delle modifiche

## 1.11.1 — 2026-10-21

- Documentazione, descrizioni del plugin e voci di `/config` tradotte in italiano.

## 1.11.0 — 2026-10-21

- Il valore accanto a ogni barra (⏳ 🧠 🕒 📅) è disegnato nel colore della barra: verde, giallo o rosso in base al livello.
- Ogni barra si può nascondere singolarmente, mantenendo il valore colorato: `Barra: sì/no` nell'editor dei blocchi, oppure `:nobar` nell'opzione `blocks` (`context:nobar`).

## 1.10.0 — 2026-10-21

- Editor dei blocchi nel menu [≡] (`⚙ Blocchi e righe…`): mostra, nascondi, ordina e posiziona ogni blocco sulla riga 1 o 2 con pulsanti e anteprima, senza passare da `/config`.

## 1.9.0 — 2026-10-21

- La barra può usare due righe: nell'opzione `blocks` una `/` inizia una nuova riga (`cache, context, 5h, 7d / model, speed, cost`). Il menu [≡] sta sull'ultima riga e si apre sopra tutte le righe.

## 1.8.0 — 2026-10-21

- ⚡ nuovo blocco: velocità di generazione dell'ultima risposta, in token di output al secondo.
- Opzione `blocks`: scegli quali blocchi mostrare e in quale ordine (`cache, context, 5h, 7d, model, speed, cost`).
- Suono dei permessi anche dove la protezione integrata di Claude Code tiene i mod fuori dalle richieste di permesso (macchine gestite, piani Team ed Enterprise): viene riprodotto dall'avviso che compare dopo 6 secondi di prompt in attesa.
- Niente più avviso di eseguibile mancante nel log di debug su Windows e Linux (la lettura della locale di macOS avviene solo su macOS).

## 1.7.0 — 2026-10-18

- Suoni: uno quando Claude termina una risposta di almeno 15 secondi, un altro quando chiede qualcosa (domande a scelta multipla, richieste di permesso, richieste di input MCP).
- Ogni suono si può attivare o disattivare singolarmente (dal menu [≡] o da `/config`) e può usare un tuo file WAV; `▶ Prova suoni` li riproduce entrambi.
- Nuove opzioni: `soundOnComplete`, `soundOnQuestion`, `completeSound`, `questionSound`, `completeMinSeconds`. Gli installer salvano tutte le opzioni, così Claude Code non chiede mai di configurare il plugin.

## 1.6.2 — 2026-10-17

- Pulsante del menu disegnato come `[≡]`; parentesi e cornice del menu nel colore `suggestion` del tema (`MENU_COLOR` in `hooks/register.ts`).

## 1.6.1 — 2026-10-17

- Il simbolo del menu ora è `≡`: `☰` veniva da un font di fallback nei terminali Windows e rompeva la riga quando era a fuoco.
- Il menu si apre verso l'alto come elenco verticale incorniciato sopra la barra, un'azione per riga, allineato a destra.

## 1.6.0 — 2026-10-17

- Menu ☰ all'estremità destra della barra: apre sotto di sé una riga di azioni, che si chiude con una scelta, con **Chiudi** o con una seconda pressione. Il selettore del TTL della cache è stato spostato al suo interno (`⇄ Cache 1h → 5m`).

## 1.5.3 — 2026-10-17

- Correzione: 🤖 poteva mostrare l'`effortLevel` di `settings.json` (es. `xh`) invece dell'effort effettivamente in uso. Ora la barra mostra solo l'effort che Claude Code invia con ogni richiesta, e lo mantiene tra i ricaricamenti del mod nella stessa sessione.

## 1.5.2 — 2026-10-17

- Effort 🤖 mostrato dall'avvio della sessione (`CLAUDE_CODE_EFFORT_LEVEL` o l'impostazione `effortLevel`) e aggiornato all'inizio di ogni richiesta, invece che solo dopo la prima risposta; le modifiche con `/effort` compaiono subito.

## 1.5.1 — 2026-10-17

- Effort 🤖 mostrato con le prime due lettere (`lo`, `me`, `hi`, `xh`, `ma`), mantenendo il suo colore.

## 1.5.0 — 2026-10-17

- Livello di effort 🤖 colorato in base all'intensità: low grigio, medium verde, high giallo, xhigh arancione, max rosso e grassetto.

## 1.4.4 — 2026-10-17

- Le percentuali hanno una parte intera a larghezza fissa (3 colonne) e, per l'uso del contesto, sempre 2 decimali, così la riga non si sposta più al variare dei valori.

## 1.4.3 — 2026-10-17

- Percentuali di 🕒 e 📅 mostrate come ricevute, senza zeri di riempimento (`5%`, `23.5%`).

## 1.4.2 — 2026-10-17

- Uso del contesto 🧠 calcolato dal conteggio dei token, così i due decimali sono esatti (il valore di Claude Code è un numero intero).

## 1.4.1 — 2026-10-17

- I limiti raggiunti mostrano solo il conto alla rovescia, senza l'etichetta `reset tra`.

## 1.4.0 — 2026-10-17

- 🕒 e 📅: una volta raggiunto un limite, percentuale e data di reset vengono sostituite da un conto alla rovescia in tempo reale fino al reset (`reset tra 2:15:30`, `reset tra 2g 3:04:05`).

## 1.3.2 — 2026-10-17

- Gli installer lasciano sempre il plugin abilitato: eseguono `claude plugin enable` dopo l'installazione o l'aggiornamento (un semplice aggiornamento lasciava disabilitato un plugin disabilitato), poi controllano `claude plugin list` e si fermano con un errore se non è abilitato.
- Gli installer avvisano quando `disableAllHooks` è `true`, che impedisce il caricamento di qualsiasi mod.
- L'opzione `locale` ha come predefinito `system`; gli installer la impostano se non è definita, così Claude Code non segnala più un'opzione non configurata.

## 1.3.1 — 2026-10-14

- Il selettore ⇄ del TTL della cache è allineato al bordo destro della riga.

## 1.3.0 — 2026-10-14

- Il pulsante ⇄ alla fine della barra cambia il TTL della cache del prompt di Claude Code tra 5m e 1h (`promptCacheTtl` in `settings.json`); 🔒 quando è fissato da una variabile d'ambiente.
- Il conto alla rovescia ⏳ segue il TTL effettivamente usato da Claude Code (variabili d'ambiente, `promptCacheTtl`, 1h automatico con gli abbonamenti) e il TTL dell'ultima richiesta.
- Rimossa l'opzione del plugin `cacheTtl`; `-CacheTtl` / `--cache-ttl` degli installer ora impostano `promptCacheTtl` e rimuovono la vecchia opzione.

## 1.2.0 — 2026-10-14

- Il reset settimanale mostra data e ora.
- Date e orari di reset seguono le impostazioni internazionali del sistema operativo (inclusi i formati personalizzati di Windows); nuova opzione `locale` per sovrascriverle.
- Costo mostrato senza il simbolo `$`.

## 1.1.0 — 2026-10-14

- Barre colorate verde / giallo / rosso in base al livello (soglie al 50% e all'80%).
- La riga è disegnata sopra il prompt senza l'etichetta `statusbar` davanti.

## 1.0.0 — 2026-10-14

- Prima release: conto alla rovescia della cache del prompt, contesto, limiti a 5 ore e settimanale, modello/effort, costo equivalente API.
- Installer automatici per Windows (PowerShell) e macOS/Linux (Bash).
