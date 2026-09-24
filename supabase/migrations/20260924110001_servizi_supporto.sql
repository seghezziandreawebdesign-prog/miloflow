-- Supporto a Servizi & Scadenze: rinnovo atomico, cassaforte delle credenziali
-- e impostazioni del riepilogo email.

-- ---------------------------------------------------------------------------
-- Rinnovo
-- ---------------------------------------------------------------------------

-- Mesi di ogni frequenza. null = una tantum (non si rinnova).
create function public.mesi_frequenza(p_frequenza public.frequenza_servizio)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_frequenza
    when 'mensile' then 1
    when 'trimestrale' then 3
    when 'semestrale' then 6
    when 'annuale' then 12
    when 'biennale' then 24
    else null
  end;
$$;

-- Avanza una scadenza di un periodo. Postgres rispetta la fine mese:
-- 31/01 + 1 mese = 28/02 (29 negli anni bisestili).
create function public.scadenza_successiva(p_data date, p_frequenza public.frequenza_servizio)
returns date
language sql
immutable
set search_path = ''
as $$
  select (p_data + make_interval(months => public.mesi_frequenza(p_frequenza)))::date;
$$;

-- Segna un servizio come rinnovato: avanza la scadenza e scrive lo storico.
-- Security invoker: servono i permessi di scrittura sul servizio. Lo storico
-- (che contiene l'importo) si scrive solo con il permesso budget.
-- Il movimento nel budget si aggancia in fase 5.
create function public.rinnova_servizio(p_servizio_id uuid, p_data date, p_importo numeric)
returns date
language plpgsql
set search_path = ''
as $$
declare
  v_servizio record;
  v_nuova date;
begin
  select id, frequenza, prossima_scadenza into v_servizio
  from public.servizi where id = p_servizio_id
  for update;
  if v_servizio.id is null then
    raise exception 'Servizio non trovato';
  end if;
  if v_servizio.frequenza = 'una_tantum' then
    raise exception 'Un servizio una tantum non si rinnova';
  end if;
  if p_importo is not null and p_importo < 0 then
    raise exception 'Importo non valido';
  end if;

  v_nuova := public.scadenza_successiva(v_servizio.prossima_scadenza, v_servizio.frequenza);

  update public.servizi set prossima_scadenza = v_nuova, stato = 'attivo' where id = p_servizio_id;
  if not found then
    raise exception 'Non hai i permessi per rinnovare questo servizio';
  end if;

  if public.puo('budget', 'scrittura') then
    insert into public.servizi_rinnovi (servizio_id, data, importo)
    values (p_servizio_id, coalesce(p_data, public.oggi()), p_importo);
  end if;

  return v_nuova;
end;
$$;

revoke execute on function public.rinnova_servizio(uuid, date, numeric) from public, anon;
grant execute on function public.rinnova_servizio(uuid, date, numeric) to authenticated;
grant execute on function public.mesi_frequenza(public.frequenza_servizio) to authenticated;
grant execute on function public.scadenza_successiva(date, public.frequenza_servizio) to authenticated;

-- ---------------------------------------------------------------------------
-- Cassaforte: una sola master password per tutta l'app.
-- Qui ci sono solo i parametri di derivazione e un valore di controllo cifrato
-- (per dire "password errata"). La master password non arriva mai al server.
-- ---------------------------------------------------------------------------

create table public.cassaforte (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  salt text not null,
  iterazioni integer not null check (iterazioni >= 600000),
  iv text not null,
  verifica_cifrata text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
alter table public.cassaforte enable row level security;
create trigger cassaforte_updated_at before update on public.cassaforte
  for each row execute function public.set_updated_at();

create policy cassaforte_select on public.cassaforte for select to authenticated
  using (public.puo('credenziali'));
create policy cassaforte_insert on public.cassaforte for insert to authenticated
  with check (public.is_owner());
create policy cassaforte_update on public.cassaforte for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy cassaforte_delete on public.cassaforte for delete to authenticated
  using (public.is_owner());

-- ---------------------------------------------------------------------------
-- Impostazioni del riepilogo email (solo owner).
-- ---------------------------------------------------------------------------

create table public.impostazioni_notifiche (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  email text,
  orario time not null default '07:30',
  giorni_anticipo integer not null default 7 check (giorni_anticipo between 0 and 60),
  attivo boolean not null default false,
  ultimo_invio date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
alter table public.impostazioni_notifiche enable row level security;
create trigger impostazioni_notifiche_updated_at before update on public.impostazioni_notifiche
  for each row execute function public.set_updated_at();

create policy impostazioni_notifiche_select on public.impostazioni_notifiche for select to authenticated
  using (public.is_owner());
create policy impostazioni_notifiche_insert on public.impostazioni_notifiche for insert to authenticated
  with check (public.is_owner());
create policy impostazioni_notifiche_update on public.impostazioni_notifiche for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy impostazioni_notifiche_delete on public.impostazioni_notifiche for delete to authenticated
  using (public.is_owner());

insert into public.impostazioni_notifiche (created_by) values (null);

revoke all on public.cassaforte, public.impostazioni_notifiche from anon;
grant select, insert, update, delete on public.cassaforte, public.impostazioni_notifiche to authenticated;

-- ---------------------------------------------------------------------------
-- Cron del riepilogo: ogni 15 minuti chiama la Edge Function, che decide se è
-- l'ora giusta (orario in Europe/Rome, una sola email al giorno).
-- URL e segreto stanno nel Vault di Supabase, non nel repository:
--   select vault.create_secret('<url funzione>', 'digest_url');
--   select vault.create_secret('<segreto>', 'digest_secret');
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'digest-scadenze',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'digest_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'digest_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'digest_url');
  $$
);
