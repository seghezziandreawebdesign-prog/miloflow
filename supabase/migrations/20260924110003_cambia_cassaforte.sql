-- Cambio della master password: nuovi parametri della cassaforte e tutte le
-- credenziali ricifrate (nel browser) in un'unica transazione. Se qualcosa
-- fallisce non si resta con metà credenziali illeggibili.

create function public.cambia_cassaforte(p_parametri jsonb, p_credenziali jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  c jsonb;
  v_attese integer;
begin
  if not public.is_owner() then
    raise exception 'Solo l''owner può cambiare la master password' using errcode = '42501';
  end if;

  -- Devono arrivare tutte le credenziali cifrate, nessuna esclusa.
  select count(*) into v_attese from public.credenziali where tipo = 'cifrata';
  if v_attese <> jsonb_array_length(coalesce(p_credenziali, '[]')) then
    raise exception 'Le credenziali sono cambiate nel frattempo: riprova';
  end if;

  update public.cassaforte set
    salt = p_parametri ->> 'salt',
    iterazioni = (p_parametri ->> 'iterazioni')::integer,
    iv = p_parametri ->> 'iv',
    verifica_cifrata = p_parametri ->> 'verifica_cifrata';
  if not found then
    raise exception 'Cassaforte non configurata';
  end if;

  for c in select * from jsonb_array_elements(coalesce(p_credenziali, '[]')) loop
    update public.credenziali set
      payload_cifrato = c ->> 'payload_cifrato',
      iv = c ->> 'iv',
      salt = c ->> 'salt'
    where id = (c ->> 'id')::uuid and tipo = 'cifrata';
    if not found then
      raise exception 'Credenziale non trovata: %', c ->> 'id';
    end if;
  end loop;
end;
$$;

revoke execute on function public.cambia_cassaforte(jsonb, jsonb) from public, anon;
grant execute on function public.cambia_cassaforte(jsonb, jsonb) to authenticated;
