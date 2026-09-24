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

## Da completare nelle fasi successive

- Token del feed ICS (fase 4), collegamento dei rinnovi al budget (fase 5), gestione di categorie, tipi di servizio e utenti (fasi 5 e 6).

## Struttura

```
app/(auth)/login        login con password o magic link
app/auth/callback       rientro dai link via email
app/(app)/...           sezioni dell'app (layout con sidebar, header, ⌘K, pannello laterale)
components/ui           componenti shadcn
components/layout       sidebar, header, switch ambito, menu +, palette ⌘K
components/drawer       EntityDrawer: pannello laterale aperto da ?apri=<tipo>:<id>
lib/supabase            client browser, server, admin e proxy di sessione
lib/actions             Server Actions
lib/schemas             schemi zod
supabase/migrations     schema, policy e seed
supabase/tests          test delle policy
```
