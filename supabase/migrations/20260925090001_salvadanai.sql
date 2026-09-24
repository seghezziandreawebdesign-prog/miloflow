-- Risparmi e investimenti ("salvadanai").
--
-- Un salvadanaio è un obiettivo di risparmio (es. "Viaggio a New York",
-- 3.000 €) o un investimento (es. un fondo con un piano da 400 €/mese).
-- I versamenti sono movimenti del budget collegati con salvadanaio_id: contano
-- come spesa del mese, nella categoria del salvadanaio. I prelievi (soldi che
-- tornano disponibili) e le valutazioni degli investimenti stanno in tabelle
-- proprie e non toccano il budget.
--
-- Con importo_mensile e giorno_mensile c'è un piano: genera_previsti e i
-- trigger creano ogni mese un movimento "previsto" (vincolo univoco
-- (salvadanaio_id, periodo), come per i servizi). Segnandolo pagato diventa un
-- versamento. I versamenti fatti a mano hanno periodo null e non collidono.

create type public.tipo_salvadanaio as enum ('risparmio', 'investimento');

create table public.salvadanai (
  id uuid primary key default gen_random_uuid(),
  ambito public.ambito not null default 'personale',
  tipo public.tipo_salvadanaio not null,
  nome text not null check (length(trim(nome)) between 1 and 200),
  -- Risparmio: la cifra da raggiungere e, se c'è, entro quando.
  obiettivo numeric(10, 2) check (obiettivo is null or obiettivo > 0),
  data_obiettivo date,
  -- Investimento: strumento (fondo, ETF…), codice ISIN e piattaforma.
  strumento text,
  isin text check (isin is null or isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'),
  piattaforma text,
  -- Piano mensile facoltativo: importo e giorno (1-28, valido in ogni mese).
  importo_mensile numeric(10, 2) check (importo_mensile is null or importo_mensile > 0),
  giorno_mensile smallint check (giorno_mensile is null or giorno_mensile between 1 and 28),
  piano_attivo boolean not null default true,
  categoria_id uuid references public.categorie (id) on delete set null,
  metodo_pagamento_id uuid references public.metodi_pagamento (id) on delete set null,
  colore text,
  icona text,
  archiviato boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  check ((importo_mensile is null) = (giorno_mensile is null))
);
alter table public.salvadanai enable row level security;
create trigger salvadanai_updated_at before update on public.salvadanai
  for each row execute function public.set_updated_at();
create index salvadanai_categoria_idx on public.salvadanai (categoria_id);
create index salvadanai_metodo_idx on public.salvadanai (metodo_pagamento_id);

create table public.salvadanai_prelievi (
  id uuid primary key default gen_random_uuid(),
  salvadanaio_id uuid not null references public.salvadanai (id) on delete cascade,
  data date not null default public.oggi(),
  importo numeric(10, 2) not null check (importo > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
alter table public.salvadanai_prelievi enable row level security;
create trigger salvadanai_prelievi_updated_at before update on public.salvadanai_prelievi
  for each row execute function public.set_updated_at();
create index salvadanai_prelievi_salvadanaio_idx on public.salvadanai_prelievi (salvadanaio_id);

-- Valore di un investimento a una data, inserito a mano (uno per giorno).
create table public.salvadanai_valori (
  id uuid primary key default gen_random_uuid(),
  salvadanaio_id uuid not null references public.salvadanai (id) on delete cascade,
  data date not null default public.oggi(),
  valore numeric(12, 2) not null check (valore >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (salvadanaio_id, data)
);
alter table public.salvadanai_valori enable row level security;
create trigger salvadanai_valori_updated_at before update on public.salvadanai_valori
  for each row execute function public.set_updated_at();

-- Versamenti: movimenti collegati al salvadanaio.
alter table public.movimenti
  add column salvadanaio_id uuid references public.salvadanai (id) on delete set null,
  add constraint movimenti_salvadanaio_periodo_key unique (salvadanaio_id, periodo);

revoke all on public.salvadanai, public.salvadanai_prelievi, public.salvadanai_valori from anon;
grant select, insert, update, delete on public.salvadanai, public.salvadanai_prelievi, public.salvadanai_valori to authenticated;

-- ---------------------------------------------------------------------------
-- Policy: come debiti e rate. Il collaboratore vede solo l'ambito lavoro e
-- solo con il permesso budget; prelievi e valori seguono il salvadanaio.
-- ---------------------------------------------------------------------------

create policy salvadanai_select on public.salvadanai for select to authenticated
  using (public.is_owner() or (ambito = 'lavoro' and public.puo('budget')));
create policy salvadanai_insert on public.salvadanai for insert to authenticated
  with check (public.is_owner() or (ambito = 'lavoro' and public.puo('budget', 'scrittura')));
create policy salvadanai_update on public.salvadanai for update to authenticated
  using (public.is_owner() or (ambito = 'lavoro' and public.puo('budget', 'scrittura')))
  with check (public.is_owner() or (ambito = 'lavoro' and public.puo('budget', 'scrittura')));
create policy salvadanai_delete on public.salvadanai for delete to authenticated
  using (public.is_owner() or (ambito = 'lavoro' and public.puo('budget', 'scrittura')));

do $$
declare
  t text;
begin
  foreach t in array array['salvadanai_prelievi', 'salvadanai_valori'] loop
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated
         using (public.puo(''budget'')
           and exists (select 1 from public.salvadanai s where s.id = salvadanaio_id))', t);
    execute format(
      'create policy %1$s_insert on public.%1$s for insert to authenticated
         with check (public.puo(''budget'', ''scrittura'')
           and exists (select 1 from public.salvadanai s where s.id = salvadanaio_id))', t);
    execute format(
      'create policy %1$s_update on public.%1$s for update to authenticated
         using (public.puo(''budget'', ''scrittura'')
           and exists (select 1 from public.salvadanai s where s.id = salvadanaio_id))
         with check (public.puo(''budget'', ''scrittura'')
           and exists (select 1 from public.salvadanai s where s.id = salvadanaio_id))', t);
    execute format(
      'create policy %1$s_delete on public.%1$s for delete to authenticated
         using (public.puo(''budget'', ''scrittura'')
           and exists (select 1 from public.salvadanai s where s.id = salvadanaio_id))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Viste.
-- ---------------------------------------------------------------------------

-- I movimenti con il nome del salvadanaio (la vista si ricrea: m.* cambia).
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

-- Salvadanai con i totali: versato (movimenti pagati), prelevato, saldo,
-- prossimo versamento previsto e ultimo valore.
create view public.v_salvadanai
with (security_invoker = true)
as
select
  s.*,
  coalesce(v.versato, 0)::numeric(12, 2) as versato,
  coalesce(p.prelevato, 0)::numeric(12, 2) as prelevato,
  (coalesce(v.versato, 0) - coalesce(p.prelevato, 0))::numeric(12, 2) as saldo,
  v.versamenti,
  v.ultimo_versamento,
  pr.id as previsto_id,
  pr.data as previsto_data,
  pr.importo as previsto_importo,
  va.valore as valore_attuale,
  va.data as valore_data
from public.salvadanai s
left join lateral (
  select sum(m.importo) as versato, count(*) as versamenti, max(m.data) as ultimo_versamento
  from public.movimenti m
  where m.salvadanaio_id = s.id and m.stato = 'pagato'
) v on true
left join lateral (
  select sum(x.importo) as prelevato from public.salvadanai_prelievi x where x.salvadanaio_id = s.id
) p on true
left join lateral (
  select m.id, m.data, m.importo
  from public.movimenti m
  where m.salvadanaio_id = s.id and m.stato = 'previsto'
  order by m.data
  limit 1
) pr on true
left join lateral (
  select x.valore, x.data
  from public.salvadanai_valori x
  where x.salvadanaio_id = s.id
  order by x.data desc
  limit 1
) va on true;

grant select on public.v_salvadanai to authenticated;
revoke all on public.v_salvadanai from anon;

-- ---------------------------------------------------------------------------
-- Previsti dei piani mensili.
-- ---------------------------------------------------------------------------

-- Il piano vale nel mese: salvadanaio attivo, piano attivo, importo e giorno.
create function public.salvadanaio_ha_piano(p_archiviato boolean, p_attivo boolean, p_importo numeric, p_giorno smallint)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select not p_archiviato and p_attivo and p_importo is not null and p_giorno is not null;
$$;

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
    and s.created_at < v_fine
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
create function public.sincronizza_previsti_salvadanaio(p_id uuid)
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

  foreach v_mese in array array[
    public.primo_del_mese(public.oggi()),
    (public.primo_del_mese(public.oggi()) + interval '1 month')::date
  ] loop
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

create function public.salvadanai_sincronizza_previsti()
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

create trigger salvadanai_sincronizza_previsti
  after insert or update of ambito, nome, importo_mensile, giorno_mensile, piano_attivo, categoria_id,
    metodo_pagamento_id, archiviato
  on public.salvadanai
  for each row execute function public.salvadanai_sincronizza_previsti();
create trigger salvadanai_elimina_previsti before delete on public.salvadanai
  for each row execute function public.salvadanai_sincronizza_previsti();

-- Un salvadanaio si elimina solo senza versamenti né prelievi: altrimenti si archivia.
create function public.elimina_salvadanaio(p_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.movimenti where salvadanaio_id = p_id and stato = 'pagato')
     or exists (select 1 from public.salvadanai_prelievi where salvadanaio_id = p_id) then
    raise exception 'Ci sono già dei versamenti: archivialo invece di eliminarlo';
  end if;
  delete from public.salvadanai where id = p_id;
  if not found then
    raise exception 'Salvadanaio non trovato o permessi insufficienti' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Categorie di esempio per i versamenti (solo se non ci sono già).
-- ---------------------------------------------------------------------------

do $$
declare
  v_padre uuid;
begin
  select id into v_padre from public.categorie where parent_id is null and nome = 'Risparmi e investimenti';
  if v_padre is null then
    insert into public.categorie (nome, ambito, colore, icona, ordine)
    values ('Risparmi e investimenti', 'entrambi', '#0d9488', 'piggy-bank', 200)
    returning id into v_padre;
  end if;
  if not exists (select 1 from public.categorie where parent_id = v_padre and nome = 'Risparmi') then
    insert into public.categorie (nome, ambito, colore, icona, ordine, parent_id)
    values ('Risparmi', 'entrambi', '#0d9488', 'piggy-bank', 10, v_padre);
  end if;
  if not exists (select 1 from public.categorie where parent_id = v_padre and nome = 'Investimenti') then
    insert into public.categorie (nome, ambito, colore, icona, ordine, parent_id)
    values ('Investimenti', 'entrambi', '#0f766e', 'trending-up', 20, v_padre);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backup: le tabelle nuove nell'esportazione e nel ripristino.
-- ---------------------------------------------------------------------------

create or replace function public.tabelle_backup()
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
    'budget_mensili', 'debiti', 'debiti_rate', 'salvadanai', 'movimenti',
    'salvadanai_prelievi', 'salvadanai_valori',
    'impostazioni_calendario', 'impostazioni_notifiche'
  ];
$$;

create or replace function public.importa_backup(p_dati jsonb)
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
     or exists (select 1 from public.debiti) or exists (select 1 from public.salvadanai) then
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

  foreach v_tabella in array array['eventi', 'budget_mensili', 'debiti', 'salvadanai'] loop
    v_n := public.backup_inserisci(v_tabella, p_dati -> v_tabella);
    v_esito := v_esito || jsonb_build_object(v_tabella, v_n);
  end loop;

  -- Rate e rinnovi senza il collegamento al movimento: si aggiunge dopo i movimenti.
  v_n := public.backup_inserisci('debiti_rate', p_dati -> 'debiti_rate', array['movimento_id']);
  v_esito := v_esito || jsonb_build_object('debiti_rate', v_n);
  v_n := public.backup_inserisci('servizi_rinnovi', p_dati -> 'servizi_rinnovi', array['movimento_id']);
  v_esito := v_esito || jsonb_build_object('servizi_rinnovi', v_n);

  -- I trigger hanno generato dei previsti: valgono quelli del backup.
  delete from public.movimenti
  where stato = 'previsto' and (servizio_id is not null or rata_id is not null or salvadanaio_id is not null);
  v_n := public.backup_inserisci('movimenti', p_dati -> 'movimenti');
  v_esito := v_esito || jsonb_build_object('movimenti', v_n);

  foreach v_tabella in array array['salvadanai_prelievi', 'salvadanai_valori'] loop
    v_n := public.backup_inserisci(v_tabella, p_dati -> v_tabella);
    v_esito := v_esito || jsonb_build_object(v_tabella, v_n);
  end loop;

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

-- ---------------------------------------------------------------------------
-- Privilegi delle funzioni nuove.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.salvadanaio_ha_piano(boolean, boolean, numeric, smallint),
  public.sincronizza_previsti_salvadanaio(uuid),
  public.elimina_salvadanaio(uuid)
from public, anon;

grant execute on function
  public.salvadanaio_ha_piano(boolean, boolean, numeric, smallint),
  public.elimina_salvadanaio(uuid)
to authenticated;
