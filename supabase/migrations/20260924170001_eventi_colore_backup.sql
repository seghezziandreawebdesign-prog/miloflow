-- Colore degli eventi nel calendario, esportazione e ripristino del backup.

-- ---------------------------------------------------------------------------
-- Eventi con colore facoltativo: nel calendario riempie lo sfondo.
-- ---------------------------------------------------------------------------

alter table public.eventi
  add column colore text check (colore is null or colore ~ '^#[0-9a-f]{6}$');

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

grant select on public.v_calendario to authenticated;
revoke all on public.v_calendario from anon;

-- ---------------------------------------------------------------------------
-- Backup: tutte le tabelle in un solo JSON (solo owner). I file dello Storage
-- li scarica il browser dai percorsi salvati nelle righe.
-- ---------------------------------------------------------------------------

create function public.tabelle_backup()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'profili', 'permessi', 'accessi_clienti',
    'tipi_servizio', 'categorie', 'metodi_pagamento',
    'clienti', 'clienti_contatti', 'clienti_link', 'clienti_diario',
    'servizi', 'servizi_economico', 'servizi_clienti', 'servizi_clienti_economico',
    'credenziali', 'cassaforte', 'servizi_rinnovi',
    'progetti', 'task', 'eventi',
    'budget_mensili', 'debiti', 'debiti_rate', 'movimenti',
    'impostazioni_calendario', 'impostazioni_notifiche'
  ];
$$;

create function public.esporta_backup()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_out jsonb := jsonb_build_object('app', 'miloflow', 'versione', 1, 'generato_il', now(), 'owner_id', auth.uid());
  v_tabella text;
  v_righe jsonb;
begin
  if not public.is_owner() then
    raise exception 'Solo il proprietario può esportare il backup' using errcode = '42501';
  end if;
  foreach v_tabella in array public.tabelle_backup() loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.%I t', v_tabella) into v_righe;
    v_out := v_out || jsonb_build_object(v_tabella, v_righe);
  end loop;
  return v_out;
end;
$$;

-- Inserisce le righe di una tabella dal backup, con created_by = chi importa.
create function public.backup_inserisci(p_tabella text, p_righe jsonb, p_togli text[] default '{}')
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_righe jsonb;
  v_n integer;
begin
  if p_righe is null or jsonb_typeof(p_righe) <> 'array' or jsonb_array_length(p_righe) = 0 then
    return 0;
  end if;
  if not (p_tabella = any (public.tabelle_backup())) then
    raise exception 'Tabella non ammessa: %', p_tabella;
  end if;
  select jsonb_agg((x - p_togli) || jsonb_build_object('created_by', auth.uid()))
  into v_righe
  from jsonb_array_elements(p_righe) x;
  execute format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I, $1)', p_tabella, p_tabella)
  using v_righe;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Ripristina un backup su un account vuoto, in una sola transazione.
-- Gli id restano quelli del backup; gli utenti diventano chi importa.
create function public.importa_backup(p_dati jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_vecchio_owner uuid;
  v_task jsonb;
  v_esito jsonb := '{}'::jsonb;
  v_tabella text;
  v_n integer;
  v_nome text;
begin
  if not public.is_owner() then
    raise exception 'Solo il proprietario può ripristinare un backup' using errcode = '42501';
  end if;
  if coalesce(p_dati ->> 'app', '') <> 'miloflow' or (p_dati ->> 'versione')::integer <> 1 then
    raise exception 'Il file non è un backup di Milo Flow riconosciuto';
  end if;
  if exists (select 1 from public.clienti) or exists (select 1 from public.servizi)
     or exists (select 1 from public.task) or exists (select 1 from public.progetti)
     or exists (select 1 from public.eventi) or exists (select 1 from public.movimenti)
     or exists (select 1 from public.debiti) then
    raise exception 'L''account contiene già dei dati: il ripristino vale solo per un account vuoto';
  end if;

  v_vecchio_owner := (p_dati ->> 'owner_id')::uuid;

  -- Profilo: il nome.
  select x ->> 'nome' into v_nome
  from jsonb_array_elements(coalesce(p_dati -> 'profili', '[]'::jsonb)) x
  where x ->> 'ruolo' = 'owner'
  limit 1;
  if v_nome is not null then
    update public.profili set nome = v_nome where id = v_uid;
  end if;

  -- I dati di esempio del progetto nuovo lasciano il posto a quelli del backup.
  delete from public.budget_mensili;
  delete from public.categorie;
  delete from public.tipi_servizio;
  delete from public.metodi_pagamento;
  delete from public.impostazioni_notifiche;
  delete from public.cassaforte;

  v_n := public.backup_inserisci('tipi_servizio', p_dati -> 'tipi_servizio');
  v_esito := v_esito || jsonb_build_object('tipi_servizio', v_n);
  -- Categorie: prima i padri, poi le figlie.
  v_n := public.backup_inserisci('categorie',
    (select jsonb_agg(x) from jsonb_array_elements(coalesce(p_dati -> 'categorie', '[]'::jsonb)) x where x ->> 'parent_id' is null));
  v_n := v_n + public.backup_inserisci('categorie',
    (select jsonb_agg(x) from jsonb_array_elements(coalesce(p_dati -> 'categorie', '[]'::jsonb)) x where x ->> 'parent_id' is not null));
  v_esito := v_esito || jsonb_build_object('categorie', v_n);
  v_n := public.backup_inserisci('metodi_pagamento', p_dati -> 'metodi_pagamento');
  v_esito := v_esito || jsonb_build_object('metodi_pagamento', v_n);

  foreach v_tabella in array array['clienti', 'clienti_contatti', 'clienti_link', 'clienti_diario',
    'servizi', 'servizi_economico', 'servizi_clienti', 'servizi_clienti_economico', 'credenziali', 'cassaforte', 'progetti'] loop
    v_n := public.backup_inserisci(v_tabella, p_dati -> v_tabella);
    v_esito := v_esito || jsonb_build_object(v_tabella, v_n);
  end loop;

  -- Task: l'assegnatario resta solo se era il vecchio owner; prima le principali, poi le sottotask.
  select jsonb_agg(x || jsonb_build_object('assegnata_a',
    case when v_vecchio_owner is not null and x ->> 'assegnata_a' = v_vecchio_owner::text then v_uid else null end))
  into v_task
  from jsonb_array_elements(coalesce(p_dati -> 'task', '[]'::jsonb)) x;
  v_n := public.backup_inserisci('task', (select jsonb_agg(x) from jsonb_array_elements(coalesce(v_task, '[]'::jsonb)) x where x ->> 'parent_id' is null));
  v_n := v_n + public.backup_inserisci('task', (select jsonb_agg(x) from jsonb_array_elements(coalesce(v_task, '[]'::jsonb)) x where x ->> 'parent_id' is not null));
  v_esito := v_esito || jsonb_build_object('task', v_n);

  foreach v_tabella in array array['eventi', 'budget_mensili', 'debiti'] loop
    v_n := public.backup_inserisci(v_tabella, p_dati -> v_tabella);
    v_esito := v_esito || jsonb_build_object(v_tabella, v_n);
  end loop;

  -- Rate e rinnovi senza il collegamento al movimento: si aggiunge dopo i movimenti.
  v_n := public.backup_inserisci('debiti_rate', p_dati -> 'debiti_rate', array['movimento_id']);
  v_esito := v_esito || jsonb_build_object('debiti_rate', v_n);
  v_n := public.backup_inserisci('servizi_rinnovi', p_dati -> 'servizi_rinnovi', array['movimento_id']);
  v_esito := v_esito || jsonb_build_object('servizi_rinnovi', v_n);

  -- I trigger hanno generato dei previsti: valgono quelli del backup.
  delete from public.movimenti where stato = 'previsto' and (servizio_id is not null or rata_id is not null);
  v_n := public.backup_inserisci('movimenti', p_dati -> 'movimenti');
  v_esito := v_esito || jsonb_build_object('movimenti', v_n);

  update public.debiti_rate r
  set movimento_id = (x ->> 'movimento_id')::uuid
  from jsonb_array_elements(coalesce(p_dati -> 'debiti_rate', '[]'::jsonb)) x
  where r.id = (x ->> 'id')::uuid and x ->> 'movimento_id' is not null
    and exists (select 1 from public.movimenti m where m.id = (x ->> 'movimento_id')::uuid);
  update public.servizi_rinnovi s
  set movimento_id = (x ->> 'movimento_id')::uuid
  from jsonb_array_elements(coalesce(p_dati -> 'servizi_rinnovi', '[]'::jsonb)) x
  where s.id = (x ->> 'id')::uuid and x ->> 'movimento_id' is not null
    and exists (select 1 from public.movimenti m where m.id = (x ->> 'movimento_id')::uuid);

  -- Impostazioni: quelle del vecchio owner diventano di chi importa.
  delete from public.impostazioni_calendario where user_id = v_uid;
  v_n := public.backup_inserisci('impostazioni_calendario',
    (select jsonb_agg(x || jsonb_build_object('user_id', v_uid))
     from jsonb_array_elements(coalesce(p_dati -> 'impostazioni_calendario', '[]'::jsonb)) x
     where v_vecchio_owner is null or x ->> 'user_id' = v_vecchio_owner::text
     limit 1));
  v_esito := v_esito || jsonb_build_object('impostazioni_calendario', v_n);
  v_n := public.backup_inserisci('impostazioni_notifiche', p_dati -> 'impostazioni_notifiche');
  v_esito := v_esito || jsonb_build_object('impostazioni_notifiche', v_n);

  return v_esito;
end;
$$;

revoke execute on function public.tabelle_backup(), public.esporta_backup(),
  public.backup_inserisci(text, jsonb, text[]), public.importa_backup(jsonb) from public, anon;
grant execute on function public.tabelle_backup(), public.esporta_backup(),
  public.backup_inserisci(text, jsonb, text[]), public.importa_backup(jsonb) to authenticated;
