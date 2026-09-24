-- Servizi senza scadenza: accessi, email, account che non si rinnovano.
-- La scadenza diventa facoltativa; un servizio senza scadenza non entra nei
-- contatori, nella vista per mese, nel calendario, nei previsti né nel digest.

alter table public.servizi alter column prossima_scadenza drop not null;

-- Nuovo tipo per gli accessi (modificabile dalle Impostazioni come gli altri).
insert into public.tipi_servizio (nome, icona, preavviso_default, created_by)
values ('Accesso', 'key-round', 30, null)
on conflict (nome) do nothing;

-- v_servizi: senza scadenza i giorni sono null e lo stato è 'senza_scadenza'.
create or replace view public.v_servizi
with (security_invoker = true)
as
select
  s.*,
  e.costo,
  e.valuta,
  e.metodo_pagamento_id,
  m.nome as metodo_pagamento_nome,
  m.tipo as metodo_pagamento_tipo,
  m.ultime_cifre as metodo_pagamento_cifre,
  e.categoria_spesa_id,
  t.nome as tipo_nome,
  t.icona as tipo_icona,
  coalesce(s.preavviso_giorni, t.preavviso_default, 30) as preavviso_effettivo,
  s.prossima_scadenza - public.oggi() as giorni_alla_scadenza,
  case
    when s.prossima_scadenza is null then 'senza_scadenza'
    when s.prossima_scadenza - public.oggi() < 0 then 'scaduto'
    when s.prossima_scadenza - public.oggi() <= 7 then 'urgente'
    when s.prossima_scadenza - public.oggi() <= coalesce(s.preavviso_giorni, t.preavviso_default, 30)
      then 'in_scadenza'
    else 'ok'
  end as stato_scadenza
from public.servizi s
left join public.servizi_economico e on e.servizio_id = s.id
left join public.metodi_pagamento m on m.id = e.metodo_pagamento_id
left join public.tipi_servizio t on t.id = s.tipo_id;

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
where m.stato = 'previsto' and m.rata_id is null and m.servizio_id is null;

-- salva_servizio: la scadenza vuota diventa null.
create or replace function public.salva_servizio(
  p_id uuid,
  p_servizio jsonb,
  p_economico jsonb,
  p_clienti jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_budget boolean := public.puo('budget', 'scrittura');
  v_clienti uuid[];
  c jsonb;
begin
  if p_id is null then
    insert into public.servizi (
      id, ambito, nome, tipo_id, fornitore, frequenza, prossima_scadenza, rinnovo_automatico,
      chi_paga, preavviso_giorni, url_pannello, username, stato, note
    ) values (
      v_id,
      (p_servizio ->> 'ambito')::public.ambito,
      p_servizio ->> 'nome',
      nullif(p_servizio ->> 'tipo_id', '')::uuid,
      nullif(p_servizio ->> 'fornitore', ''),
      (p_servizio ->> 'frequenza')::public.frequenza_servizio,
      nullif(p_servizio ->> 'prossima_scadenza', '')::date,
      coalesce((p_servizio ->> 'rinnovo_automatico')::boolean, false),
      (p_servizio ->> 'chi_paga')::public.chi_paga,
      nullif(p_servizio ->> 'preavviso_giorni', '')::integer,
      nullif(p_servizio ->> 'url_pannello', ''),
      nullif(p_servizio ->> 'username', ''),
      coalesce(nullif(p_servizio ->> 'stato', ''), 'attivo')::public.stato_servizio,
      nullif(p_servizio ->> 'note', '')
    );
  else
    update public.servizi set
      ambito = (p_servizio ->> 'ambito')::public.ambito,
      nome = p_servizio ->> 'nome',
      tipo_id = nullif(p_servizio ->> 'tipo_id', '')::uuid,
      fornitore = nullif(p_servizio ->> 'fornitore', ''),
      frequenza = (p_servizio ->> 'frequenza')::public.frequenza_servizio,
      prossima_scadenza = nullif(p_servizio ->> 'prossima_scadenza', '')::date,
      rinnovo_automatico = coalesce((p_servizio ->> 'rinnovo_automatico')::boolean, false),
      chi_paga = (p_servizio ->> 'chi_paga')::public.chi_paga,
      preavviso_giorni = nullif(p_servizio ->> 'preavviso_giorni', '')::integer,
      url_pannello = nullif(p_servizio ->> 'url_pannello', ''),
      username = nullif(p_servizio ->> 'username', ''),
      stato = coalesce(nullif(p_servizio ->> 'stato', ''), 'attivo')::public.stato_servizio,
      note = nullif(p_servizio ->> 'note', '')
    where id = v_id;
    if not found then
      raise exception 'Servizio non trovato o permessi insufficienti' using errcode = '42501';
    end if;
  end if;

  if p_economico is not null and v_budget then
    insert into public.servizi_economico (servizio_id, costo, valuta, metodo_pagamento_id, categoria_spesa_id)
    values (
      v_id,
      nullif(p_economico ->> 'costo', '')::numeric,
      coalesce(nullif(p_economico ->> 'valuta', ''), 'EUR'),
      -- Il metodo ha senso solo se paghi tu.
      case when (p_servizio ->> 'chi_paga') = 'io' then nullif(p_economico ->> 'metodo_pagamento_id', '')::uuid end,
      nullif(p_economico ->> 'categoria_spesa_id', '')::uuid
    )
    on conflict (servizio_id) do update set
      costo = excluded.costo,
      valuta = excluded.valuta,
      metodo_pagamento_id = excluded.metodo_pagamento_id,
      categoria_spesa_id = excluded.categoria_spesa_id;
  end if;

  if p_clienti is not null then
    select coalesce(array_agg((x ->> 'cliente_id')::uuid), '{}')
    into v_clienti
    from jsonb_array_elements(p_clienti) x;

    delete from public.servizi_clienti
    where servizio_id = v_id and not (cliente_id = any (v_clienti));

    for c in select * from jsonb_array_elements(p_clienti) loop
      insert into public.servizi_clienti (servizio_id, cliente_id)
      values (v_id, (c ->> 'cliente_id')::uuid)
      on conflict do nothing;

      if v_budget then
        if nullif(c ->> 'prezzo_rivendita', '') is null then
          delete from public.servizi_clienti_economico
          where servizio_id = v_id and cliente_id = (c ->> 'cliente_id')::uuid;
        else
          insert into public.servizi_clienti_economico (servizio_id, cliente_id, prezzo_rivendita)
          values (v_id, (c ->> 'cliente_id')::uuid, (c ->> 'prezzo_rivendita')::numeric)
          on conflict (servizio_id, cliente_id) do update set prezzo_rivendita = excluded.prezzo_rivendita;
        end if;
      end if;
    end loop;
  end if;

  return v_id;
end;
$$;

-- rinnova_servizio: senza scadenza non c'è nulla da rinnovare.
create or replace function public.rinnova_servizio(p_servizio_id uuid, p_data date, p_importo numeric)
returns date
language plpgsql
set search_path = ''
as $$
declare
  v_servizio record;
  v_nuova date;
  v_periodo date;
  v_movimento uuid;
begin
  select s.id, s.ambito, s.nome, s.frequenza, s.prossima_scadenza, s.chi_paga,
         e.costo, e.categoria_spesa_id, e.metodo_pagamento_id
  into v_servizio
  from public.servizi s
  left join public.servizi_economico e on e.servizio_id = s.id
  where s.id = p_servizio_id
  for update of s;
  if v_servizio.id is null then
    raise exception 'Servizio non trovato';
  end if;
  if v_servizio.prossima_scadenza is null then
    raise exception 'Un servizio senza scadenza non si rinnova';
  end if;
  if v_servizio.frequenza = 'una_tantum' then
    raise exception 'Un servizio una tantum non si rinnova';
  end if;
  if p_importo is not null and p_importo < 0 then
    raise exception 'Importo non valido';
  end if;

  v_nuova := public.scadenza_successiva(v_servizio.prossima_scadenza, v_servizio.frequenza);

  if public.puo('budget', 'scrittura') then
    if v_servizio.chi_paga = 'io' then
      v_periodo := public.primo_del_mese(v_servizio.prossima_scadenza);
      insert into public.movimenti (ambito, data, importo, descrizione, categoria_id, stato, servizio_id, periodo, metodo_pagamento_id)
      values (v_servizio.ambito, coalesce(p_data, public.oggi()), coalesce(p_importo, v_servizio.costo, 0), v_servizio.nome,
              v_servizio.categoria_spesa_id, 'pagato', v_servizio.id, v_periodo, v_servizio.metodo_pagamento_id)
      on conflict (servizio_id, periodo) do update set
        importo = case when public.movimenti.stato = 'pagato' then public.movimenti.importo + excluded.importo else excluded.importo end,
        stato = 'pagato',
        data = excluded.data,
        metodo_pagamento_id = coalesce(public.movimenti.metodo_pagamento_id, excluded.metodo_pagamento_id)
      returning id into v_movimento;
    end if;
    insert into public.servizi_rinnovi (servizio_id, data, importo, movimento_id)
    values (p_servizio_id, coalesce(p_data, public.oggi()), p_importo, v_movimento);
  end if;

  update public.servizi set prossima_scadenza = v_nuova, stato = 'attivo' where id = p_servizio_id;
  if not found then
    raise exception 'Non hai i permessi per rinnovare questo servizio';
  end if;

  return v_nuova;
end;
$$;

-- sincronizza_previsti_servizio: quando la scadenza sparisce (il periodo
-- diventa null), il vecchio previsto va comunque eliminato.
create or replace function public.sincronizza_previsti_servizio(p_servizio_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  v_periodo date;
  v_valido boolean;
begin
  select sv.id, sv.ambito, sv.nome, sv.stato, sv.chi_paga, sv.prossima_scadenza,
         e.costo, e.categoria_spesa_id, e.metodo_pagamento_id
  into s
  from public.servizi sv
  left join public.servizi_economico e on e.servizio_id = sv.id
  where sv.id = p_servizio_id;

  if s.id is null then
    delete from public.movimenti where stato = 'previsto' and servizio_id = p_servizio_id;
    return;
  end if;

  v_periodo := public.primo_del_mese(s.prossima_scadenza);
  v_valido := s.stato = 'attivo' and s.chi_paga = 'io' and s.prossima_scadenza is not null;

  delete from public.movimenti
  where stato = 'previsto' and servizio_id = p_servizio_id
    and (not v_valido or periodo is distinct from v_periodo);

  if v_valido and public.mese_nell_orizzonte(v_periodo) then
    insert into public.movimenti (ambito, data, importo, descrizione, categoria_id, stato, servizio_id, periodo, metodo_pagamento_id)
    values (s.ambito, s.prossima_scadenza, coalesce(s.costo, 0), s.nome, s.categoria_spesa_id, 'previsto', s.id, v_periodo, s.metodo_pagamento_id)
    on conflict (servizio_id, periodo) do update set
      ambito = excluded.ambito,
      data = excluded.data,
      importo = excluded.importo,
      descrizione = excluded.descrizione,
      categoria_id = excluded.categoria_id,
      metodo_pagamento_id = excluded.metodo_pagamento_id
    where public.movimenti.stato = 'previsto';
  end if;
end;
$$;
