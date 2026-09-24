-- Metodi di pagamento gestiti (carte, contanti, conti) al posto del testo libero.
-- Servono a sapere con cosa si paga ogni servizio e, dalla fase 5, quanto si
-- spende con ogni carta. Stanno nella sezione budget: stessi permessi.

create type public.tipo_metodo_pagamento as enum (
  'carta_credito', 'carta_debito', 'prepagata', 'contanti', 'conto', 'altro'
);

create table public.metodi_pagamento (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  tipo public.tipo_metodo_pagamento not null,
  -- Solo le ultime 4 cifre: mai il numero completo.
  ultime_cifre text check (ultime_cifre ~ '^\d{4}$'),
  colore text,
  ambito public.ambito_categoria not null default 'entrambi',
  archiviato boolean not null default false,
  ordine integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
alter table public.metodi_pagamento enable row level security;
create trigger metodi_pagamento_updated_at before update on public.metodi_pagamento
  for each row execute function public.set_updated_at();

create policy metodi_pagamento_select on public.metodi_pagamento for select to authenticated
  using (public.is_owner() or (ambito <> 'personale' and public.puo('budget')));
create policy metodi_pagamento_insert on public.metodi_pagamento for insert to authenticated
  with check (public.is_owner() or (ambito <> 'personale' and public.puo('budget', 'scrittura')));
create policy metodi_pagamento_update on public.metodi_pagamento for update to authenticated
  using (public.is_owner() or (ambito <> 'personale' and public.puo('budget', 'scrittura')))
  with check (public.is_owner() or (ambito <> 'personale' and public.puo('budget', 'scrittura')));
create policy metodi_pagamento_delete on public.metodi_pagamento for delete to authenticated
  using (public.is_owner() or (ambito <> 'personale' and public.puo('budget', 'scrittura')));

revoke all on public.metodi_pagamento from anon;
grant select, insert, update, delete on public.metodi_pagamento to authenticated;

insert into public.metodi_pagamento (nome, tipo, ordine, created_by) values ('Contanti', 'contanti', 100, null);

-- v_servizi dipende dalla vecchia colonna: si elimina qui e si ricrea sotto.
drop view public.v_servizi;

-- Il testo libero lascia il posto al collegamento (verificato: nessun dato da migrare).
alter table public.servizi_economico
  drop column metodo_pagamento,
  add column metodo_pagamento_id uuid references public.metodi_pagamento (id) on delete set null;
create index servizi_economico_metodo_idx on public.servizi_economico (metodo_pagamento_id);

alter table public.movimenti
  drop column metodo_pagamento,
  add column metodo_pagamento_id uuid references public.metodi_pagamento (id) on delete set null;
create index movimenti_metodo_idx on public.movimenti (metodo_pagamento_id);

-- v_servizi ricreata con il metodo di pagamento collegato.
create view public.v_servizi
with (security_invoker = true)
as
select
  s.*,
  e.costo,
  e.valuta,
  e.metodo_pagamento_id,
  m.nome as metodo_pagamento_nome,
  m.tipo as metodo_pagamento_tipo,
  m.ultime_cifre as metodo_pagamento_cifre,
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
left join public.metodi_pagamento m on m.id = e.metodo_pagamento_id
left join public.tipi_servizio t on t.id = s.tipo_id;

grant select on public.v_servizi to authenticated;
revoke all on public.v_servizi from anon;

-- salva_servizio: il metodo di pagamento ora è un riferimento.
create or replace function public.salva_servizio(
  p_id uuid,
  p_servizio jsonb,
  p_economico jsonb,
  p_clienti jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_budget boolean := public.puo('budget', 'scrittura');
  v_clienti uuid[];
  c jsonb;
begin
  if p_id is null then
    insert into public.servizi (
      id, ambito, nome, tipo_id, fornitore, frequenza, prossima_scadenza, rinnovo_automatico,
      chi_paga, preavviso_giorni, url_pannello, username, stato, note
    ) values (
      v_id,
      (p_servizio ->> 'ambito')::public.ambito,
      p_servizio ->> 'nome',
      nullif(p_servizio ->> 'tipo_id', '')::uuid,
      nullif(p_servizio ->> 'fornitore', ''),
      (p_servizio ->> 'frequenza')::public.frequenza_servizio,
      (p_servizio ->> 'prossima_scadenza')::date,
      coalesce((p_servizio ->> 'rinnovo_automatico')::boolean, false),
      (p_servizio ->> 'chi_paga')::public.chi_paga,
      nullif(p_servizio ->> 'preavviso_giorni', '')::integer,
      nullif(p_servizio ->> 'url_pannello', ''),
      nullif(p_servizio ->> 'username', ''),
      coalesce(nullif(p_servizio ->> 'stato', ''), 'attivo')::public.stato_servizio,
      nullif(p_servizio ->> 'note', '')
    );
  else
    update public.servizi set
      ambito = (p_servizio ->> 'ambito')::public.ambito,
      nome = p_servizio ->> 'nome',
      tipo_id = nullif(p_servizio ->> 'tipo_id', '')::uuid,
      fornitore = nullif(p_servizio ->> 'fornitore', ''),
      frequenza = (p_servizio ->> 'frequenza')::public.frequenza_servizio,
      prossima_scadenza = (p_servizio ->> 'prossima_scadenza')::date,
      rinnovo_automatico = coalesce((p_servizio ->> 'rinnovo_automatico')::boolean, false),
      chi_paga = (p_servizio ->> 'chi_paga')::public.chi_paga,
      preavviso_giorni = nullif(p_servizio ->> 'preavviso_giorni', '')::integer,
      url_pannello = nullif(p_servizio ->> 'url_pannello', ''),
      username = nullif(p_servizio ->> 'username', ''),
      stato = coalesce(nullif(p_servizio ->> 'stato', ''), 'attivo')::public.stato_servizio,
      note = nullif(p_servizio ->> 'note', '')
    where id = v_id;
    if not found then
      raise exception 'Servizio non trovato o permessi insufficienti' using errcode = '42501';
    end if;
  end if;

  if p_economico is not null and v_budget then
    insert into public.servizi_economico (servizio_id, costo, valuta, metodo_pagamento_id)
    values (
      v_id,
      nullif(p_economico ->> 'costo', '')::numeric,
      coalesce(nullif(p_economico ->> 'valuta', ''), 'EUR'),
      -- Il metodo ha senso solo se paghi tu.
      case when (p_servizio ->> 'chi_paga') = 'io' then nullif(p_economico ->> 'metodo_pagamento_id', '')::uuid end
    )
    on conflict (servizio_id) do update set
      costo = excluded.costo,
      valuta = excluded.valuta,
      metodo_pagamento_id = excluded.metodo_pagamento_id;
  end if;

  if p_clienti is not null then
    select coalesce(array_agg((x ->> 'cliente_id')::uuid), '{}')
    into v_clienti
    from jsonb_array_elements(p_clienti) x;

    delete from public.servizi_clienti
    where servizio_id = v_id and not (cliente_id = any (v_clienti));

    for c in select * from jsonb_array_elements(p_clienti) loop
      insert into public.servizi_clienti (servizio_id, cliente_id)
      values (v_id, (c ->> 'cliente_id')::uuid)
      on conflict do nothing;

      if v_budget then
        if nullif(c ->> 'prezzo_rivendita', '') is null then
          delete from public.servizi_clienti_economico
          where servizio_id = v_id and cliente_id = (c ->> 'cliente_id')::uuid;
        else
          insert into public.servizi_clienti_economico (servizio_id, cliente_id, prezzo_rivendita)
          values (v_id, (c ->> 'cliente_id')::uuid, (c ->> 'prezzo_rivendita')::numeric)
          on conflict (servizio_id, cliente_id) do update set prezzo_rivendita = excluded.prezzo_rivendita;
        end if;
      end if;
    end loop;
  end if;

  return v_id;
end;
$$;
