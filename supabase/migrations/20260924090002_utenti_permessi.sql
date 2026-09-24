-- Profili, permessi per sezione e funzioni helper usate da tutte le policy.

create table public.profili (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  ruolo public.ruolo_utente not null default 'collaboratore',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
alter table public.profili enable row level security;
create trigger profili_updated_at before update on public.profili
  for each row execute function public.set_updated_at();

create table public.permessi (
  user_id uuid not null references public.profili (id) on delete cascade,
  sezione public.sezione_permesso not null,
  livello public.livello_permesso not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (user_id, sezione)
);
alter table public.permessi enable row level security;
create trigger permessi_updated_at before update on public.permessi
  for each row execute function public.set_updated_at();

-- Helper. Security definer per leggere profili e permessi senza passare dalle loro
-- policy (che a loro volta usano is_owner: senza definer sarebbe ricorsione).

create function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profili
    where id = (select auth.uid()) and ruolo = 'owner'
  );
$$;

create function public.puo(
  p_sezione public.sezione_permesso,
  p_livello public.livello_permesso default 'lettura'
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_owner() or exists (
    select 1 from public.permessi
    where user_id = (select auth.uid())
      and sezione = p_sezione
      and (livello = 'scrittura' or p_livello = 'lettura')
  );
$$;

-- Crea il profilo a ogni nuovo utente (invito o creazione dal pannello).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profili (id, nome, created_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    null
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Un collaboratore può cambiare il proprio nome ma non il ruolo. Da SQL editor
-- (auth.uid() nullo) il ruolo si può cambiare: è così che si nomina l'owner.
create function public.profili_proteggi_ruolo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ruolo is distinct from old.ruolo
     and (select auth.uid()) is not null
     and not public.is_owner() then
    raise exception 'Solo l''owner può cambiare il ruolo di un utente';
  end if;
  return new;
end;
$$;

create trigger profili_proteggi_ruolo before update on public.profili
  for each row execute function public.profili_proteggi_ruolo();

-- Policy

create policy profili_select on public.profili for select to authenticated
  using (id = (select auth.uid()) or public.is_owner());
create policy profili_update on public.profili for update to authenticated
  using (id = (select auth.uid()) or public.is_owner())
  with check (id = (select auth.uid()) or public.is_owner());
create policy profili_delete on public.profili for delete to authenticated
  using (public.is_owner());
-- Nessuna policy di insert: i profili li crea solo il trigger.

create policy permessi_select on public.permessi for select to authenticated
  using (user_id = (select auth.uid()) or public.is_owner());
create policy permessi_insert on public.permessi for insert to authenticated
  with check (public.is_owner());
create policy permessi_update on public.permessi for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy permessi_delete on public.permessi for delete to authenticated
  using (public.is_owner());
