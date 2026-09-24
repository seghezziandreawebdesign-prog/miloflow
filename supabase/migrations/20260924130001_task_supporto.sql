-- Supporto a task e progetti (fase 3): regole di coerenza aggiornate,
-- completamento atomico con ricorrenza, avanzamento dei progetti.

-- Regole di coerenza della task, applicate prima di ogni scrittura:
-- - sottotask al massimo di un livello;
-- - la sottotask eredita ambito, progetto e cliente dal genitore;
-- - la task di un progetto ne eredita l'ambito, e il cliente se il progetto ne ha uno;
-- - una task con cliente è sempre di lavoro (i clienti sono sempre lavoro);
-- - completata_il segue lo stato "fatto";
-- - in_attesa_di e in_attesa_dal valgono solo nello stato "in attesa".
create or replace function public.task_coerenza()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  genitore record;
  progetto record;
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
    new.ricorrenza := null;
  end if;

  if new.progetto_id is not null and new.parent_id is null then
    select ambito, cliente_id into progetto from public.progetti where id = new.progetto_id;
    new.ambito := progetto.ambito;
    if progetto.cliente_id is not null then
      new.cliente_id := progetto.cliente_id;
    end if;
  end if;

  if new.cliente_id is not null then
    new.ambito := 'lavoro';
  end if;

  if new.stato = 'fatto' and (tg_op = 'INSERT' or old.stato <> 'fatto') then
    new.completata_il := coalesce(new.completata_il, now());
  elsif new.stato <> 'fatto' then
    new.completata_il := null;
  end if;

  if new.stato = 'in_attesa' then
    new.in_attesa_dal := coalesce(new.in_attesa_dal, public.oggi());
  else
    new.in_attesa_di := null;
    new.in_attesa_dal := null;
  end if;

  return new;
end;
$$;

-- Un progetto con cliente è sempre di lavoro.
create function public.progetti_coerenza()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.cliente_id is not null then
    new.ambito := 'lavoro';
  end if;
  return new;
end;
$$;

create trigger progetti_coerenza before insert or update on public.progetti
  for each row execute function public.progetti_coerenza();

-- Quando il progetto cambia cliente o ambito, le sue task si allineano
-- (le sottotask seguono tramite task_propaga_a_sottotask).
create or replace function public.progetti_propaga_cliente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.task
  set ambito = new.ambito,
      cliente_id = coalesce(new.cliente_id, cliente_id)
  where progetto_id = new.id
    and parent_id is null
    and (ambito, cliente_id) is distinct from (new.ambito, coalesce(new.cliente_id, cliente_id));
  return null;
end;
$$;

drop trigger progetti_propaga_cliente on public.progetti;
create trigger progetti_propaga_cliente
  after update of cliente_id, ambito on public.progetti
  for each row execute function public.progetti_propaga_cliente();

-- Completa una task in un'unica transazione:
-- - facoltativamente completa anche le sottotask aperte;
-- - se è ricorrente e p_prossima porta le date della prossima occorrenza
--   (calcolate dal client con la RRULE), crea la nuova task con le sottotask
--   ricopiate come da fare. La ricorrenza passa alla nuova occorrenza, così
--   togliere e rimettere la spunta non genera doppioni.
-- Security invoker: ogni lettura e scrittura passa dalle policy.
-- Restituisce l'id della nuova occorrenza, oppure null.
create function public.completa_task(
  p_id uuid,
  p_sottotask boolean default false,
  p_prossima jsonb default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  t public.task;
  v_nuova uuid;
  v_ricorre boolean;
  n int;
begin
  select * into t from public.task where id = p_id;
  if not found then
    raise exception 'Task non trovata' using errcode = '42501';
  end if;
  if t.stato = 'fatto' then
    return null;
  end if;

  v_ricorre := t.ricorrenza is not null and t.parent_id is null and p_prossima is not null;

  update public.task
  set stato = 'fatto',
      ricorrenza = case when v_ricorre then null else ricorrenza end
  where id = p_id;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Permessi insufficienti' using errcode = '42501';
  end if;

  if p_sottotask then
    update public.task set stato = 'fatto' where parent_id = p_id and stato <> 'fatto';
  end if;

  if v_ricorre then
    -- L'id si genera qui: con INSERT ... RETURNING la policy di lettura
    -- verrebbe valutata su una riga che la funzione non vede ancora.
    v_nuova := gen_random_uuid();
    insert into public.task (
      id, ambito, titolo, note, progetto_id, cliente_id, servizio_id, priorita,
      data_pianificata, scadenza, durata_min, ricorrenza, assegnata_a, ordine
    ) values (
      v_nuova, t.ambito, t.titolo, t.note, t.progetto_id, t.cliente_id, t.servizio_id, t.priorita,
      nullif(p_prossima ->> 'data_pianificata', '')::date,
      nullif(p_prossima ->> 'scadenza', '')::date,
      t.durata_min, t.ricorrenza, t.assegnata_a, t.ordine
    );
    insert into public.task (parent_id, titolo, note, priorita, durata_min, assegnata_a, ordine)
    select v_nuova, s.titolo, s.note, s.priorita, s.durata_min, s.assegnata_a, s.ordine
    from public.task s
    where s.parent_id = p_id;
  end if;

  return v_nuova;
end;
$$;

revoke execute on function public.completa_task(uuid, boolean, jsonb) from public, anon;
grant execute on function public.completa_task(uuid, boolean, jsonb) to authenticated;

-- Progetti con l'avanzamento: task principali totali e fatte. Con
-- security_invoker i conteggi includono solo le task visibili a chi legge.
create view public.v_progetti
with (security_invoker = true)
as
select
  p.*,
  coalesce(c.totali, 0)::integer as task_totali,
  coalesce(c.fatte, 0)::integer as task_fatte
from public.progetti p
left join lateral (
  select count(*) as totali, count(*) filter (where t.stato = 'fatto') as fatte
  from public.task t
  where t.progetto_id = p.id and t.parent_id is null
) c on true;

grant select on public.v_progetti to authenticated;
revoke all on public.v_progetti from anon;
