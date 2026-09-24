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
-- non assegnata, T4 personale assegnata a C (una task con cliente è sempre
-- di lavoro, quindi T4 non ne ha), T5 lavoro B.
insert into public.task (id, ambito, titolo, cliente_id, assegnata_a, data_pianificata) values
  ('40000000-0000-0000-0000-000000000001', 'lavoro', 'T1', '10000000-0000-0000-0000-00000000000a', null, public.oggi()),
  ('40000000-0000-0000-0000-000000000002', 'lavoro', 'T2', null, '00000000-0000-0000-0000-00000000000c', public.oggi()),
  ('40000000-0000-0000-0000-000000000003', 'lavoro', 'T3', null, null, public.oggi()),
  ('40000000-0000-0000-0000-000000000004', 'personale', 'T4', null, '00000000-0000-0000-0000-00000000000c', public.oggi()),
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

-- Salvadanai: uno di lavoro con piano mensile, uno personale (risparmio).
-- Il piano esiste da due mesi: ha il previsto anche nel mese corrente.
insert into public.salvadanai (id, ambito, tipo, nome, importo_mensile, giorno_mensile, created_at) values
  ('70000000-0000-0000-0000-000000000001', 'lavoro', 'investimento', 'SV lavoro', 50, 1, now() - interval '2 months');
-- Piano creato oggi con un giorno già passato: nessun previsto arretrato.
insert into public.salvadanai (id, ambito, tipo, nome, importo_mensile, giorno_mensile) values
  ('70000000-0000-0000-0000-000000000003', 'lavoro', 'risparmio', 'SV nuovo', 10, 1);
insert into public.salvadanai (id, ambito, tipo, nome, obiettivo) values
  ('70000000-0000-0000-0000-000000000002', 'personale', 'risparmio', 'SV personale', 3000);
insert into public.salvadanai_prelievi (salvadanaio_id, importo) values
  ('70000000-0000-0000-0000-000000000001', 1),
  ('70000000-0000-0000-0000-000000000002', 1);
insert into public.salvadanai_valori (salvadanaio_id, valore) values
  ('70000000-0000-0000-0000-000000000001', 100);

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

-- Una task con cliente è sempre di lavoro; quella di un progetto ne prende l'ambito.
insert into public.task (id, ambito, titolo, cliente_id) values
  ('40000000-0000-0000-0000-000000000012', 'personale', 'Con cliente', '10000000-0000-0000-0000-00000000000a');
insert into public.task (id, ambito, titolo, progetto_id) values
  ('40000000-0000-0000-0000-000000000013', 'lavoro', 'Nel progetto personale', '30000000-0000-0000-0000-000000000002');
select public._test_conta(
  $q$select 1 from public.task where id = '40000000-0000-0000-0000-000000000012' and ambito = 'lavoro'$q$,
  1, 'la task con cliente diventa di lavoro');
select public._test_conta(
  $q$select 1 from public.task where id = '40000000-0000-0000-0000-000000000013' and ambito = 'personale'$q$,
  1, 'la task eredita l''ambito dal progetto');
update public.progetti set ambito = 'lavoro' where id = '30000000-0000-0000-0000-000000000002';
select public._test_conta(
  $q$select 1 from public.task where id = '40000000-0000-0000-0000-000000000013' and ambito = 'lavoro'$q$,
  1, 'il cambio di ambito del progetto si propaga alle task');
update public.progetti set ambito = 'personale' where id = '30000000-0000-0000-0000-000000000002';

-- Eventi: con un progetto ereditano ambito e cliente, con un cliente sono di lavoro,
-- a giornata intera partono a mezzanotte di Roma.
insert into public.eventi (id, ambito, titolo, inizio, progetto_id) values
  ('50000000-0000-0000-0000-000000000010', 'personale', 'EP1', now(), '30000000-0000-0000-0000-000000000001');
select public._test_conta(
  $q$select 1 from public.eventi where id = '50000000-0000-0000-0000-000000000010'
     and ambito = 'lavoro' and cliente_id = '10000000-0000-0000-0000-00000000000a'$q$,
  1, 'evento con progetto: eredita ambito e cliente');
insert into public.eventi (id, ambito, titolo, inizio, cliente_id) values
  ('50000000-0000-0000-0000-000000000011', 'personale', 'EC1', now(), '10000000-0000-0000-0000-00000000000a');
select public._test_conta(
  $q$select 1 from public.eventi where id = '50000000-0000-0000-0000-000000000011' and ambito = 'lavoro'$q$,
  1, 'evento con cliente: sempre di lavoro');
insert into public.eventi (id, ambito, titolo, inizio, tutto_il_giorno) values
  ('50000000-0000-0000-0000-000000000012', 'personale', 'EG1', '2027-03-10T15:30:00+01:00', true);
select public._test_conta(
  $q$select 1 from public.eventi where id = '50000000-0000-0000-0000-000000000012'
     and inizio = '2027-03-10T00:00:00+01:00'$q$,
  1, 'evento a giornata intera: parte a mezzanotte di Roma');
-- Task con orario: nel calendario ha inizio e fine, senza orario dura tutto il giorno.
update public.task set ora_inizio = '09:30', durata_min = 90 where id = '40000000-0000-0000-0000-000000000001';
select public._test_conta(
  $q$select 1 from public.v_calendario where tipo = 'task' and id = '40000000-0000-0000-0000-000000000001'
     and not tutto_il_giorno and fine = inizio + interval '90 minutes'$q$,
  1, 'v_calendario: task con orario e durata');
select public._test_conta(
  $q$select 1 from public.v_calendario where tipo = 'task' and id = '40000000-0000-0000-0000-000000000003' and tutto_il_giorno$q$,
  1, 'v_calendario: task senza orario dura tutto il giorno');
delete from public.eventi where id in ('50000000-0000-0000-0000-000000000010', '50000000-0000-0000-0000-000000000011', '50000000-0000-0000-0000-000000000012');

-- "In attesa": la data si imposta da sola e si azzera uscendo dallo stato.
update public.task set stato = 'in_attesa', in_attesa_di = 'Preventivo'
  where id = '40000000-0000-0000-0000-000000000012';
select public._test_conta(
  $q$select 1 from public.task where id = '40000000-0000-0000-0000-000000000012'
     and in_attesa_dal = public.oggi() and in_attesa_di = 'Preventivo'$q$,
  1, 'passando in attesa si salva la data');
update public.task set stato = 'in_corso' where id = '40000000-0000-0000-0000-000000000012';
select public._test_conta(
  $q$select 1 from public.task where id = '40000000-0000-0000-0000-000000000012'
     and in_attesa_dal is null and in_attesa_di is null$q$,
  1, 'uscendo dall''attesa i campi si azzerano');
delete from public.task where id in ('40000000-0000-0000-0000-000000000012', '40000000-0000-0000-0000-000000000013');

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
select public._test_conta(
  $q$select 1 where public.storage_accesso('allegati', 'task/40000000-0000-0000-0000-000000000002/x.png', 'lettura')$q$,
  0, 'il collaboratore senza permesso task legge gli allegati');

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
-- 8 del seed iniziale + "Accesso" (migration servizi_senza_scadenza).
select public._test_conta('select 1 from public.tipi_servizio', 9, 'tipi di servizio');
select public._test_conta('select 1 from public.progetti', 1, 'progetti visibili (solo P1)');
select public._test_conta('select 1 from public.task', 2, 'task visibili (T1 con A, T2 assegnata)');
select public._test_conta('select 1 from public.eventi', 1, 'eventi visibili (solo E1)');
select public._test_conta('select 1 from public.impostazioni_calendario', 0, 'preferenze calendario: nessuna prima del primo accesso');
select public._test_conta('select 1 from public.mie_impostazioni_calendario()', 1, 'preferenze calendario create al primo accesso');
select public._test_conta(
  'select 1 from public.impostazioni_calendario where user_id = ''00000000-0000-0000-0000-00000000000c'' and intervallo_minuti = 30',
  1, 'preferenze calendario del collaboratore con i default');
select public._test_rifiutato(
  $q$insert into public.impostazioni_calendario (user_id) values ('00000000-0000-0000-0000-00000000000a')$q$,
  'crea le preferenze calendario di un altro utente');
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
  $q$update public.task set ambito = 'personale' where id = '40000000-0000-0000-0000-000000000002'$q$,
  'sposta una task nell''ambito personale');
select public._test_rifiutato(
  $q$select public.completa_task('40000000-0000-0000-0000-000000000005')$q$,
  'completa una task di un cliente non suo');
-- Allegati delle task (bucket allegati, cartella task/<id>): valgono le policy della task.
select public._test_conta(
  $q$select 1 where public.storage_accesso('allegati', 'task/40000000-0000-0000-0000-000000000001/x.png', 'scrittura')$q$,
  1, 'carica un allegato su una task del proprio cliente');
select public._test_conta(
  $q$select 1 where public.storage_accesso('allegati', 'task/40000000-0000-0000-0000-000000000005/x.png', 'lettura')$q$,
  0, 'legge gli allegati di una task di un cliente non suo');
select public._test_conta(
  $q$select 1 where public.storage_accesso('allegati', 'task/40000000-0000-0000-0000-000000000004/x.png', 'lettura')$q$,
  0, 'legge gli allegati di una task personale');
select public._test_conta(
  $q$select 1 where public.storage_accesso('allegati', 'task/non-un-uuid/x.png', 'lettura')$q$,
  0, 'percorso di allegato non valido');
select public.completa_task('40000000-0000-0000-0000-000000000001');
select public._test_conta(
  $q$select 1 from public.task where id = '40000000-0000-0000-0000-000000000001' and stato = 'fatto'$q$,
  1, 'completa una task del proprio cliente');
select public._test_conta('select 1 from public.v_progetti', 1, 'v_progetti: solo P1');
select public._test_righe(
  $q$update public.task set stato = 'in_corso', ordine = 1
     where id = '40000000-0000-0000-0000-000000000005'$q$,
  0, 'riordina una task di un cliente non suo');
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
select public._test_conta($q$select 1 from public.categorie where nome in ('Software','Attrezzatura','Formazione','Commercialista','Hosting','Domini','Licenze','SaaS')$q$, 8, 'categorie di lavoro (4 + 4 sottocategorie)');
select public._test_conta('select 1 from public.movimenti where descrizione like ''M %''', 1, 'movimenti di lavoro');
select public._test_rifiutato('select public.genera_previsti(public.oggi())', 'genera i previsti senza essere owner');
select public._test_rifiutato('select public.esporta_backup()', 'esporta il backup senza essere owner');
select public._test_rifiutato(
  $q$select public.paga_rata((select id from public.debiti_rate where debito_id = '60000000-0000-0000-0000-000000000001'), null, null, null)$q$,
  'paga una rata con budget in sola lettura');
select public._test_conta($q$select 1 from public.debiti where creditore in ('Fornitore', 'Banca')$q$, 1, 'debiti di lavoro');
select public._test_conta($q$select 1 from public.debiti_rate r join public.debiti d on d.id = r.debito_id where d.creditore in ('Fornitore', 'Banca')$q$, 1, 'rate dei debiti di lavoro');
select public._test_rifiutato(
  $q$insert into public.movimenti (ambito, importo) values ('lavoro', 5)$q$,
  'crea un movimento con budget in sola lettura');
select public._test_conta($q$select 1 from public.salvadanai where nome like 'SV %'$q$, 2, 'salvadanai: solo quelli di lavoro');
select public._test_conta($q$select 1 from public.v_salvadanai where nome like 'SV %'$q$, 2, 'v_salvadanai: solo quelli di lavoro');
select public._test_conta(
  $q$select 1 from public.salvadanai_prelievi where salvadanaio_id in ('70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002')$q$,
  1, 'prelievi: solo del salvadanaio di lavoro');
select public._test_conta(
  $q$select 1 from public.salvadanai_valori where salvadanaio_id = '70000000-0000-0000-0000-000000000001'$q$,
  1, 'valori del salvadanaio di lavoro');
select public._test_rifiutato(
  $q$insert into public.salvadanai (ambito, tipo, nome) values ('lavoro', 'risparmio', 'Intruso')$q$,
  'crea un salvadanaio con budget in sola lettura');
select public._test_rifiutato(
  $q$insert into public.salvadanai_prelievi (salvadanaio_id, importo) values ('70000000-0000-0000-0000-000000000001', 5)$q$,
  'registra un prelievo con budget in sola lettura');
select public._test_rifiutato(
  $q$select public.elimina_salvadanaio('70000000-0000-0000-0000-000000000001')$q$,
  'elimina un salvadanaio con budget in sola lettura');

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
select public._test_conta('select 1 from public.mie_impostazioni_calendario()', 1, 'owner: preferenze calendario');
select public._test_conta('select 1 from public.impostazioni_calendario', 1, 'owner: vede solo le proprie preferenze calendario');
do $$
begin
  if length(public.rigenera_token_ics()) <> 64 then
    raise exception 'FALLITO: il token ICS deve avere 64 caratteri';
  end if;
  if public.rigenera_token_ics() = (select token_ics from public.impostazioni_calendario where user_id = auth.uid()) then
    null; -- la seconda chiamata ha sostituito il token: qui leggiamo già il nuovo
  end if;
end;
$$;
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

-- Task ricorrente: completandola nasce la prossima occorrenza con le sottotask.
insert into public.task (id, titolo, ricorrenza, data_pianificata, scadenza, priorita, cliente_id) values
  ('40000000-0000-0000-0000-000000000020', 'Backup settimanale', 'FREQ=WEEKLY;BYDAY=MO',
   '2027-01-04', '2027-01-05', 1, '10000000-0000-0000-0000-00000000000a');
insert into public.task (parent_id, titolo, stato) values
  ('40000000-0000-0000-0000-000000000020', 'Controlla log', 'fatto'),
  ('40000000-0000-0000-0000-000000000020', 'Scarica archivio', 'da_fare');
do $$
declare
  v_nuova uuid;
begin
  v_nuova := public.completa_task('40000000-0000-0000-0000-000000000020', true,
    '{"data_pianificata":"2027-01-11","scadenza":"2027-01-12"}');
  if v_nuova is null then
    raise exception 'FALLITO: la ricorrente non ha creato la prossima occorrenza';
  end if;
  if not exists (select 1 from public.task where id = v_nuova and stato = 'da_fare'
      and data_pianificata = '2027-01-11' and scadenza = '2027-01-12' and priorita = 1
      and ricorrenza = 'FREQ=WEEKLY;BYDAY=MO' and cliente_id = '10000000-0000-0000-0000-00000000000a') then
    raise exception 'FALLITO: la prossima occorrenza non copia i dati';
  end if;
  if (select count(*) from public.task where parent_id = v_nuova and stato = 'da_fare') <> 2 then
    raise exception 'FALLITO: le sottotask non sono ricopiate come da fare';
  end if;
  if (select count(*) from public.task where parent_id = '40000000-0000-0000-0000-000000000020' and stato = 'fatto') <> 2 then
    raise exception 'FALLITO: le sottotask aperte non sono state completate';
  end if;
  if (select ricorrenza from public.task where id = '40000000-0000-0000-0000-000000000020') is not null then
    raise exception 'FALLITO: la ricorrenza deve passare alla nuova occorrenza';
  end if;
  -- Togliere e rimettere la spunta non crea doppioni.
  update public.task set stato = 'da_fare' where id = '40000000-0000-0000-0000-000000000020';
  if public.completa_task('40000000-0000-0000-0000-000000000020', false,
      '{"data_pianificata":"2027-01-11"}') is not null then
    raise exception 'FALLITO: ricompletare la task ha creato un doppione';
  end if;
end;
$$;

reset role;

-- ============================================================
-- 5. Budget: previsti idempotenti, rate, rinnovi e debiti.
-- ============================================================

set local role authenticated;
select public._test_come('00000000-0000-0000-0000-00000000000a');

-- I trigger hanno già creato i previsti del mese per i servizi (S1, S2, S3, S4
-- sono attivi e pagati da me) e per le rate in scadenza. Generare due volte
-- non crea doppioni.
do $$
declare
  v_mese date := public.primo_del_mese(public.oggi());
begin
  perform public.genera_previsti(v_mese);
  perform public.genera_previsti(v_mese);
  perform public.genera_previsti(public.oggi() + 40);
end;
$$;
select public._test_conta(
  $q$select 1 from public.movimenti where servizio_id = '20000000-0000-0000-0000-000000000001'$q$,
  1, 'owner: un solo previsto per S1');
select public._test_conta(
  $q$select 1 from public.movimenti where servizio_id = '20000000-0000-0000-0000-000000000001'
     and stato = 'previsto' and importo = 120 and periodo = public.primo_del_mese(public.oggi() + 3)
     and data = public.oggi() + 3$q$,
  1, 'owner: il previsto di S1 ha costo, data e periodo');
select public._test_conta(
  $q$select 1 from public.movimenti m join public.debiti_rate r on r.id = m.rata_id
     where r.debito_id = '60000000-0000-0000-0000-000000000001' and m.stato = 'previsto' and m.importo = 100$q$,
  1, 'owner: la rata del debito di lavoro ha il suo previsto');
-- Nel calendario la rata compare una volta sola.
select public._test_conta(
  $q$select 1 from public.v_calendario v where v.tipo = 'movimento'
     and v.id in (select id from public.movimenti where rata_id is not null)$q$,
  0, 'owner: le rate non compaiono due volte nel calendario');
select public._test_conta(
  $q$select 1 from public.v_calendario v where v.tipo = 'movimento'
     and v.id in (select id from public.movimenti where servizio_id is not null)$q$,
  0, 'owner: i previsti dei servizi non raddoppiano la scadenza nel calendario');

-- Disdetta: il previsto sparisce; riattivazione: torna.
update public.servizi set stato = 'disdetto' where id = '20000000-0000-0000-0000-000000000001';
select public._test_conta(
  $q$select 1 from public.movimenti where servizio_id = '20000000-0000-0000-0000-000000000001'$q$,
  0, 'owner: disdire elimina il previsto');
update public.servizi set stato = 'attivo' where id = '20000000-0000-0000-0000-000000000001';
select public._test_conta(
  $q$select 1 from public.movimenti where servizio_id = '20000000-0000-0000-0000-000000000001' and stato = 'previsto'$q$,
  1, 'owner: riattivare ricrea il previsto');
-- Se paga il cliente non c'è previsto; se cambia il costo il previsto si aggiorna.
update public.servizi set chi_paga = 'cliente' where id = '20000000-0000-0000-0000-000000000002';
select public._test_conta(
  $q$select 1 from public.movimenti where servizio_id = '20000000-0000-0000-0000-000000000002'$q$,
  0, 'owner: se paga il cliente niente previsto');
update public.servizi set chi_paga = 'io' where id = '20000000-0000-0000-0000-000000000002';
update public.servizi_economico set costo = 99 where servizio_id = '20000000-0000-0000-0000-000000000001';
select public._test_conta(
  $q$select 1 from public.movimenti where servizio_id = '20000000-0000-0000-0000-000000000001' and importo = 99$q$,
  1, 'owner: il previsto segue il costo');

-- Rinnovo: il previsto del periodo diventa pagato, senza aggiungerne un altro.
do $$
declare
  v_mov uuid;
begin
  perform public.rinnova_servizio('20000000-0000-0000-0000-000000000001', public.oggi(), 95);
  select movimento_id into v_mov from public.servizi_rinnovi
  where servizio_id = '20000000-0000-0000-0000-000000000001' order by created_at desc limit 1;
  if v_mov is null then
    raise exception 'FALLITO: il rinnovo non è collegato al movimento';
  end if;
  if not exists (select 1 from public.movimenti where id = v_mov and stato = 'pagato' and importo = 95
      and periodo = public.primo_del_mese(public.oggi() + 3) and data = public.oggi()) then
    raise exception 'FALLITO: il movimento del rinnovo non è pagato con importo e periodo giusti';
  end if;
  if (select count(*) from public.movimenti where servizio_id = '20000000-0000-0000-0000-000000000001'
      and periodo = public.primo_del_mese(public.oggi() + 3)) <> 1 then
    raise exception 'FALLITO: il rinnovo ha aggiunto un movimento invece di aggiornare il previsto';
  end if;
  -- Rinnovare di nuovo nello stesso periodo somma gli importi.
  update public.servizi set prossima_scadenza = public.oggi() + 3 where id = '20000000-0000-0000-0000-000000000001';
  perform public.rinnova_servizio('20000000-0000-0000-0000-000000000001', public.oggi(), 5);
  if (select importo from public.movimenti where id = v_mov) <> 100 then
    raise exception 'FALLITO: due rinnovi nello stesso periodo devono sommarsi';
  end if;
end;
$$;
-- Se paga il cliente, il rinnovo non crea movimenti.
update public.servizi set chi_paga = 'cliente' where id = '20000000-0000-0000-0000-000000000002';
do $$
begin
  perform public.rinnova_servizio('20000000-0000-0000-0000-000000000002', null, 10);
end;
$$;
select public._test_conta(
  $q$select 1 from public.movimenti where servizio_id = '20000000-0000-0000-0000-000000000002'$q$,
  0, 'owner: rinnovo pagato dal cliente senza movimento');

-- Rata: pagare crea il movimento pagato, ripagare è rifiutato, annullare torna previsto.
do $$
declare
  v_rata uuid := (select id from public.debiti_rate where debito_id = '60000000-0000-0000-0000-000000000001');
  v_mov uuid;
begin
  v_mov := public.paga_rata(v_rata, public.oggi(), 101, null);
  if not exists (select 1 from public.debiti_rate where id = v_rata and pagata and movimento_id = v_mov) then
    raise exception 'FALLITO: la rata non risulta pagata';
  end if;
  if not exists (select 1 from public.movimenti where id = v_mov and stato = 'pagato' and importo = 101 and rata_id = v_rata) then
    raise exception 'FALLITO: il movimento della rata non è pagato';
  end if;
  if (select count(*) from public.movimenti where rata_id = v_rata) <> 1 then
    raise exception 'FALLITO: pagare la rata ha creato un doppione';
  end if;
  begin
    perform public.paga_rata(v_rata, null, null, null);
    raise exception 'FALLITO: una rata pagata non si paga due volte';
  exception when others then
    if sqlerrm like 'FALLITO%' then raise; end if;
  end;
  perform public.annulla_pagamento_rata(v_rata);
  if not exists (select 1 from public.debiti_rate where id = v_rata and not pagata and movimento_id is null) then
    raise exception 'FALLITO: annullare il pagamento non ha riaperto la rata';
  end if;
  if not exists (select 1 from public.movimenti where rata_id = v_rata and stato = 'previsto' and importo = 100) then
    raise exception 'FALLITO: annullare il pagamento non ha riportato il movimento a previsto';
  end if;
end;
$$;

-- Debito con piano: le rate pagate restano, le altre seguono il piano nuovo;
-- non si elimina un debito con rate pagate.
do $$
declare
  v_id uuid;
  v_rata uuid;
begin
  v_id := public.salva_debito(null,
    '{"ambito":"personale","creditore":"Concessionaria","importo_totale":300,"tipo":"rateale","categoria_id":""}',
    format('[{"numero":1,"scadenza":"%s","importo":100},{"numero":2,"scadenza":"%s","importo":100},{"numero":3,"scadenza":"%s","importo":100}]',
      public.primo_del_mese(public.oggi()) + 27,
      (public.primo_del_mese(public.oggi()) + interval '1 month 5 days')::date,
      (public.primo_del_mese(public.oggi()) + interval '2 months 5 days')::date)::jsonb);
  if (select count(*) from public.debiti_rate where debito_id = v_id) <> 3 then
    raise exception 'FALLITO: il piano non ha 3 rate';
  end if;
  if (select count(*) from public.movimenti m join public.debiti_rate r on r.id = m.rata_id where r.debito_id = v_id) <> 2 then
    raise exception 'FALLITO: solo le rate del mese corrente e del successivo hanno il previsto';
  end if;
  select id into v_rata from public.debiti_rate where debito_id = v_id and numero = 1;
  perform public.paga_rata(v_rata, null, null, null);
  perform public.salva_debito(v_id,
    '{"ambito":"personale","creditore":"Concessionaria","importo_totale":300,"tipo":"rateale","categoria_id":""}',
    format('[{"numero":1,"scadenza":"%s","importo":1},{"numero":2,"scadenza":"%s","importo":150}]',
      public.primo_del_mese(public.oggi()) + 27,
      (public.primo_del_mese(public.oggi()) + interval '1 month 5 days')::date)::jsonb);
  if (select importo from public.debiti_rate where id = v_rata) <> 100 then
    raise exception 'FALLITO: una rata pagata non deve cambiare';
  end if;
  if (select count(*) from public.debiti_rate where debito_id = v_id) <> 2 then
    raise exception 'FALLITO: la rata tolta dal piano deve sparire';
  end if;
  if not exists (select 1 from public.movimenti m join public.debiti_rate r on r.id = m.rata_id
      where r.debito_id = v_id and r.numero = 2 and m.importo = 150 and m.stato = 'previsto') then
    raise exception 'FALLITO: il previsto della rata 2 non segue il piano';
  end if;
  begin
    perform public.elimina_debito(v_id);
    raise exception 'FALLITO: un debito con rate pagate non si elimina';
  exception when others then
    if sqlerrm like 'FALLITO%' then raise; end if;
  end;
end;
$$;

-- Salvadanai: previsti del piano idempotenti, versamenti, prelievi, eliminazione.
do $$
declare
  v_mese date := public.primo_del_mese(public.oggi());
  v_sv uuid := '70000000-0000-0000-0000-000000000001';
  v_prev uuid;
  r record;
begin
  perform public.genera_previsti(v_mese);
  perform public.genera_previsti(v_mese);
  if (select count(*) from public.movimenti where salvadanaio_id = v_sv and periodo = v_mese) <> 1 then
    raise exception 'FALLITO: il piano deve avere un solo previsto nel mese';
  end if;
  -- (il blocco precedente ha generato anche il mese dopo il successivo)
  if (select count(*) from public.movimenti where salvadanaio_id = v_sv and stato = 'previsto'
      and periodo in (v_mese, (v_mese + interval '1 month')::date)) <> 2 then
    raise exception 'FALLITO: il piano deve avere il previsto del mese corrente e del successivo';
  end if;
  if exists (select 1 from public.movimenti where salvadanaio_id = '70000000-0000-0000-0000-000000000003'
             and data < public.oggi() and public.oggi() > v_mese) then
    raise exception 'FALLITO: un piano nuovo non deve avere previsti prima della creazione';
  end if;
  select id into v_prev from public.movimenti where salvadanaio_id = v_sv and periodo = v_mese;
  if (select data from public.movimenti where id = v_prev) <> v_mese or (select importo from public.movimenti where id = v_prev) <> 50 then
    raise exception 'FALLITO: il previsto del piano ha data o importo sbagliati';
  end if;

  -- Il previsto pagato diventa un versamento; un versamento a mano si somma.
  update public.movimenti set stato = 'pagato' where id = v_prev;
  insert into public.movimenti (ambito, importo, stato, salvadanaio_id) values ('lavoro', 25, 'pagato', v_sv);
  select * into r from public.v_salvadanai where id = v_sv;
  if r.versato <> 75 or r.prelevato <> 1 or r.saldo <> 74 or r.valore_attuale <> 100 then
    raise exception 'FALLITO: totali del salvadanaio sbagliati (versato %, prelevato %, saldo %)', r.versato, r.prelevato, r.saldo;
  end if;

  -- Cambiare il piano aggiorna solo il previsto non pagato.
  update public.salvadanai set importo_mensile = 60 where id = v_sv;
  if (select importo from public.movimenti where id = v_prev) <> 50 then
    raise exception 'FALLITO: cambiare il piano non deve toccare il versamento già pagato';
  end if;
  if not exists (select 1 from public.movimenti where salvadanaio_id = v_sv and stato = 'previsto' and importo = 60) then
    raise exception 'FALLITO: il previsto del mese successivo non segue il piano';
  end if;

  -- Piano sospeso: i previsti non pagati spariscono, i versamenti restano.
  update public.salvadanai set piano_attivo = false where id = v_sv;
  if exists (select 1 from public.movimenti where salvadanaio_id = v_sv and stato = 'previsto') then
    raise exception 'FALLITO: sospendere il piano deve togliere i previsti';
  end if;
  perform public.genera_previsti(v_mese);
  if exists (select 1 from public.movimenti where salvadanaio_id = v_sv and stato = 'previsto') then
    raise exception 'FALLITO: genera_previsti non deve ricreare i previsti di un piano sospeso';
  end if;

  begin
    perform public.elimina_salvadanaio(v_sv);
    raise exception 'FALLITO: un salvadanaio con versamenti non si elimina';
  exception when others then
    if sqlerrm like 'FALLITO%' then raise; end if;
  end;
  delete from public.salvadanai_prelievi where salvadanaio_id = '70000000-0000-0000-0000-000000000002';
  perform public.elimina_salvadanaio('70000000-0000-0000-0000-000000000002');
  if exists (select 1 from public.salvadanai where id = '70000000-0000-0000-0000-000000000002') then
    raise exception 'FALLITO: un salvadanaio senza versamenti si elimina';
  end if;
end;
$$;

-- Backup: l'owner esporta tutto; il ripristino vale solo su un account vuoto.
do $$
declare
  v_backup jsonb;
begin
  v_backup := public.esporta_backup();
  if (v_backup ->> 'app') <> 'miloflow' or jsonb_array_length(v_backup -> 'clienti') < 2 then
    raise exception 'FALLITO: esporta_backup non contiene i clienti';
  end if;
  if jsonb_array_length(v_backup -> 'credenziali') < 2 or jsonb_array_length(v_backup -> 'movimenti') < 1 then
    raise exception 'FALLITO: esporta_backup non contiene credenziali e movimenti';
  end if;
  if jsonb_array_length(v_backup -> 'salvadanai') < 1 or jsonb_array_length(v_backup -> 'salvadanai_valori') < 1 then
    raise exception 'FALLITO: esporta_backup non contiene i salvadanai';
  end if;
  begin
    perform public.importa_backup(v_backup);
    raise exception 'FALLITO: il ripristino su un account con dati deve essere rifiutato';
  exception when others then
    if sqlerrm like 'FALLITO%' then raise; end if;
  end;
end;
$$;

-- Categorie: la sottocategoria prende l'ambito del padre e lo segue.
do $$
declare
  v_padre uuid;
  v_figlia uuid;
begin
  insert into public.categorie (nome, ambito) values ('Padre test', 'lavoro') returning id into v_padre;
  insert into public.categorie (nome, ambito, parent_id) values ('Figlia test', 'personale', v_padre) returning id into v_figlia;
  if (select ambito from public.categorie where id = v_figlia) <> 'lavoro' then
    raise exception 'FALLITO: la sottocategoria deve avere l''ambito del padre';
  end if;
  update public.categorie set ambito = 'entrambi' where id = v_padre;
  if (select ambito from public.categorie where id = v_figlia) <> 'entrambi' then
    raise exception 'FALLITO: cambiare l''ambito del padre deve propagarsi';
  end if;
  perform public.riordina_categorie(v_padre, array[v_figlia]);
  if (select ordine from public.categorie where id = v_figlia) <> 10 then
    raise exception 'FALLITO: riordina_categorie non aggiorna l''ordine';
  end if;
end;
$$;

reset role;

select 'TUTTI I TEST DELLE POLICY SUPERATI' as esito;

rollback;
