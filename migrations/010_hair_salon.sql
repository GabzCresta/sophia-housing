-- =============================================================================
-- 010 · Cabeleireiro (seção nova do quadro da vida)
-- =============================================================================
-- Adiciona a categoria hair_salon ao enum de places — o router descobre
-- (hair_salon + barber_shop no Google) e a seção lista com tempos/nota/link.

alter type place_category add value if not exists 'hair_salon';
