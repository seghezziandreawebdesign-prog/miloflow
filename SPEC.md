# SPEC — Webapp gestionale freelance + personale

Questo documento è la specifica completa del progetto. Va tenuto nella root del repository e riletto all'inizio di ogni sessione di lavoro. È la fonte di verità: se qualcosa nel codice contraddice questo documento, vale il documento, a meno che io non dica diversamente.

---

## 0. Come devi lavorare

- Lavora **per fasi** (sezione 9). Alla fine di ogni fase fermati, riassumi cosa hai fatto, cosa devo testare io e cosa devo configurare a mano. Non passare alla fase successiva senza il mio ok.
- Prima di iniziare una fase, mostrami il piano (file che creerai, migration, componenti) e aspetta conferma.
- Se una scelta non è specificata qui e ha impatto su dati, sicurezza o UX, **chiedimi** invece di inventare.
- Tutte le modifiche al database passano da **migration SQL** in `supabase/migrations/` (Supabase CLI). Mai modifiche manuali non tracciate. Dopo ogni migration rigenera i tipi TypeScript.
- La **service role key** di Supabase non deve mai finire nel codice client né in variabili `NEXT_PUBLIC_*`. Si usa solo lato server (Server Actions, Route Handlers) e nelle Edge Functions.
- Ogni tabella ha **RLS attiva** dal momento in cui viene creata, con le policy descritte nella sezione 5. Nessuna tabella senza policy.
- TypeScript in modalità strict. Nessun `any` salvo casi motivati.
- Interfaccia **in italiano**. Date in formato italiano (`dd/MM/yyyy`, settimana che inizia di lunedì), valuta EUR con formattazione `it-IT`, fuso orario `Europe/Rome`.
- Nomi di tabelle e colonne in italiano come indicato qui. Codice (variabili, funzioni, componenti) in inglese.
- Commit piccoli e descrittivi. Un branch per fase.
- Scrivi codice leggibile e manutenibile da una persona sola: niente astrazioni premature, niente librerie non elencate senza chiedermelo.

---

## 1. Contesto

Sono un web designer/developer freelance in regime forfettario. Uso questa app per gestire sia l'attività professionale sia la vita personale: clienti, servizi con scadenze (domini, hosting, licenze, abbonamenti), task e progetti, calendario, budget e spese, debiti.

**Fuori scope**: fatture, tasse, INPS. Li gestisco altrove. Non creare nulla che li riguardi.

Utenti: io (owner) e, in futuro, uno o più collaboratori esterni con accesso limitato.

---

## 2. Stack

- **Next.js** (ultima versione stabile, App Router) + **TypeScript**
- **Supabase**: Postgres, Auth, Storage, Edge Functions, pg_cron + pg_net
- **Vercel** per il deploy, collegato al repository GitHub
- **Tailwind CSS** + **shadcn/ui** (Sheet, Dialog, Command, Table, Tabs, Popover, Calendar, Chart, Form, Sonner per i toast)
- `@supabase/ssr` per l'autenticazione lato server con cookie
- **TanStack Query** per cache client e aggiornamenti ottimistici (spunta task, drag & drop)
- **TanStack Table** per le tabelle con filtri e ordinamento
- **react-hook-form + zod** per form e validazione (gli schemi zod si riusano lato server)
- **FullCalendar** (pacchetti standard gratuiti: daygrid, timegrid, list, interaction)
- **rrule** per le ricorrenze (salvate come stringa RRULE)
- **Recharts** (tramite i chart di shadcn)
- **date-fns** con locale `it`
- **Resend** per le email (chiamato dalle Edge Functions)
- **lucide-react** per le icone

Mutazioni tramite **Server Actions** con validazione zod. Letture iniziali nei Server Components, interattività nei Client Components con TanStack Query dove serve.

---

## 3. Principi trasversali di UX

### 3.1 Ambito Lavoro / Personale
Ogni entità operativa (task, progetto, servizio, evento, movimento, debito) ha un campo `ambito` = `lavoro` | `personale`. I clienti sono sempre lavoro.

Nell'header c'è uno switch fisso **Tutto / Lavoro / Personale**, salvato in un cookie, che filtra tutte le pagine. Due colori fissi definiti come token CSS (es. `--ambito-lavoro`, `--ambito-personale`) usati in badge, calendario e grafici. Quando si crea un elemento, l'ambito di default è quello attivo nello switch (se "Tutto", default `lavoro`).

### 3.2 Pannello laterale unico
Tutte le entità si aprono in un **pannello laterale (Sheet)** sopra la lista, non in una pagina nuova. Il pannello è indirizzabile via URL con un parametro `?apri=<tipo>:<id>` (es. `?apri=servizio:uuid`), così è apribile da qualsiasi pagina, dal calendario e dai link nelle email. Un componente `EntityDrawer` che smista al contenuto giusto in base al tipo. Nel pannello: dettagli, modifica inline o tramite form, azioni contestuali.

### 3.3 Creazione rapida
Pulsante **+** sempre visibile nell'header con menu: Nuova task, Nuova spesa, Nuovo servizio, Nuovo evento, Nuovo cliente. Ogni form di creazione mostra **solo i campi essenziali**; gli altri stanno in una sezione espandibile "Altri dettagli".

### 3.4 Ricerca globale
Palette comandi **⌘K / Ctrl+K** (shadcn Command) che cerca tra clienti, servizi, task, progetti ed eventi e permette di aprirli nel pannello. Include anche comandi rapidi ("Nuova task", "Vai al calendario").

### 3.5 Layout
Sidebar a sinistra: **Oggi, Task, Calendario, Clienti, Servizi & Scadenze, Budget, Impostazioni**. Su mobile la sidebar diventa un menu a scomparsa e le liste si adattano a card. Tema chiaro/scuro. L'app deve essere installabile come **PWA** (manifest + icone) a partire dalla fase 6.

### 3.6 Stati vuoti e feedback
Ogni lista vuota ha uno stato vuoto con un'azione chiara ("Aggiungi il primo servizio"). Ogni azione mostra un toast di conferma; le azioni distruttive chiedono conferma. Preferire l'archiviazione alla cancellazione.

---

## 4. Modello dati

Tutte le tabelle hanno `id uuid` (default `gen_random_uuid()`), `created_at` e `updated_at` (aggiornato da trigger), `created_by uuid` (default `auth.uid()`). Importi in `numeric(10,2)`. Le colonne elencate sono il minimo; aggiungi indici su chiavi esterne e sulle colonne data usate nei filtri.

### 4.1 Utenti e permessi
- **profili**: `id` (= auth.users.id), `nome`, `ruolo` (`owner` | `collaboratore`, default `collaboratore`). Un trigger su `auth.users` crea il profilo alla registrazione/invito. L'owner viene impostato manualmente una volta via SQL (documentalo nel README).
- **permessi**: `user_id`, `sezione` (`clienti` | `servizi` | `credenziali` | `calendario` | `task` | `budget`), `livello` (`lettura` | `scrittura`). Chiave primaria (user_id, sezione).
- **accessi_clienti**: `user_id`, `cliente_id`. Definisce quali clienti vede un collaboratore.

### 4.2 Clienti
- **clienti**: `tipo` (`azienda` | `privato`), `ragione_sociale` (obbligatorio), `nome_breve`, `piva`, `codice_fiscale`, `codice_sdi`, `pec`, `nazione` (default `IT`), `indirizzo`, `cap`, `citta`, `provincia`, `email`, `telefono`, `sito`, `logo_path` (Storage), `colore`, `stato` (`attivo` | `potenziale` | `in_pausa` | `archiviato`), `tags text[]`, `note`.
- **clienti_contatti**: `cliente_id`, `nome`, `ruolo`, `email`, `telefono`, `principale bool`.
- **clienti_link**: `cliente_id`, `etichetta`, `url`, `ordine`.
- **clienti_diario**: `cliente_id`, `data`, `testo`. Note cronologiche.

### 4.3 Servizi e scadenze
- **tipi_servizio**: `nome`, `icona`, `preavviso_default` (giorni). Seed iniziale: Dominio, Hosting, Licenza plugin/tema, SaaS, Abbonamento, Assicurazione, Bollo/Tassa, Altro.
- **servizi**: `ambito`, `nome` (obbligatorio), `tipo_id`, `fornitore`, `costo`, `valuta` (default EUR), `frequenza` (`mensile` | `trimestrale` | `semestrale` | `annuale` | `biennale` | `una_tantum`), `prossima_scadenza date` (obbligatoria), `rinnovo_automatico bool`, `chi_paga` (`io` | `cliente`), `metodo_pagamento` (testo libero descrittivo, es. "Revolut *4417": **mai** numeri di carta completi), `preavviso_giorni`, `url_pannello`, `username`, `categoria_spesa_id`, `stato` (`attivo` | `disdetto` | `archiviato`), `note`.
- **servizi_clienti**: `servizio_id`, `cliente_id`, `prezzo_rivendita`, `note`. Chiave primaria composta. Un servizio può essere collegato a più clienti (es. un piano hosting con i siti di più clienti).
- **servizi_economico** (opzionale ma consigliata): se vuoi separare costi e prezzi di rivendita dai dati operativi, per poterli nascondere ai collaboratori. Discutine con me prima di implementarla.
- **servizi_rinnovi**: `servizio_id`, `data`, `importo`, `movimento_id`. Storico dei rinnovi.
- **credenziali**: tabella separata dai servizi. `servizio_id` (o `cliente_id`), `etichetta`, `tipo` (`link_password_manager` | `cifrata`), `url_password_manager`, `payload_cifrato`, `iv`, `salt`. Vedi 5.4.

**Stato calcolato**: non salvare lo stato di scadenza. Crea una view `v_servizi` con `giorni_alla_scadenza` e `stato_scadenza`: `scaduto` (< 0), `urgente` (≤ 7), `in_scadenza` (≤ preavviso), `ok`. La view deve usare `security_invoker = true` per rispettare l'RLS.

### 4.4 Task e progetti
- **progetti**: `ambito`, `nome`, `cliente_id`, `stato` (`attivo` | `in_pausa` | `completato` | `archiviato`), `scadenza`, `colore`, `descrizione`.
- **task**: `ambito`, `titolo`, `note`, `progetto_id`, `cliente_id`, `parent_id` (sottotask, **massimo un livello**: validalo), `servizio_id`, `stato` (`da_fare` | `in_corso` | `in_attesa` | `fatto`), `in_attesa_di` (testo), `in_attesa_dal` (data), `priorita` (null | 1 alta | 2 media | 3 bassa), `data_pianificata date` (quando la faccio), `scadenza date` (entro quando), `durata_min`, `ricorrenza` (RRULE), `assegnata_a`, `ordine`, `completata_il`.

Se una task ha `progetto_id` e il progetto ha un cliente, il `cliente_id` della task si eredita dal progetto. Quando si completa una task ricorrente, si crea la prossima occorrenza.

### 4.5 Calendario
- **eventi**: `ambito`, `titolo`, `inizio timestamptz`, `fine timestamptz`, `tutto_il_giorno bool`, `luogo`, `link_call`, `cliente_id`, `progetto_id`, `ricorrenza` (RRULE), `note`.
- **v_calendario**: view (`security_invoker = true`) che unisce con colonne comuni (`id`, `tipo`, `titolo`, `inizio`, `fine`, `tutto_il_giorno`, `ambito`, `cliente_id`, `modificabile`): task non completate con data pianificata, deadline delle task, scadenze dei servizi attivi, eventi, rate di debiti non pagate, movimenti previsti.

### 4.6 Budget, spese e debiti
- **categorie**: `nome`, `parent_id` (due livelli), `ambito` (`lavoro` | `personale` | `entrambi`), `colore`, `icona`, `budget_default`, `ordine`, `archiviata bool`.
- **budget_mensili**: `categoria_id`, `mese date` (sempre il primo del mese), `importo`. Override del default per un mese specifico.
- **movimenti**: `ambito`, `data`, `importo`, `descrizione`, `categoria_id`, `stato` (`previsto` | `pagato`), `servizio_id`, `rata_id`, `periodo date` (primo del mese di competenza), `metodo_pagamento`, `ricevuta_path`. Vincoli univoci su (`servizio_id`, `periodo`) e su (`rata_id`) per impedire duplicati.
- **debiti**: `ambito`, `creditore`, `descrizione`, `importo_totale`, `tipo` (`rateale` | `unica_soluzione` | `prestito_privato`), `data_inizio`, `note`.
- **debiti_rate**: `debito_id`, `numero`, `scadenza`, `importo`, `pagata bool`, `movimento_id`.

Seed categorie di esempio (modificabili): Lavoro → Software (Hosting, Domini, Licenze, SaaS), Attrezzatura, Formazione, Commercialista; Personale → Casa (Affitto, Bollette), Spesa, Trasporti, Salute, Svago, Abbonamenti.

### 4.7 Storage
Bucket privati: `loghi`, `ricevute`, `allegati`. Accesso tramite signed URL. Policy di Storage coerenti con i permessi della sezione corrispondente.

---

## 5. Sicurezza e permessi

### 5.1 Autenticazione
- Registrazione pubblica **disabilitata**. Login con email e password (più magic link come opzione).
- Gli utenti si aggiungono solo per invito: in Impostazioni → Utenti l'owner inserisce un'email, una Server Action lato server chiama `auth.admin.inviteUserByEmail` con la service role key.
- Middleware Next.js che protegge tutte le rotte tranne login e callback.

### 5.2 Funzioni helper (security definer, `search_path` fissato)
- `is_owner()`: l'utente corrente è owner.
- `puo(sezione, livello default 'lettura')`: owner, oppure ha il permesso richiesto (scrittura implica lettura).
- `vede_cliente(cliente_id)`: owner, oppure il cliente è in `accessi_clienti` per l'utente.

### 5.3 Regole RLS
- **Owner**: accesso completo a tutto.
- **Collaboratore**, regole valide per **ogni** tabella:
  - vede solo righe con `ambito = 'lavoro'`: l'ambito personale gli è sempre invisibile, a livello di database;
  - vede solo se ha il permesso sulla sezione (`puo(...)`); scrive solo con livello `scrittura`;
  - dove esiste un `cliente_id`, vede solo se `vede_cliente(cliente_id)`; le task senza cliente le vede solo se assegnate a lui;
  - **budget, movimenti, debiti, categorie**: accesso solo se ha il permesso `budget` (di default non lo avrà);
  - **credenziali**: solo con il permesso `credenziali`;
  - `profili`, `permessi`, `accessi_clienti`: il collaboratore legge solo i propri, scrive solo l'owner.
- Ricorda: RLS filtra righe, non colonne. Tutto ciò che deve essere nascosto a un collaboratore che vede la riga va in una tabella separata.
- Nel frontend nascondi le voci di menu e le azioni non permesse, ma la sicurezza reale è nell'RLS.
- Scrivi dei **test SQL** (o uno script) che verificano le policy impersonando owner e collaboratore.

### 5.4 Credenziali
Le password non vanno mai salvate in chiaro. Due modalità per ogni credenziale:
1. **Link al password manager**: si salva solo l'URL dell'elemento (es. Bitwarden).
2. **Cifrata lato client**: cifratura nel browser con Web Crypto (AES-GCM, chiave derivata da una master password con PBKDF2 SHA-256 e almeno 600.000 iterazioni, salt e IV casuali). Nel database vanno solo `payload_cifrato`, `iv`, `salt`. La master password non viene mai inviata al server né salvata; la chiave derivata resta in memoria per la sessione ("cassaforte sbloccata") e si cancella al logout o dopo 15 minuti di inattività. Pulsanti "Mostra" e "Copia" attivi solo a cassaforte sbloccata. Aggiungi una verifica della master password (es. un valore di controllo cifrato) per dare errore chiaro se è sbagliata.

---

## 6. Sezioni

### 6.1 Oggi (home)
Pagina che si compone da sola, in blocchi:
- Task con `data_pianificata` oggi, task con data pianificata passata e non completate, task con scadenza superata. Spunta diretta per completarle.
- Eventi di oggi.
- Servizi in scadenza nei prossimi 14 giorni (con badge di stato).
- Rate e movimenti previsti nei prossimi 7 giorni.
- Budget del mese: speso + previsto rispetto al budget totale.
- Task "in attesa" da più di 5 giorni: da sollecitare.
Tutto rispetta lo switch di ambito. Ogni elemento si apre nel pannello laterale.

### 6.2 Clienti
- **Lista**: logo, nome breve (o ragione sociale), stato, numero servizi attivi, numero task aperte. Filtri per stato e tag, ricerca. Vista tabella e vista a card con loghi.
- **Creazione**: si parte dalla P.IVA. Una Edge Function interroga il servizio **VIES** della Commissione Europea e, se trova dati, precompila ragione sociale e indirizzo (l'utente conferma). Se VIES non risponde, il form resta compilabile a mano senza bloccare.
- **Logo**: upload nel bucket `loghi`; se assente, fallback alla favicon del sito del cliente, poi alle iniziali su sfondo con il colore del cliente.
- **Scheda cliente** (pannello largo o pagina `/clienti/[id]`) con tab:
  - *Panoramica*: tutti i dati, contatti (multipli, uno principale), link. Pulsante copia su P.IVA, codice fiscale, SDI, PEC.
  - *Servizi*: servizi collegati con costo, prezzo di rivendita e prossima scadenza.
  - *Progetti e task*.
  - *Eventi*: passati e futuri.
  - *Diario*: note datate in ordine cronologico, aggiunta rapida.

### 6.3 Servizi & Scadenze
- **Intestazione**: tre contatori cliccabili che filtrano la lista: Scaduti, Entro 7 giorni, Entro 30 giorni.
- **Lista**: ordinata per scadenza. Per riga: badge stato colorato (rosso scaduto, arancio urgente, giallo in scadenza, verde ok), nome, tipo con icona, loghi dei clienti collegati, costo e frequenza, icona rinnovo automatico, chi paga. Filtri: ambito, tipo, cliente, chi paga, stato.
- **Vista "Per mese"**: scadenze raggruppate per mese sui prossimi 12 mesi, con totale di costo per mese.
- **Creazione**: campi visibili nome, costo, frequenza, prossima scadenza, cliente/i. Il resto in "Altri dettagli". Il preavviso si precompila dal tipo di servizio.
- **Pannello del servizio**: tutti i dati; clienti collegati con prezzo di rivendita e margine; credenziali (vedi 5.4); storico rinnovi. Azioni:
  - *Apri pannello* (url_pannello in nuova scheda)
  - *Copia username*, *Mostra/Copia password*
  - *Segna come rinnovato*: chiede importo effettivo (precompilato col costo) e data; avanza `prossima_scadenza` in base alla frequenza; scrive in `servizi_rinnovi`; crea o aggiorna il movimento del periodo nel budget come `pagato`. Se `chi_paga = cliente`, non crea movimenti.
  - *Disdici*: stato `disdetto`, esce dalle scadenze attive.
  - *Crea task*: task precompilata collegata al servizio e al cliente.
  - *Avvisa cliente*: apre un'anteprima di email modificabile ("Il servizio X scade il …") e la invia via Resend al contatto principale del cliente. **Invia solo dopo conferma esplicita.**
  - *Duplica*.

### 6.4 Task
- **Viste** (tab o sottomenu):
  - *Inbox*: task senza data pianificata, senza scadenza e senza progetto.
  - *Oggi*, *Prossimi 7 giorni* (raggruppati per giorno).
  - *Progetti*: elenco progetti con barra di avanzamento (task fatte / totali) e, dentro ogni progetto, vista lista o kanban per stato con drag & drop.
  - *In attesa*: con "in attesa di" e da quanti giorni.
  - *Tutte*: tabella con filtri per ambito, cliente, progetto, priorità, stato, assegnatario.
  - *Pianifica settimana*: a sinistra Inbox e task senza data pianificata, a destra i 7 giorni della settimana; trascinando una task su un giorno si imposta `data_pianificata`.
- **Aggiunta rapida**: un campo di testo singolo con parsing in italiano:
  - date: `oggi`, `domani`, `dopodomani`, giorni della settimana (`lun`, `lunedì`, … → prossima occorrenza), `tra N giorni`, `dd/mm`;
  - `#nome` → cliente o progetto (con autocompletamento mentre scrivi);
  - `!alta` `!media` `!bassa` oppure `!1` `!2` `!3` → priorità;
  - il testo rimanente è il titolo. Mostra un'anteprima dei valori riconosciuti prima di salvare.
  Scrivi il parser come funzione pura con test unitari.
- **Pannello della task**: titolo, note, stato, priorità, data pianificata, scadenza, durata, progetto, cliente, ricorrenza, assegnatario, sottotask (aggiunta rapida e spunta), collegamento al servizio. Passando a "In attesa" chiede "in attesa di cosa" e salva la data.
- Completando una task con sottotask aperte, chiedi se completare anche quelle.

### 6.5 Calendario
- FullCalendar con viste mese, settimana, giorno, lista. Settimana da lunedì, orari 24h, locale italiano.
- Legge da `v_calendario` solo per il range visibile. Le ricorrenze (RRULE) si espandono lato client per il range visibile.
- **Filtri a pulsante**: Task, Deadline, Scadenze servizi, Eventi, Rate, Spese previste. Più lo switch di ambito globale. Stato dei filtri salvato.
- Ogni tipo ha un'icona; il colore dipende dall'ambito (con variazione di tonalità per tipo).
- Click su un elemento: apre il pannello dell'entità originale.
- Drag & drop: consentito su task (cambia `data_pianificata`) ed eventi (cambia orari). **Non** consentito su scadenze servizi, rate e movimenti (si modificano solo dalla loro scheda).
- Click su uno spazio vuoto: crea un evento o una task in quella data.
- **Feed ICS** (fase 4): una Edge Function che restituisce un file `.ics` con scadenze, task pianificate ed eventi, protetta da un token segreto nell'URL, rigenerabile dalle Impostazioni. Nelle impostazioni si sceglie cosa includere e quale ambito.

### 6.6 Budget & Spese
- **Pagina mese** (navigazione con frecce mese precedente/successivo):
  - in alto: budget totale, speso, previsto da pagare, rimanente;
  - una barra per categoria (speso pieno + previsto tratteggiato rispetto al budget), rossa se supera;
  - lista movimenti del mese; i previsti in grigio con pulsante "Segna pagato" (con importo modificabile).
  - Budget di una categoria modificabile per il singolo mese (salva in `budget_mensili`).
- **Generazione dei previsti**: funzione Postgres `genera_previsti(mese date)`, **idempotente** grazie ai vincoli univoci, che crea movimenti `previsto` per:
  - ogni servizio `attivo` con `chi_paga = io` la cui scadenza cade nel mese (per i mensili, ogni mese);
  - ogni rata di debito non pagata con scadenza nel mese.
  Eseguita da pg_cron il primo di ogni mese e richiamabile con un pulsante "Aggiorna previsti". Se un servizio viene modificato o disdetto, il previsto non ancora pagato del mese si aggiorna o si elimina.
- **Nuova spesa**: form ottimizzato per mobile: prima l'importo con tastierino numerico, poi una griglia di categorie con icone (filtrate per ambito), poi facoltativi descrizione, data (default oggi), metodo di pagamento, foto ricevuta.
- **Debiti** (tab dedicata): elenco con creditore, residuo, prossima rata, barra di avanzamento. Creazione: se rateale, dati numero rate, importo e giorno di scadenza, si genera il piano rate (modificabile). Grafico del residuo nel tempo. Pagare una rata crea il movimento collegato.
- **Report** (tab dedicata, con filtro periodo e ambito):
  - torta per categoria del periodo;
  - barre impilate ultimi 12 mesi, lavoro vs personale;
  - spese fisse (da servizi e rate) vs variabili;
  - costo annuo degli abbonamenti attivi (tutti i servizi normalizzati su 12 mesi), con elenco ordinato per costo;
  - margine sui servizi rivenduti: somma prezzi di rivendita meno costi, per cliente.
- Nessun campo fiscale (deducibilità, IVA): in regime forfettario non servono.

### 6.7 Impostazioni
- **Categorie**: albero a due livelli, drag & drop per ordinare, colore, icona, ambito, budget di default, archiviazione.
- **Tipi di servizio**: nome, icona, preavviso di default.
- **Notifiche**: email per il riepilogo, orario, giorni di anticipo, attiva/disattiva.
- **Calendario esterno**: URL del feed ICS, rigenerazione token, cosa includere.
- **Utenti** (solo owner): invito via email, elenco utenti, per ogni collaboratore: permessi per sezione (nessuno / lettura / scrittura), permesso credenziali, clienti accessibili. Revoca accesso.
- **Profilo**: nome, cambio password, gestione master password della cassaforte.

---

## 7. Automazioni ed Edge Functions

- **digest-scadenze**: ogni mattina (pg_cron + pg_net) invia via Resend un'email riepilogativa all'owner con servizi scaduti e in scadenza entro il preavviso, task in ritardo e rate in arrivo. Ogni elemento ha un link che apre il pannello corrispondente (`?apri=...`). Non inviare email vuote.
- **genera-previsti**: il primo di ogni mese esegue `genera_previsti` per il mese corrente e il successivo.
- **vies-lookup**: riceve una P.IVA e un codice paese, interroga VIES, restituisce i dati normalizzati. Gestisce timeout ed errori senza bloccare il form.
- **calendario-ics**: restituisce il feed ICS autenticato tramite token.
- **invia-email-cliente**: invia l'avviso di scadenza al cliente, solo su azione esplicita dell'utente.
- **invita-utente**: in alternativa alla Server Action, se preferisci tenerlo lato Edge.

Secret delle Edge Functions (Resend API key, service role) impostati con `supabase secrets set`, mai nel repository.

---

## 8. Struttura del progetto (indicativa)

```
app/
  (auth)/login, auth/callback
  (app)/layout.tsx          sidebar, header, switch ambito, ⌘K, +, EntityDrawer
  (app)/oggi
  (app)/task
  (app)/calendario
  (app)/clienti, clienti/[id]
  (app)/servizi
  (app)/budget
  (app)/impostazioni
components/
  ui/                       shadcn
  drawer/                   EntityDrawer + contenuti per tipo
  forms/                    form per entità
lib/
  supabase/                 client browser, server, middleware
  actions/                  server actions per dominio
  schemas/                  zod
  parsing/                  parser aggiunta rapida task (+ test)
  crypto/                   cifratura credenziali (+ test)
  dates/                    utility date e ricorrenze
supabase/
  migrations/
  functions/
  seed.sql
```

README con: setup locale, variabili d'ambiente, come applicare le migration, come impostare l'owner, come fare il deploy, come configurare pg_cron e i secret.

---

## 9. Fasi di sviluppo

Ogni fase si chiude solo quando i criteri di accettazione sono verificati. A fine fase: riepilogo, istruzioni di test, configurazioni manuali necessarie.

### Fase 1 — Fondamenta
- Setup Next.js, Tailwind, shadcn/ui, Supabase SSR, struttura cartelle, README, variabili d'ambiente di esempio (`.env.example`).
- Migration: `profili`, `permessi`, `accessi_clienti`, trigger profilo, funzioni helper, tutte le tabelle del modello dati (anche quelle delle fasi successive, così RLS e relazioni sono pensate insieme) con **RLS e policy complete**. Seed tipi di servizio e categorie.
- Test delle policy (owner vs collaboratore).
- Login, middleware, logout.
- Layout: sidebar, header con switch ambito (cookie), pulsante +, ⌘K (inizialmente con sola navigazione), `EntityDrawer` con routing `?apri=`.
- Tema chiaro/scuro, token colore per gli ambiti.
- Deploy su Vercel funzionante.
**Criteri**: login funziona in produzione; un utente collaboratore di test non legge nessuna riga senza permessi; lo switch di ambito persiste tra le pagine.

### Fase 2 — Clienti e Servizi & Scadenze
- Clienti completi (lista, creazione con VIES, logo, scheda con tab, contatti, link, diario).
- Servizi completi (contatori, lista, vista per mese, creazione, pannello, azioni, collegamento a più clienti, storico rinnovi).
- Credenziali con entrambe le modalità (5.4).
- Edge Function e cron del digest email.
**Criteri**: inserisco un servizio in meno di 20 secondi; "Segna come rinnovato" aggiorna la scadenza correttamente per ogni frequenza; la password cifrata non è leggibile dal dashboard Supabase; ricevo l'email del mattino.

### Fase 3 — Task, progetti e Oggi
- Progetti, task, sottotask, stati, "in attesa", ricorrenze.
- Tutte le viste, incluso Pianifica settimana e kanban.
- Aggiunta rapida con parser e test.
- Pagina Oggi completa (con i blocchi di budget e rate che mostrano dati reali o si nascondono se la fase 5 non è ancora pronta).
- ⌘K esteso alla ricerca delle entità.
**Criteri**: "Chiamare fornitore domani #onis !alta" crea la task corretta; completando una ricorrente appare la successiva; la pagina Oggi mostra correttamente i ritardi.

### Fase 4 — Calendario
- `v_calendario`, FullCalendar con viste, filtri, colori, drag & drop consentito solo dove previsto, creazione da slot vuoto, apertura pannelli.
- Tabella eventi con ricorrenze.
- Feed ICS con token.
**Criteri**: sposto una task nel calendario e la data si aggiorna ovunque; non riesco a trascinare una scadenza di servizio; il feed ICS si sottoscrive da Google Calendar e Apple Calendar.

### Fase 5 — Budget & Spese
- Categorie in Impostazioni, budget mensili, movimenti, generazione previsti idempotente con cron, debiti e rate, form mobile, report.
- Collegamento con "Segna come rinnovato" e con il pagamento delle rate.
**Criteri**: eseguendo più volte "Aggiorna previsti" non si creano duplicati; rinnovare un servizio aggiorna il previsto del mese invece di aggiungerne un altro; i report coincidono con i totali della lista.

### Fase 6 — Collaboratori e rifiniture
- Gestione utenti e invito, UI permessi per sezione e per cliente, menu e azioni condizionati ai permessi.
- PWA installabile, ottimizzazione mobile di tutte le pagine.
- Stati vuoti, loading skeleton, gestione errori uniforme.
**Criteri**: invito un collaboratore con accesso solo a Task e a un cliente: entra, vede solo quello, non vede nulla dell'ambito personale né il budget.

### Fase 7 (futura, non iniziare senza richiesta)
- Import CSV estratto conto con regole di categorizzazione automatica.
- Notifiche Telegram.
- Sincronizzazione bidirezionale con Google Calendar.
