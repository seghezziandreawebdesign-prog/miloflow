-- Le righe del contratto diventano voci libere ("Creazione sito web",
-- "Gestione social media") con il prezzo concordato. I servizi del database
-- (dominio, hosting…) si collegano alla voce come dettaglio, senza prezzo:
-- il loro costo è già registrato sul servizio. Il totale del contratto è la
-- somma dei prezzi delle voci.

create table public.contratti_voci (
  id uuid primary key default gen_random_uuid(),
  contratto_id uuid not null references public.contratti (id) on delete cascade,
  descrizione text not null check (length(trim(descrizione)) between 1 and 200),
  prezzo numeric(10, 2) not null default 0 check (prezzo >= 0),
  note text,
  ordine integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
alter table public.contratti_voci enable row level security;
create trigger contratti_voci_updated_at before update on public.contratti_voci
  for each row execute function public.set_updated_at();
create index contratti_voci_contratto_idx on public.contratti_voci (contratto_id);

create table public.contratti_voci_servizi (
  voce_id uuid not null references public.contratti_voci (id) on delete cascade,
  servizio_id uuid not null references public.servizi (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (voce_id, servizio_id)
);
alter table public.contratti_voci_servizi enable row level security;
create index contratti_voci_servizi_servizio_idx on public.contratti_voci_servizi (servizio_id);

revoke all on public.contratti_voci, public.contratti_voci_servizi from anon;
grant select, insert, update, delete on public.contratti_voci, public.contratti_voci_servizi to authenticated;

-- Le voci seguono il contratto (la sottoquery rispetta l'RLS di contratti).
create policy contratti_voci_select on public.contratti_voci for select to authenticated
  using (public.puo('budget') and exists (select 1 from public.contratti c where c.id = contratto_id));
create policy contratti_voci_insert on public.contratti_voci for insert to authenticated
  with check (public.puo('budget', 'scrittura') and exists (select 1 from public.contratti c where c.id = contratto_id));
create policy contratti_voci_update on public.contratti_voci for update to authenticated
  using (public.puo('budget', 'scrittura') and exists (select 1 from public.contratti c where c.id = contratto_id))
  with check (public.puo('budget', 'scrittura') and exists (select 1 from public.contratti c where c.id = contratto_id));
create policy contratti_voci_delete on public.contratti_voci for delete to authenticated
  using (public.puo('budget', 'scrittura') and exists (select 1 from public.contratti c where c.id = contratto_id));

-- I collegamenti chiedono anche la visibilità del servizio.
create policy contratti_voci_servizi_select on public.contratti_voci_servizi for select to authenticated
  using (public.puo('budget') and public.vede_servizio(servizio_id)
    and exists (select 1 from public.contratti_voci v where v.id = voce_id));
create policy contratti_voci_servizi_insert on public.contratti_voci_servizi for insert to authenticated
  with check (public.puo('budget', 'scrittura') and public.vede_servizio(servizio_id)
    and exists (select 1 from public.contratti_voci v where v.id = voce_id));
create policy contratti_voci_servizi_delete on public.contratti_voci_servizi for delete to authenticated
  using (public.puo('budget', 'scrittura') and public.vede_servizio(servizio_id)
    and exists (select 1 from public.contratti_voci v where v.id = voce_id));

-- Le righe del vecchio modello diventano voci con il nome del servizio,
-- con il servizio collegato come dettaglio.
do $$
declare
  r record;
  v_voce uuid;
begin
  for r in
    select cs.contratto_id, cs.servizio_id, cs.prezzo, cs.ordine, cs.note, s.nome
    from public.contratti_servizi cs
    join public.servizi s on s.id = cs.servizio_id
    order by cs.contratto_id, cs.ordine
  loop
    v_voce := gen_random_uuid();
    insert into public.contratti_voci (id, contratto_id, descrizione, prezzo, note, ordine)
    values (v_voce, r.contratto_id, r.nome, r.prezzo, r.note, r.ordine);
    insert into public.contratti_voci_servizi (voce_id, servizio_id) values (v_voce, r.servizio_id);
  end loop;
end;
$$;

drop table public.contratti_servizi;

-- ---------------------------------------------------------------------------
-- Salvataggio atomico: contratto e voci (con i servizi collegati) in
-- un'unica transazione. Le voci si riscrivono per intero: nessun'altra
-- tabella le referenzia. Security invoker: ogni scrittura passa dalle policy.
-- ---------------------------------------------------------------------------

drop function public.salva_contratto(uuid, jsonb, jsonb);

create function public.salva_contratto(
  p_id uuid,
  p_contratto jsonb,
  p_voci jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  -- L'id si genera qui: con INSERT ... RETURNING la policy di lettura
  -- verrebbe valutata su una riga che la funzione non vede ancora.
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_voce uuid;
  v_ordine integer := 0;
  v jsonb;
  sid text;
begin
  if p_id is null then
    insert into public.contratti (id, cliente_id, titolo, stato, data_inizio, data_fine, note)
    values (
      v_id,
      (p_contratto ->> 'cliente_id')::uuid,
      coalesce(p_contratto ->> 'titolo', ''),
      coalesce(nullif(p_contratto ->> 'stato', ''), 'attivo')::public.stato_contratto,
      nullif(p_contratto ->> 'data_inizio', '')::date,
      nullif(p_contratto ->> 'data_fine', '')::date,
      nullif(p_contratto ->> 'note', '')
    );
  else
    update public.contratti set
      cliente_id = (p_contratto ->> 'cliente_id')::uuid,
      titolo = coalesce(p_contratto ->> 'titolo', ''),
      stato = coalesce(nullif(p_contratto ->> 'stato', ''), 'attivo')::public.stato_contratto,
      data_inizio = nullif(p_contratto ->> 'data_inizio', '')::date,
      data_fine = nullif(p_contratto ->> 'data_fine', '')::date,
      note = nullif(p_contratto ->> 'note', '')
    where id = v_id;
    if not found then
      raise exception 'Contratto non trovato o permessi insufficienti' using errcode = '42501';
    end if;
  end if;

  delete from public.contratti_voci where contratto_id = v_id;

  for v in select * from jsonb_array_elements(coalesce(p_voci, '[]'::jsonb)) loop
    v_voce := gen_random_uuid();
    insert into public.contratti_voci (id, contratto_id, descrizione, prezzo, note, ordine)
    values (
      v_voce,
      v_id,
      v ->> 'descrizione',
      coalesce(nullif(v ->> 'prezzo', ''), '0')::numeric,
      nullif(v ->> 'note', ''),
      v_ordine
    );
    for sid in select jsonb_array_elements_text(coalesce(v -> 'servizi', '[]'::jsonb)) loop
      insert into public.contratti_voci_servizi (voce_id, servizio_id)
      values (v_voce, sid::uuid)
      on conflict do nothing;
    end loop;
    v_ordine := v_ordine + 1;
  end loop;

  return v_id;
end;
$$;

revoke execute on function public.salva_contratto(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.salva_contratto(uuid, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Backup: le tabelle nuove al posto di contratti_servizi.
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
    'contratti', 'contratti_voci', 'contratti_voci_servizi',
    'progetti', 'task', 'eventi',
    'budget_mensili', 'debiti', 'debiti_rate', 'salvadanai', 'movimenti',
    'salvadanai_prelievi', 'salvadanai_valori',
    'impostazioni_calendario', 'impostazioni_notifiche'
  ];
$$;

-- Il ripristino usa le tabelle nuove.
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
    'servizi', 'servizi_economico', 'servizi_clienti', 'servizi_clienti_economico', 'credenziali', 'cassaforte',
    'contratti', 'contratti_voci', 'contratti_voci_servizi', 'progetti'] loop
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
