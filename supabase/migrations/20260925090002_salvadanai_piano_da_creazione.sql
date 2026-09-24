-- Piani mensili dei salvadanai: nessun previsto con data precedente alla
-- creazione del salvadanaio (un piano creato il 24 con giorno 5 parte dal
-- mese successivo, non con un versamento "in ritardo").

create or replace function public.genera_previsti(p_mese date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mese date := public.primo_del_mese(p_mese);
  v_fine date := (v_mese + interval '1 month')::date;
  v_totale integer := 0;
  v_righe integer;
begin
  if auth.uid() is not null and not public.is_owner() then
    raise exception 'Solo il proprietario può generare i previsti' using errcode = '42501';
  end if;

  -- Servizi attivi pagati da me con la scadenza nel mese.
  insert into public.movimenti (ambito, data, importo, descrizione, categoria_id, stato, servizio_id, periodo, metodo_pagamento_id)
  select s.ambito, s.prossima_scadenza, coalesce(e.costo, 0), s.nome, e.categoria_spesa_id, 'previsto', s.id, v_mese, e.metodo_pagamento_id
  from public.servizi s
  left join public.servizi_economico e on e.servizio_id = s.id
  where s.stato = 'attivo' and s.chi_paga = 'io'
    and s.prossima_scadenza >= v_mese and s.prossima_scadenza < v_fine
  on conflict (servizio_id, periodo) do update set
    ambito = excluded.ambito,
    data = excluded.data,
    importo = excluded.importo,
    descrizione = excluded.descrizione,
    categoria_id = excluded.categoria_id,
    metodo_pagamento_id = excluded.metodo_pagamento_id
  where public.movimenti.stato = 'previsto';
  get diagnostics v_righe = row_count;
  v_totale := v_totale + v_righe;

  -- Previsti del mese che non hanno più un servizio valido.
  delete from public.movimenti m
  where m.stato = 'previsto' and m.periodo = v_mese and m.servizio_id is not null
    and not exists (
      select 1 from public.servizi s
      where s.id = m.servizio_id and s.stato = 'attivo' and s.chi_paga = 'io'
        and s.prossima_scadenza >= v_mese and s.prossima_scadenza < v_fine
    );

  -- Rate non pagate con scadenza nel mese.
  insert into public.movimenti (ambito, data, importo, descrizione, categoria_id, stato, rata_id, periodo)
  select d.ambito, r.scadenza, r.importo, d.creditore || ' · rata ' || r.numero, d.categoria_id, 'previsto', r.id, v_mese
  from public.debiti_rate r
  join public.debiti d on d.id = r.debito_id
  where not r.pagata and r.scadenza >= v_mese and r.scadenza < v_fine
  on conflict (rata_id) do update set
    ambito = excluded.ambito,
    data = excluded.data,
    importo = excluded.importo,
    descrizione = excluded.descrizione,
    categoria_id = excluded.categoria_id,
    periodo = excluded.periodo
  where public.movimenti.stato = 'previsto';
  get diagnostics v_righe = row_count;
  v_totale := v_totale + v_righe;

  delete from public.movimenti m
  where m.stato = 'previsto' and m.periodo = v_mese and m.rata_id is not null
    and not exists (
      select 1 from public.debiti_rate r
      where r.id = m.rata_id and not r.pagata and r.scadenza >= v_mese and r.scadenza < v_fine
    );

  -- Piani mensili di risparmi e investimenti.
  insert into public.movimenti (ambito, data, importo, descrizione, categoria_id, stato, salvadanaio_id, periodo, metodo_pagamento_id)
  select s.ambito, v_mese + (s.giorno_mensile - 1), s.importo_mensile, s.nome, s.categoria_id, 'previsto', s.id, v_mese, s.metodo_pagamento_id
  from public.salvadanai s
  where public.salvadanaio_ha_piano(s.archiviato, s.piano_attivo, s.importo_mensile, s.giorno_mensile)
    and v_mese + (s.giorno_mensile - 1) >= (s.created_at at time zone 'Europe/Rome')::date
  on conflict (salvadanaio_id, periodo) do update set
    ambito = excluded.ambito,
    data = excluded.data,
    importo = excluded.importo,
    descrizione = excluded.descrizione,
    categoria_id = excluded.categoria_id,
    metodo_pagamento_id = excluded.metodo_pagamento_id
  where public.movimenti.stato = 'previsto';
  get diagnostics v_righe = row_count;
  v_totale := v_totale + v_righe;

  delete from public.movimenti m
  where m.stato = 'previsto' and m.periodo = v_mese and m.salvadanaio_id is not null
    and not exists (
      select 1 from public.salvadanai s
      where s.id = m.salvadanaio_id
        and public.salvadanaio_ha_piano(s.archiviato, s.piano_attivo, s.importo_mensile, s.giorno_mensile)
    );

  return v_totale;
end;
$$;

-- Tiene allineati i previsti del piano nel mese corrente e nel successivo.
-- Se il piano non vale più, spariscono tutti i previsti non pagati.
create or replace function public.sincronizza_previsti_salvadanaio(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  v_mese date;
begin
  select * into s from public.salvadanai where id = p_id;
  if s.id is null
     or not public.salvadanaio_ha_piano(s.archiviato, s.piano_attivo, s.importo_mensile, s.giorno_mensile) then
    delete from public.movimenti where stato = 'previsto' and salvadanaio_id = p_id;
    return;
  end if;
  -- Il piano parte dal primo giorno utile dopo la creazione: niente previsti arretrati.
  delete from public.movimenti
  where stato = 'previsto' and salvadanaio_id = p_id
    and data < (s.created_at at time zone 'Europe/Rome')::date;

  foreach v_mese in array array[
    public.primo_del_mese(public.oggi()),
    (public.primo_del_mese(public.oggi()) + interval '1 month')::date
  ] loop
    continue when v_mese + (s.giorno_mensile - 1) < (s.created_at at time zone 'Europe/Rome')::date;
    insert into public.movimenti (ambito, data, importo, descrizione, categoria_id, stato, salvadanaio_id, periodo, metodo_pagamento_id)
    values (s.ambito, v_mese + (s.giorno_mensile - 1), s.importo_mensile, s.nome, s.categoria_id, 'previsto', s.id, v_mese, s.metodo_pagamento_id)
    on conflict (salvadanaio_id, periodo) do update set
      ambito = excluded.ambito,
      data = excluded.data,
      importo = excluded.importo,
      descrizione = excluded.descrizione,
      categoria_id = excluded.categoria_id,
      metodo_pagamento_id = excluded.metodo_pagamento_id
    where public.movimenti.stato = 'previsto';
  end loop;
end;
$$;

create or replace function public.salvadanai_sincronizza_previsti()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.movimenti where stato = 'previsto' and salvadanaio_id = old.id;
    return old;
  end if;
  perform public.sincronizza_previsti_salvadanaio(new.id);
  return null;
end;
$$;

-- Riallinea i piani già creati.
select public.sincronizza_previsti_salvadanaio(id) from public.salvadanai;
