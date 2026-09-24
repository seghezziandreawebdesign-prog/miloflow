-- Categorie, budget mensili, movimenti, debiti e rate.
-- Tutto richiede il permesso "budget"; il collaboratore non vede mai l'ambito personale.

create table public.categorie (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  parent_id uuid references public.categorie (id) on delete cascade,
  ambito public.ambito_categoria not null default 'entrambi',
  colore text,
  icona text,
  budget_default numeric(10, 2) check (budget_default >= 0),
  ordine integer not null default 0,
  archiviata boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  check (parent_id is null or parent_id <> id)
);
alter table public.categorie enable row level security;
create trigger categorie_updated_at before update on public.categorie
  for each row execute function public.set_updated_at();
create index categorie_parent_idx on public.categorie (parent_id);

-- Albero a due livelli al massimo.
create function public.categorie_due_livelli()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is not null then
    if exists (select 1 from public.categorie where id = new.parent_id and parent_id is not null) then
      raise exception 'Le categorie hanno al massimo due livelli';
    end if;
    if tg_op = 'UPDATE' and exists (select 1 from public.categorie where parent_id = new.id) then
      raise exception 'Una categoria con sottocategorie non può diventare sottocategoria';
    end if;
  end if;
  return new;
end;
$$;

create trigger categorie_due_livelli before insert or update of parent_id on public.categorie
  for each row execute function public.categorie_due_livelli();

create table public.budget_mensili (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorie (id) on delete cascade,
  mese date not null check (extract(day from mese) = 1),
  importo numeric(10, 2) not null check (importo >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (categoria_id, mese)
);
alter table public.budget_mensili enable row level security;
create trigger budget_mensili_updated_at before update on public.budget_mensili
  for each row execute function public.set_updated_at();
create index budget_mensili_mese_idx on public.budget_mensili (mese);

create table public.debiti (
  id uuid primary key default gen_random_uuid(),
  ambito public.ambito not null default 'personale',
  creditore text not null,
  descrizione text,
  importo_totale numeric(10, 2) not null check (importo_totale >= 0),
  tipo public.tipo_debito not null,
  data_inizio date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
alter table public.debiti enable row level security;
create trigger debiti_updated_at before update on public.debiti
  for each row execute function public.set_updated_at();

create table public.debiti_rate (
  id uuid primary key default gen_random_uuid(),
  debito_id uuid not null references public.debiti (id) on delete cascade,
  numero integer not null check (numero > 0),
  scadenza date not null,
  importo numeric(10, 2) not null check (importo >= 0),
  pagata boolean not null default false,
  movimento_id uuid, -- FK più sotto, dopo movimenti
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (debito_id, numero)
);
alter table public.debiti_rate enable row level security;
create trigger debiti_rate_updated_at before update on public.debiti_rate
  for each row execute function public.set_updated_at();
create index debiti_rate_scadenza_idx on public.debiti_rate (scadenza) where not pagata;
create index debiti_rate_movimento_idx on public.debiti_rate (movimento_id);

create table public.movimenti (
  id uuid primary key default gen_random_uuid(),
  ambito public.ambito not null default 'lavoro',
  data date not null default public.oggi(),
  importo numeric(10, 2) not null check (importo >= 0),
  descrizione text,
  categoria_id uuid references public.categorie (id) on delete set null,
  stato public.stato_movimento not null default 'pagato',
  servizio_id uuid references public.servizi (id) on delete set null,
  rata_id uuid references public.debiti_rate (id) on delete set null,
  periodo date check (periodo is null or extract(day from periodo) = 1),
  metodo_pagamento text check (
    metodo_pagamento is null
    or regexp_replace(metodo_pagamento, '[\s.-]', '', 'g') !~ '\d{12,}'
  ),
  ricevuta_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  -- Impediscono i duplicati quando genera_previsti gira più volte.
  unique (servizio_id, periodo),
  unique (rata_id)
);
alter table public.movimenti enable row level security;
create trigger movimenti_updated_at before update on public.movimenti
  for each row execute function public.set_updated_at();
create index movimenti_data_idx on public.movimenti (data);
create index movimenti_periodo_idx on public.movimenti (periodo);
create index movimenti_categoria_idx on public.movimenti (categoria_id);
create index movimenti_stato_idx on public.movimenti (stato);

-- Chiavi esterne che chiudono i riferimenti circolari.
alter table public.debiti_rate
  add constraint debiti_rate_movimento_fk
  foreign key (movimento_id) references public.movimenti (id) on delete set null;
alter table public.servizi_rinnovi
  add constraint servizi_rinnovi_movimento_fk
  foreign key (movimento_id) references public.movimenti (id) on delete set null;
alter table public.servizi_economico
  add constraint servizi_economico_categoria_fk
  foreign key (categoria_spesa_id) references public.categorie (id) on delete set null;

-- Policy

create policy categorie_select on public.categorie for select to authenticated
  using (public.is_owner() or (ambito <> 'personale' and public.puo('budget')));
create policy categorie_insert on public.categorie for insert to authenticated
  with check (public.is_owner() or (ambito <> 'personale' and public.puo('budget', 'scrittura')));
create policy categorie_update on public.categorie for update to authenticated
  using (public.is_owner() or (ambito <> 'personale' and public.puo('budget', 'scrittura')))
  with check (public.is_owner() or (ambito <> 'personale' and public.puo('budget', 'scrittura')));
create policy categorie_delete on public.categorie for delete to authenticated
  using (public.is_owner() or (ambito <> 'personale' and public.puo('budget', 'scrittura')));

-- budget_mensili e debiti_rate ereditano la visibilità dalla riga madre:
-- la sottoquery passa dalle policy di categorie/debiti.
create policy budget_mensili_select on public.budget_mensili for select to authenticated
  using (public.puo('budget')
    and exists (select 1 from public.categorie c where c.id = categoria_id));
create policy budget_mensili_insert on public.budget_mensili for insert to authenticated
  with check (public.puo('budget', 'scrittura')
    and exists (select 1 from public.categorie c where c.id = categoria_id));
create policy budget_mensili_update on public.budget_mensili for update to authenticated
  using (public.puo('budget', 'scrittura')
    and exists (select 1 from public.categorie c where c.id = categoria_id))
  with check (public.puo('budget', 'scrittura')
    and exists (select 1 from public.categorie c where c.id = categoria_id));
create policy budget_mensili_delete on public.budget_mensili for delete to authenticated
  using (public.puo('budget', 'scrittura')
    and exists (select 1 from public.categorie c where c.id = categoria_id));

do $$
declare
  t text;
begin
  foreach t in array array['movimenti', 'debiti'] loop
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated
         using (public.is_owner() or (ambito = ''lavoro'' and public.puo(''budget'')))', t);
    execute format(
      'create policy %1$s_insert on public.%1$s for insert to authenticated
         with check (public.is_owner() or (ambito = ''lavoro'' and public.puo(''budget'', ''scrittura'')))', t);
    execute format(
      'create policy %1$s_update on public.%1$s for update to authenticated
         using (public.is_owner() or (ambito = ''lavoro'' and public.puo(''budget'', ''scrittura'')))
         with check (public.is_owner() or (ambito = ''lavoro'' and public.puo(''budget'', ''scrittura'')))', t);
    execute format(
      'create policy %1$s_delete on public.%1$s for delete to authenticated
         using (public.is_owner() or (ambito = ''lavoro'' and public.puo(''budget'', ''scrittura'')))', t);
  end loop;
end;
$$;

create policy debiti_rate_select on public.debiti_rate for select to authenticated
  using (public.puo('budget')
    and exists (select 1 from public.debiti d where d.id = debito_id));
create policy debiti_rate_insert on public.debiti_rate for insert to authenticated
  with check (public.puo('budget', 'scrittura')
    and exists (select 1 from public.debiti d where d.id = debito_id));
create policy debiti_rate_update on public.debiti_rate for update to authenticated
  using (public.puo('budget', 'scrittura')
    and exists (select 1 from public.debiti d where d.id = debito_id))
  with check (public.puo('budget', 'scrittura')
    and exists (select 1 from public.debiti d where d.id = debito_id));
create policy debiti_rate_delete on public.debiti_rate for delete to authenticated
  using (public.puo('budget', 'scrittura')
    and exists (select 1 from public.debiti d where d.id = debito_id));
