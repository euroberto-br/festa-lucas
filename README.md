<div align="center">

# 🎤 Lucas Nery faz 7! — Festa Tema Mussa 🔥

**Convite-cardápio interativo + Arena de Jogos 60 FPS + galeria + cápsula do tempo + avatar IA para a festa de 7 anos do Lucas Nery · 12/12/2026 às 13:00**

*Pano na cabeça, bonézinho pra trás, óculos escuro — é o Mussa Style!* 🎶

**Zero frameworks · Zero build · Vercel + Supabase PostgreSQL (100% gratuito)**

</div>

---

## 📖 Páginas do Projeto

| Página | O que faz |
|---|---|
| 🍽️ [`index.html`](index.html) | Cardápio-show interativo (`ROUND 01` a `ROUND 13`, 69 itens), caça aos 7 microfones dourados, 7 velas no Bolo Belga e batida *boom-bap* em Web Audio API |
| 🎮 [`jogos.html`](jogos.html) | **Arena de Jogos (60 FPS)** — 4 jogos dinâmicos em `<canvas>`: *Mussa Surf* (estilo Subway Surfers), *Lucas Dash* (estilo Sonic com pulo duplo), *Voo do Mic* (estilo Jetpack/Flappy) e *Batalha Hero* (estilo Piano Tiles com 4 músicas reais), com desafio 30s, Ranking da Tropa e **Passaporte VIP / Placa de 1 Milhão** |
| 📺 [`ranking.html`](ranking.html) | **Telão do Ranking** — top 10 gigante com rodízio automático a cada 10s para TV/tablet |
| 📸 [`fotos.html`](fotos.html) | **Fotos dos Inscritos** — galeria colaborativa via Cloudinary (`festa_lucas`) com 5 molduras temáticas e marca d'água automática |
| 📼 [`capsula.html`](capsula.html) | **Mande sua Rima** — cápsula do tempo selada no **Supabase PostgreSQL** (`capsula_mensagens`) |
| 🎨 [`mussa.html`](mussa.html) | **Vire do Mussaverso!** — selfie → desenho cartoon estilo Mussa com IA (Azure `gpt-image-2` via `/api/mussa`) + mural opcional |

---

## ☁️ Deploy Gratuito: Vercel (`festalucas.roberto.inf.br`) + Supabase PostgreSQL

### Passo 1 — Criar o banco no Supabase (Grátis)
1. Acesse [supabase.com](https://supabase.com), crie um projeto novo (região `South America (São Paulo)`).
2. Abra o **SQL Editor**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
   - Cria `capsula_mensagens`, `ranking_placares`, a view `ranking_melhores` e `ia_geracoes` com **RLS ativado (zero acesso público)**.
3. Em **Project Settings → API**, anote:
   - `Project URL` → será `SUPABASE_URL`
   - `service_role` secret → será `SUPABASE_SERVICE_ROLE_KEY`

### Passo 2 — Publicar na Vercel + Subdomínio `festalucas.roberto.inf.br`
1. Suba este repositório no GitHub e importe na **Vercel** (*Add New → Project*):
   - **Framework Preset**: `Other`
   - **Build Command**: *(vazio)*
   - **Output Directory**: `.`
2. Em **Project Settings → Environment Variables**, adicione:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AZURE_API_KEY` *(opcional, apenas para o gerador de avatar em `mussa.html`)*
3. Em **Project Settings → Domains → Add Domain**, digite **`festalucas.roberto.inf.br`**:
   - Com o domínio `roberto.inf.br` já gerenciado pela Vercel, o DNS e o certificado HTTPS são configurados automaticamente.
   - *(Se o DNS for externo, crie um registro `CNAME` apontando `festalucas` → `cname.vercel-dns.com`.)*
4. Teste os endpoints após o deploy:
   - `https://festalucas.roberto.inf.br/api/capsula`
   - `https://festalucas.roberto.inf.br/api/ranking`
   - `https://festalucas.roberto.inf.br/api/mussa`

### Passo 3 — Cloudinary (`fotos.html` e mural da `mussa.html`)
- Cloud name já configurado: `znbneca7`
- Criar **2 upload presets unsigned**:
  - `festa_lucas` aplicando a tag `festa-lucas`
  - `festa_lucas_ia` aplicando a tag `festa-lucas-ia`
- Manter **Resource list** habilitado em *Cloudinary → Settings → Security*.

> **Dica (Supabase Free Tier):** bancos gratuitos pausam após 7 dias sem acesso. Abra o painel do Supabase (ou acesse `/api/ranking`) alguns dias antes de **12/12/2026** para garantir o banco ativo no dia da festa.

---

## 🚀 Rodando localmente

- **Somente páginas estáticas**: `python -m http.server 8000 --bind 127.0.0.1` → `http://127.0.0.1:8000`
- **Com as rotas `/api/*` locais**: `npx vercel dev` (com `.env.local` fora do Git)
