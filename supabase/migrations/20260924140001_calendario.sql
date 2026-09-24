-- Calendario (fase 4): orario delle task, coerenza degli eventi, preferenze
-- del calendario per utente e vista v_calendario arricchita.

-- Orario di inizio facoltativo: senza, la task sta nella riga "tutto il giorno".
alter table public.task add column ora_inizio time;

-- Regole di coerenza dell'evento, come per le task:
-- - l'evento di un progetto ne eredita l'ambito, e il cliente se il progetto ne ha uno;
-- - un evento con cliente è sempre di lavoro;
-- - un evento a giornata intera non ha orari (parte a mezzanotte di Roma).
create function public.eventi_coerenza()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  progetto record;
begin
  if new.progetto_id is not null then
    select ambito, cliente_id into progetto from public.progetti where id = new.progetto_id;
    new.ambito := progetto.ambito;
    if progetto.cliente_id is not null then
      new.cliente_id := progetto.cliente_id;
    end if;
  end if;
  if new.cliente_id is not null then
    new.ambito := 'lavoro';
  end if;
  if new.tutto_il_giorno then
    new.inizio := date_trunc('day', new.inizio at time zone 'Europe/Rome') at time zone 'Europe/Rome';
    if new.fine is not null then
      new.fine := date_trunc('day', new.fine at time zone 'Europe/Rome') at time zone 'Europe/Rome';
    end if;
  end if;
  return new;
end;
$$;
create trigger eventi_coerenza before insert or update on public.eventi
  for each row execute function public.eventi_coerenza();

-- Preferenze del calendario, una riga per utente.
create table public.impostazioni_calendario (
  user_id uuid primary key default auth.uid() references public.profili (id) on delete cascade,
  intervallo_minuti integer not null default 30 check (intervallo_minuti in (15, 30, 60)),
  ora_inizio time not null default '07:00',
  ora_fine time not null default '21:00',
  vista_default text not null default 'settimana'
    check (vista_default in ('giorno', 'settimana', 'mese', 'lista')),
  -- Feed ICS: token segreto nell'URL, cosa includere e per quale ambito (null = tutto).
  token_ics text unique,
  ics_include text[] not null default '{task,deadline,scadenza_servizio,evento}',
  ics_ambito public.ambito,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ora_fine > ora_inizio)
);
alter table public.impostazioni_calendario enable row level security;
create trigger impostazioni_calendario_updated_at before update on public.impostazioni_calendario
  for each row execute function public.set_updated_at();

-- Ognuno vede e modifica solo la propria riga.
create policy impostazioni_calendario_select on public.impostazioni_calendario for select to authenticated
  using (user_id = auth.uid());
create policy impostazioni_calendario_insert on public.impostazioni_calendario for insert to authenticated
  with check (user_id = auth.uid());
create policy impostazioni_calendario_update on public.impostazioni_calendario for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy impostazioni_calendario_delete on public.impostazioni_calendario for delete to authenticated
  using (user_id = auth.uid());

-- Le proprie preferenze, create con i default alla prima richiesta.
create function public.mie_impostazioni_calendario()
returns setof public.impostazioni_calendario
language sql
security invoker
set search_path = ''
as $$
  insert into public.impostazioni_calendario (user_id) values (auth.uid())
  on conflict (user_id) do nothing;
  select * from public.impostazioni_calendario where user_id = auth.uid();
$$;

-- Nuovo token del feed ICS (il vecchio URL smette di funzionare).
create function public.rigenera_token_ics()
returns text
language sql
security invoker
set search_path = ''
as $$
  insert into public.impostazioni_calendario (user_id) values (auth.uid())
  on conflict (user_id) do nothing;
  update public.impostazioni_calendario
  set token_ics = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
  where user_id = auth.uid()
  returning token_ics;
$$;

grant execute on function public.mie_impostazioni_calendario(), public.rigenera_token_ics() to authenticated;

-- Vista del calendario: aggiunge orario e durata delle task, progetto e colore.
-- Security invoker: ogni ramo rispetta le policy della tabella da cui legge.
drop view public.v_calendario;

create view public.v_calendario
with (security_invoker = true)
as
select
  t.id,
  'task'::text as tipo,
  t.titolo,
  case
    when t.ora_inizio is null then (t.data_pianificata::timestamp at time zone 'Europe/Rome')
    else ((t.data_pianificata + t.ora_inizio)::timestamp at time zone 'Europe/Rome')
  end as inizio,
  case
    when t.ora_inizio is null then null::timestamptz
    else ((t.data_pianificata + t.ora_inizio)::timestamp at time zone 'Europe/Rome')
      + make_interval(mins => coalesce(t.durata_min, 60))
  end as fine,
  (t.ora_inizio is null) as tutto_il_giorno,
  t.ambito,
  t.cliente_id,
  t.progetto_id,
  p.colore,
  true as modificabile,
  null::text as ricorrenza
from public.task t
left join public.progetti p on p.id = t.progetto_id
where t.stato <> 'fatto' and t.data_pianificata is not null

union all

select
  t.id,
  'deadline',
  t.titolo,
  (t.scadenza::timestamp at time zone 'Europe/Rome'),
  null,
  true,
  t.ambito,
  t.cliente_id,
  t.progetto_id,
  p.colore,
  false,
  null
from public.task t
left join public.progetti p on p.id = t.progetto_id
where t.stato <> 'fatto' and t.scadenza is not null

union all

select
  s.id,
  'scadenza_servizio',
  s.nome,
  (s.prossima_scadenza::timestamp at time zone 'Europe/Rome'),
  null,
  true,
  s.ambito,
  null, -- un servizio può avere più clienti
  null,
  null,
  false,
  null
from public.servizi s
where s.stato = 'attivo'

union all

select
  e.id,
  'evento',
  e.titolo,
  e.inizio,
  e.fine,
  e.tutto_il_giorno,
  e.ambito,
  e.cliente_id,
  e.progetto_id,
  p.colore,
  true,
  e.ricorrenza
from public.eventi e
left join public.progetti p on p.id = e.progetto_id

union all

select
  r.id,
  'rata',
  d.creditore || ' — rata ' || r.numero,
  (r.scadenza::timestamp at time zone 'Europe/Rome'),
  null,
  true,
  d.ambito,
  null,
  null,
  null,
  false,
  null
from public.debiti_rate r
join public.debiti d on d.id = r.debito_id
where not r.pagata

union all

select
  m.id,
  'movimento',
  coalesce(m.descrizione, 'Spesa prevista'),
  (m.data::timestamp at time zone 'Europe/Rome'),
  null,
  true,
  m.ambito,
  null,
  null,
  null,
  false,
  null
from public.movimenti m
where m.stato = 'previsto';
