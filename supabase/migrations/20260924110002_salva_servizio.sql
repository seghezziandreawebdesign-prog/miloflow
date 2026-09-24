-- Salvataggio atomico di un servizio: dati operativi, dati economici,
-- clienti collegati e prezzi di rivendita in un'unica transazione.
-- Security invoker: ogni scrittura passa dalle policy. I dati economici si
-- scrivono solo con il permesso budget in scrittura; senza, vengono ignorati
-- (il collaboratore non li vede e non li tocca).

create function public.salva_servizio(
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
  -- L'id si genera qui: con INSERT ... RETURNING la policy di lettura
  -- verrebbe valutata su una riga che la funzione non vede ancora.
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
    insert into public.servizi_economico (servizio_id, costo, valuta, metodo_pagamento)
    values (
      v_id,
      nullif(p_economico ->> 'costo', '')::numeric,
      coalesce(nullif(p_economico ->> 'valuta', ''), 'EUR'),
      nullif(p_economico ->> 'metodo_pagamento', '')
    )
    on conflict (servizio_id) do update set
      costo = excluded.costo,
      valuta = excluded.valuta,
      metodo_pagamento = excluded.metodo_pagamento;
  end if;

  if p_clienti is not null then
    select coalesce(array_agg((x ->> 'cliente_id')::uuid), '{}')
    into v_clienti
    from jsonb_array_elements(p_clienti) x;

    -- Le policy limitano la cancellazione ai collegamenti visibili: quelli
    -- verso clienti che l'utente non vede restano dove sono.
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

revoke execute on function public.salva_servizio(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.salva_servizio(uuid, jsonb, jsonb, jsonb) to authenticated;
