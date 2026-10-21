-- =============================================================================
-- 009 · Decisão à distância (o Gabriel decide do Brasil, sem visitar)
-- =============================================================================
-- 1) O funil não tem visita: 'visitando' vira 'analisando' — o estágio real é
--    juntar informação por foto, conversa com o landlord e reviews do Google.
-- 2) charges_include: o que as charges cobrem (agua, luz, aquecimento, internet).
--    Na França, électricité fora das charges é custo escondido de ~€40-60/mês.
-- 3) contact_info: contato do anúncio (landlord/agência) — quem decide de longe
--    depende desse canal.
-- =============================================================================

-- 1) rename idempotente: só se 'visitando' ainda existir no enum
do $$ begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'apartment_status' and e.enumlabel = 'visitando'
  ) then
    alter type apartment_status rename value 'visitando' to 'analisando';
  end if;
end $$;

-- 2) e 3) novos campos da ficha
alter table apartments add column if not exists charges_include text[];
alter table apartments add column if not exists contact_info text;

comment on column apartments.charges_include is 'o que as charges cobrem: agua, luz, aquecimento, internet';
comment on column apartments.contact_info is 'contato do anúncio (landlord/agência): nome, telefone, e-mail';
