-- Progetti e task (con sottotask a un solo livello).

create table public.progetti (
  id uuid primary key default gen_random_uuid(),
  ambito public.ambito not null default 'lavoro',
  nome text not null check (length(trim(nome)) > 0),
  cliente_id uuid references public.clienti (id) on delete set null,
  stato public.stato_progetto not null default 'attivo',
  scadenza date,
  colore text,
  descrizione text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
alter table public.progetti enable row level security;
create trigger progetti_updated_at before update on public.progetti
  for each row execute function public.set_updated_at();
create index progetti_cliente_idx on public.progetti (cliente_id);
create index progetti_stato_idx on public.progetti (stato);

create table public.task (
  id uuid primary key default gen_random_uuid(),
  ambito public.ambito not null default 'lavoro',
  titolo text not null check (length(trim(titolo)) > 0),
  note text,
  progetto_id uuid references public.progetti (id) on delete set null,
  cliente_id uuid references public.clienti (id) on delete set null,
  parent_id uuid references public.task (id) on delete cascade,
  servizio_id uuid references public.servizi (id) on delete set null,
  stato public.stato_task not null default 'da_fare',
  in_attesa_di text,
  in_attesa_dal date,
  priorita smallint check (priorita between 1 and 3),
  data_pianificata date,
  scadenza date,
  durata_min integer check (durata_min > 0),
  ricorrenza text, -- stringa RRULE
  assegnata_a uuid references public.profili (id) on delete set null,
  ordine double precision not null default 0,
  completata_il timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  check (parent_id is null or parent_id <> id)
);
alter table public.task enable row level security;
create trigger task_updated_at before update on public.task
  for each row execute function public.set_updated_at();
create index task_progetto_idx on public.task (progetto_id);
create index task_cliente_idx on public.task (cliente_id);
create index task_parent_idx on public.task (parent_id);
create index task_servizio_idx on public.task (servizio_id);
create index task_assegnata_idx on public.task (assegnata_a);
create index task_data_pianificata_idx on public.task (data_pianificata) where stato <> 'fatto';
create index task_scadenza_idx on public.task (scadenza) where stato <> 'fatto';
create index task_stato_idx on public.task (stato);

-- Regole di coerenza della task, applicate prima di ogni scrittura:
-- - sottotask al massimo di un livello;
-- - la sottotask eredita ambito, progetto e cliente dal genitore;
-- - con un progetto che ha un cliente, il cliente si eredita dal progetto;
-- - completata_il segue lo stato "fatto".
-- Security definer per leggere genitore e progetto anche quando chi scrive
-- non li vede (le policy della task restano comunque applicate alla riga).
create function public.task_coerenza()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  genitore record;
  cliente_progetto uuid;
begin
  if new.parent_id is not null then
    select parent_id, ambito, progetto_id, cliente_id into genitore
    from public.task where id = new.parent_id;
    if genitore.parent_id is not null then
      raise exception 'Le sottotask possono avere un solo livello';
    end if;
    if tg_op = 'UPDATE' and exists (select 1 from public.task where parent_id = new.id) then
      raise exception 'Una task con sottotask non può diventare a sua volta una sottotask';
    end if;
    new.ambito := genitore.ambito;
    new.progetto_id := genitore.progetto_id;
    new.cliente_id := genitore.cliente_id;
  end if;

  if new.progetto_id is not null and new.parent_id is null then
    select cliente_id into cliente_progetto from public.progetti where id = new.progetto_id;
    if cliente_progetto is not null then
      new.cliente_id := cliente_progetto;
    end if;
  end if;

  if new.stato = 'fatto' and (tg_op = 'INSERT' or old.stato <> 'fatto') then
    new.completata_il := coalesce(new.completata_il, now());
  elsif new.stato <> 'fatto' then
    new.completata_il := null;
  end if;

  return new;
end;
$$;

create trigger task_coerenza before insert or update on public.task
  for each row execute function public.task_coerenza();

-- Quando cambiano progetto o cliente di una task madre, le sottotask si allineano.
create function public.task_propaga_a_sottotask()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.task
  set ambito = new.ambito, progetto_id = new.progetto_id, cliente_id = new.cliente_id
  where parent_id = new.id
    and (ambito, progetto_id, cliente_id) is distinct from (new.ambito, new.progetto_id, new.cliente_id);
  return null;
end;
$$;

create trigger task_propaga_a_sottotask
  after update of ambito, progetto_id, cliente_id on public.task
  for each row execute function public.task_propaga_a_sottotask();

-- Quando il progetto cambia cliente, le sue task si allineano.
create function public.progetti_propaga_cliente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cliente_id is not null then
    update public.task set cliente_id = new.cliente_id
    where progetto_id = new.id and cliente_id is distinct from new.cliente_id;
  end if;
  return null;
end;
$$;

create trigger progetti_propaga_cliente
  after update of cliente_id on public.progetti
  for each row execute function public.progetti_propaga_cliente();

-- Policy

create policy progetti_select on public.progetti for select to authenticated
  using (public.is_owner()
    or (ambito = 'lavoro' and public.puo('task') and public.vede_cliente(cliente_id)));
create policy progetti_insert on public.progetti for insert to authenticated
  with check (public.is_owner()
    or (ambito = 'lavoro' and public.puo('task', 'scrittura') and public.vede_cliente(cliente_id)));
create policy progetti_update on public.progetti for update to authenticated
  using (public.is_owner()
    or (ambito = 'lavoro' and public.puo('task', 'scrittura') and public.vede_cliente(cliente_id)))
  with check (public.is_owner()
    or (ambito = 'lavoro' and public.puo('task', 'scrittura') and public.vede_cliente(cliente_id)));
create policy progetti_delete on public.progetti for delete to authenticated
  using (public.is_owner()
    or (ambito = 'lavoro' and public.puo('task', 'scrittura') and public.vede_cliente(cliente_id)));

-- Task del collaboratore: con cliente se il cliente è suo, senza cliente solo se assegnata a lui.
create function public.vede_task(
  p_ambito public.ambito,
  p_cliente_id uuid,
  p_assegnata_a uuid,
  p_livello public.livello_permesso
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_owner() or (
    p_ambito = 'lavoro'
    and public.puo('task', p_livello)
    and case
      when p_cliente_id is null then p_assegnata_a = (select auth.uid())
      else public.vede_cliente(p_cliente_id)
    end
  );
$$;

create policy task_select on public.task for select to authenticated
  using (public.vede_task(ambito, cliente_id, assegnata_a, 'lettura'));
create policy task_insert on public.task for insert to authenticated
  with check (public.vede_task(ambito, cliente_id, assegnata_a, 'scrittura'));
create policy task_update on public.task for update to authenticated
  using (public.vede_task(ambito, cliente_id, assegnata_a, 'scrittura'))
  with check (public.vede_task(ambito, cliente_id, assegnata_a, 'scrittura'));
create policy task_delete on public.task for delete to authenticated
  using (public.vede_task(ambito, cliente_id, assegnata_a, 'scrittura'));
