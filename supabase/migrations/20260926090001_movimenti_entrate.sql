-- Entrate nel budget: un movimento ha un tipo (spesa o entrata). Le entrate
-- non toccano budget, barre e report delle spese: contano nel "Guadagnato"
-- del mese. I previsti generati da servizi, rate e piani restano spese.

create type public.tipo_movimento as enum ('spesa', 'entrata');

alter table public.movimenti
  add column tipo public.tipo_movimento not null default 'spesa';

-- v_movimenti usa m.*: la colonna nuova finirebbe in mezzo, quindi si ricrea.
drop view public.v_movimenti;
create view public.v_movimenti
with (security_invoker = true)
as
select
  m.*,
  c.nome as categoria_nome,
  c.colore as categoria_colore,
  c.icona as categoria_icona,
  c.parent_id as categoria_parent_id,
  cp.nome as categoria_padre_nome,
  mp.nome as metodo_nome,
  mp.tipo as metodo_tipo,
  mp.ultime_cifre as metodo_cifre,
  s.nome as servizio_nome,
  d.id as debito_id,
  d.creditore as debito_creditore,
  r.numero as rata_numero,
  sv.nome as salvadanaio_nome,
  sv.tipo as salvadanaio_tipo
from public.movimenti m
left join public.categorie c on c.id = m.categoria_id
left join public.categorie cp on cp.id = c.parent_id
left join public.metodi_pagamento mp on mp.id = m.metodo_pagamento_id
left join public.servizi s on s.id = m.servizio_id
left join public.debiti_rate r on r.id = m.rata_id
left join public.debiti d on d.id = r.debito_id
left join public.salvadanai sv on sv.id = m.salvadanaio_id;

grant select on public.v_movimenti to authenticated;
revoke all on public.v_movimenti from anon;

-- Nel calendario le "spese previste" restano solo spese: le entrate previste
-- non c'entrano con quella voce.
-- v_calendario: i servizi senza scadenza non compaiono nel calendario.
create or replace view public.v_calendario
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
  null::text as ricorrenza,
  null::text as colore_sfondo
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
  null,
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
  null,
  null
from public.servizi s
where s.stato = 'attivo' and s.prossima_scadenza is not null

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
  e.ricorrenza,
  e.colore
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
  null,
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
  null,
  null
from public.movimenti m
where m.stato = 'previsto' and m.rata_id is null and m.servizio_id is null
  and m.tipo = 'spesa';
