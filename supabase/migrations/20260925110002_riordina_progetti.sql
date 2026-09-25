-- Riordina i progetti di un livello: l'ordine è la posizione nell'array.
-- Diritti dell'invocante: valgono le policy di update dei progetti.
create function public.riordina_progetti(p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  i integer;
begin
  for i in 1 .. coalesce(array_length(p_ids, 1), 0) loop
    update public.progetti set ordine = i * 10 where id = p_ids[i];
  end loop;
end;
$$;

revoke execute on function public.riordina_progetti(uuid[]) from public, anon;
grant execute on function public.riordina_progetti(uuid[]) to authenticated;
