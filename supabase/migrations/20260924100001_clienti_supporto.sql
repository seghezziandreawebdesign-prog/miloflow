-- Supporto alla sezione Clienti: unicità della P.IVA, contatto principale
-- atomico e vista per la lista con i conteggi.

-- La P.IVA si salva normalizzata (senza spazi né prefisso del paese).
create unique index clienti_piva_uidx on public.clienti (nazione, piva) where piva is not null;

-- Rende principale un contatto e toglie il flag agli altri dello stesso cliente.
-- Due update in sequenza: l'indice unico parziale non permetterebbe di farlo in uno.
-- Security invoker: valgono le policy di clienti_contatti.
create function public.imposta_contatto_principale(p_contatto_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_cliente_id uuid;
begin
  select cliente_id into v_cliente_id from public.clienti_contatti where id = p_contatto_id;
  if v_cliente_id is null then
    raise exception 'Contatto non trovato';
  end if;

  update public.clienti_contatti
  set principale = false
  where cliente_id = v_cliente_id and principale and id <> p_contatto_id;

  update public.clienti_contatti set principale = true where id = p_contatto_id;
  if not found then
    raise exception 'Non hai i permessi per modificare questo contatto';
  end if;
end;
$$;

revoke execute on function public.imposta_contatto_principale(uuid) from public, anon;
grant execute on function public.imposta_contatto_principale(uuid) to authenticated;

-- Lista clienti con i conteggi. Security invoker: ogni conteggio vede solo
-- le righe che l'utente può vedere.
create view public.v_clienti
with (security_invoker = true)
as
select
  c.*,
  (
    select count(*)
    from public.servizi_clienti sc
    join public.servizi s on s.id = sc.servizio_id
    where sc.cliente_id = c.id and s.stato = 'attivo'
  ) as servizi_attivi,
  (
    select count(*)
    from public.task t
    where t.cliente_id = c.id and t.stato <> 'fatto' and t.parent_id is null
  ) as task_aperte
from public.clienti c;

grant select on public.v_clienti to authenticated;
revoke all on public.v_clienti from anon;
