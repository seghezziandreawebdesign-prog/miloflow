-- Tipi enumerati e funzioni di servizio condivise da tutte le tabelle.

create type public.ambito as enum ('lavoro', 'personale');
create type public.ruolo_utente as enum ('owner', 'collaboratore');
create type public.sezione_permesso as enum ('clienti', 'servizi', 'credenziali', 'calendario', 'task', 'budget');
create type public.livello_permesso as enum ('lettura', 'scrittura');

create type public.tipo_cliente as enum ('azienda', 'privato');
create type public.stato_cliente as enum ('attivo', 'potenziale', 'in_pausa', 'archiviato');

create type public.frequenza_servizio as enum ('mensile', 'trimestrale', 'semestrale', 'annuale', 'biennale', 'una_tantum');
create type public.chi_paga as enum ('io', 'cliente');
create type public.stato_servizio as enum ('attivo', 'disdetto', 'archiviato');
create type public.tipo_credenziale as enum ('link_password_manager', 'cifrata');

create type public.stato_progetto as enum ('attivo', 'in_pausa', 'completato', 'archiviato');
create type public.stato_task as enum ('da_fare', 'in_corso', 'in_attesa', 'fatto');

create type public.ambito_categoria as enum ('lavoro', 'personale', 'entrambi');
create type public.stato_movimento as enum ('previsto', 'pagato');
create type public.tipo_debito as enum ('rateale', 'unica_soluzione', 'prestito_privato');

-- Aggiorna updated_at a ogni modifica.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Converte un testo in uuid senza sollevare errori: serve alle policy di Storage,
-- dove il primo segmento del percorso può essere qualsiasi cosa.
create function public.try_uuid(valore text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return valore::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

-- Data odierna nel fuso dell'app, usata da viste e funzioni.
create function public.oggi()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Rome')::date;
$$;
