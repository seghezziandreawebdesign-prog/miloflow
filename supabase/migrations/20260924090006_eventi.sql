-- Eventi del calendario.

create table public.eventi (
  id uuid primary key default gen_random_uuid(),
  ambito public.ambito not null default 'lavoro',
  titolo text not null check (length(trim(titolo)) > 0),
  inizio timestamptz not null,
  fine timestamptz,
  tutto_il_giorno boolean not null default false,
  luogo text,
  link_call text,
  cliente_id uuid references public.clienti (id) on delete set null,
  progetto_id uuid references public.progetti (id) on delete set null,
  ricorrenza text, -- stringa RRULE
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  check (fine is null or fine >= inizio)
);
alter table public.eventi enable row level security;
create trigger eventi_updated_at before update on public.eventi
  for each row execute function public.set_updated_at();
create index eventi_inizio_idx on public.eventi (inizio);
create index eventi_cliente_idx on public.eventi (cliente_id);
create index eventi_progetto_idx on public.eventi (progetto_id);

create policy eventi_select on public.eventi for select to authenticated
  using (public.is_owner()
    or (ambito = 'lavoro' and public.puo('calendario') and public.vede_cliente(cliente_id)));
create policy eventi_insert on public.eventi for insert to authenticated
  with check (public.is_owner()
    or (ambito = 'lavoro' and public.puo('calendario', 'scrittura') and public.vede_cliente(cliente_id)));
create policy eventi_update on public.eventi for update to authenticated
  using (public.is_owner()
    or (ambito = 'lavoro' and public.puo('calendario', 'scrittura') and public.vede_cliente(cliente_id)))
  with check (public.is_owner()
    or (ambito = 'lavoro' and public.puo('calendario', 'scrittura') and public.vede_cliente(cliente_id)));
create policy eventi_delete on public.eventi for delete to authenticated
  using (public.is_owner()
    or (ambito = 'lavoro' and public.puo('calendario', 'scrittura') and public.vede_cliente(cliente_id)));
