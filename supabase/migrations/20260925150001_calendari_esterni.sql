-- Calendari esterni in sola lettura (feed ICS pubblici, es. iCloud):
-- configurazione per utente e cache delle occorrenze già espanse. La
-- sincronizzazione avviene lato server; il browser legge solo le tabelle.

create table public.calendari_esterni (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profili (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  url text not null check (url ~* '^https://'),
  colore text,
  ambito public.ambito not null default 'personale',
  attivo boolean not null default true,
  ultimo_sync timestamptz,
  errore_sync text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.calendari_esterni enable row level security;
create trigger calendari_esterni_updated_at before update on public.calendari_esterni
  for each row execute function public.set_updated_at();
create index calendari_esterni_user_idx on public.calendari_esterni (user_id);

-- Occorrenze già espanse (ricorrenze comprese) nella finestra di sincronizzazione.
-- È una cache: non entra nel backup, si rigenera con una sincronizzazione.
create table public.eventi_esterni (
  id uuid primary key default gen_random_uuid(),
  calendario_id uuid not null references public.calendari_esterni (id) on delete cascade,
  uid text not null,
  titolo text not null,
  inizio timestamptz not null,
  fine timestamptz,
  tutto_il_giorno boolean not null default false,
  luogo text,
  note text,
  created_at timestamptz not null default now(),
  unique (calendario_id, uid)
);
alter table public.eventi_esterni enable row level security;
create index eventi_esterni_inizio_idx on public.eventi_esterni (calendario_id, inizio);

-- Come impostazioni_calendario: ognuno vede e gestisce solo i propri.
create policy calendari_esterni_select on public.calendari_esterni for select to authenticated
  using (user_id = (select auth.uid()));
create policy calendari_esterni_insert on public.calendari_esterni for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy calendari_esterni_update on public.calendari_esterni for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy calendari_esterni_delete on public.calendari_esterni for delete to authenticated
  using (user_id = (select auth.uid()));

create policy eventi_esterni_select on public.eventi_esterni for select to authenticated
  using (exists (select 1 from public.calendari_esterni c
    where c.id = calendario_id and c.user_id = (select auth.uid())));
create policy eventi_esterni_insert on public.eventi_esterni for insert to authenticated
  with check (exists (select 1 from public.calendari_esterni c
    where c.id = calendario_id and c.user_id = (select auth.uid())));
create policy eventi_esterni_update on public.eventi_esterni for update to authenticated
  using (exists (select 1 from public.calendari_esterni c
    where c.id = calendario_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.calendari_esterni c
    where c.id = calendario_id and c.user_id = (select auth.uid())));
create policy eventi_esterni_delete on public.eventi_esterni for delete to authenticated
  using (exists (select 1 from public.calendari_esterni c
    where c.id = calendario_id and c.user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Backup: si esporta la configurazione dei calendari (non la cache).
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
    'impostazioni_calendario', 'impostazioni_notifiche', 'calendari_esterni'
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
    'servizi', 'servizi_economico', 'servizi_clienti', 'servizi_clienti_economico', 'credenziali', 'cassaforte'] loop
    v_n := public.backup_inserisci(v_tabella, p_dati -> v_tabella);
    v_esito := v_esito || jsonb_build_object(v_tabella, v_n);
  end loop;

  -- Progetti: prima i padri, poi i sottoprogetti.
  v_n := public.backup_inserisci('progetti',
    (select jsonb_agg(x) from jsonb_array_elements(coalesce(p_dati -> 'progetti', '[]'::jsonb)) x where x ->> 'parent_id' is null));
  v_n := v_n + public.backup_inserisci('progetti',
    (select jsonb_agg(x) from jsonb_array_elements(coalesce(p_dati -> 'progetti', '[]'::jsonb)) x where x ->> 'parent_id' is not null));
  v_esito := v_esito || jsonb_build_object('progetti', v_n);

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

  -- Calendari esterni del vecchio owner: diventano di chi importa, da risincronizzare.
  delete from public.calendari_esterni where user_id = v_uid;
  v_n := public.backup_inserisci('calendari_esterni',
    (select jsonb_agg(x || jsonb_build_object('user_id', v_uid, 'ultimo_sync', null, 'errore_sync', null))
     from jsonb_array_elements(coalesce(p_dati -> 'calendari_esterni', '[]'::jsonb)) x
     where v_vecchio_owner is null or x ->> 'user_id' = v_vecchio_owner::text));
  v_esito := v_esito || jsonb_build_object('calendari_esterni', v_n);

  return v_esito;
end;
$$;
