-- Servizi con scadenza, collegamento ai clienti, dati economici separati,
-- storico rinnovi e credenziali.
--
-- I dati economici (costo, metodo di pagamento, categoria di spesa, prezzi di
-- rivendita) stanno in tabelle a parte perché RLS filtra righe e non colonne:
-- un collaboratore con permesso "servizi" vede il servizio, ma i soldi solo
-- con il permesso "budget".

create table public.tipi_servizio (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  icona text,
  preavviso_default integer not null default 30 check (preavviso_default >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
alter table public.tipi_servizio enable row level security;
create trigger tipi_servizio_updated_at before update on public.tipi_servizio
  for each row execute function public.set_updated_at();

create table public.servizi (
  id uuid primary key default gen_random_uuid(),
  ambito public.ambito not null default 'lavoro',
  nome text not null check (length(trim(nome)) > 0),
  tipo_id uuid references public.tipi_servizio (id) on delete set null,
  fornitore text,
  frequenza public.frequenza_servizio not null default 'annuale',
  prossima_scadenza date not null,
  rinnovo_automatico boolean not null default false,
  chi_paga public.chi_paga not null default 'io',
  -- Nullo = usa il preavviso di default del tipo.
  preavviso_giorni integer check (preavviso_giorni >= 0),
  url_pannello text,
  username text,
  stato public.stato_servizio not null default 'attivo',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
alter table public.servizi enable row level security;
create trigger servizi_updated_at before update on public.servizi
  for each row execute function public.set_updated_at();
create index servizi_tipo_idx on public.servizi (tipo_id);
create index servizi_scadenza_idx on public.servizi (prossima_scadenza);
create index servizi_stato_ambito_idx on public.servizi (stato, ambito);

create table public.servizi_clienti (
  servizio_id uuid not null references public.servizi (id) on delete cascade,
  cliente_id uuid not null references public.clienti (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (servizio_id, cliente_id)
);
alter table public.servizi_clienti enable row level security;
create trigger servizi_clienti_updated_at before update on public.servizi_clienti
  for each row execute function public.set_updated_at();
create index servizi_clienti_cliente_idx on public.servizi_clienti (cliente_id);

-- Un collaboratore vede un servizio se è di lavoro, ha il permesso "servizi" e il
-- servizio è collegato ad almeno un suo cliente (o l'ha creato lui, altrimenti
-- non potrebbe collegarlo dopo averlo inserito). Security definer perché
-- legge servizi_clienti, le cui policy a loro volta usano questa funzione.
create function public.vede_servizio(p_servizio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_owner() or exists (
    select 1 from public.servizi s
    where s.id = p_servizio_id
      and s.ambito = 'lavoro'
      and public.puo('servizi')
      and (
        s.created_by = (select auth.uid())
        or exists (
          select 1 from public.servizi_clienti sc
          where sc.servizio_id = s.id and public.vede_cliente(sc.cliente_id)
        )
      )
  );
$$;

create table public.servizi_economico (
  servizio_id uuid primary key references public.servizi (id) on delete cascade,
  costo numeric(10, 2) check (costo >= 0),
  valuta text not null default 'EUR' check (valuta ~ '^[A-Z]{3}$'),
  -- Solo testo descrittivo (es. "Revolut *4417"): rifiutato se contiene
  -- 12 o più cifre di fila, cioè qualcosa che somiglia a un numero di carta.
  metodo_pagamento text check (
    metodo_pagamento is null
    or regexp_replace(metodo_pagamento, '[\s.-]', '', 'g') !~ '\d{12,}'
  ),
  categoria_spesa_id uuid, -- FK aggiunta nella migration del budget
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
alter table public.servizi_economico enable row level security;
create trigger servizi_economico_updated_at before update on public.servizi_economico
  for each row execute function public.set_updated_at();
create index servizi_economico_categoria_idx on public.servizi_economico (categoria_spesa_id);

create table public.servizi_clienti_economico (
  servizio_id uuid not null,
  cliente_id uuid not null,
  prezzo_rivendita numeric(10, 2) check (prezzo_rivendita >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (servizio_id, cliente_id),
  foreign key (servizio_id, cliente_id)
    references public.servizi_clienti (servizio_id, cliente_id) on delete cascade
);
alter table public.servizi_clienti_economico enable row level security;
create trigger servizi_clienti_economico_updated_at before update on public.servizi_clienti_economico
  for each row execute function public.set_updated_at();
create index servizi_clienti_economico_cliente_idx on public.servizi_clienti_economico (cliente_id);

create table public.servizi_rinnovi (
  id uuid primary key default gen_random_uuid(),
  servizio_id uuid not null references public.servizi (id) on delete cascade,
  data date not null,
  importo numeric(10, 2) check (importo >= 0),
  movimento_id uuid, -- FK aggiunta nella migration del budget
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
alter table public.servizi_rinnovi enable row level security;
create trigger servizi_rinnovi_updated_at before update on public.servizi_rinnovi
  for each row execute function public.set_updated_at();
create index servizi_rinnovi_servizio_idx on public.servizi_rinnovi (servizio_id, data desc);
create index servizi_rinnovi_movimento_idx on public.servizi_rinnovi (movimento_id);

create table public.credenziali (
  id uuid primary key default gen_random_uuid(),
  servizio_id uuid references public.servizi (id) on delete cascade,
  cliente_id uuid references public.clienti (id) on delete cascade,
  etichetta text not null,
  tipo public.tipo_credenziale not null,
  url_password_manager text,
  -- Base64. La cifratura avviene solo nel browser: qui non arriva mai il chiaro.
  payload_cifrato text,
  iv text,
  salt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  check (num_nonnulls(servizio_id, cliente_id) = 1),
  check (
    (tipo = 'link_password_manager' and url_password_manager is not null
      and payload_cifrato is null and iv is null and salt is null)
    or
    (tipo = 'cifrata' and payload_cifrato is not null and iv is not null and salt is not null
      and url_password_manager is null)
  )
);
alter table public.credenziali enable row level security;
create trigger credenziali_updated_at before update on public.credenziali
  for each row execute function public.set_updated_at();
create index credenziali_servizio_idx on public.credenziali (servizio_id);
create index credenziali_cliente_idx on public.credenziali (cliente_id);

-- Stato di scadenza calcolato, mai salvato.
create view public.v_servizi
with (security_invoker = true)
as
select
  s.*,
  e.costo,
  e.valuta,
  e.metodo_pagamento,
  e.categoria_spesa_id,
  t.nome as tipo_nome,
  t.icona as tipo_icona,
  coalesce(s.preavviso_giorni, t.preavviso_default, 30) as preavviso_effettivo,
  s.prossima_scadenza - public.oggi() as giorni_alla_scadenza,
  case
    when s.prossima_scadenza - public.oggi() < 0 then 'scaduto'
    when s.prossima_scadenza - public.oggi() <= 7 then 'urgente'
    when s.prossima_scadenza - public.oggi() <= coalesce(s.preavviso_giorni, t.preavviso_default, 30)
      then 'in_scadenza'
    else 'ok'
  end as stato_scadenza
from public.servizi s
left join public.servizi_economico e on e.servizio_id = s.id
left join public.tipi_servizio t on t.id = s.tipo_id;

-- Policy

create policy tipi_servizio_select on public.tipi_servizio for select to authenticated
  using (public.puo('servizi'));
create policy tipi_servizio_insert on public.tipi_servizio for insert to authenticated
  with check (public.is_owner());
create policy tipi_servizio_update on public.tipi_servizio for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy tipi_servizio_delete on public.tipi_servizio for delete to authenticated
  using (public.is_owner());

create policy servizi_select on public.servizi for select to authenticated
  using (public.vede_servizio(id));
create policy servizi_insert on public.servizi for insert to authenticated
  with check (public.is_owner() or (ambito = 'lavoro' and public.puo('servizi', 'scrittura')));
create policy servizi_update on public.servizi for update to authenticated
  using (public.vede_servizio(id) and public.puo('servizi', 'scrittura'))
  with check (public.is_owner() or (ambito = 'lavoro' and public.puo('servizi', 'scrittura')));
create policy servizi_delete on public.servizi for delete to authenticated
  using (public.vede_servizio(id) and public.puo('servizi', 'scrittura'));

create policy servizi_clienti_select on public.servizi_clienti for select to authenticated
  using (public.vede_servizio(servizio_id) and public.vede_cliente(cliente_id));
create policy servizi_clienti_insert on public.servizi_clienti for insert to authenticated
  with check (public.puo('servizi', 'scrittura')
    and public.vede_servizio(servizio_id) and public.vede_cliente(cliente_id));
create policy servizi_clienti_update on public.servizi_clienti for update to authenticated
  using (public.puo('servizi', 'scrittura')
    and public.vede_servizio(servizio_id) and public.vede_cliente(cliente_id))
  with check (public.puo('servizi', 'scrittura')
    and public.vede_servizio(servizio_id) and public.vede_cliente(cliente_id));
create policy servizi_clienti_delete on public.servizi_clienti for delete to authenticated
  using (public.puo('servizi', 'scrittura')
    and public.vede_servizio(servizio_id) and public.vede_cliente(cliente_id));

-- Dati economici e rinnovi: servizio visibile + permesso budget.
do $$
declare
  t text;
begin
  foreach t in array array['servizi_economico', 'servizi_rinnovi'] loop
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated
         using (public.puo(''budget'') and public.vede_servizio(servizio_id))', t);
    execute format(
      'create policy %1$s_insert on public.%1$s for insert to authenticated
         with check (public.puo(''budget'', ''scrittura'') and public.vede_servizio(servizio_id))', t);
    execute format(
      'create policy %1$s_update on public.%1$s for update to authenticated
         using (public.puo(''budget'', ''scrittura'') and public.vede_servizio(servizio_id))
         with check (public.puo(''budget'', ''scrittura'') and public.vede_servizio(servizio_id))', t);
    execute format(
      'create policy %1$s_delete on public.%1$s for delete to authenticated
         using (public.puo(''budget'', ''scrittura'') and public.vede_servizio(servizio_id))', t);
  end loop;
end;
$$;

create policy servizi_clienti_economico_select on public.servizi_clienti_economico for select to authenticated
  using (public.puo('budget') and public.vede_servizio(servizio_id) and public.vede_cliente(cliente_id));
create policy servizi_clienti_economico_insert on public.servizi_clienti_economico for insert to authenticated
  with check (public.puo('budget', 'scrittura')
    and public.vede_servizio(servizio_id) and public.vede_cliente(cliente_id));
create policy servizi_clienti_economico_update on public.servizi_clienti_economico for update to authenticated
  using (public.puo('budget', 'scrittura')
    and public.vede_servizio(servizio_id) and public.vede_cliente(cliente_id))
  with check (public.puo('budget', 'scrittura')
    and public.vede_servizio(servizio_id) and public.vede_cliente(cliente_id));
create policy servizi_clienti_economico_delete on public.servizi_clienti_economico for delete to authenticated
  using (public.puo('budget', 'scrittura')
    and public.vede_servizio(servizio_id) and public.vede_cliente(cliente_id));

-- Credenziali: permesso dedicato, più la visibilità dell'oggetto a cui appartengono.
create function public.vede_credenziale(
  p_servizio_id uuid,
  p_cliente_id uuid,
  p_livello public.livello_permesso
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.puo('credenziali', p_livello) and case
    when p_servizio_id is not null then public.vede_servizio(p_servizio_id)
    else public.puo('clienti') and public.vede_cliente(p_cliente_id)
  end;
$$;

create policy credenziali_select on public.credenziali for select to authenticated
  using (public.vede_credenziale(servizio_id, cliente_id, 'lettura'));
create policy credenziali_insert on public.credenziali for insert to authenticated
  with check (public.vede_credenziale(servizio_id, cliente_id, 'scrittura'));
create policy credenziali_update on public.credenziali for update to authenticated
  using (public.vede_credenziale(servizio_id, cliente_id, 'scrittura'))
  with check (public.vede_credenziale(servizio_id, cliente_id, 'scrittura'));
create policy credenziali_delete on public.credenziali for delete to authenticated
  using (public.vede_credenziale(servizio_id, cliente_id, 'scrittura'));
