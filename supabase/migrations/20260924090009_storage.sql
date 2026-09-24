-- Bucket privati e policy di Storage. L'accesso passa sempre da signed URL.
--
-- Convenzione dei percorsi (il primo segmento lega il file alla sua entità):
--   loghi/<cliente_id>/<file>
--   ricevute/<movimento_id>/<file>
--   allegati/<tipo>/<id>/<file>   tipo: clienti | servizi | task | progetti | eventi | movimenti | debiti
--
-- Un file è visibile se è visibile la riga a cui appartiene (le query qui sotto
-- passano dalle policy delle tabelle) e scrivibile con il permesso di scrittura
-- della sezione corrispondente.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('loghi', 'loghi', false, 2 * 1024 * 1024,
    array['image/png', 'image/jpeg', 'image/webp']),
  ('ricevute', 'ricevute', false, 10 * 1024 * 1024,
    array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'application/pdf']),
  ('allegati', 'allegati', false, 25 * 1024 * 1024, null)
on conflict (id) do nothing;

create function public.storage_accesso(
  p_bucket text,
  p_nome text,
  p_livello public.livello_permesso
)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  cartelle text[] := storage.foldername(p_nome);
  tipo text;
  rif uuid;
begin
  if p_bucket = 'loghi' then
    rif := public.try_uuid(cartelle[1]);
    return public.puo('clienti', p_livello)
      and exists (select 1 from public.clienti where id = rif);
  elsif p_bucket = 'ricevute' then
    rif := public.try_uuid(cartelle[1]);
    return public.puo('budget', p_livello)
      and exists (select 1 from public.movimenti where id = rif);
  elsif p_bucket = 'allegati' then
    tipo := cartelle[1];
    rif := public.try_uuid(cartelle[2]);
    return case tipo
      when 'clienti' then public.puo('clienti', p_livello)
        and exists (select 1 from public.clienti where id = rif)
      when 'servizi' then public.puo('servizi', p_livello)
        and exists (select 1 from public.servizi where id = rif)
      when 'task' then public.puo('task', p_livello)
        and exists (select 1 from public.task where id = rif)
      when 'progetti' then public.puo('task', p_livello)
        and exists (select 1 from public.progetti where id = rif)
      when 'eventi' then public.puo('calendario', p_livello)
        and exists (select 1 from public.eventi where id = rif)
      when 'movimenti' then public.puo('budget', p_livello)
        and exists (select 1 from public.movimenti where id = rif)
      when 'debiti' then public.puo('budget', p_livello)
        and exists (select 1 from public.debiti where id = rif)
      else false
    end;
  end if;
  return false;
end;
$$;

create policy app_file_select on storage.objects for select to authenticated
  using (bucket_id in ('loghi', 'ricevute', 'allegati')
    and public.storage_accesso(bucket_id, name, 'lettura'));
create policy app_file_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('loghi', 'ricevute', 'allegati')
    and public.storage_accesso(bucket_id, name, 'scrittura'));
create policy app_file_update on storage.objects for update to authenticated
  using (bucket_id in ('loghi', 'ricevute', 'allegati')
    and public.storage_accesso(bucket_id, name, 'scrittura'))
  with check (bucket_id in ('loghi', 'ricevute', 'allegati')
    and public.storage_accesso(bucket_id, name, 'scrittura'));
create policy app_file_delete on storage.objects for delete to authenticated
  using (bucket_id in ('loghi', 'ricevute', 'allegati')
    and public.storage_accesso(bucket_id, name, 'scrittura'));
