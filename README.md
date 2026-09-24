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

## Da completare nelle fasi successive

- Cron (`pg_cron` + `pg_net`) e secret delle Edge Functions (`supabase secrets set ...`) nella fase 2, con il digest email.
- Tabelle di impostazioni per notifiche, token del feed ICS e verifica della master password della cassaforte. Si aggiungono nelle fasi che le usano.

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
