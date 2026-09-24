# Milo Flow

Gestionale personale per l'attività freelance e la vita privata: clienti, servizi con scadenze, task e progetti, calendario, budget e debiti. La specifica completa è in [SPEC.md](SPEC.md), che è la fonte di verità del progetto.

Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui su Base UI, Supabase (Postgres, Auth, Storage), Vercel.

## Setup locale

Requisiti: Node 22 (vedi `.nvmrc`). Docker non serve: si lavora sul progetto Supabase remoto.

```bash
nvm use
npm install
cp .env.example .env.local   # poi compila URL e chiave anon
./scripts/imposta-service-key.sh   # incolla la service role key senza mostrarla
npm run dev
```

L'app gira su http://localhost:3000.

### Variabili d'ambiente

| Variabile | Dove si usa | Note |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client e server | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client e server | chiave pubblica, protetta da RLS |
| `NEXT_PUBLIC_SITE_URL` | server | URL pubblico, per i link nelle email |
| `SUPABASE_SERVICE_ROLE_KEY` | **solo server** | salta RLS: mai in codice client né con prefisso `NEXT_PUBLIC_` |

## Database

Tutte le modifiche passano da migration SQL in `supabase/migrations/`. Mai modifiche a mano dal pannello.

La CLI di Supabase è una dipendenza di sviluppo, quindi si lancia con `npx supabase`. La prima volta bisogna collegarla al progetto:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>   # chiede la password del database
```

Comandi di uso quotidiano:

```bash
npx supabase migration new nome_migration   # crea un file vuoto in supabase/migrations
npm run db:push          # applica le migration al progetto collegato
npm run db:types         # rigenera lib/supabase/database.types.ts (dopo ogni migration)
npm run test:policies    # verifica le policy RLS (owner contro collaboratore)
```

`test:policies` esegue `supabase/tests/policies.sql` dentro una transazione chiusa da `ROLLBACK`: crea utenti e dati finti, prova letture e scritture con i due ruoli, poi annulla tutto. Se una verifica fallisce, il comando termina con un errore che inizia con `FALLITO`.

### Sicurezza in breve

- RLS è attiva su ogni tabella. L'owner vede tutto. Il collaboratore vede solo:
  - l'ambito `lavoro`;
  - le sezioni per cui ha un permesso (tabella `permessi`);
  - i clienti che gli sono assegnati (tabella `accessi_clienti`).
- Le entità senza cliente sono invisibili al collaboratore. Fa eccezione una task senza cliente, se è assegnata a lui.
- Costi, metodi di pagamento e prezzi di rivendita dei servizi stanno in tabelle separate (`servizi_economico`, `servizi_clienti_economico`). Si leggono solo con il permesso `budget`.
- Le funzioni helper `is_owner()`, `puo()`, `vede_cliente()` e `vede_servizio()` sono `security definer`, con `search_path` fissato.

## Impostare l'owner

La registrazione pubblica è disattivata: gli utenti entrano solo su invito. Il primo utente, cioè tu, va creato e promosso a mano, una volta sola:

1. Supabase → Authentication → Users → **Add user** → Create new user. Inserisci email e password e spunta *Auto Confirm User*.
2. Supabase → SQL Editor, esegui:

   ```sql
   update public.profili
   set ruolo = 'owner'
   where id = (select id from auth.users where email = 'tua@email.it');
   ```

La query deve rispondere **1 row affected**. Se risponde 0, l'email non corrisponde a quella dell'utente creato. Per controllare il risultato:

```sql
select u.email, p.ruolo from auth.users u join public.profili p on p.id = u.id;
```

Finché il ruolo è `collaboratore` senza permessi, l'app mostra un avviso giallo in cima e non lascia creare nulla.

Il profilo viene creato in automatico da un trigger. Nasce con ruolo `collaboratore`, e solo da SQL Editor o da un owner si può cambiare.

## Configurazione di Supabase Auth

In Authentication:

- **Sign In / Providers**: disattiva *Allow new users to sign up*.
- **URL Configuration**:
  - *Site URL*: l'URL di produzione, per esempio `https://miloflow.vercel.app`;
  - *Redirect URLs*: `http://localhost:3000/**` e `https://<dominio-produzione>/**`.

## Deploy

Vercel, collegato al repository GitHub. In Vercel → Settings → Environment Variables vanno le stesse variabili di `.env.local`. `NEXT_PUBLIC_SITE_URL` va impostata con l'URL di produzione. Ogni push su `main` va in produzione, ogni branch genera una preview.

## Controlli

```bash
npm run lint
npm run typecheck
npm test          # test unitari (vitest)
npm run build
```

## Edge Functions, segreti e cron

| Funzione | Cosa fa | Autenticazione |
| --- | --- | --- |
| `vies-lookup` | cerca una P.IVA su VIES | JWT di un utente loggato |
| `digest-scadenze` | riepilogo email del mattino | segreto del cron, oppure JWT dell'owner per la prova |
| `invia-email-cliente` | avviso di scadenza al cliente, dopo conferma | JWT dell'utente (valgono le sue policy) |
| `calendario-ics` | feed ICS per Google e Apple Calendar | token segreto nell'URL, solo per l'owner |

Per pubblicarle:

```bash
npx supabase functions deploy <nome> --use-api
```

I segreti stanno nelle impostazioni delle Edge Functions, mai nel repository:

- `RESEND_API_KEY` e `RESEND_FROM`: si impostano con `./scripts/imposta-resend.sh`, che non mostra la chiave a schermo. Per scrivere ai clienti serve un dominio verificato su Resend. Con `onboarding@resend.dev` parte solo il riepilogo verso l'email del proprio account Resend.
- `CRON_SECRET`: segreto casuale condiviso con il cron.
- `SITE_URL`: URL dell'app, per i link nelle email.

Il cron (`pg_cron` + `pg_net`) gira ogni 15 minuti e chiama `digest-scadenze`. La funzione invia una sola volta al giorno, dopo l'orario scelto in Impostazioni → Notifiche. URL e segreto il cron li legge dal Vault di Supabase (`digest_url`, `digest_secret`). Per rigenerare il segreto:

```sql
select vault.update_secret((select id from vault.secrets where name = 'digest_secret'), '<nuovo segreto>');
```

Poi si imposta lo stesso valore con `npx supabase secrets set CRON_SECRET=<nuovo segreto>`.

## Cassaforte delle credenziali

Una sola master password per tutta l'app, impostata dall'owner in Impostazioni. La cifratura avviene solo nel browser:

- PBKDF2-SHA256 a 600.000 iterazioni produce una chiave madre, che resta solo in memoria;
- da questa, per ogni credenziale, HKDF con il salt della credenziale produce una chiave AES-GCM a 256 bit.

Nel database finiscono solo payload cifrato, IV e salt. La cassaforte si richiude al logout o dopo 15 minuti di inattività. **Se si perde la master password, le password cifrate non sono recuperabili.**

## Task e progetti

- **Aggiunta rapida**. È un campo unico che riconosce date, riferimenti e priorità:
  - date: `oggi`, `domani`, `dopodomani`, `lun`…`dom`, `tra 3 giorni`, `12/10`. Una data semplice è la data pianificata; con `entro` davanti è la scadenza;
  - riferimenti: `#cliente` o `#progetto`, con autocompletamento;
  - priorità: `!alta` `!media` `!bassa` oppure `!1` `!2` `!3`.

  Il parser è una funzione pura in `lib/parsing/task-rapida.ts`, con i suoi test.
- **Ricorrenze**. Sono stringhe RRULE e seguono un calendario fisso: la prossima occorrenza si calcola dalla data prevista, non dal giorno in cui si completa la task. Le occorrenze già passate si saltano.
  - Completando la task, la funzione SQL `completa_task` crea la prossima occorrenza e ricopia le sottotask come da fare. Tutto avviene in una sola transazione.
  - Le date della nuova occorrenza le calcola il server Next con la libreria `rrule`.
  - La ricorrenza passa alla nuova task, quindi togliere e rimettere la spunta non crea doppioni.
- **Regole del database**, applicate da trigger:
  - una task con cliente è sempre di lavoro;
  - una task dentro un progetto ne eredita l'ambito e il cliente;
  - le sottotask hanno un solo livello;
  - la data "in attesa dal" si imposta da sola.
- **Eliminazione**. Le task si eliminano davvero, insieme alle sottotask. I progetti invece si archiviano soltanto.

## Calendario

- Pagina `/calendario` con FullCalendar 7 (pacchetto `@fullcalendar/react`, che contiene le viste). Le righe arrivano dalla vista `v_calendario` per l'intervallo visibile; le ricorrenze degli eventi si espandono nel browser (`lib/calendario.ts`, con test).
- Una task con `ora_inizio` sta nella fascia oraria e dura `durata_min` (60 minuti se manca); senza orario sta in "tutto il giorno". Trascinandola cambiano data, ora e durata.
- Le preferenze (tacche da 15/30/60 minuti, ore di inizio e fine, vista di partenza) stanno in `impostazioni_calendario`, una riga per utente creata al primo accesso dalla funzione `mie_impostazioni_calendario()`.
- **Feed ICS**: in Impostazioni → Calendario si crea un link con un token di 64 caratteri (`rigenera_token_ics()`); la Edge Function `calendario-ics` risponde con il file `.ics`. Il feed legge con la service role, quindi è disponibile solo per l'owner. Va pubblicata con `npx supabase functions deploy calendario-ics --use-api` e usa il segreto `SITE_URL` per i link.

## Budget & Spese

- **Pagina `/budget`** con tre sezioni sul parametro `?tab=`: *Mese* (`?mese=yyyy-MM-01`), *Debiti* e *Report* (`?periodo=mese|3mesi|12mesi|anno`). Il mese mostra budget, speso, previsto e rimanente, una barra per categoria (le sottocategorie contano nel padre) e i movimenti raggruppati per giorno. Un movimento appartiene al mese per la sua `data`; `periodo` è il mese di competenza usato dai vincoli univoci.
- **Categorie** (Impostazioni → Categorie): due livelli, trascinamento per l'ordine, colore, icona (nome lucide in `lib/icone.ts`), ambito, budget mensile di default, archiviazione. Una sottocategoria ha sempre l'ambito del padre (trigger). Il budget di un padre nel mese è il suo override in `budget_mensili`, altrimenti il suo default più quelli delle figlie.
- **Previsti**. La funzione SQL `genera_previsti(mese)` crea un movimento `previsto` per ogni servizio attivo pagato da me con la scadenza nel mese e per ogni rata non pagata del mese. È idempotente grazie ai vincoli univoci `(servizio_id, periodo)` e `(rata_id)`. La chiama l'owner con «Aggiorna previsti» (mese scelto e successivo) e il cron `genera-previsti` di `pg_cron` il primo del mese alle 00:05 UTC, in SQL diretto, senza Edge Function né segreti. I trigger su `servizi`, `servizi_economico`, `debiti` e `debiti_rate` tengono aggiornati i previsti del mese corrente e del successivo quando qualcosa cambia (disdetta, costo, scadenza, piano delle rate).
- **Rinnovo**. `rinnova_servizio` avanza la scadenza e, se paghi tu, rende `pagato` il movimento del periodo della scadenza rinnovata (lo crea se manca; due rinnovi nello stesso periodo si sommano). Lo storico in `servizi_rinnovi` punta al movimento. Se paga il cliente non nasce nessun movimento.
- **Debiti**. `salva_debito` scrive debito e piano delle rate in una transazione: le rate pagate non si toccano, le altre seguono il piano nuovo. `paga_rata` crea (o converte) il movimento `pagato` e segna la rata; `annulla_pagamento_rata` torna indietro. Un debito si elimina solo senza rate pagate (`elimina_debito`). Le rate ereditano `debiti.categoria_id`.
- **Nuova spesa** (menu +, ⌘K, pagina Budget): importo, griglia di categorie, poi descrizione, data, metodo, foto della ricevuta nel bucket `ricevute/<movimento_id>/`. Un movimento si elimina con conferma; quello di una rata pagata si annulla dal debito.
- **Report**: i calcoli sono funzioni pure in `lib/budget.ts` (con test) sugli stessi movimenti della lista, quindi i totali coincidono. Il grafico dei 12 mesi usa una tramatura sul personale, oltre al colore, e ha la tabella sotto.
- **Calendario**: le rate e i previsti dei servizi compaiono una volta sola (come rata e come scadenza); le «Spese previste» sono solo quelle inserite a mano. Un evento può avere un colore suo (`eventi.colore`, colonna `colore_sfondo` di `v_calendario`) che ne riempie lo sfondo; senza colore vale quello dell'ambito. FullCalendar 7 legge per ogni evento solo `color` e `contrastColor` (le proprietà `backgroundColor`/`borderColor`/`textColor` della versione 6 sono ignorate): i colori per tipo e ambito stanno in `lib/calendario.ts`.
- **Report mensile in PDF**: «Esporta PDF» nella pagina del mese apre `/budget/stampa?mese=…`, una pagina senza sidebar (gruppo di route `(stampa)`) con totali, categorie, tutti i movimenti, metodi, abbonamenti e debiti. Il PDF lo fa il browser con «Salva come PDF» (su iPhone: Condividi → Salva in File).

## Backup

In Impostazioni → Backup (solo owner). **Scarica il backup** produce uno ZIP costruito nel browser con `fflate`: `dati.json` (tutte le tabelle, da `esporta_backup()`), `LEGGIMI.txt` e la cartella `file/<bucket>/<percorso>` con loghi, ricevute e allegati delle task scaricati dallo Storage. Le credenziali cifrate restano cifrate: servono la stessa master password e nient'altro.

**Ripristina un backup** vale solo su un account senza clienti, servizi e task: la funzione SQL `importa_backup(jsonb)` inserisce tutto in una sola transazione conservando gli id, sostituisce categorie, tipi di servizio e metodi di esempio con quelli del backup, assegna a chi importa le righe (`created_by`) e le impostazioni, e scarta permessi e accessi dei collaboratori (gli utenti vanno reinvitati). I file vengono poi ricaricati nello Storage agli stessi percorsi. Per un nuovo progetto Supabase: applicare le migration, creare l'owner come descritto sopra, entrare e ripristinare.

## Da completare nelle fasi successive

- Gestione di tipi di servizio e utenti (fase 6).

## Struttura

```
app/(auth)/login        login con password o magic link
app/auth/callback       rientro dai link via email
app/(app)/...           sezioni dell'app (layout con sidebar, header, ⌘K, pannello delle entità)
components/ui           componenti shadcn
components/layout       sidebar, header, switch ambito, menu +, palette ⌘K
components/drawer       EntityDrawer: pannello centrato (foglio dal basso su mobile) aperto da ?apri=<tipo>:<id>
components/filtri       barra dei filtri e chip
lib/supabase            client browser, server, admin e proxy di sessione
lib/actions             Server Actions
lib/schemas             schemi zod
lib/parsing             parser dell'aggiunta rapida delle task
lib/dates               date, giorni e ricorrenze RRULE
components/task         viste delle task, kanban, Pianifica settimana, aggiunta rapida
components/calendario   FullCalendar, filtri, creazione dallo slot, form dell'evento
components/budget       pagina Budget, Nuova spesa, debiti con piano rate, report, griglia delle categorie
components/impostazioni sezioni delle Impostazioni (calendario, categorie, cassaforte, metodi, notifiche)
supabase/migrations     schema, policy e seed
supabase/tests          test delle policy
```
