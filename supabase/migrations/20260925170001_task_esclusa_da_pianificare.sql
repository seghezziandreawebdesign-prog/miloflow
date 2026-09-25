-- Spunta "non pianificare" nella lista Da pianificare del calendario:
-- la task esce dalla lista ma resta ovunque altrove.
alter table public.task add column esclusa_da_pianificare boolean not null default false;
