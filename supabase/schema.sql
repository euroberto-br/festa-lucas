-- ============================================================
-- FESTA LUCAS NERY (7 ANOS — TEMA MUSSA) · SUPABASE POSTGRESQL
-- Cole e execute este script uma vez no SQL Editor do Supabase.
-- ============================================================

-- 1. Cápsula do Tempo (mensagens seladas — só visíveis no Dashboard do Supabase)
create table if not exists public.capsula_mensagens (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  nome text not null check (char_length(trim(nome)) between 1 and 80),
  relacao text not null default '' check (char_length(relacao) <= 80),
  tipo text not null default '🎤 Rima pro Lucas' check (char_length(tipo) <= 40),
  mensagem text not null check (char_length(trim(mensagem)) between 1 and 4000)
);

-- 2. Ranking da Arena de Jogos (placares dos desafios de 30s)
create table if not exists public.ranking_placares (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  nome text not null check (char_length(trim(nome)) between 1 and 40),
  nome_normalizado text generated always as (lower(trim(nome))) stored,
  jogo text not null check (jogo in ('runner', 'sonic', 'flappy', 'ritmo', 'pacman')),
  pontos integer not null check (pontos between 1 and 2000),
  detalhe text not null default '30s' check (char_length(detalhe) <= 20),
  aparelho text not null default '' check (char_length(aparelho) <= 32)
);

create index if not exists idx_ranking_jogo_pontos
  on public.ranking_placares (jogo, pontos desc);

create index if not exists idx_ranking_pessoa_jogo
  on public.ranking_placares (nome_normalizado, jogo, pontos desc);

-- View com o melhor placar de cada pessoa em cada jogo
create or replace view public.ranking_melhores as
select distinct on (nome_normalizado, jogo)
  nome,
  nome_normalizado,
  jogo,
  pontos,
  detalhe,
  criado_em
from public.ranking_placares
order by nome_normalizado, jogo, pontos desc, criado_em asc;

-- 3. Estatística de uso do Estúdio IA ("Vire do Mussaverso!")
create table if not exists public.ia_geracoes (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  status text not null default 'ok' check (char_length(status) <= 30),
  aparelho text not null default '' check (char_length(aparelho) <= 32)
);

-- 4. Confirmação de Presença (RSVP — aberto até 09/12/2026 às 23:00 BRT)
create table if not exists public.presenca_confirmacoes (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  nome text not null check (char_length(trim(nome)) between 1 and 80),
  acompanhantes jsonb not null default '[]'::jsonb,
  acompanhantes_texto text not null default '',
  total_adultos integer not null default 1 check (total_adultos between 0 and 20),
  total_criancas integer not null default 0 check (total_criancas between 0 and 20),
  total_pessoas integer not null default 1 check (total_pessoas between 1 and 25),
  observacao text not null default '' check (char_length(observacao) <= 400)
);

-- ============================================================
-- SEGURANÇA (Fail-Closed): RLS ativado sem políticas públicas!
-- Somente as Serverless Functions da Vercel (via service_role)
-- conseguem ler/gravar. Ninguém lê os dados pelo navegador.
-- ============================================================
alter table public.capsula_mensagens enable row level security;
alter table public.ranking_placares enable row level security;
alter table public.ia_geracoes enable row level security;
alter table public.presenca_confirmacoes enable row level security;
