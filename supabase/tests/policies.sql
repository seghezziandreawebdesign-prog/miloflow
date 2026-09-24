-- Test delle policy RLS: owner contro collaboratore.
--
-- Gira tutto dentro una transazione chiusa da ROLLBACK: utenti, dati e funzioni
-- di supporto spariscono alla fine, il database resta com'era.
-- Esecuzione:  npm run test:policies
-- Se una verifica fallisce, lo script si ferma con un errore che inizia con FALLITO.

begin;

-- Funzioni di supporto (create nella transazione, annullate dal rollback).

create function public._test_come(p_uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

create function public._test_conta(p_sql text, p_atteso bigint, p_cosa text)
returns void language plpgsql as $$
declare
  n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') q' into n;
  if n <> p_atteso then
    raise exception 'FALLITO: % — attese % righe, trovate %', p_cosa, p_atteso, n;
  end if;
end;
$$;

-- Esegue un comando che deve essere rifiutato (errore RLS o eccezione di trigger).
create function public._test_rifiutato(p_sql text, p_cosa text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return;
  end;
  raise exception 'FALLITO: % — il comando doveva essere rifiutato', p_cosa;
end;
$$;

-- Esegue un update/delete che deve toccare esattamente N righe.
create function public._test_righe(p_sql text, p_attese int, p_cosa text)
returns void language plpgsql as $$
declare
  n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  if n <> p_attese then
    raise exception 'FALLITO: % — attese % righe modificate, modificate %', p_cosa, p_attese, n;
  end if;
end;
$$;

grant execute on function public._test_come, public._test_conta,
  public._test_rifiutato, public._test_righe to authenticated;

-- Dati di prova, inseriti come postgres (RLS non si applica).

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'owner@test.local', '{"nome":"Owner"}', now(), now()),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'collab@test.local', '{"nome":"Collab"}', now(), now());

update public.profili set ruolo = 'owner' where id = '00000000-0000-0000-0000-00000000000a';

do $$
begin
  if (select count(*) from public.profili where id in (
      '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c')) <> 2 then
    raise exception 'FALLITO: il trigger non ha creato i profili';
  end if;
  if (select ruolo from public.profili where id = '00000000-0000-0000-0000-00000000000c') <> 'collaboratore' then
    raise exception 'FALLITO: il ruolo di default non è collaboratore';
  end if;
end;
$$;

-- Clienti A (assegnabile al collaboratore) e B (mai suo).
insert into public.clienti (id, ragione_sociale) values
  ('10000000-0000-0000-0000-00000000000a', 'Cliente A'),
  ('10000000-0000-0000-0000-00000000000b', 'Cliente B');
insert into public.clienti_contatti (cliente_id, nome, principale) values
  ('10000000-0000-0000-0000-00000000000a', 'Contatto A', true),
  ('10000000-0000-0000-0000-00000000000b', 'Contatto B', true);

-- S1 lavoro→A, S2 lavoro→B, S3 lavoro senza clienti, S4 personale→A.
insert into public.servizi (id, ambito, nome, prossima_scadenza) values
  ('20000000-0000-0000-0000-000000000001', 'lavoro', 'S1', public.oggi() + 3),
  ('20000000-0000-0000-0000-000000000002', 'lavoro', 'S2', public.oggi() + 10),
  ('20000000-0000-0000-0000-000000000003', 'lavoro', 'S3', public.oggi() + 20),
  ('20000000-0000-0000-0000-000000000004', 'personale', 'S4', public.oggi() - 1);
insert into public.servizi_clienti (servizio_id, cliente_id) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000b'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-00000000000a');
insert into public.servizi_economico (servizio_id, costo) values
  ('20000000-0000-0000-0000-000000000001', 120),
  ('20000000-0000-0000-0000-000000000004', 50);
insert into public.servizi_clienti_economico (servizio_id, cliente_id, prezzo_rivendita) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 200);
insert into public.credenziali (servizio_id, etichetta, tipo, url_password_manager) values
  ('20000000-0000-0000-0000-000000000001', 'Pannello S1', 'link_password_manager', 'https://vault.example/s1'),
  ('20000000-0000-0000-0000-000000000004', 'Pannello S4', 'link_password_manager', 'https://vault.example/s4');

insert into public.progetti (id, ambito, nome, cliente_id) values
  ('30000000-0000-0000-0000-000000000001', 'lavoro', 'P1', '10000000-0000-0000-0000-00000000000a'),
  ('30000000-0000-0000-0000-000000000002', 'personale', 'P2', null);

-- T1 lavoro A, T2 lavoro senza cliente assegnata a C, T3 lavoro senza cliente
-- non assegnata, T4 personale A assegnata a C, T5 lavoro B.
insert into public.task (id, ambito, titolo, cliente_id, assegnata_a, data_pianificata) values
  ('40000000-0000-0000-0000-000000000001', 'lavoro', 'T1', '10000000-0000-0000-0000-00000000000a', null, public.oggi()),
  ('40000000-0000-0000-0000-000000000002', 'lavoro', 'T2', null, '00000000-0000-0000-0000-00000000000c', public.oggi()),
  ('40000000-0000-0000-0000-000000000003', 'lavoro', 'T3', null, null, public.oggi()),
  ('40000000-0000-0000-0000-000000000004', 'personale', 'T4', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c', public.oggi()),
  ('40000000-0000-0000-0000-000000000005', 'lavoro', 'T5', '10000000-0000-0000-0000-00000000000b', null, public.oggi());

insert into public.eventi (id, ambito, titolo, inizio, cliente_id) values
  ('50000000-0000-0000-0000-000000000001', 'lavoro', 'E1', now(), '10000000-0000-0000-0000-00000000000a'),
  ('50000000-0000-0000-0000-000000000002', 'lavoro', 'E2', now(), null),
  ('50000000-0000-0000-0000-000000000003', 'personale', 'E3', now(), null);

insert into public.debiti (id, ambito, creditore, importo_totale, tipo) values
  ('60000000-0000-0000-0000-000000000001', 'lavoro', 'Fornitore', 600, 'rateale'),
  ('60000000-0000-0000-0000-000000000002', 'personale', 'Banca', 1200, 'rateale');
insert into public.debiti_rate (debito_id, numero, scadenza, importo) values
  ('60000000-0000-0000-0000-000000000001', 1, public.oggi() + 5, 100),
  ('60000000-0000-0000-0000-000000000002', 1, public.oggi() + 5, 100);
insert into public.movimenti (ambito, importo, descrizione, stato) values
  ('lavoro', 10, 'M lavoro', 'pagato'),
  ('personale', 20, 'M personale', 'previsto');

-- Regole di coerenza delle task (trigger).
insert into public.task (id, titolo, progetto_id) values
  ('40000000-0000-0000-0000-000000000010', 'Eredita cliente', '30000000-0000-0000-0000-000000000001');
select public._test_conta(
  $q$select 1 from public.task where id = '40000000-0000-0000-0000-000000000010'
     and cliente_id = '10000000-0000-0000-0000-00000000000a'$q$,
  1, 'la task eredita il cliente dal progetto');
insert into public.task (id, titolo, parent_id) values
  ('40000000-0000-0000-0000-000000000011', 'Sottotask', '40000000-0000-0000-0000-000000000010');
select public._test_rifiutato(
  $q$insert into public.task (titolo, parent_id) values ('Nipote', '40000000-0000-0000-0000-000000000011')$q$,
  'sottotask di secondo livello');
delete from public.task where id in ('40000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000011');

-- ============================================================
-- 1. Collaboratore senza permessi: nessuna riga da nessuna parte.
-- ============================================================

set local role authenticated;
select public._test_come('00000000-0000-0000-0000-00000000000c');

do $$
declare
  t text;
  n bigint;
begin
  for t in
    select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relkind in ('r', 'v')
      and c.relname not in ('profili')
  loop
    execute format('select count(*) from public.%I', t) into n;
    if n > 0 then
      raise exception 'FALLITO: collaboratore senza permessi legge % righe da %', n, t;
    end if;
  end loop;
end;
$$;

select public._test_conta('select 1 from public.profili', 1, 'il collaboratore vede solo il proprio profilo');
select public._test_rifiutato(
  $q$update public.profili set ruolo = 'owner' where id = '00000000-0000-0000-0000-00000000000c'$q$,
  'il collaboratore si promuove owner');
select public._test_righe(
  $q$update public.profili set nome = 'Nuovo nome' where id = '00000000-0000-0000-0000-00000000000c'$q$,
  1, 'il collaboratore cambia il proprio nome');
select public._test_rifiutato(
  $q$insert into public.permessi (user_id, sezione, livello)
     values ('00000000-0000-0000-0000-00000000000c', 'budget', 'scrittura')$q$,
  'il collaboratore si assegna un permesso');
select public._test_rifiutato(
  $q$insert into public.clienti (ragione_sociale) values ('Intruso')$q$,
  'il collaboratore crea un cliente');
select public._test_rifiutato(
  $q$insert into public.task (ambito, titolo, assegnata_a)
     values ('lavoro', 'X', '00000000-0000-0000-0000-00000000000c')$q$,
  'il collaboratore senza permesso task crea una task');

reset role;

-- ============================================================
-- 2. Permessi: clienti/servizi/calendario in lettura, task in scrittura, solo cliente A.
-- ============================================================

insert into public.permessi (user_id, sezione, livello) values
  ('00000000-0000-0000-0000-00000000000c', 'clienti', 'lettura'),
  ('00000000-0000-0000-0000-00000000000c', 'servizi', 'lettura'),
  ('00000000-0000-0000-0000-00000000000c', 'calendario', 'lettura'),
  ('00000000-0000-0000-0000-00000000000c', 'task', 'scrittura');
insert into public.accessi_clienti (user_id, cliente_id) values
  ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-00000000000a');

set local role authenticated;
select public._test_come('00000000-0000-0000-0000-00000000000c');

select public._test_conta('select 1 from public.clienti', 1, 'clienti visibili (solo A)');
select public._test_conta('select 1 from public.clienti_contatti', 1, 'contatti visibili (solo di A)');
select public._test_conta('select 1 from public.servizi', 1, 'servizi visibili (solo S1)');
select public._test_conta('select 1 from public.servizi_clienti', 1, 'collegamenti servizio-cliente');
select public._test_conta('select 1 from public.v_servizi where costo is null', 1, 'v_servizi senza costi');
select public._test_conta('select 1 from public.servizi_economico', 0, 'costi senza permesso budget');
select public._test_conta('select 1 from public.servizi_clienti_economico', 0, 'prezzi di rivendita senza permesso budget');
select public._test_conta('select 1 from public.credenziali', 0, 'credenziali senza permesso');
select public._test_conta('select 1 from public.tipi_servizio', 8, 'tipi di servizio');
select public._test_conta('select 1 from public.progetti', 1, 'progetti visibili (solo P1)');
select public._test_conta('select 1 from public.task', 2, 'task visibili (T1 con A, T2 assegnata)');
select public._test_conta('select 1 from public.eventi', 1, 'eventi visibili (solo E1)');
select public._test_conta('select 1 from public.categorie', 0, 'categorie senza permesso budget');
select public._test_conta('select 1 from public.metodi_pagamento', 0, 'metodi di pagamento senza permesso budget');
select public._test_conta('select 1 from public.movimenti', 0, 'movimenti senza permesso budget');
select public._test_conta('select 1 from public.debiti', 0, 'debiti senza permesso budget');
select public._test_conta('select 1 from public.v_calendario where ambito = ''personale''', 0,
  'nessun elemento personale nel calendario');
select public._test_conta('select 1 from public.v_calendario', 4,
  'calendario: T1, T2, scadenza S1, E1');

-- Scritture: task sì (con i vincoli), clienti e servizi no (solo lettura).
select public._test_righe(
  $q$update public.task set note = 'ok' where id = '40000000-0000-0000-0000-000000000001'$q$,
  1, 'aggiorna una task del proprio cliente');
select public._test_righe(
  $q$update public.task set note = 'no' where id = '40000000-0000-0000-0000-000000000005'$q$,
  0, 'aggiorna una task di un cliente non suo');
insert into public.task (ambito, titolo, assegnata_a)
  values ('lavoro', 'Nuova', '00000000-0000-0000-0000-00000000000c');
select public._test_rifiutato(
  $q$insert into public.task (ambito, titolo, assegnata_a)
     values ('personale', 'X', '00000000-0000-0000-0000-00000000000c')$q$,
  'crea una task personale');
select public._test_rifiutato(
  $q$insert into public.task (ambito, titolo, cliente_id)
     values ('lavoro', 'X', '10000000-0000-0000-0000-00000000000b')$q$,
  'crea una task per un cliente non suo');
select public._test_rifiutato(
  $q$insert into public.task (ambito, titolo) values ('lavoro', 'X')$q$,
  'crea una task senza cliente non assegnata a sé');
select public._test_rifiutato(
  $q$update public.task set ambito = 'personale' where id = '40000000-0000-0000-0000-000000000001'$q$,
  'sposta una task nell''ambito personale');
select public._test_righe(
  $q$update public.clienti set note = 'x' where id = '10000000-0000-0000-0000-00000000000a'$q$,
  0, 'modifica un cliente con permesso di sola lettura');
select public._test_righe(
  $q$update public.servizi set note = 'x' where id = '20000000-0000-0000-0000-000000000001'$q$,
  0, 'modifica un servizio con permesso di sola lettura');
select public._test_rifiutato(
  $q$insert into public.eventi (ambito, titolo, inizio, cliente_id)
     values ('lavoro', 'X', now(), '10000000-0000-0000-0000-00000000000a')$q$,
  'crea un evento con calendario in sola lettura');
select public._test_rifiutato(
  $q$select public.rinnova_servizio('20000000-0000-0000-0000-000000000001', null, 10)$q$,
  'rinnova un servizio con permesso di sola lettura');
select public._test_conta('select 1 from public.impostazioni_notifiche', 0, 'impostazioni notifiche solo owner');
select public._test_conta('select 1 from public.v_clienti where servizi_attivi = 1', 1,
  'v_clienti conta solo i servizi visibili');
select public._test_rifiutato(
  $q$select public.imposta_contatto_principale(
       (select id from public.clienti_contatti where nome = 'Contatto A'))$q$,
  'cambia il contatto principale con clienti in sola lettura');

reset role;

-- ============================================================
-- 3. Aggiunti budget e credenziali in lettura.
-- ============================================================

insert into public.permessi (user_id, sezione, livello) values
  ('00000000-0000-0000-0000-00000000000c', 'budget', 'lettura'),
  ('00000000-0000-0000-0000-00000000000c', 'credenziali', 'lettura');

set local role authenticated;
select public._test_come('00000000-0000-0000-0000-00000000000c');

select public._test_conta('select 1 from public.servizi_economico', 1, 'costi con budget (solo S1)');
select public._test_conta('select 1 from public.v_servizi where costo = 120', 1, 'v_servizi con costo di S1');
select public._test_conta('select 1 from public.servizi_clienti_economico', 1, 'prezzo di rivendita di S1');
select public._test_conta('select 1 from public.credenziali', 1, 'credenziali (solo S1)');
select public._test_conta('select 1 from public.categorie where ambito = ''personale''', 0, 'nessuna categoria personale');
select public._test_conta('select 1 from public.categorie', 8, 'categorie di lavoro (4 + 4 sottocategorie)');
select public._test_conta('select 1 from public.movimenti', 1, 'movimenti di lavoro');
select public._test_conta('select 1 from public.debiti', 1, 'debiti di lavoro');
select public._test_conta('select 1 from public.debiti_rate', 1, 'rate dei debiti di lavoro');
select public._test_rifiutato(
  $q$insert into public.movimenti (ambito, importo) values ('lavoro', 5)$q$,
  'crea un movimento con budget in sola lettura');

reset role;

-- ============================================================
-- 4. L'owner vede e scrive tutto.
-- ============================================================

set local role authenticated;
select public._test_come('00000000-0000-0000-0000-00000000000a');

select public._test_conta('select 1 from public.profili where id in (''00000000-0000-0000-0000-00000000000a'', ''00000000-0000-0000-0000-00000000000c'')', 2, 'owner: profili');
select public._test_conta('select 1 from public.clienti where ragione_sociale like ''Cliente _''', 2, 'owner: clienti');
select public._test_conta('select 1 from public.servizi where nome in (''S1'',''S2'',''S3'',''S4'')', 4, 'owner: servizi');
select public._test_conta('select 1 from public.task where titolo in (''T1'',''T2'',''T3'',''T4'',''T5'')', 5, 'owner: task');
select public._test_conta('select 1 from public.eventi where titolo in (''E1'',''E2'',''E3'')', 3, 'owner: eventi');
select public._test_conta('select 1 from public.credenziali where etichetta like ''Pannello S_''', 2, 'owner: credenziali');
select public._test_conta('select 1 from public.v_servizi where nome = ''S4'' and stato_scadenza = ''scaduto''', 1, 'owner: stato scaduto calcolato');
select public._test_conta('select 1 from public.v_servizi where nome = ''S1'' and stato_scadenza = ''urgente''', 1, 'owner: stato urgente calcolato');
select public._test_righe(
  $q$update public.clienti set note = 'owner' where id = '10000000-0000-0000-0000-00000000000b'$q$,
  1, 'owner: modifica un cliente');
insert into public.permessi (user_id, sezione, livello)
  values ('00000000-0000-0000-0000-00000000000c', 'servizi', 'scrittura')
  on conflict (user_id, sezione) do update set livello = excluded.livello;

-- Rinnovo: la scadenza avanza per frequenza, rispettando la fine mese.
insert into public.servizi (id, nome, frequenza, prossima_scadenza) values
  ('20000000-0000-0000-0000-000000000011', 'Mensile fine mese', 'mensile', '2027-01-31'),
  ('20000000-0000-0000-0000-000000000012', 'Biennale bisestile', 'biennale', '2028-02-29'),
  ('20000000-0000-0000-0000-000000000013', 'Una tantum', 'una_tantum', '2027-05-10'),
  ('20000000-0000-0000-0000-000000000014', 'Trimestrale', 'trimestrale', '2026-11-30');
do $$
begin
  if public.rinnova_servizio('20000000-0000-0000-0000-000000000011', '2027-01-30', 9.99) <> '2027-02-28' then
    raise exception 'FALLITO: mensile 31/01 → 28/02';
  end if;
  if public.rinnova_servizio('20000000-0000-0000-0000-000000000012', null, null) <> '2030-02-28' then
    raise exception 'FALLITO: biennale 29/02/2028 → 28/02/2030';
  end if;
  if public.rinnova_servizio('20000000-0000-0000-0000-000000000014', null, 30) <> '2027-02-28' then
    raise exception 'FALLITO: trimestrale 30/11 → 28/02';
  end if;
end;
$$;
select public._test_conta(
  $q$select 1 from public.servizi_rinnovi where servizio_id = '20000000-0000-0000-0000-000000000011'
     and data = '2027-01-30' and importo = 9.99$q$,
  1, 'owner: il rinnovo scrive lo storico');
select public._test_rifiutato(
  $q$select public.rinnova_servizio('20000000-0000-0000-0000-000000000013', null, 1)$q$,
  'rinnova un servizio una tantum');
select public._test_conta('select 1 from public.impostazioni_notifiche', 1, 'owner: impostazioni notifiche');

-- Salvataggio atomico di un servizio con clienti e prezzi.
do $$
declare
  v_id uuid;
begin
  v_id := public.salva_servizio(
    null,
    '{"ambito":"lavoro","nome":"Hosting condiviso","frequenza":"annuale","prossima_scadenza":"2027-03-01","chi_paga":"io"}',
    '{"costo":"120.00","metodo_pagamento":"Revolut *4417"}',
    '[{"cliente_id":"10000000-0000-0000-0000-00000000000a","prezzo_rivendita":"80"},
      {"cliente_id":"10000000-0000-0000-0000-00000000000b","prezzo_rivendita":""}]'
  );
  if (select count(*) from public.servizi_clienti where servizio_id = v_id) <> 2
     or (select costo from public.servizi_economico where servizio_id = v_id) <> 120
     or (select count(*) from public.servizi_clienti_economico where servizio_id = v_id) <> 1 then
    raise exception 'FALLITO: salva_servizio in creazione';
  end if;

  perform public.salva_servizio(
    v_id,
    '{"ambito":"lavoro","nome":"Hosting condiviso","frequenza":"annuale","prossima_scadenza":"2027-03-01","chi_paga":"io"}',
    '{"costo":"130"}',
    '[{"cliente_id":"10000000-0000-0000-0000-00000000000b","prezzo_rivendita":"90"}]'
  );
  if (select count(*) from public.servizi_clienti where servizio_id = v_id) <> 1
     or (select costo from public.servizi_economico where servizio_id = v_id) <> 130
     or (select prezzo_rivendita from public.servizi_clienti_economico where servizio_id = v_id) <> 90 then
    raise exception 'FALLITO: salva_servizio in modifica';
  end if;
end;
$$;
select public._test_rifiutato(
  $q$insert into public.metodi_pagamento (nome, tipo, ultime_cifre) values ('Visa', 'carta_credito', '4111111111111111')$q$,
  'salva un numero di carta completo');

-- Metodo di pagamento: si salva se pago io, si azzera se paga il cliente.
insert into public.metodi_pagamento (id, nome, tipo, ultime_cifre)
  values ('70000000-0000-0000-0000-000000000001', 'Revolut', 'prepagata', '4417');
do $$
declare
  v_id uuid;
begin
  v_id := public.salva_servizio(null,
    '{"ambito":"lavoro","nome":"Con carta","frequenza":"mensile","prossima_scadenza":"2027-01-01","chi_paga":"io"}',
    '{"costo":"5","metodo_pagamento_id":"70000000-0000-0000-0000-000000000001"}', '[]');
  if (select metodo_pagamento_nome from public.v_servizi where id = v_id) is distinct from 'Revolut' then
    raise exception 'FALLITO: metodo di pagamento non salvato';
  end if;
  perform public.salva_servizio(v_id,
    '{"ambito":"lavoro","nome":"Con carta","frequenza":"mensile","prossima_scadenza":"2027-01-01","chi_paga":"cliente"}',
    '{"costo":"5","metodo_pagamento_id":"70000000-0000-0000-0000-000000000001"}', '[]');
  if (select metodo_pagamento_id from public.v_servizi where id = v_id) is not null then
    raise exception 'FALLITO: il metodo deve azzerarsi se paga il cliente';
  end if;
end;
$$;

reset role;

select 'TUTTI I TEST DELLE POLICY SUPERATI' as esito;

rollback;
