-- Clienti, contatti, link, diario e accessi dei collaboratori ai clienti.
-- I clienti sono sempre ambito lavoro, quindi non hanno la colonna ambito.

create table public.clienti (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_cliente not null default 'azienda',
  ragione_sociale text not null check (length(trim(ragione_sociale)) > 0),
  nome_breve text,
  piva text,
  codice_fiscale text,
  codice_sdi text,
  pec text,
  nazione text not null default 'IT' check (nazione ~ '^[A-Z]{2}$'),
  indirizzo text,
  cap text,
  citta text,
  provincia text,
  email text,
  telefono text,
  sito text,
  logo_path text,
  colore text,
  stato public.stato_cliente not null default 'attivo',
  tags text[] not null default '{}',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
alter table public.clienti enable row level security;
create trigger clienti_updated_at before update on public.clienti
  for each row execute function public.set_updated_at();
create index clienti_stato_idx on public.clienti (stato);
create index clienti_tags_idx on public.clienti using gin (tags);

create table public.accessi_clienti (
  user_id uuid not null references public.profili (id) on delete cascade,
  cliente_id uuid not null references public.clienti (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (user_id, cliente_id)
);
alter table public.accessi_clienti enable row level security;
create trigger accessi_clienti_updated_at before update on public.accessi_clienti
  for each row execute function public.set_updated_at();
create index accessi_clienti_cliente_idx on public.accessi_clienti (cliente_id);

-- Owner, oppure il cliente è tra quelli assegnati. Un cliente nullo non è visibile
-- al collaboratore: le entità senza cliente gli restano nascoste.
create function public.vede_cliente(p_cliente_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_owner() or (
    p_cliente_id is not null and exists (
      select 1 from public.accessi_clienti
      where user_id = (select auth.uid()) and cliente_id = p_cliente_id
    )
  );
$$;

create table public.clienti_contatti (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clienti (id) on delete cascade,
  nome text not null,
  ruolo text,
  email text,
  telefono text,
  principale boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
alter table public.clienti_contatti enable row level security;
create trigger clienti_contatti_updated_at before update on public.clienti_contatti
  for each row execute function public.set_updated_at();
create index clienti_contatti_cliente_idx on public.clienti_contatti (cliente_id);
-- Al massimo un contatto principale per cliente.
create unique index clienti_contatti_principale_uidx
  on public.clienti_contatti (cliente_id) where principale;

create table public.clienti_link (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clienti (id) on delete cascade,
  etichetta text not null,
  url text not null,
  ordine integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
alter table public.clienti_link enable row level security;
create trigger clienti_link_updated_at before update on public.clienti_link
  for each row execute function public.set_updated_at();
create index clienti_link_cliente_idx on public.clienti_link (cliente_id);

create table public.clienti_diario (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clienti (id) on delete cascade,
  data date not null default public.oggi(),
  testo text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
alter table public.clienti_diario enable row level security;
create trigger clienti_diario_updated_at before update on public.clienti_diario
  for each row execute function public.set_updated_at();
create index clienti_diario_cliente_data_idx on public.clienti_diario (cliente_id, data desc);

-- Policy

-- Un collaboratore non crea clienti: non sarebbe in accessi_clienti e non lo vedrebbe.
create policy clienti_select on public.clienti for select to authenticated
  using (public.puo('clienti') and public.vede_cliente(id));
create policy clienti_insert on public.clienti for insert to authenticated
  with check (public.is_owner());
create policy clienti_update on public.clienti for update to authenticated
  using (public.puo('clienti', 'scrittura') and public.vede_cliente(id))
  with check (public.puo('clienti', 'scrittura') and public.vede_cliente(id));
create policy clienti_delete on public.clienti for delete to authenticated
  using (public.is_owner());

create policy accessi_clienti_select on public.accessi_clienti for select to authenticated
  using (user_id = (select auth.uid()) or public.is_owner());
create policy accessi_clienti_insert on public.accessi_clienti for insert to authenticated
  with check (public.is_owner());
create policy accessi_clienti_update on public.accessi_clienti for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy accessi_clienti_delete on public.accessi_clienti for delete to authenticated
  using (public.is_owner());

-- Tabelle figlie: stesse regole del cliente a cui appartengono.
do $$
declare
  t text;
begin
  foreach t in array array['clienti_contatti', 'clienti_link', 'clienti_diario'] loop
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated
         using (public.puo(''clienti'') and public.vede_cliente(cliente_id))', t);
    execute format(
      'create policy %1$s_insert on public.%1$s for insert to authenticated
         with check (public.puo(''clienti'', ''scrittura'') and public.vede_cliente(cliente_id))', t);
    execute format(
      'create policy %1$s_update on public.%1$s for update to authenticated
         using (public.puo(''clienti'', ''scrittura'') and public.vede_cliente(cliente_id))
         with check (public.puo(''clienti'', ''scrittura'') and public.vede_cliente(cliente_id))', t);
    execute format(
      'create policy %1$s_delete on public.%1$s for delete to authenticated
         using (public.puo(''clienti'', ''scrittura'') and public.vede_cliente(cliente_id))', t);
  end loop;
end;
$$;
