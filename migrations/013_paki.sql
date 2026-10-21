-- =============================================================================
-- 013 · Paki (mercearias de bairro) — seção nova do quadro da vida
-- =============================================================================
-- "Paki" = a lojinha de conveniência independente (épicerie, night shop, alimentation
-- genérica) — a que o matchChain NÃO reconhece como rede. Separa-se do Supermercado,
-- que é a compra grande (rede conhecida OU type supermarket do Google). Só lista, sem
-- seleção nem budget: importa a proximidade, não o custo.
alter type place_category add value if not exists 'paki';

-- Types descritivos de loja especializada mostrados na seção Supermercado
-- (Picard = congelados, Naturalia = bio). Somam-se aos já existentes
-- hipermercado/supermercado/mercearia/discount.
alter type market_type add value if not exists 'congelados';
alter type market_type add value if not exists 'bio';
