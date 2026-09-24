-- Vista unica per il calendario. Security invoker: ogni ramo rispetta le policy
-- della tabella da cui legge, quindi un collaboratore vede solo ciò che può vedere.
-- Gli elementi a giornata intera partono alla mezzanotte di Europe/Rome.
-- ricorrenza è valorizzata solo per gli eventi: l'espansione avviene nel client.

create view public.v_calendario
with (security_invoker = true)
as
select
  t.id,
  'task'::text as tipo,
  t.titolo,
  (t.data_pianificata::timestamp at time zone 'Europe/Rome') as inizio,
  null::timestamptz as fine,
  true as tutto_il_giorno,
  t.ambito,
  t.cliente_id,
  true as modificabile,
  null::text as ricorrenza
from public.task t
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
  false,
  null
from public.task t
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
  true,
  e.ricorrenza
from public.eventi e

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
  false,
  null
from public.movimenti m
where m.stato = 'previsto';
