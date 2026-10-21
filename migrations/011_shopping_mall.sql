-- =============================================================================
-- 011 · Shopping (seção nova do quadro da vida)
-- =============================================================================
-- Categoria shopping_mall no enum de places — lista + budget, sem seleção.

alter type place_category add value if not exists 'shopping_mall';
