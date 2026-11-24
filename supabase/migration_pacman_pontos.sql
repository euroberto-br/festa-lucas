-- ============================================================
-- MIGRAÇÃO: Suporte a Pac-Man e Pontuações Ampliadas no Ranking
-- Execute no SQL Editor do Supabase (projeto eiypwcbmherpulvaycbs)
-- ============================================================

-- 1. Remove constraints legadas
ALTER TABLE public.ranking_placares 
  DROP CONSTRAINT IF EXISTS ranking_placares_jogo_check;

ALTER TABLE public.ranking_placares 
  DROP CONSTRAINT IF EXISTS ranking_placares_pontos_check;

-- 2. Recria com suporte a 'pacman' e limite de até 2000 pontos
ALTER TABLE public.ranking_placares 
  ADD CONSTRAINT ranking_placares_jogo_check 
  CHECK (jogo IN ('runner', 'sonic', 'flappy', 'ritmo', 'pacman'));

ALTER TABLE public.ranking_placares 
  ADD CONSTRAINT ranking_placares_pontos_check 
  CHECK (pontos BETWEEN 1 AND 2000);

-- 3. Atualiza a view ranking_melhores para garantir integridade
CREATE OR REPLACE VIEW public.ranking_melhores AS
SELECT DISTINCT ON (nome_normalizado, jogo)
  nome,
  nome_normalizado,
  jogo,
  pontos,
  detalhe,
  criado_em
FROM public.ranking_placares
ORDER BY nome_normalizado, jogo, pontos DESC, criado_em ASC;
