-- Budget & Spese (fase 5): categoria dei debiti, coerenza delle categorie,
-- vista dei movimenti, previsti idempotenti con cron, pagamento delle rate,
-- rinnovo dei servizi collegato al budget, salvataggio dei debiti con il piano
-- e riordino delle categorie.

-- ---------------------------------------------------------------------------
-- Debiti con categoria facoltativa: le rate la ereditano nei movimenti.
-- ---------------------------------------------------------------------------

alter table public.debiti
  add column categoria_id uuid references public.categorie (id) on delete set null;
create index debiti_categoria_idx on public.debiti (categoria_id);

-- ---------------------------------------------------------------------------
-- Categorie: una sottocategoria ha sempre l'ambito del padre.
-- ---------------------------------------------------------------------------

create function public.categorie_eredita_ambito()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is not null then
    select ambito into new.ambito from public.categorie where id = new.parent_id;
  end if;
  return new;
end;
$$;

create trigger categorie_eredita_ambito before insert or update of parent_id, ambito on public.categorie
  for each row execute function public.categorie_eredita_ambito();

create function public.categorie_propaga_ambito()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.categorie set ambito = new.ambito where parent_id = new.id and ambito <> new.ambito;
  return null;
end;
$$;

create trigger categorie_propaga_ambito after update of ambito on public.categorie
  for each row execute function public.categorie_propaga_ambito();

-- Riordina (e sposta) le categorie di un livello: l'ordine è la posizione nell'array.
create function public.riordina_categorie(p_parent_id uuid, p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  i integer;
begin
  for i in 1 .. coalesce(array_length(p_ids, 1), 0) loop
    update public.categorie set ordine = i * 10, parent_id = p_parent_id where id = p_ids[i];
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vista dei movimenti con categoria, metodo, servizio e debito.
-- ---------------------------------------------------------------------------

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
  r.numero as rata_numero
from public.movimenti m
left join public.categorie c on c.id = m.categoria_id
left join public.categorie cp on cp.id = c.parent_id
left join public.metodi_pagamento mp on mp.id = m.metodo_pagamento_id
left join public.servizi s on s.id = m.servizio_id
left join public.debiti_rate r on r.id = m.rata_id
left join public.debiti d on d.id = r.debito_id;

grant select on public.v_movimenti to authenticated;
revoke all on public.v_movimenti from anon;

-- ---------------------------------------------------------------------------
-- Previsti: un movimento "previsto" per ogni scadenza di servizio pagata da me
-- e per ogni rata non pagata del mese. Idempotente grazie ai vincoli univoci
-- (servizio_id, periodo) e (rata_id). La chiama l'owner dal pulsante
-- "Aggiorna previsti" e il cron il primo del mese (senza utente).
-- ---------------------------------------------------------------------------

create function public.primo_del_mese(p_data date)
returns date
language sql
immutable
set search_path = ''
as $$
  select date_trunc('month', p_data)::date;
$$;

create function public.genera_previsti(p_mese date)
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

  return v_totale;
end;
$$;

-- Il cron lavora sul mese corrente e sul successivo: questo è l'orizzonte
-- entro cui anche i trigger qui sotto tengono aggiornati i previsti.
create function public.mese_nell_orizzonte(p_mese date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.primo_del_mese(p_mese) in (
    public.primo_del_mese(public.oggi()),
    (public.primo_del_mese(public.oggi()) + interval '1 month')::date
  );
$$;

-- Se un servizio cambia o viene disdetto, il suo previsto non pagato si
-- aggiorna o si elimina; se torna valido nel mese corrente o nel successivo,
-- il previsto si ricrea.
create function public.sincronizza_previsti_servizio(p_servizio_id uuid)
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
  v_valido := s.stato = 'attivo' and s.chi_paga = 'io';

  delete from public.movimenti
  where stato = 'previsto' and servizio_id = p_servizio_id and (not v_valido or periodo <> v_periodo);

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

create function public.servizi_sincronizza_previsti()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.movimenti where stato = 'previsto' and servizio_id = old.id;
    return old;
  end if;
  perform public.sincronizza_previsti_servizio(new.id);
  return null;
end;
$$;

create trigger servizi_sincronizza_previsti after insert or update on public.servizi
  for each row execute function public.servizi_sincronizza_previsti();
create trigger servizi_elimina_previsti before delete on public.servizi
  for each row execute function public.servizi_sincronizza_previsti();

create function public.servizi_economico_sincronizza_previsti()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sincronizza_previsti_servizio(coalesce(new.servizio_id, old.servizio_id));
  return null;
end;
$$;

create trigger servizi_economico_sincronizza_previsti after insert or update or delete on public.servizi_economico
  for each row execute function public.servizi_economico_sincronizza_previsti();

-- Rate: il previsto segue la rata (scadenza, importo) e sparisce con lei.
create function public.debiti_rate_sincronizza_previsto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
begin
  if tg_op = 'DELETE' then
    delete from public.movimenti where stato = 'previsto' and rata_id = old.id;
    return old;
  end if;
  if new.pagata then
    return null; -- il pagamento lo gestisce paga_rata
  end if;
  if public.mese_nell_orizzonte(new.scadenza) then
    select ambito, creditore, categoria_id into d from public.debiti where id = new.debito_id;
    insert into public.movimenti (ambito, data, importo, descrizione, categoria_id, stato, rata_id, periodo)
    values (d.ambito, new.scadenza, new.importo, d.creditore || ' · rata ' || new.numero, d.categoria_id, 'previsto', new.id, public.primo_del_mese(new.scadenza))
    on conflict (rata_id) do update set
      ambito = excluded.ambito,
      data = excluded.data,
      importo = excluded.importo,
      descrizione = excluded.descrizione,
      categoria_id = excluded.categoria_id,
      periodo = excluded.periodo
    where public.movimenti.stato = 'previsto';
  else
    delete from public.movimenti where stato = 'previsto' and rata_id = new.id;
  end if;
  return null;
end;
$$;

create trigger debiti_rate_sincronizza_previsto after insert or update on public.debiti_rate
  for each row execute function public.debiti_rate_sincronizza_previsto();
create trigger debiti_rate_elimina_previsto before delete on public.debiti_rate
  for each row execute function public.debiti_rate_sincronizza_previsto();

-- Se cambia il debito (creditore, categoria, ambito) si aggiornano i previsti delle rate.
create function public.debiti_sincronizza_previsti()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.movimenti m
  set ambito = new.ambito,
      categoria_id = new.categoria_id,
      descrizione = new.creditore || ' · rata ' || r.numero
  from public.debiti_rate r
  where r.id = m.rata_id and r.debito_id = new.id and m.stato = 'previsto';
  return null;
end;
$$;

create trigger debiti_sincronizza_previsti after update of ambito, creditore, categoria_id on public.debiti
  for each row execute function public.debiti_sincronizza_previsti();

-- Cron: il primo del mese alle 00:05 (UTC) genera i previsti del mese e del successivo.
select cron.unschedule(jobid) from cron.job where jobname = 'genera-previsti';
select cron.schedule(
  'genera-previsti',
  '5 0 1 * *',
  $cron$
    select public.genera_previsti(public.primo_del_mese(public.oggi())),
           public.genera_previsti((public.primo_del_mese(public.oggi()) + interval '1 month')::date)
  $cron$
);

-- ---------------------------------------------------------------------------
-- Pagamento di una rata: crea (o converte) il movimento e segna la rata.
-- Security invoker: valgono le policy di chi chiama.
-- ---------------------------------------------------------------------------

create function public.paga_rata(p_rata_id uuid, p_data date, p_importo numeric, p_metodo_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  r record;
  d record;
  v_movimento uuid;
begin
  select id, debito_id, numero, scadenza, importo, pagata into r
  from public.debiti_rate where id = p_rata_id for update;
  if r.id is null then
    raise exception 'Rata non trovata o permessi insufficienti' using errcode = '42501';
  end if;
  if r.pagata then
    raise exception 'Rata già pagata';
  end if;
  if p_importo is not null and p_importo < 0 then
    raise exception 'Importo non valido';
  end if;
  select ambito, creditore, categoria_id into d from public.debiti where id = r.debito_id;

  select id into v_movimento from public.movimenti where rata_id = p_rata_id;
  if v_movimento is null then
    v_movimento := gen_random_uuid();
    insert into public.movimenti (id, ambito, data, importo, descrizione, categoria_id, stato, rata_id, periodo, metodo_pagamento_id)
    values (v_movimento, d.ambito, coalesce(p_data, public.oggi()), coalesce(p_importo, r.importo),
            d.creditore || ' · rata ' || r.numero, d.categoria_id, 'pagato', r.id, public.primo_del_mese(r.scadenza), p_metodo_id);
  else
    update public.movimenti
    set stato = 'pagato',
        data = coalesce(p_data, public.oggi()),
        importo = coalesce(p_importo, r.importo),
        metodo_pagamento_id = coalesce(p_metodo_id, metodo_pagamento_id)
    where id = v_movimento;
  end if;

  update public.debiti_rate set pagata = true, movimento_id = v_movimento where id = p_rata_id;
  return v_movimento;
end;
$$;

-- Annulla il pagamento: la rata torna da pagare e il movimento torna previsto
-- (il trigger della rata lo tiene o lo elimina in base all'orizzonte).
create function public.annulla_pagamento_rata(p_rata_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  r record;
begin
  select id, scadenza, importo, pagata, movimento_id into r
  from public.debiti_rate where id = p_rata_id for update;
  if r.id is null then
    raise exception 'Rata non trovata o permessi insufficienti' using errcode = '42501';
  end if;
  if not r.pagata then
    raise exception 'La rata non risulta pagata';
  end if;
  if r.movimento_id is not null then
    update public.movimenti
    set stato = 'previsto', data = r.scadenza, importo = r.importo
    where id = r.movimento_id;
  end if;
  update public.debiti_rate set pagata = false, movimento_id = null where id = p_rata_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Debiti: salvataggio atomico con il piano delle rate ed eliminazione.
-- ---------------------------------------------------------------------------

create function public.salva_debito(p_id uuid, p_debito jsonb, p_rate jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_numeri integer[];
  r jsonb;
begin
  if p_id is null then
    insert into public.debiti (id, ambito, creditore, descrizione, importo_totale, tipo, data_inizio, note, categoria_id)
    values (
      v_id,
      (p_debito ->> 'ambito')::public.ambito,
      p_debito ->> 'creditore',
      nullif(p_debito ->> 'descrizione', ''),
      (p_debito ->> 'importo_totale')::numeric,
      (p_debito ->> 'tipo')::public.tipo_debito,
      nullif(p_debito ->> 'data_inizio', '')::date,
      nullif(p_debito ->> 'note', ''),
      nullif(p_debito ->> 'categoria_id', '')::uuid
    );
  else
    update public.debiti set
      ambito = (p_debito ->> 'ambito')::public.ambito,
      creditore = p_debito ->> 'creditore',
      descrizione = nullif(p_debito ->> 'descrizione', ''),
      importo_totale = (p_debito ->> 'importo_totale')::numeric,
      tipo = (p_debito ->> 'tipo')::public.tipo_debito,
      data_inizio = nullif(p_debito ->> 'data_inizio', '')::date,
      note = nullif(p_debito ->> 'note', ''),
      categoria_id = nullif(p_debito ->> 'categoria_id', '')::uuid
    where id = v_id;
    if not found then
      raise exception 'Debito non trovato o permessi insufficienti' using errcode = '42501';
    end if;
  end if;

  if p_rate is not null then
    select coalesce(array_agg((x ->> 'numero')::integer), '{}') into v_numeri
    from jsonb_array_elements(p_rate) x;

    -- Le rate pagate non si toccano; le altre seguono il piano nuovo.
    delete from public.debiti_rate
    where debito_id = v_id and not pagata and not (numero = any (v_numeri));

    for r in select * from jsonb_array_elements(p_rate) loop
      insert into public.debiti_rate (debito_id, numero, scadenza, importo)
      values (v_id, (r ->> 'numero')::integer, (r ->> 'scadenza')::date, (r ->> 'importo')::numeric)
      on conflict (debito_id, numero) do update set
        scadenza = excluded.scadenza,
        importo = excluded.importo
      where not public.debiti_rate.pagata;
    end loop;
  end if;

  return v_id;
end;
$$;

-- Un debito si elimina solo se nessuna rata è stata pagata.
create function public.elimina_debito(p_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.debiti_rate where debito_id = p_id and pagata) then
    raise exception 'Il debito ha rate pagate: non si può eliminare';
  end if;
  delete from public.debiti where id = p_id;
  if not found then
    raise exception 'Debito non trovato o permessi insufficienti' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rinnovo del servizio collegato al budget: se pago io, il movimento del
-- periodo della scadenza rinnovata diventa "pagato" (creato se manca).
-- Due pagamenti nello stesso periodo si sommano. Se paga il cliente, nessun
-- movimento. Lo storico dei rinnovi punta al movimento.
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- salva_servizio: anche la categoria di spesa (usata dai previsti).
-- ---------------------------------------------------------------------------

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
      (p_servizio ->> 'prossima_scadenza')::date,
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
      prossima_scadenza = (p_servizio ->> 'prossima_scadenza')::date,
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

-- ---------------------------------------------------------------------------
-- v_calendario: le rate previste compaiono una volta sola (come rata), non
-- anche come movimento previsto.
-- ---------------------------------------------------------------------------

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
where m.stato = 'previsto' and m.rata_id is null;

grant select on public.v_calendario to authenticated;
revoke all on public.v_calendario from anon;

-- ---------------------------------------------------------------------------
-- Privilegi.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.genera_previsti(date),
  public.paga_rata(uuid, date, numeric, uuid),
  public.annulla_pagamento_rata(uuid),
  public.salva_debito(uuid, jsonb, jsonb),
  public.elimina_debito(uuid),
  public.riordina_categorie(uuid, uuid[]),
  public.sincronizza_previsti_servizio(uuid),
  public.primo_del_mese(date),
  public.mese_nell_orizzonte(date)
from public, anon;

grant execute on function
  public.genera_previsti(date),
  public.paga_rata(uuid, date, numeric, uuid),
  public.annulla_pagamento_rata(uuid),
  public.salva_debito(uuid, jsonb, jsonb),
  public.elimina_debito(uuid),
  public.riordina_categorie(uuid, uuid[]),
  public.primo_del_mese(date),
  public.mese_nell_orizzonte(date)
to authenticated;
