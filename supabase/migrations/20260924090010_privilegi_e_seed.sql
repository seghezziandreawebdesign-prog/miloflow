-- Privilegi espliciti e dati di riferimento iniziali.
-- Il seed sta in una migration (e non in seed.sql) perché deve arrivare anche in produzione.

-- anon non tocca nulla: senza login non si legge né si scrive.
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Tipi di servizio. icona = nome di un'icona lucide.
insert into public.tipi_servizio (nome, icona, preavviso_default) values
  ('Dominio', 'globe', 30),
  ('Hosting', 'server', 30),
  ('Licenza plugin/tema', 'puzzle', 30),
  ('SaaS', 'cloud', 14),
  ('Abbonamento', 'repeat', 7),
  ('Assicurazione', 'shield', 30),
  ('Bollo/Tassa', 'landmark', 30),
  ('Altro', 'ellipsis', 14);

-- Categorie di esempio, modificabili dalle Impostazioni.
with padri as (
  insert into public.categorie (nome, ambito, colore, icona, ordine) values
    ('Software', 'lavoro', '#2563eb', 'app-window', 10),
    ('Attrezzatura', 'lavoro', '#0891b2', 'laptop', 20),
    ('Formazione', 'lavoro', '#7c3aed', 'graduation-cap', 30),
    ('Commercialista', 'lavoro', '#475569', 'briefcase', 40),
    ('Casa', 'personale', '#ea580c', 'house', 110),
    ('Spesa', 'personale', '#16a34a', 'shopping-cart', 120),
    ('Trasporti', 'personale', '#ca8a04', 'car', 130),
    ('Salute', 'personale', '#dc2626', 'heart-pulse', 140),
    ('Svago', 'personale', '#db2777', 'party-popper', 150),
    ('Abbonamenti', 'personale', '#9333ea', 'repeat', 160)
  returning id, nome, ambito, colore
)
insert into public.categorie (nome, parent_id, ambito, colore, icona, ordine)
select figlie.nome, padri.id, padri.ambito, padri.colore, figlie.icona, figlie.ordine
from padri
join (values
  ('Software', 'Hosting', 'server', 1),
  ('Software', 'Domini', 'globe', 2),
  ('Software', 'Licenze', 'key-round', 3),
  ('Software', 'SaaS', 'cloud', 4),
  ('Casa', 'Affitto', 'key', 1),
  ('Casa', 'Bollette', 'zap', 2)
) as figlie (padre, nome, icona, ordine) on figlie.padre = padri.nome;
