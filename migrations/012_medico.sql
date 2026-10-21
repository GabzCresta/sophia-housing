-- =============================================================================
-- 012 · Médico (última seção do quadro da vida)
-- =============================================================================
-- Hospitais e farmácias no enum de places — lista com tempos, gasolina por ida
-- e budget de saúde.

alter type place_category add value if not exists 'hospital';
alter type place_category add value if not exists 'pharmacy';
